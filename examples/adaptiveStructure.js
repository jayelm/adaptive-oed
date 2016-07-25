var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./structureInfrastructure.js');
var fs = require('fs');
var cache = require('../cache/structureTenths.js');

// var cache = JSON.parse(fs.readFileSync('./cache/structureTenths.js', 'utf8'));

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: true,
    cache: cache
};

var aoed = adaptive.AOED(infrastructure);

acli.runCLI(aoed, args);

// acli.runCLIAll(aoed, args);
