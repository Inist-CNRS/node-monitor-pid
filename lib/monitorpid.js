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
  
  self.pid = pid;

  self.options = mixin({
    period: 5000, // by default monitor each 5 seconds
  }, options);

  // ...
};

MonitorPid.prototype = Object.create(EventEmitter.prototype);

MonitorPid.prototype.start = function () {
  var self = this;

  // first of all, check that the pid exists
  running(self.pid, function (err, live) {
    if (err) return self.emit('error', err);
    if (!live) {
      self.emit('error', new Error('Cannot monitor pid ' + self.pid + ' because it is not running'));
    } else {
      // test each period of time if pid is running
      self.loopHandler = setInterval(function () {
        running(self.pid, function (err, live) {
          if (err) return self.emit('error', err);
          if (!live) {
            // process is not alive anymore, tell it !
            self.emit('end', self.pid);
            // and stop monitoring !
            clearInterval(self.loopHandler);
            self.loopHandler = undefined;
          }
        });
      }, self.options.period);
    }
  });


};
MonitorPid.prototype.stop = function () {
  // ...
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
