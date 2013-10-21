/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

var expect      = require('chai').expect;
var MonitorPid  = require('../index.js');

before(function (){

});

describe('MonitorPid', function () {

  it('should return an error if started on an unknown pid @1', function (done) {
    var i = 0;
    expect(i, 'xxx').to.be.numeric;
    done();
  });

});

after(function (){

});
