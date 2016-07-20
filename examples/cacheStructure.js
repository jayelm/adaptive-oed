var adaptive = require('../adaptive');
var infrastructure = require('./structureInfrastructure.js');
var fs = require('fs');

var aoed = adaptive.AOED(infrastructure);

var fname = "./cache/structure.json";

var cache = aoed.cache();
fs.writeFile(fname, JSON.stringify(cache), function(err) {
    if (err) return console.log(err);

    console.log("Saved", fname);
});
