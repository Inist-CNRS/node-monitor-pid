/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var fs           = require('fs');
var util         = require('util');
var spawn        = require('child_process').spawn;
var Lazy         = require('lazy');
var exec         = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;
var running      = require('is-running'); // to check if a pid is running
var moment       = require('moment');
var semver       = require('semver');

// Constructor
var MonitorPid = function (pid, options) {
  var self = this;
  
  self.pid            = pid;
  self.stopped        = true;
  self.startTimestamp = undefined;

  self.options = mixin({
    period: 5000, // by default monitor each 5 seconds
    fakePidStat: false, // used to use fake data instead of a real pidstat output
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
    self.hitStartTime = new Date();

    if (self.options.fakePidStat) {
      parsePidStatStdout(
        fs.readFileSync(__dirname + '/../test/big-pidstat-pids.txt', 'utf8').trim().split(','),
        fs.createReadStream(__dirname + '/../test/big-pidstat-stdout.txt'),
        cb
      );
    } else {
      self.getPidTree(self.pid, function (err, pids) {
        // -d for disk stats
        // -r for memory stats
        // -u for cpu stats
        // -h for all on one line (but do not display average)
        // 1 1 means check each second during 1 second
        // LANG=C to be sure stdout will have english strings
        var pidstat = spawn('pidstat',
                            [ '-h', '-d', '-u', '-r', '-p', pids.join(','), '1', '1' ],
                            { env: mixin(process.env, { 'LANG': 'C' }) });

        // capture stderr
        var pidstatStderr = '';
        new Lazy(pidstat.stderr).lines.map(String).join(function (stderrArray) {
          pidstatStderr = stderrArray.join('\n');
        });

        // capture possible errors
        pidstat.on('close', function (code) {
          if (code != 0) {
            var err = new Error(pidstatStderr);
            return self.emit('error', err);
          }
        });

        // parse stdout stream
        parsePidStatStdout(pids, pidstat.stdout, cb);
      });
    }


  };

  function parsePidStatStdout(pids, stdout, cb) {
    // test if stdout is readable
    if (!stdout || !stdout.readable) {
      self.emit('error', new Error('Cannot parse pidstat stdout because it is not a readable stream'));
      cb();
    }

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
      monit_time: 0, // valuated in the on end event
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

    // parse the pidstat result as a stream line by line
    var fieldsName = [];
    var fieldsIdx  = [];  
    var lazy = new Lazy(stdout);
    lazy.lines.map(String).forEach(function (line) {
      // cleanup the line
      line = line.trim();
      if (line === '') {
        return;
      }
      // filter unwanted lines
      // ex: Linux 3.10-3-amd64  ...
      if (!new RegExp('^([0-9]|#)').test(line)) {
        return;
      }

      // detect fields names and field order
      if (new RegExp('^#').test(line)) {
        line = line.slice(1).trim(); // remove '#'
        line.split(new RegExp('[ |\t]+')).forEach(function (field, fieldIdx) {
          fieldsName.push(field);
          if (field != 'Time' && field != 'PID' && field != 'CPU' && field != 'Command') {
            fieldsIdx.push(fieldIdx); // list kept fields indexes
          }
        });
      }

      // fill the record
      if (line.match(/^[0-9]/)) {
        line.split(new RegExp('[ |\t]+')).forEach(function (fieldValue, fieldIdx) {
          // skip fields
          if (fieldsIdx.indexOf(fieldIdx) === -1) {
            return;
          }
          // get,format and store the field value
          if (record[fieldsName[fieldIdx]] === undefined) {
            // if undefined (should not occur, initialize with zero value)
            record[fieldsName[fieldIdx]] = 0;
          }
          record[fieldsName[fieldIdx]] += parseFloat(fieldValue.replace(',', '.'));
        });
      }
    });
  
    // parsing of the whole stdout stream is finished when the 'end' event is received
    lazy.on('end', function () {
      // record time taken by this monitoring step
      record.monit_time = new Date() - self.hitStartTime,

      // parsing is finished, send the result as an event
      self.emit('monitored', self.pid, record);
  
      cb();      
    });
  }

  self.getPidTree = function (pid, cb) {
    var pids = [];
    exec('pstree -l -p ' + pid, function (err, stdout, stderr) {
      // ignore threads
      var pstreeSplited = stdout.match(new RegExp('[^}]\\([0-9]+\\)', 'gm'));
      if (pstreeSplited) {
        pstreeSplited.forEach(function (elt) {
          elt = elt.slice(2, -1);
          if (elt.match(/^[0-9]+$/)) {
            pids.push(parseInt(elt, 10));
          }
        });
      }
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
  
  // first of all check the pidstat version
  checkPidstatVersion(function (err, version) {
    if (err) return self.emit('error', err);
    // then check the pstree command existence
    checkPstreeExistence(function (err) {
      if (err) return self.emit('error', err);
      // then, check that the wanted monitored pid exists
      running(self.pid, function (err, live) {
        if (err) return self.emit('error', err);
        if (!live) {
          self.emit('error', new Error('Cannot monitor pid ' + self.pid + ' because it is not running'));
        } else {
          // the pid is running, monitoring can start
          self.startMonitoringLoop();
        }
      });
    });
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

/**
 * Check pidstat is in the PATH and check its version
 */
function checkPidstatVersion(cb) {
  var p = exec('pidstat -V', function (err, stdout, stderr) {
    // check the command is installed
    if (err) {
      return cb(new Error('pidstat not found (please install sysstat software)'));      
    }
    // check it returns right return code (0)
    if (p.exitCode != 0) {
      return cb(new Error('pidstat -V should exit with code 0 (please upgrade sysstat software)'));
    } 
    // check the version is >= 10.x
    var v = stdout.split('\n')[0].replace('sysstat version', '').trim();
    if (!semver.satisfies(v, '>= 10.0.0')) {
      return cb(new Error('pidstat version is too low (' + v + '), it should be >= 10.x (please upgrade sysstat software)'));
    }
    return cb(null, v);
  });
}

/**
 * Check pstree is in the PATH
 */
function checkPstreeExistence(cb) {
  var p = exec('pstree -V', function (err, stdout, stderr) {
    // check the command is installed
    if (err) {
      return cb(new Error('pstree not found (please install psmisc software)'));      
    }
    // check it returns right return code (0)
    if (p.exitCode != 0) {
      return cb(new Error('pidtree -V should exit with code 0 (please check your psmisc software)'));
    } 
    return cb(null);
  });
}
