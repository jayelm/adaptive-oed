var infrastructure = function() {
    var coinWeights = [
        0.01, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.99
    ];

    var arraysEqual = function(as,bs) {
        return as.length === bs.length &&
            all(idF, map2(function(a, b) { return a === b; }, as, bs));
    };

    // Groupify: Model -> Model
    var groupify = function(m) {
        var gm = function(x, y) {
            var yDist = m(x.sequence);
            var p = Math.exp(yDist.score(true));
            return Binomial({n: x.n, p: p}).score(y)
        }
        return Model(m.name.replace('Single', 'Group'), gm);
    };

    var fairSingle = Model('fairSingle', cache(function(sequence) {
        Enumerate(function() {
            return flip();
        });
    }));

    var biasSingle = Model('biasSingle', cache(function(sequence) {
        Enumerate(function() {
            var p = uniformDraw(coinWeights);
            var sampled = repeat(sequence.length, function() { return flip(p); });
            condition(arraysEqual(sampled, sequence));
            return flip(p);
        });
    }));

    var markovSingle = Model('markovSingle', cache(function(sequence) {
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
    }));

    var fairGroup = groupify(fairSingle);
    var biasGroup = groupify(biasSingle);
    var markovGroup = groupify(markovSingle);

    var numParticipants = 1;

    var args = {
        M: function() {
            return uniformDraw([fairGroup, biasGroup, markovGroup]);
        },
        X: function() {
            return {n: numParticipants, sequence: repeat(4, flip)};
        },
        Y: function() {
            return randomInteger(numParticipants + 1);
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

    // Groupify: Model -> Model
    var groupify = function(m) {
        var gm = function(x, y) {
            var yDist = m(x.sequence);
            var p = Math.exp(yDist.score(true));
            return Binomial({n: x.n, p: p}).score(y)
        }
        return Model(m.name.replace('Single', 'Group'), gm);
    };

    var fairSingle = Model('fairSingle', cache(function(sequence) {
        Enumerate(function() {
            return flip();
        });
    }));

    var biasSingle = Model('biasSingle', cache(function(sequence) {
        Enumerate(function() {
            var p = uniformDraw(coinWeights);
            var sampled = repeat(sequence.length, function() { return flip(p); });
            condition(arraysEqual(sampled, sequence));
            return flip(p);
        });
    }));

    var markovSingle = Model('markovSingle', cache(function(sequence) {
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
    }));

    var fairGroup = groupify(fairSingle);
    var biasGroup = groupify(biasSingle);
    var markovGroup = groupify(markovSingle);

    var nullGroup = Model('nullGroup', function(x, y) {
        // Ignore x, return equal probability for all y in the possible repsonses range
        return RandomInteger({n: numParticipants + 1}).score(y);
    });

    var numParticipants = 1;

    var args = {
        M: function() {
            return uniformDraw([fairGroup, biasGroup, markovGroup, nullGroup]);
        },
        X: function() {
            return {n: numParticipants, sequence: repeat(4, flip)};
        },
        Y: function() {
            return randomInteger(numParticipants + 1);
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
