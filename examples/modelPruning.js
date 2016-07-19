var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./booleanInfrastructure.js');
var _ = require('underscore');

// If you drop model names, this thing takes up much less memory
// if you're actually interested in calculating the MAP, then do so, but later
var USE_MODEL_NAMES = false;

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: true
};

var expts = [
    [{type: 'conditional', a: 'on', cond: {bright: true, hot: true}}, 0.9],
    [{type: 'marginal', a: 'on'}, 0.5],
    [{type: 'conditional', a: 'bright', cond: {hot: true}}, 0.9],
    [{type: 'marginal', a: 'hot'}, 0.5],
    [{type: 'conditional', a: 'hot', cond: {bright: true}}, 0.9],
    [{type: 'marginal', a: 'bright'}, 0.5],
    [{type: 'conditional', a: 'on', cond: {bright: false}}, 0.1],
    [{type: 'conditional', a: 'hot', cond: {bright: false}}, 0.2]
];

var cols = [
    'trial', 'model', 'll', 'p', 'resp'
];

for (var i = 0; i < expts.length; i++) {
    cols.push('E' + (i + 1)); // R array indexing
}

// Marginal and conditional functions imported from booleanInfrastructure.js
// and reworked for _.reduce
var marginal = function(jpd, ids, a) {
    return _.reduce(jpd, function(prob, row) {
        var assns = row[0];
        var p = row[1];
        return (assns[ids[a]]) ? prob + p : prob;
    }, 0);
};

var conditional = function(jpd, ids, a, cond) {
    // The accumulator is [P(A, cond), P(cond)]
    var probs = _.reduce(jpd, function(probs, row) {
        var assns = row[0];
        var p = row[1];
        // Is the condition satisfied? check each condition manually
        var condition = _.every(Object.keys(cond), function(c) {
            return assns[ids[c]] === cond[c];
        });
        if (condition) {
            return [
                (assns[ids[a]]) ? probs[0] + p : probs[0],
                probs[1] + p
            ];
        } else {
            return probs;
        }
    }, [0, 0]);
    // P(A | cond) = P(A, cond) / P(cond)
    if (probs[0] === 0 && probs[1] === 0) {
        // This was never possible, return 0
        return 0;
    } else {
        return probs[0] / probs[1];
    }
};

var logRow = function(args) {
    if (args === null) {
        // Then log the header
        console.log(cols.join('\t'));
    } else {
        console.log(_.map(cols, function(key) { return args[key]; }).join('\t'));
    }
};

var aoed = adaptive.AOED(infrastructure);

var prior = aoed.initialPrior;

logRow(null);

for (var i = 0; i < expts.length; i++) {
    var expt = expts[i][0],
        resp = expts[i][1];

    var res = aoed.update(prior, expt, resp);

    var models = res.mPosterior.support();

    for (var j = 0; j < models.length; j++) {
        var model = models[j];
        var mScore = res.mPosterior.score(model);

        // Get JPD and info required for computing probabilities
        var modelJSON = JSON.parse(model.name),
            jpd = modelJSON[3],
            aList = modelJSON[0];

        var ids = _.object(Object.keys(aList), _.range(Object.keys(aList).length));

        var jpd = JSON.parse(model.name)[3];

        var row = {
            trial: i + 1,
            model: (USE_MODEL_NAMES) ? model.name : null,
            ll: mScore,
            p: Math.exp(mScore),
            resp: resp
        };

        // Compute model predictions for probabilities for experiments
        for (var expti = 0; expti < expts.length; expti++) {
            var thisExpt = expts[expti][0];

            // Get model prediction for this probability
            var modelP;
            if (thisExpt.type === 'marginal') {
                modelP = marginal(jpd, ids, thisExpt.a);
            } else if (thisExpt.type === 'conditional') {
                modelP = conditional(jpd, ids, thisExpt.a, thisExpt.cond);
            } else {
                throw 'Unknown experiment type ' + thisExpt.type;
            }

            // Assign to cols
            row['E' + (expti + 1)] = modelP;
        }

        logRow(row);
    }

    // Update prior
    prior = res.mPosterior;
}
