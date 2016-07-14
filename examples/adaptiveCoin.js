var adaptive = require('../adaptive');
var acli = require('../acli');
var makeInfrastructure = require('./coinInfrastructure.js');

var infrastructure = makeInfrastructure({nullGroup: true});

var args = {
    usePredictiveY: false,
    returnKL: true
}

var aoed = adaptive.AOED(infrastructure);

acli.runCLI(aoed, args);

// acli.runCLIAll(aoed);
