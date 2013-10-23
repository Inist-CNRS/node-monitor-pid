node-monitor-pid
================

Monitors a pid and all its sons.

[![Build Status](https://travis-ci.org/kerphi/node-monitor-pid.png?branch=master)](https://travis-ci.org/kerphi/node-monitor-pid)

Installation
================

```
npm install monitor-pid
```

It also requires ``pidstat`` and ``pstree`` linux command to be installed on the system. 

Usage as a command line
=======================

```sh
npm install -g monitor-pid
monitor-pid --pid 5253 --period 5000
```

It will monitor the pid 5253 each 5 secondes and output cpu, mem, disk and nb_pids statistics as a CSV string on stdout.

Usage as a nodejs module
========================

```js
var MonitorPid = require('monitor-pid');

// creates an instance of MonitorPid
// - pid to monitor is 5253
// - monitoring will occure each 5 secondes
var mp = new MonitorPid(5253, { period: 5000 });

// begin the monitoring
mp.start();

// received each time the pid tree has been monitored
mp.on('monitored', function (pid, stats) {
  console.error('monitored', pid, stats);
});

// occurs when the monitoring is finished
// (no more pid or stop has been called)
mp.on('end', function (pid) {
  console.error('end', pid);
});

mp.on('error', function (err) {
  console.error(err);
});

// stop the monitoring after 50 secondes
setTimeout(function () {
  mp.stop();
}, 50000);
```

