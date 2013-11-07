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

It will monitor the pid 5253 each 5 secondes and output cpu, memory, disk and nb_pids statistics as a CSV string on stdout.

Usage as a nodejs module
========================

```js
var MonitorPid = require('monitor-pid');

// creates an instance of MonitorPid
// - pid to monitor is 5253
// - monitoring will occure each 5 secondes
var mp = new MonitorPid(5253, { period: 5000 });

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

// begin the monitoring
mp.start();

// stop the monitoring after 50 secondes
setTimeout(function () {
  mp.stop();
}, 50000);
```

Output fields
=============

CPU fields:

* "%usr": Percentage of CPU used by the task while executing at the user level (application), with or without nice priority. Note that this field does NOT include time spent running a virtual processor.
* "%system": Percentage of CPU used by the task while executing at the system level (kernel).
* "%guest": Percentage of CPU spent by the task in virtual machine (running a virtual processor).
* "%CPU": Total percentage of CPU time used by the task. In an SMP environment, the task's CPU usage will be divided by the total number of CPU's if option -I has been entered on the command line.

Memory fields:

* "minflt/s": Total number of minor faults the task has made per second, those which have not required loading a memory page from disk.
* "majflt/s": Total number of major faults the task has made per second, those which have required loading a memory page from disk.
* "VSZ": Virtual Size: The virtual memory usage of entire task in kilobytes.
* "RSS": Resident Set Size: The non-swapped physical memory used by the task in kilobytes.
* "%MEM": The tasks's currently used share of available physical memory.

Disk fields:

* "kB_rd/s": Number of kilobytes the task has caused to be read from disk per second.
* "kB_wr/s": Number of kilobytes the task has caused, or shall cause to be written to disk per second.
* "kB_ccwr/s": Number of kilobytes whose writing to disk has been cancelled by the task. This may occur when the task truncates some  dirty pagecache. In this case, some IO which another task has been accounted for will not be happening.


