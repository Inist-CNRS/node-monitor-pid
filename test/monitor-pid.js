/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var expect      = require('chai').expect;
var MonitorPid  = require('../index.js');
var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;

before(function (){

});

describe('MonitorPid nodejs module', function () {
  this.timeout(5000);

  it('should return an error if started with an unknown pid @1.1', function (done) {
    getNonRunningPid(function (err, pidToTest) {
      var mp = new MonitorPid(pidToTest);
      mp.on('error', function (err) {
        expect(err.toString()).to.contain('is not running');
        done();
      });
      mp.start();
    });
  });
  
  it('should stop monitoring when the watched process is finished @1.2', function (done) {
    var p = spawn('sleep', ['0.1']);
    var pCode = undefined;
    p.on('exit', function (code) {
      pCode = code;
    })
    var mp = new MonitorPid(p.pid, { period: 10 }); // monitor each 10ms
    mp.on('end', function (pid) {
      expect(pCode).to.not.be.undefined;;
      expect(pCode).to.be.equal(0);
      expect(pid).to.be.equal(p.pid);
      done();
    });
    mp.start();
  });

  it('should stop monitoring when the "stop" method is called @1.3', function (done) {
    var p = spawn('sleep', ['2']);
    var pCode = undefined;
    p.on('exit', function (code) {
      pCode = code;
    })
    var mp = new MonitorPid(p.pid, { period: 10 }); // monitor each 10ms
    mp.on('end', function (pid) {
      expect(pCode, 'process should not have yet exited').to.be.undefined;;
      expect(pid).to.be.equal(p.pid);
      done();
    });
    mp.start();
    // stop the monitoring after 100ms
    setTimeout(function () {
      mp.stop();
    }, 100);
  });

  it('should return a JSON result @1.4', function (done) {
    var stats   = [];
    var p = spawn('sleep', ['0.1']);
    var mp = new MonitorPid(p.pid, { period: 10 }); // monitor each 10ms
    mp.on('monitored', function (pid, data) {
      stats.push(data);
    });
    mp.on('end', function (pid) {
      expect(stats).to.have.length.above(0);
      expect(stats[0]).to.be.an('object');
      done();
    });
    mp.start();
  });

  it('should return 2 results if period is 1.5s and the watched process die after 3.5s @1.5', function (done) {
    var stats   = [];
    var p = spawn('sleep', ['3.5']);
    var mp = new MonitorPid(p.pid, { period: 1500 });
    mp.on('monitored', function (pid, data) {
      stats.push(data);
    });
    mp.on('end', function (pid) {
      expect(stats).to.have.length(3);
      done();
    });
    mp.start();
  });

  it('should return a result with attended fields @1.6', function (done) {
    var stats   = [];
    var p = spawn('sleep', ['0.2']);
    var mp = new MonitorPid(p.pid, { period: 10 }); // monitor each 10ms
    mp.on('monitored', function (pid, data) {
      stats.push(data);
    });
    mp.on('end', function (pid) {
      expect(stats).to.have.length(1);
      expect(stats[0].date).to.not.be.undefined;
      expect(stats[0].time).to.not.be.undefined;
      expect(stats[0].parent_pid).to.not.be.undefined;
      expect(stats[0].active_pids).to.not.be.undefined;
      expect(stats[0].nb_pids).to.not.be.undefined;

      expect(stats[0]['%usr']).to.not.be.undefined;
      expect(stats[0]['%system']).to.not.be.undefined;
      expect(stats[0]['%guest']).to.not.be.undefined;
      expect(stats[0]['%CPU']).to.not.be.undefined;

      expect(stats[0]['minflt/s']).to.not.be.undefined;
      expect(stats[0]['majflt/s']).to.not.be.undefined;
      expect(stats[0]['VSZ']).to.not.be.undefined;
      expect(stats[0]['RSS']).to.not.be.undefined;
      expect(stats[0]['%MEM']).to.not.be.undefined;

      expect(stats[0]['kB_rd/s']).to.not.be.undefined;
      expect(stats[0]['kB_wr/s']).to.not.be.undefined;
      expect(stats[0]['kB_ccwr/s']).to.not.be.undefined;

      done();
    });
    mp.start();
  });

  this.timeout(7000);
  it('should work when monitoring several process (parent with sons) @1.7', function (done) {
    var stats = [];
    var mp = new MonitorPid(2, { period: 100 }); // monitor each 10ms
    mp.on('monitored', function (pid, data) {
      stats.push(data);
      mp.stop();
    });
    mp.on('end', function (pid) {
      expect(stats).to.have.length.above(0);
      expect(stats[0]).to.be.an('object');
      done();
    });
    mp.on('error', function (err) {
      expect(err).to.be.null;
      done();
    });
    mp.start();
  });

});

describe('MonitorPid unix command', function () {

  it('should not be allowed to be run without parameters @2.1', function (done) {
    var cmd = __dirname + '/../bin/monitor-pid';
    var p = exec(cmd, function (err, stdout, stderr) {
      expect(p.exitCode).to.be.equal(1);
      expect(stderr).to.contain('Missing required arguments: pid');
      done();
    });
  });

  it('should return 1 if pid doesn\'t exist @2.2', function (done) {
    getNonRunningPid(function (err, pidToTest) {
      var cmd = __dirname + '/../bin/monitor-pid --pid=' + pidToTest;
      var p = exec(cmd, function (err, stdout, stderr) {
        expect(p.exitCode).to.be.equal(1);
        done();
      });
    });
  });

 this.timeout(5000);
 it('should return CSV as a result if pid exists @2.3', function (done) {
    var p = spawn('sleep', ['3']);
    var cmd = __dirname + '/../bin/monitor-pid --pid=' + p.pid + ' --period=100';
    exec(cmd, function (err, stdout, stderr) {
      expect(p.exitCode).to.be.equal(0);

      var CSV = require('csv-string');
      var json = CSV.parse(stdout);

      expect(json).to.have.length.above(1);
      expect(json[0]).to.include('%CPU');

      // check the cpu value is a number
      var cpuIdx = json[0].indexOf('%CPU');
      expect(json[1][cpuIdx]).to.match(/^[0-9]+/);      

      done();
    });
  });

});

describe('MonitorPid dependencies', function () {
  it('should have pidstat installed on the system @3.1', function (done) {
    var p = exec('pidstat -V', function (err, stdout, stderr) {
      expect(stdout + stderr).contain('sysstat version');
      //expect(p.exitCode).to.be.equal(0); // do not check exitCode because it returns 1 on Suse OS
      done();
    });   
  });
  it('should have pstree installed on the system @3.2', function (done) {
    var p = exec('pstree -V', function (err, stdout, stderr) {
      expect(p.exitCode).to.be.equal(0);
      done();
    });
  });
});

after(function (){

});

var running = require('is-running');
function getNonRunningPid(cb, startPid) {
  if (!startPid) {
    startPid = 2000;
  }
  running(startPid, function (err, live) {
    if (err) return cb(err);
    if (!live) {
      cb(err, startPid);
    } else {
      getNonRunningPid(cb, startPid + 1);
    }
  });

}