var adaptive = require('..');
var _ = require('underscore');
var makeInfrastructure = require('./singleCoinInfrastructure.js');

// Problem with 1: fair is indistinguishbale from the null model

var nsubs = 50;
var N = 50;
var numParticipants = 1;

// TODO seed math.random
var sampleResponse = function(x) {
    // e.g. [.9, .1]
    return (Math.random() < x[0]) ? [1, 0] : [0, 1];
    // Sample according to the length 2 array of probabilities
};

// Imagine we set up responses perfectly adhering to a biased model.
// X is the experiment (a boolean array)
var biasedResponse = function(x) {
    // Calculate number of true responses.
    var trueFlips = 0;
    for (var i = 0; i < x.length; i++) {
        trueFlips += x[i];
    }
    var nTrue = (trueFlips / x.length) * numParticipants;
    return sampleResponse([nTrue, numParticipants - nTrue]);
};

var fairResponse = function(x) {
    // Always 10T, 10F
    return sampleResponse([numParticipants / 2, numParticipants / 2]);
};

var markovResponseDict = {
    'false,false,false,false': [0.16739691516709526, 0.8326030848329048],
    'false,false,false,true': [0.6005557312252969, 0.39944426877470324],
    'false,false,true,false': [0.6005557312252969, 0.39944426877470324],
    'false,false,true,true': [0.6005557312252969, 0.39944426877470324],
    'false,true,false,false': [0.6005557312252966, 0.39944426877470324],
    'false,true,false,true': [0.16739691516709515, 0.8326030848329049],
    'false,true,true,false': [0.6005557312252969, 0.39944426877470324],
    'false,true,true,true': [0.6005557312252969, 0.39944426877470324],
    'true,false,false,false': [0.39944426877470324, 0.6005557312252969],
    'true,false,false,true': [0.39944426877470324, 0.6005557312252969],
    'true,false,true,false': [0.8326030848329049, 0.16739691516709515],
    'true,false,true,true': [0.39944426877470324, 0.6005557312252966],
    'true,true,false,false': [0.39944426877470324, 0.6005557312252969],
    'true,true,false,true': [0.39944426877470324, 0.6005557312252969],
    'true,true,true,false': [0.39944426877470324, 0.6005557312252969],
    'true,true,true,true': [0.8326030848329048, 0.16739691516709526],
};

var markovResponse = function(x) {
    // Hardcoded from sample
    var probs = markovResponseDict[x.toString()];
    var numHeads = numParticipants * probs[0];
    var numTails = numParticipants * probs[1];
    return sampleResponse([numHeads, numTails]);
};

var allResponses = function() {
    var responses = [];
    for (var i = 0; i < numParticipants + 1; i++) {
        resposnes.push([i, numParticipants - i]);
    }
    return responses;
};

var randomResponse = fairResponse;

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
    fair: fairResponse,
    markov: markovResponse
};

var cols = [
    'strategy', 'subject', 'trial', 'responseType', 'pFair', 'pBias', 'pMarkov', 'pBest',
    // The selected experiment, EIG, the response, the AIG,
    // and a flag saying whether or not it has "converged" i.e. belief in the
    // correct model is > 0.95
    'x', 'EIG', 'response', 'AIG', 'cumAIG', 'converged'
];

var logRow = function(args) {
    if (args === null) {
        // Then log the header
        console.log(cols.join());
    } else {
        console.log(_.map(cols, function(key) { return args[key]; }).join());
    }
};

var strategies = ['ignorance', 'predictive', 'random'];
var nullArr = [
    adaptive.AOED(makeInfrastructure({nullGroup: false})),
    adaptive.AOED(makeInfrastructure({nullGroup: true}))
];

// IDEA: Run many many of these kinds of samples
var randomResponses = [];
for (var i = 0; i < 100; i++) {
    randomResponses.push(randomResponse());
}

// No null group for now
var aoed = nullArr[0];

var allExpts = [
    [true, true, true, true],
    [true, true, true, false],
    [true, true, false, true],
    [true, true, false, false],
    [true, false, true, true],
    [true, false, true, false],
    [true, false, false, true],
    [true, false, false, false],
    [false, true, true, true],
    [false, true, true, false],
    [false, true, false, true],
    [false, true, false, false],
    [false, false, true, true],
    [false, false, true, false],
    [false, false, false, true],
    [false, false, false, false]
];

var sampleArr = function(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
};

var randomExpt = function() {
    return sampleArr(allExpts);
};

logRow(null);

var globalsubi = 0;

for (var stratIndex = 0; stratIndex < strategies.length; stratIndex++) {
    var strat = strategies[stratIndex];

    for (var rT in responseTypes) {
        if (!responseTypes.hasOwnProperty(rT)) continue;

        var responseFunc = responseTypes[rT];

        for (var subi = 1; subi < nsubs; subi++) {
            globalsubi = globalsubi + 1;
            // Get initial prior
            var prior = aoed.initialPrior;
            var cumAIG = 0;

            for (var i = 1; i < N + 1; i++) {
                // Get beliefs
                var beliefs = {};
                _.values(prior.params.dist).forEach(function(b) {
                    beliefs[b.val] = b.prob.toFixed(4);
                });

                // Get information for every experiment
                if (strat == 'random') {
                    var expts = aoed.suggestAll(prior, (strat == 'predictive')).support();
                    // Ignore EIGs and pick a random experiment
                    var bestExpt = sampleArr(expts);
                } else {
                    var expts = aoed.suggestAll(prior, (strat == 'predictive')).support();
                    // Loop through and get max experiment
                    var bestExpt = _.reduce(expts, function(bestExpt, expt) {
                        return (expt.EIG > bestExpt.EIG) ? expt : bestExpt;
                    }, {x: null, EIG: 0, KLDist: null});

                    // Get y response to the best experiment
                }

                var bestX = bestExpt.x,
                    bestEIG = bestExpt.EIG.toFixed(4),
                    bestKLDist = bestExpt.KLDist;


                // Has it converged?
                var converged = (
                    rT === 'biased' && beliefs.biasGroup > 0.95 ||
                    rT === 'markov' && beliefs.markovGroup > 0.95 ||
                    rT === 'fair' && beliefs.fairGroup > 0.95
                );

                var pBest = 0;
                if (rT === 'biased') {
                    pBest = beliefs.biasGroup;
                } else if (rT === 'markov') {
                    pBest = beliefs.markovGroup;
                } else if (rT === 'fair') {
                    pBest = beliefs.fairGroup;
                }

                // if (converged) {
                    // console.log("Converged after", i, "iterations");
                // }

                var y = responseFunc(bestX);

                // Get results according to the experiment run.
                var updateResults = aoed.update(prior, bestExpt.x, y);
                // Actually update the prior
                prior = updateResults.mPosterior;

                cumAIG = cumAIG + updateResults.AIG;

                logRow({
                    strategy: strat,
                    subject: globalsubi,
                    trial: i,
                    responseType: rT,
                    pFair: beliefs.fairGroup,
                    pBias: beliefs.biasGroup,
                    pMarkov: beliefs.markovGroup,
                    pBest: pBest,
                    x: expToString(bestX),
                    EIG: bestEIG,
                    response: y[0],
                    AIG: updateResults.AIG.toFixed(4),
                    cumAIG: cumAIG.toFixed(4),
                    converged: converged * 1
                });
            }
        }
    }
}
