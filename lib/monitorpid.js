/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var fs           = require('fs');
var util         = require('util');
var spawn        = require('child_process').spawn;
var exec         = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;
var running      = require('is-running'); // to check if a pid is running

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
      var pidstat = exec('pidstat -h -d -u -r -p ' + pids.join(',') + ' 1 1',
        function (err, stdout, stderr) {
          if (err) return self.emit('error', err);

          var record = {
            parent_pid: self.pid,
            active_pids: [],
            nb_pids: pids.length,
            cpu: 0,
            time: 0,
            mem_vsz: 0,
            mem_rss: 0,
            disk_read: 0,
            disk_write: 0
          };

          // parse the pidstat result
          stdout.split('\n').forEach(function (line) {
            // cleanup the line
            line = line.trim();
            if (line === '') {
              return;
            }
            
            // fill the record
            if (line.match(/^[0-9]/)) {
              var fields = line.split(/ +/);
              record.time        = parseInt(fields[0], 10) - self.startTimestamp;
              record.active_pids.push(parseInt(fields[1], 10));
              record.cpu        += parseFloat(fields[5].replace(',', '.'));
              record.mem_vsz    += parseInt(fields[9], 10) / 1024 / 1024;
              record.mem_rss    += parseInt(fields[10], 10) / 1024 / 1024;
              record.disk_read  += parseFloat(fields[12].replace(',', '.') * 1000);
              record.disk_write += parseFloat(fields[13].replace(',', '.') * 1000);
            }
          });

          // record time taker by this monitoring step
          record.monit_time = new Date() - hitStartTime;

          self.emit('monitored', pid, record);
          cb();

        }
      );


    });


  };

  self.getPidTree = function (pid, cb) {
    var pids = [];
    exec('pstree -p ' + pid, function (err, stdout, stderr) {
      stdout.split(/(\([0-9]+\))/).forEach(function (elt) {
        if (elt.match(/\([0-9]+\)/)) {
          pids.push(elt.slice(1, -1));
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
