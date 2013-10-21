/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var expect      = require('chai').expect;
var MonitorPid  = require('../index.js');
var spawn       = require('child_process').spawn;

before(function (){

});

describe('MonitorPid nodejs module', function () {

  it('should return an error if started with an unknown pid @1', function (done) {
    getNonRunningPid(function (err, pidToTest) {
      var mp = new MonitorPid(pidToTest);
      mp.on('error', function (err) {
        expect(err.toString()).to.contain('is not running');
        done();
      });
      mp.start();
    });
  });
  
  it('should stop monitoring when the watched process is finished @2', function (done) {
    var process = spawn('sleep', ['0.1']);
    var processCode = undefined;
    process.on('exit', function (code) {
      processCode = code;
    })
    var mp = new MonitorPid(process.pid, { period: 10 }); // monitor each 10ms
    mp.on('end', function (pid) {
      expect(processCode).to.not.be.undefined;;
      expect(processCode).to.be.equal(0);
      expect(pid).to.be.equal(process.pid);
      done();
    });
    mp.start();
  });

  it('should stop monitoring when the "stop" method is called @3', function (done) {
    var process = spawn('sleep', ['1']);
    var processCode = undefined;
    process.on('exit', function (code) {
      processCode = code;
    })
    var mp = new MonitorPid(process.pid, { period: 10 }); // monitor each 10ms
    mp.on('end', function (pid) {
      expect(processCode, 'process should not have yet exited').to.be.undefined;;
      expect(pid).to.be.equal(process.pid);
      done();
    });
    mp.start();
    // stop the monitoring after 100ms
    setTimeout(function () {
      mp.stop();
    }, 100);
  });

  it('should return a JSON result @4', function (done) {
    var stats   = [];
    var process = spawn('sleep', ['0.1']);
    var mp = new MonitorPid(process.pid, { period: 10 }); // monitor each 10ms
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

  it('should return 2 results if period is 1 sec and the watched process die after 2.5 secondes @5');

  it('should return a result with attended fields @6');

});

describe('MonitorPid unix command', function () {

  it('should not be allowed to be run without parameters @6');
  it('should return 1 if pid doesn\'t exist @7');
  it('should return CSV as a result if pid exists @8');

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