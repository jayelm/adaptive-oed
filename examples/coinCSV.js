var adaptive = require('..');
var _ = require('underscore');
var makeInfrastructure = require('./coinInfrastructure.js');

// For demonstrating that ignorance prior/markov responses fails
var N = 8;
var numParticipants = 20;

// Imagine we set up responses perfectly adhering to a biased model.
// X is the experiment (a boolean array)
var biasedResponseDict = {
    '0': 0.13419002529223334,
    '1': 0.33256219864868247,
    '2': 0.5,
    '3': 0.6674378013513177,
    '4': 0.8658099747077667,
};

var biasedResponse = function(x) {
    // FIXME: This might not be exactly correct, if bias takes into account
    // other probabilities, and there are more probabilities on the higher side
    // of e.g. 0.75?
    // Calculate number of true responses.
    var trueFlips = 0;
    for (var i = 0; i < x.length; i++) {
        trueFlips += x[i];
    }
    var nTrue = biasedResponseDict[trueFlips.toString()] * numParticipants;
    return Math.round(nTrue);
};

var fairResponse = function(x) {
    // Always 10H, 10T
    return numParticipants / 2;
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
    var numHeads = Math.round(numParticipants * probs[0]);
    return numHeads;
};

var allResponses = function() {
    var responses = [];
    for (var i = 0; i < numParticipants + 1; i++) {
        responses.push([i, numParticipants - i]);
    }
    return responses;
};

// Bad pseudorandom from
// http://stackoverflow.com/questions/521295/javascript-random-seeds
var seed = 1;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

var randomResponse = function() {
    var r = random();
    var numHeads = Math.round(numParticipants * r);
    return numHeads;
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
    fair: fairResponse,
    markov: markovResponse,
    random: randomResponse
};

var cols = [
    'useNull', 'prior', 'responseType', 'trial', 'pFair', 'pBias', 'pMarkov',
    'pNull', 'bestX', 'x', 'EIG', 'response', 'y', 'AIG'
];

var logRow = function(args) {
    if (args === null) {
        // Then log the header
        console.log(cols.join());
    } else {
        console.log(_.map(cols, function(key) { return args[key]; }).join());
    }
};

var yPriors = ['ignorance', 'predictive'];
var nullArr = [
    adaptive.AOED(makeInfrastructure({nullGroup: false})),
    adaptive.AOED(makeInfrastructure({nullGroup: true}))
];

logRow(null);

for (var infIndex = 0; infIndex < nullArr.length; infIndex++) {
    var useNull = !!infIndex;

    var aoed = nullArr[infIndex];

    for (var priorIndex = 0; priorIndex < yPriors.length; priorIndex++) {
        var yPrior = yPriors[priorIndex];

        for (var rT in responseTypes) {
            if (!responseTypes.hasOwnProperty(rT)) continue;

            if (rT === 'random') {
                // These were randomly sampled, but I want to keep them the
                // same for both random conditions
                var responses = [
                    // Null just to match these responses up with experiment
                    // trial, which is 1-indexed
                    null, 10, 12, 15, 1, 13, 14, 17, 12
                ];
            }

            var responseFunc = responseTypes[rT];
            // Get initial prior
            var prior = aoed.initialPrior;

            for (var i = 1; i < N + 1; i++) {
                // Get beliefs
                var beliefs = {};
                _.values(prior.params.dist).forEach(function(b) {
                    beliefs[b.val.name] = b.prob.toFixed(4);
                });

                // Get information for every experiment
                var expts = aoed.suggestAll(prior, {
                    usePredictiveY: (yPrior === 'predictive'),
                    returnKL: true
                });
                // Loop through and get max experiment
                var bestExpt = _.reduce(expts, function(bestExpt, expt) {
                    return (expt.EIG > bestExpt.EIG) ? expt : bestExpt;
                }, {x: null, EIG: -Infinity, KLDist: null});

                // Get y response to the best experiment
                var bestX = bestExpt.x.sequence,
                    bestEIG = bestExpt.EIG.toFixed(4),
                    bestKLDist = bestExpt.KLDist;

                if (rT === 'random') {
                    var y = responses[i];
                } else {
                    var y = responseFunc(bestX);
                }

                for (var exptIndex = 0; exptIndex < expts.length; exptIndex++) {
                    var expt = expts[exptIndex];
                    var x = expt.x.sequence,
                        EIG = expt.EIG.toFixed(4),
                        KLDist = expt.KLDist;


                    // Loop through KLDist and log each row to CSV
                    KLDist.support().forEach(function(kld) {
                        var nTrue = kld.y;
                        logRow({
                            useNull: useNull * 1,
                            prior: yPrior,
                            responseType: rT,
                            trial: i,
                            pFair: beliefs.fairGroup,
                            pBias: beliefs.biasGroup,
                            pMarkov: beliefs.markovGroup,
                            pNull: (useNull) ? beliefs.nullGroup : 0,
                            bestX: expToString(bestX),
                            x: expToString(x),
                            EIG: EIG,
                            response: y,
                            y: nTrue,
                            AIG: kld.val.toFixed(4)
                        });
                    });
                }
                // Update beliefs according to the best experiment
                prior = aoed.update(prior, bestExpt.x, y).mPosterior;
            }
        }
    }
}
