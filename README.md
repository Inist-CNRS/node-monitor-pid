node-monitor-pid
================

Monitors a pid and all its sons.

Use case example: watch a Web server system activity being stressed by [siege](http://www.joedog.org/siege-home/) (benchmarking). Then use Libreoffice or Excel to analyze the CPU, MEM and DISK usage of the Web server.

[![Build Status](https://travis-ci.org/kerphi/node-monitor-pid.png?branch=master)](https://travis-ci.org/kerphi/node-monitor-pid)

Installation
================

```
npm install monitor-pid
```

It also requires ``pidstat`` (>= 10.x) and ``pstree`` linux command to be installed on the system (`apt-get install sysstat psmisc`)

Usage as a command line
=======================

```sh
npm install -g monitor-pid
monitor-pid --pid 5253 --period 5000
```

It will monitor the pid 5253 each 5 secondes and output cpu, memory, disk and nb_pids statistics as a CSV string on stdout.

Output example:

```csv
date,time,parent_pid,nb_pids,monit_time,%usr,%system,%guest,%CPU,minflt/s,majflt/s,VSZ,RSS,%MEM,kB_rd/s,kB_wr/s,kB_ccwr/s
2013/11/09 13:05:52,0,1,167,1062,7.84,0.98,0.00,8.82,20.58,0.00,47132328.00,2683424.00,33.22,-105.00,44.02,-97.16
2013/11/09 13:05:57,5,1,167,1053,12.74,5.88,0.00,18.62,2561.77,0.00,47132140.00,2687784.00,33.28,-105.00,79.31,-101.08
2013/11/09 13:06:02,10,1,167,1052,29.70,10.89,0.00,40.59,4618.81,0.00,47141112.00,2688768.00,33.30,-105.00,-97.08,-97.08
2013/11/09 13:06:07,15,1,167,1046,11.88,4.95,0.00,16.83,2051.49,0.00,47199016.00,2682536.00,33.22,-105.00,-61.44,-101.04
2013/11/09 13:06:12,20,1,167,1045,5.94,0.99,0.00,6.93,19.80,0.00,47203476.00,2679040.00,33.17,-105.00,-105.00,-105.00
```

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


