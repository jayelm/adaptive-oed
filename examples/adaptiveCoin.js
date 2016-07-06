var adaptive = require('..');
var makeInfrastructure = require('./coinInfrastructure.js');

var infrastructure = makeInfrastructure({nullGroup: true});

var args = {
    usePredictiveY: false,
    returnKL: true
}

var aoed = adaptive.AOED(infrastructure);

adaptive.runCLI(aoed, args);

// adaptive.runCLIAll(aoed);
