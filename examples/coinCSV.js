var adaptive = require('..');
var _ = require('underscore');

var infrastructure = function() {
    var coinWeights = [
        0.01, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.99
    ];

    var arraysEqual = function(as,bs) {
        return as.length === bs.length &&
            all(idF, map2(function(a, b) { return a === b; }, as, bs));
    };

    var fairSingle = cache(function(sequence) {
        Enumerate(function() {
            return flip();
        });
    });

    var fairGroup = function(sequence, counts) {
        var yDist = fairSingle(sequence);
        var numHeads = counts[0],
            numTails = counts[1];

        var p = Math.exp(score(yDist, true));

        return score(Binomial({n: numHeads + numTails, p: p}), numHeads);
    };

    var biasSingle = cache(function(sequence) {
        Enumerate(function() {
            var p = uniformDraw(coinWeights);
            var sampled = repeat(sequence.length, function() { return flip(p); });
            condition(arraysEqual(sampled, sequence));
            return flip(p);
        });
    });

    var biasGroup = function(sequence, counts) {
        var yDist = biasSingle(sequence);
        var numHeads = counts[0],
            numTails = counts[1];

        var p = Math.exp(score(yDist, true));

        return score(Binomial({n: numHeads + numTails, p: p}), numHeads);
    };

    var markovSingle = cache(function(sequence) {
        Enumerate(function() {
            var transitionProb = uniformDraw(coinWeights);

            var generateSequence = function(n, flipsSoFar) {
                if (flipsSoFar.length == n) {
                    return flipsSoFar;
                } else {
                    var lastFlip = last(flipsSoFar);
                    return generateSequence(n,
                                            append(flipsSoFar,
                                                   flip(transitionProb) ? !lastFlip : lastFlip));
                }
            };
            var firstCoin = flip();
            var sampled = generateSequence(sequence.length, [firstCoin]);
            condition(arraysEqual(sampled, sequence));
            return flip( transitionProb ) ? !last(sampled) : last(sampled);
        });
    });

    var markovGroup = function(sequence, counts) {
        var yDist = markovSingle(sequence);
        var numHeads = counts[0],
            numTails = counts[1];

        var n = numHeads + numTails;
        var p = Math.exp(score(yDist, true));

        return score(Binomial({n: n, p: p}), numHeads);
    };

    var numParticipants = 20;

    var args = {
        mNameSample: function() {
            return uniformDraw(['biasGroup', 'fairGroup', 'markovGroup']);
            // return categorical({
                // vs: ['biasGroup', 'fairGroup', 'markovGroup'],
                // ps: [0.6861392352852966, 0.000011677789526658295, 0.3138490869251765]
            // });
        },
        mFuncs: {
            biasGroup: biasGroup,
            fairGroup: fairGroup,
            markovGroup: markovGroup
        },
        xSample: function() {
            return repeat(4, flip);
        },
        ySample: function() {
            var numHeads = randomInteger(numParticipants + 1);
            var numTails = numParticipants - numHeads;
            return [numHeads, numTails];
        }
    };
};

var aoed = adaptive.AOED(infrastructure);
var N = 6;
var numParticipants = 20;

// Imagine we set up responses perfectly adhering to a biased model.
// X is the experiment (a boolean array)
var biasedResponse = function(x) {
    // Calculate number of true responses.
    var trueFlips = 0;
    for (var i = 0; i < x.length; i++) {
        trueFlips += x[i];
    }
    var nTrue = (trueFlips / x.length) * numParticipants;
    return [nTrue, numParticipants - nTrue];
};

var fairResponse = function(x) {
    // Always 10T, 10F
    return [numParticipants / 2, numParticipants / 2];
};

// Convert a boolean array expeirment to TTTT/FFFF
var expToString = function(x) {
    return x.toString()
        .replace(/true/g, 'T')
        .replace(/false/g, 'F')
        .replace(/,/g, '');
};


// Different canned response types
var responseTypes = {
    biased: biasedResponse,
    fair: fairResponse
    // markov: markovResponse
};

var yPriors = ['ignorance', 'predictive'];

// CSV header
console.log('prior,responseType,trial,pFair,pBias,pMarkov,x,EIG,response,y,AIG');

for (var priorIndex = 0; priorIndex < yPriors.length; priorIndex++) {
    var yPrior = yPriors[priorIndex];

    for (var rT in responseTypes) {
        if (!responseTypes.hasOwnProperty(rT)) continue;

        var responseFunc = responseTypes[rT];
        // Get initial prior
        var prior = aoed.initialPrior;

        for (var i = 1; i < N + 1; i++) {
            // Get beliefs
            var beliefs = {};
            _.values(prior.params.dist).forEach(function(b) {
                beliefs[b.val] = b.prob.toFixed(4);
            });

            // Get suggested experiment information
            var expt = aoed.suggest(prior, (yPrior == 'predictive'));
            var x = expt.x,
                EIG = expt.EIG.toFixed(4),
                KLDist = expt.KLDist;

            // Get canned y response
            var y = responseFunc(x);

            // Loop through KLDist and log each row to CSV
            KLDist.support().forEach(function(kld) {
                var nTrue = kld.y[0];
                var row = [
                    yPrior, rT, i,
                    beliefs.fairGroup, beliefs.biasGroup, beliefs.markovGroup,
                    // Response is based on number of heads, so 0-index
                    expToString(x), EIG, y[0], nTrue, kld.val.toFixed(4)
                ];
                console.log(row.join());
            });

            // Update beliefs
            prior = aoed.update(prior, expt.x, y).mPosterior;
        }
    }
}
