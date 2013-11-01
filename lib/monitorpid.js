/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var fs           = require('fs');
var util         = require('util');
var spawn        = require('child_process').spawn;
var exec         = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;
var running      = require('is-running'); // to check if a pid is running
var moment       = require('moment');

// Constructor
var MonitorPid = function (pid, options) {
  var self = this;
  
  self.pid            = pid;
  self.stopped        = true;
  self.startTimestamp = undefined;

  self.options = mixin({
    period: 5000, // by default monitor each 5 seconds
  }, options);

  /**
   * The monitoring loop
   */
  self.startMonitoringLoop = function () {
    if (self.loopHandler) return;
    // test each period of time if pid is running
    function doOneLoop() {
      var loopStartTime = new Date();
      running(self.pid, function (err, live) {
        if (err) return self.emit('error', err);
        if (!live) {
          // process is not alive anymore,
          // so stop monitoring !
          self.stop();
        } else {
          // if stopped flag is true, do not continue
          if (self.stopped) return;
          // process is alive, monitor it !
          self.doMonitoring(function () {
            // calculate how much miliseconds to wait before next loop
            // (min time to wait is 1s)
            var monitoringTime     = new Date() - loopStartTime;
            var timeBeforeNextLoop = self.options.period - monitoringTime;
            timeBeforeNextLoop = timeBeforeNextLoop <= 0 ? 10 : timeBeforeNextLoop;
            // when this monitoring loop is finished run the next loop
            setTimeout(doOneLoop, timeBeforeNextLoop);
          });
        }
      });
    };
    doOneLoop();
  };

  /**
   * run a one shot monitoring
   */
  self.doMonitoring = function (cb) {
    var hitStartTime = new Date();

    self.getPidTree(self.pid, function (err, pids) {

      // -d for disk stats
      // -r for memory stats
      // -u for cpu stats
      // -h for all on one line (but do not display average)
      // 1 1 means check each second during 1 second
      // LANG=C to be sure stdout will have english strings
      var pidstat = exec('LANG=C pidstat -d -u -r -p ' + pids.join(',') + ' 1 1',
        function (err, stdout, stderr) {
          if (err) return self.emit('error', err);

          var record = {
            // date of the probing (Excel/Libreofice formated)
            date: moment().format("YYYY/MM/DD H:mm:ss"),
            // elapsed time since monitoring was started
            time: Math.floor(new Date().getTime() / 1000) - self.startTimestamp,
            // monitored pid
            parent_pid: self.pid,
            // monitored pid and all its sons
            pids: pids,
            // number of pids (parent and all its sons)
            nb_pids: pids.length,
            // list just active pids (sublist of "pids")
            active_pids: [],
            // record time taken by this monitoring step
            monit_time: new Date() - hitStartTime,
            // intialize CPU fields
            '%usr' : 0,
            '%system' : 0,
            '%guest' : 0,
            '%CPU' : 0,
            // intialize memory fields
            'minflt/s' : 0,
            'majflt/s' : 0,
            'VSZ' : 0,
            'RSS' : 0,
            '%MEM' : 0,
            // intialize disk fields
            'kB_rd/s' : 0,
            'kB_wr/s' : 0,
            'kB_ccwr/s' : 0,
          };

          // parse the pidstat result
          stdout.split(new RegExp('\\n\\n[0-9]')).forEach(function (block) {
            // Skipped line example:
            // Linux 3.10-3-amd64  ...
            if (!new RegExp('^[0-9:]').test(block)) {
              return;
            }
            // Block example:
            // 21:22:17          PID  minflt/s  majflt/s     VSZ    RSS   %MEM  Command
            // 21:22:18        10189      0.00      0.00  461108  53528   0.66  sublime_text
            var fieldsName = [];
            var fieldsIdx  = [];
            block.split('\n').forEach(function (line, lineIdx) {
              // Skipped line example:
              // Average:       10200 ...
              if (!new RegExp('^[0-9:]').test(line)) {
                return;
              }
              line.split(new RegExp('[ |\t]+')).forEach(function (field, fieldIdx) {
                field = field.trim();
                if (lineIdx == 0) {
                  // First line example:
                  // 21:22:17  PID  minflt/s  majflt/s     VSZ    RSS   %MEM  Command
                  fieldsName.push(field);
                  // Skipped fieldsName:
                  // 21:22:17
                  // PID
                  // Command
                  if (!new RegExp('^([0-9:]+|Command|PID|CPU)$').test(field)) {
                    fieldsIdx.push(fieldIdx); // list kept fields indexes
                  }
                } else {
                  // Skip few fields. Example:
                  // 21:22:18 (first column)
                  // sublime_text ('Command' column)
                  if (fieldsIdx.indexOf(fieldIdx) === -1) {
                    return;
                  }
                  // Line example with numbers:
                  // 10189      0.00      0.00  461108  53528   0.66  sublime_text                  
                  if (record[fieldsName[fieldIdx]] === undefined) {
                    // if undefined (should not occur, initialize with zero value)
                    record[fieldsName[fieldIdx]] = 0;
                  }
                  record[fieldsName[fieldIdx]] += parseFloat(field.replace(',', '.') * 1000);
                }
              });
            });
          });

          self.emit('monitored', pid, record);
          cb();
        }
      );


    });


  };

  self.getPidTree = function (pid, cb) {
    var pids = [];
    exec('pstree -l -p ' + pid, function (err, stdout, stderr) {
      stdout.split(/(\([0-9]+\))/).forEach(function (elt) {
        if (elt.match(/\([0-9]+\)/)) {
          pids.push(parseInt(elt.slice(1, -1), 10));
        }
      });
      cb(err, pids);
    });
  }

};

MonitorPid.prototype = Object.create(EventEmitter.prototype);

MonitorPid.prototype.start = function () {
  var self = this;
  
  // monitoring cannot be started cause it is already started
  if (!self.stopped) {
    return;
  }
  self.stopped = false;

  self.startTimestamp = Math.floor(new Date().getTime() / 1000);

  // first of all, check that the pid exists
  running(self.pid, function (err, live) {
    if (err) return self.emit('error', err);
    if (!live) {
      self.emit('error', new Error('Cannot monitor pid ' + self.pid + ' because it is not running'));
    } else {
      // the pid is running, monitoring can start
      self.startMonitoringLoop();
    }
  });


};
MonitorPid.prototype.stop = function () {
  var self = this;
  // tells the monitoring is stopped
  self.emit('end', self.pid);
  // and stop monitoring loop
  self.stopped = true;
};

module.exports = MonitorPid;

/**
 *  Mixing object properties. 
 */
var mixin = function() {
  var mix = {}; 
  [].forEach.call(arguments, function(arg) { 
    for (var name in arg) {
      if (arg.hasOwnProperty(name)) {
        mix[name] = arg[name];
      }
    }
  });
  return mix;
};
