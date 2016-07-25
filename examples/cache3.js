var adaptive = require('../adaptive');
var infrastructure = require('./si3.js');
var fs = require('fs');

var aoed = adaptive.AOED(infrastructure);

var fname = "./cache/si3.json";
var varname = "structureCache";


var cache = aoed.cache();
var content = 'var ' + varname + ' = ' + JSON.stringify(cache) + ';';
fs.writeFile(fname, content, function(err) {
    if (err) return console.log(err);

    console.log("Saved", fname);
});
