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

// Get name of file
var data = fs.readFileSync(process.argv[2], 'utf8');

var cols = [
    'mScore', 'amt_id', 'm', 'aWeights', 'aPriors', 'amt_trial',
    'xText', 'xType', 'xA', 'xCond', 'EIG', 'y', 'mY', 'alternate',
    'repeat', 'domain',
    '[false,false,false]',
    '[false,false,true]',
    '[false,true,false]',
    '[false,true,true]',
    '[true,false,false]',
    '[true,false,true]',
    '[true,true,false]',
    '[true,true,true]'
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
        var currObj = _.object(
            header,
            _.map(data[currIndex], JSON.parse)
        );
        var currSubj = currObj.amt_id;

        var currSlice = data.slice(currIndex);

        var nextM = _.find(_.range(currSlice.length), function(i) {
            // mNo
            var row = currSlice[i];
            if (JSON.parse(row[0]) !== currSubj) {
                return true;
            }
        });

        if (nextM === undefined) {
            // Then this is the last one
            nextM = currSlice.length;
        }

        var lastObj = _.object(header,
            _.map(currSlice[nextM - 1], JSON.parse));

        var infraStr = adaptive.getThunkBody(
            infrastructure
                .toString()
                .replace(/fixedStructure = null/, 'fixedStructure = ' +
                         JSON.stringify(JSON.parse(lastObj.map)[0]))
        );

        var aoed = adaptive.AOED(infraStr);
        var prior = aoed.initialPrior;

        while (currObj.amt_id === currSubj) {
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
            var x = {
                name: currObj.xText,
                text: currObj.xText,
                type: currObj.xType,
                a: currObj.xA,
                cond: JSON.parse(currObj.xCond)
            };
            var y = JSON.parse(currObj.y);
            var yObj = {
                y: y,
                name: y.toString()
            };
            var mY = (x.type === 'conditional') ?
                conditional(jpd, ids, x.a, x.cond) :
                marginal(jpd, ids, x.a);

            var jpdObj = _.object(
                _.map(jpd, function(row) {
                    return JSON.stringify(row[0]);
                }),
                _.map(jpd, function(row) {
                    return row[1];
                })
            );

            // Log this trial
            var stdObj = {
                mScore: score,
                amt_id: lastObj.amt_id,
                m: lastObj.mMax,
                aWeights: JSON.stringify(aWeights),
                aPriors: JSON.stringify(aPriors),
                amt_trial: currObj.amt_trial,
                xText: x.name,
                xType: x.type,
                xA: x.a,
                xCond: JSON.stringify(x.cond),
                EIG: currObj.xEIG,
                y: y,
                mY: mY,
                alternate: currObj.alternate,
                repeat: currObj.repeat,
                domain: lastObj.domain
            };

            logRow(_.extend(stdObj, jpdObj));

            var res = aoed.update(prior, x, yObj, args);
            prior = res.mPosterior;

            currIndex++;
            currObj = _.object(header, _.map(data[currIndex], JSON.parse));
        }
    }
});
