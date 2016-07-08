var adaptive = require('..');
var infrastructure = require('./booleanInfrastructure.js');

var args = {
    usePredictiveY: false,
    returnKL: false
};

var aoed = adaptive.AOED(infrastructure);

adaptive.runCLI(aoed, args);

// adaptive.runCLIAll(aoed);
