var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./strengthInfrastructure.js');
var csv = require('csv');
var fs = require('fs');
var _ = require('underscore');

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: true,
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

var nodes = ['bright', 'on', 'hot'];

// Attempt to parse a text, since I didn't include this in the main run
var strToExpt = function(str) {
    var type = (str.indexOf('that are') === -1) ? 'marginal' : 'conditional';
    if (type === 'conditional') {
        var cond = {};
        // Then split on .
        var splits = str.split('.');
        var s1 = splits[0];
        var s2 = splits[1];
        // Look for "nots" first
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (s1.indexOf('not ' + n) > -1) {
                cond[n] = false;
            }
        }
        // Then look for trues conditioned on them not appearing in the above
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (s1.indexOf(' ' + n) > -1 && !cond.hasOwnProperty(n)) {
                cond[n] = true;
            }
        }

        // Look in second half
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (s2.indexOf(' ' + n) > -1) {
                return {
                    name: str,
                    text: str,
                    type: type,
                    a: n,
                    cond: cond
                }
            }
        }
    } else { // Then marginal, just look for node mentioned
        var a = null;
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (str.indexOf(n) > -1) {
                return {
                    name: str,
                    type: type,
                    a: n
                };
            }
        }
        return null;
    }
};

var data = fs.readFileSync('./data/raw/structure-noskip.tsv', 'utf8');

var cols = [
    'skip', 'mScore', 'mNo', 'm', 'aWeights', 'aPriors', 'trueWeights',
    'truePriors', 'trial', 'x','EIG','y', 'mY', 'll'
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

csv.parse(data, {delimiter: '\t', quote: '', escape: ''}, function(err, data) {
    if (err) {
        throw err;
    }
    // Get first one
    var header = data[0];
    var currIndex = 1;
    while (currIndex < data.length) {
        // Get LAST experiment:
        var currObj = _.object(header, data[currIndex]);
        var currNo = currObj.mNo;

        var currSlice = data.slice(currIndex);

        var nextM = _.find(_.range(currSlice.length), function(i) {
            // mNo
            var row = currSlice[i];
            if (row[2] !== currNo) {
                return true;
            }
        });

        var lastObj = _.object(header, currSlice[nextM - 1]);

        var infraStr = adaptive.getThunkBody(
            infrastructure
                .toString()
                .replace(/fixedStructure = null/, 'fixedStructure = ' +
                         JSON.stringify(JSON.parse(lastObj.mMax)[0]))
        );

        var aoed = adaptive.AOED(infraStr);
        var prior = aoed.initialPrior;
        var trial = 1;

        while (currObj.mNo === currNo) {
            var map = prior.MAP();

            var mapArr = JSON.parse(map.val.name),
                score = map.score,
                aList = mapArr[0],
                aWeights = mapArr[1],
                aPriors = mapArr[2],
                jpd = mapArr[3];

            var ids = _.object(
                Object.keys(aList),
                _.range(Object.keys(aList).length)
            );
            // Get question, get answer
            var x = strToExpt(currObj.x);
            var y = JSON.parse(currObj.y);
            var yObj = {
                y: y,
                name: y.toString()
            };
            var mY = (x.type === 'conditional') ?
                conditional(jpd, ids, x.a, x.cond) :
                marginal(jpd, ids, x.a);

            // Log this trial
            logRow({
                skip: lastObj.skip,
                mScore: score,
                mNo: lastObj.mNo,
                m: lastObj.mMax,
                aWeights: JSON.stringify(aWeights),
                aPriors: JSON.stringify(aPriors),
                trueWeights: lastObj.aWeights,
                truePriors: lastObj.aPriors,
                trial: trial,
                x: x.name,
                EIG: null,
                y: y,
                mY: mY,
                ll: null
            });

            prior = aoed.update(prior, x, yObj, args).mPosterior;
            currIndex++; trial++;
            currObj = _.object(header, data[currIndex]);
        }
    }
});
