/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var fs           = require('fs');
var util         = require('util');
var spawn        = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;

// Constructor
var MonitorPid = function (pid, options) {
  var self = this;
  
  self.pid = pid;

  self.options = mixin({
    // recursive: true,
    // watchDirectory: false
  }, options);

  // ...
};

MonitorPid.prototype = Object.create(EventEmitter.prototype);

MonitorPid.prototype.start = function () {
  // ...
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
