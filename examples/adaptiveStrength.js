var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./strengthInfrastructure.js');

var aList = {bright: [], hot: [], on: []};

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: true,
};

var infraStr = adaptive.getThunkBody(
    infrastructure
        .toString()
        .replace(/fixedStructure = null/, 'fixedStructure = ' + JSON.stringify(aList))
);

var aoed = adaptive.AOED(infraStr);

acli.runCLI(aoed, args);

// acli.runCLIAll(aoed, args);
