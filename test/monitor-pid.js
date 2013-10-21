/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var expect      = require('chai').expect;
var MonitorPid  = require('../index.js');

before(function (){

});

describe('MonitorPid nodejs module', function () {

  it('should return an error if started with an unknown pid @1');
  // it('should return an error if started with an unknown pid @1', function (done) {
  //   getNonRunningPid(function (err, pidToTest) {
  //     var mp = new MonitorPid(pidToTest);
  //     mp.on('error', function (err) {
  //       console.error(err);
  //       //expect(err, 'xxx').to.be.numeric;
  //       done();
  //     });
  //     mp.start();
  //   });
  // });
  it('should stop monitoring when the watched process is finished @2');
  it('should stop monitoring when the "stop" method is called @3');
  it('should return JSON result @4');
  it('should return 2 results if period is 1 sec and the watched process die after 2.5 secondes @5');

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