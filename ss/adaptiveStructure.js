var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./structureInfrastructure.js');

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: true
};

var aoed = adaptive.AOED(infrastructure);

acli.runCLI(aoed, args);

// acli.runCLIAll(aoed, args);
