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

// Standard structure learning infrastructure
var aoed = adaptive.AOED(infrastructure);

var jpds = JSON.parse(fs.readFileSync('./data/priors-8q.json'));

var binWidth = 0.1;
var EPSILON = 0.000001;
var roundTo = function(n, mult) {
    return mult * Math.round(n / mult);
};

var acceptableDomains = [
    'lightbulb',
    'tomatoplant'
];

var respToFloat = function(y) {
    y = roundTo(y, binWidth);
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
    return y;
};

var TOL = 0.000001;
function isClose(a, b) {
    return Math.abs(a - b) < TOL;
}

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

var ids = {bright: 0, hot: 1, on: 2};
var cols = [
    'subj', 'domain', 'jpd', 'trial', 'pMax', 'pMaxLL', 'mMax',
    'xText', 'xType', 'xA', 'xCond', 'EIG', 'y', 'yRaw', 'alternate',
    'repeat'
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

for (var i = 0; i < jpds.length; i++) {
    // Get response model
    var jpdObj = jpds[i];
    if (!_.contains(acceptableDomains, jpdObj.domain)) {
        console.log('domain is', jpdObj.domain, 'skipping');
        continue;
    }

    // Reset prior
    var prior = aoed.initialPrior;

    // Experiments previously run
    var prevExpts = {};

    // 15 qs, skipping is possible
    for (var j = 0; j < 15; j++) {
        var exptsUnordered = aoed.suggestAll(prior, args);
        var expts = _.sortBy(exptsUnordered, function(k) {
            return -k.EIG;
        });
        var thisExpt = expts.shift();
        // True if switching to different expt
        var alternate = false;
        // True if not a duplicate
        var duplicate = false;

        while (prevExpts.hasOwnProperty(thisExpt.x.name) && expts.length > 0) {
            if (!isClose(thisExpt.EIG, expts[0].EIG)) {
                break;
            }
            thisExpt = expts.shift();
            alternate = true;
        }

        var x = thisExpt.x;

        if (prevExpts.hasOwnProperty(x.name)) {
            var y = prevExpts[x.name];
            var yRaw = null;
            duplicate = true;
        } else {
            var yRaw = (x.type === 'marginal') ?
                marginal(jpdObj.jpd, ids, x.a) :
                conditional(jpdObj.jpd, ids, x.a, x.cond);
            var y = respToFloat(yRaw);
        }

        var yObj = {
            y: y,
            name: y.toString()
        };

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
        }

        logRow({
            subj: jpdObj.subj,
            domain: jpdObj.domain,
            jpd: JSON.stringify(jpdObj.jpd),
            trial: j + 1,
            pMax: pMax,
            pMaxLL: Math.log(pMax),
            mMax: mMax,
            xText: x.name,
            xType: x.type,
            xA: x.a,
            xCond: JSON.stringify(x.cond),
            EIG: x.EIG,
            y: yObj.name,
            yRaw: yRaw,
            alternate: alternate,
            repeat: prevExpts.hasOwnProperty(x.name)
        });

        // Cache previous response
        prevExpts[x.name] = y;

        prior = aoed.update(prior, x, yObj, args).mPosterior;
    }
}
