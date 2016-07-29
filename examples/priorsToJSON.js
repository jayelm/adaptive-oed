var csv = require('csv');
var fs = require('fs');
var _ = require('underscore');

var data = fs.readFileSync('./data/raw/prior-exp-mturk_all_n71.csv', 'utf8');

var header_meanings = {
    'Q_XYZ': [true, true, true],
    'Q_XYnZ': [true, true, false],
    'Q_XnYZ': [true, false, true],
    'Q_XnYnZ': [true, false, false],
    'Q_nXYZ': [false, true, true],
    'Q_nXYnZ': [false, true, false],
    'Q_nXnYZ': [false, false, true],
    'Q_nXnYnZ': [false, false, false],
};

var sumNoZeros = function(arr) {
    // XXX: To avoid 0 probability errors: add infinitesimals to values if
    // they're zero
    return _.reduce(arr, function(memo, num) {
        // This is EPSILON * 100
        return memo + ((num === 0) ? 0.0001 : num);
    }, 0);
};

var normalize = function(vals) {
    // XXX: To avoid 0 probability errors: add infinitesimals to values if
    // they're zero
    var total = sumNoZeros(vals);
    return _.map(vals, function(v) {
        return ((v === 0) ? 0.0001 : v) / total;
    });
};

var jpds = [];

csv.parse(data, {delimiter: ',', quote: '', escape: ''}, function(err, data) {
    if (err) {
        throw err;
    }
    var header = data[0];

    // Loop through each
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var rowObj = _.object(header, row);

        // Normalize values
        var rawJPD = _.map(Object.keys(header_meanings), function(name) {
            return Number(rowObj[name]);
        });

        var normed = normalize(rawJPD);
        var vals = _.values(header_meanings);

        var jpd = _.zip(_.values(header_meanings), normed).reverse();

        jpds.push({
            subj: rowObj.subj,
            jpd: jpd,
            condition: (rowObj.condition === 0) ? 'plaus' : 'freq',
            rt: Number(rowObj.rt),
            domain: rowObj.domain
        });
    }

    fs.writeFileSync('./data/priors-8q.json', JSON.stringify(jpds));
    console.log('saved to ./data/priors-8q.json');
});
