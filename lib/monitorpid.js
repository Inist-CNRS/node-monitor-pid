/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var fs           = require('fs');
var util         = require('util');
var spawn        = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;
var running      = require('is-running'); // to check if a pid is running

// Constructor
var MonitorPid = function (pid, options) {
  var self = this;
  
  self.pid         = pid;
  self.stopped     = true;

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
            // (min time to wait is 10ms)
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
    self.emit('monitored', pid, { pid: self.pid });
    cb();
  };

};

MonitorPid.prototype = Object.create(EventEmitter.prototype);

MonitorPid.prototype.start = function () {
  var self = this;
  
  // monitoring cannot be started cause it is already started
  if (!self.stopped) {
    return;
  }

  // first of all, check that the pid exists
  running(self.pid, function (err, live) {
    if (err) return self.emit('error', err);
    if (!live) {
      self.emit('error', new Error('Cannot monitor pid ' + self.pid + ' because it is not running'));
    } else {
      // the pid is running, monitoring can start
      self.stopped = false;
      self.startMonitoringLoop();
    }
  });


};
MonitorPid.prototype.stop = function () {
  var self = this;
  // tells the monitoring is stopped
  self.emit('end', self.pid);
  // and stop monitoring loop
  clearInterval(self.loopHandler);
  self.loopHandler = undefined;
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
