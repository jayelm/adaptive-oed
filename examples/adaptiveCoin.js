var adaptive = require('..');
var makeInfrastructure = require('./coinInfrastructure.js');

var infrastructure = makeInfrastructure({nullGroup: true});

console.log(infrastructure.toString());

var usePredictiveY = false;

var aoed = adaptive.AOED(infrastructure);

adaptive.runCLI(aoed, usePredictiveY);

// adaptive.runCLIAll(aoed);
