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

    var numParticipants = 1;

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

var nullInfrastructure = function() {
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


    var numParticipants = 1;

    // Equiprobable for all possible counts. Ignore input arguments
    var nullGroup = function(sequence, counts) {
        return score(RandomInteger({n: numParticipants + 1}), counts[0]);
    };

    var args = {
        mNameSample: function() {
            return uniformDraw(['biasGroup', 'fairGroup', 'markovGroup', 'nullGroup']);
        },
        mFuncs: {
            biasGroup: biasGroup,
            fairGroup: fairGroup,
            markovGroup: markovGroup,
            nullGroup: nullGroup
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

var makeInfrastructure = function(args) {
    // Return a different infrastructure thunk depending on whether or not a
    // null group is requested.
    // Because of reflection, I think I just need to repeat everything
    return (args.nullGroup) ? nullInfrastructure : infrastructure;
};

module.exports = makeInfrastructure;
