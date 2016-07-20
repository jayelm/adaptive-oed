var adaptive = require('../adaptive');
var infrastructure = require('./structureInfrastructure.js');

var aoed = adaptive.AOED(infrastructure);

var cache = aoed.cache();
console.log(cache);
