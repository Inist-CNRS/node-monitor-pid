node-monitor-pid
================

Monitors a pid and all its sons

Installation
================

```
npm install monitor-pid
```

Usage as a command line
=======================

```
npm install -f monitor-pid
monitor-pid --pid 5253 --delay 5000
```

It will monitor the pid 5253 each 5 secondes and output the statistics on stdout.

Usage as a nodejs module
========================

```
var MonitorPid = require('monitor-pid');

// creates an instance of MonitorPid
// - pid to monitor is 5253
// - monitoring will occure each 5 secondes
var mapp = new MonitorPid(5253, { delay: 5000 });

// begin the monitoring
mapp.start();

// received each time the pid tree has been monitored
mapp.on('monitored', function (pid, stats) {
  console.error('monitored', pid, stats);
});

// occurs when the monitoring is finished
// (no more pid or stop has been called)
mapp.on('end', function (pid) {
  console.error('end', pid);
});

// stop the monitoring after 50 secondes
setTimeout(function () {
  mapp.stop();
}, 50000);
```

