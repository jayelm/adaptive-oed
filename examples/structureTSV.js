var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./structureInfrastructure.js');
var fs = require('fs');
var _ = require('underscore');
var cache = require('../cache/structureTenths.js');

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: true,
    cache: cache
};

var aoed = adaptive.AOED(infrastructure);

// Sample a model and a JPD. This will get passed to WebPPL.
var sampleDAG = function() {
    var aList = uniformDraw(enumerateStructures(nodes));
    var aWeights = sampleWeights(aList);
    var aPriors = samplePriors(aList);

    var aWeightsLL = reduce(function(child, acc) {
        var parents = aWeights[child];
        var parentsLL = reduce(function(w, acc) {
            return acc * Math.exp(weights.score(w));
        }, 1, parents);
        return acc * parentsLL;
    }, 1, Object.keys(aWeights));

    var aPriorsLL = reduce(function(child, acc) {
        var b = aPriors[child];
        return acc * Math.exp(probs.score(b));
    }, 1, Object.keys(aPriors));

    return {
        jpd: JPD(aList, aWeights, aPriors),
        aList: aList,
        aWeights: aWeights,
        aPriors: aPriors,
        // This is LL disregarding probability of aList (since that's uniform)
        ll: Math.log(aWeightsLL * aPriorsLL)
    };
};

var sampleDAGsrc = aoed.compileThunk(sampleDAG);
var binWidth = aoed.retrieve('binWidth');
var EPSILON = aoed.retrieve('EPSILON');

var roundTo = function(n, mult) {
    return mult * Math.round(n / mult);
};

var marginal = function(jpd, ids, a) {
    // Due to floating point errors, this is sometimes slightly > 1
    return Math.min(1, _.reduce(jpd, function(prob, row) {
        var assns = row[0];
        var p = row[1];
        return (assns[ids[a]]) ? prob + p : prob;
    },0 ));
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
        // This shouldn't happen, since we never have zero probabilities
        throw 'zero probabilities: ' + probs;
    } else {
        return Math.min(1, probs[0] / probs[1]);
    }
};

var prior = aoed.initialPrior;

var cols = [
    'skip', 'pTrue', 'mNo', 'mName', 'aWeights', 'aPriors', 'trial', 'pMax', 'mMax', 'x','EIG','y', 'll'
];

var logRow = function(args) {
    if (args === null) {
        // Then log the header
        console.log(cols.join('\t'));
    } else {
        console.log(_.map(cols, function(key) { return args[key]; }).join('\t'));
    }
};

logRow(null);

for (skipi = 0; skipi < 2; skipi++) {
    var skip = (skipi === 0);

    for (var mNo = 0; mNo < 25; mNo++) {
        var model = aoed.run(sampleDAGsrc),
            jpd = model.jpd,
            aList = model.aList,
            aWeights = model.aWeights,
            aPriors = model.aPriors,
            ll = model.ll;

        var mName = JSON.stringify([aList]);

        var ids = _.object(
            Object.keys(aList),
            _.range(Object.keys(aList).length)
        );

        prior = aoed.initialPrior;
        var oldExpts = new Set();

        for (var i = 0; i < 30; i++) {
            // Get best question
            var expts = aoed.suggestAll(prior, args);
            // Loop through and get max experiment
            var bestExpt = _.reduce(expts, function(bestExpt, expt) {
                if (skip) {
                    if (oldExpts.has(expt.x.name)) {
                        // Then don't return this new expt
                        return bestExpt;
                    }
                }
                return (expt.EIG > bestExpt.EIG) ? expt : bestExpt;
            }, {x: null, EIG: -Infinity, KLDist: null});

            if (bestExpt.x === null) {
                // Then we've exhausted all experiments
                break;
            }


            var x = bestExpt.x,
                EIG = bestExpt.EIG,
                KLDist = bestExpt.KLDist;

            oldExpts.add(x.name);

            var y;
            if (x.type === 'conditional') {
                y = conditional(jpd, ids, x.a, x.cond);
            } else if (x.type === 'marginal') {
                y = marginal(jpd, ids, x.a);
            } else {
                throw 'Unknown experiment type ' + x.type;
            }
            // round to binwidth
            y = roundTo(y, binWidth);
            // small corrections for discrete betas
            // TODO: Just fix these in the discretization!
            if (y === 0.6) {
                y = 0.6000000000000001;
            } else if (y === 0.3) {
                y = 0.30000000000000004;
            } else if (y === 0.7) {
                y = 0.7000000000000001;
            } else if (y === 0) {
                y = EPSILON;
            } else if (y === 1) {
                y = 1 - EPSILON;
            }
            var yObj = {
                y: y,
                name: y.toString()
            };
            // Get belief in true model
            var pTrue = -1;
            var pMax = -1;
            var mMax = '';
            var models = prior.support();
            for (var mi = 0; mi < models.length; mi++) {
                var model = models[mi];
                var score = Math.exp(prior.score(model));
                if (score > pMax) {
                    pMax = score;
                    mMax = model.name;
                }
                if (model.name === mName) {
                    pTrue = score;
                }
            }
            logRow({
                skip: skip * 1,
                mNo: mNo + 1,
                mName: mName,
                aWeights: JSON.stringify(aWeights),
                aPriors: JSON.stringify(aPriors),
                trial: i + 1,
                pTrue: pTrue,
                pMax: pMax,
                mMax: mMax,
                x: x.name,
                EIG: EIG,
                y: yObj.name,
                ll: ll
            });
            // Log this information before rerunning
            prior = aoed.update(prior, x, yObj, args).mPosterior;
        }
    }
}
