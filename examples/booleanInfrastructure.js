var infrastructure = function() {
    var _ = underscore;

    // TODO: This also assumes discrete judgments (for now), that come from
    // probs
    var discrete = true;
    var probs = [0, 0.5];
    var weights = [-1, 1];

    // var probs = [
        // 0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1
    // ];
    // var weights = [
        // -0.01, -0.05, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9,
        // -0.95, -0.99, -1, 0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
        // 0.8, 0.9, 0.95, 0.99, 1
    // ];

    var shuffle = function(toShuffle, shuffled) {
        if (toShuffle.length === 0) {
            return shuffled;
        }
        var i = randomInteger(toShuffle.length);
        var toRemove = toShuffle[i];
        return shuffle(_.without(toShuffle, toRemove), append(shuffled, toRemove));
    };

    var pam = function(arr, f) {
        return map(f, arr);
    };

    var pamObject = function(obj, f) {
        return mapObject(f, obj);
    };

    var pamN = function(n, f) {
        return mapN(f, n);
    };

    var retlif = function(arr, f) {
        return filter(f, arr);
    };

    var ecuder = function(arr, init, f) {
        return reduce(f, init, arr);
    };

    var err = function(msg) {
        console.log(msg);
        console.log(error);
    };

    // Calculate P(A).
    // Because we're restricting ourselves to n = 3, exact inference is
    // possible.
    // XXX: cache might overflow, we're caching a LOT of things
    // XXX: What happens when w0 = 1, w1 = -1? Output is 1, is that correct?
    var marginal = dp.cache(function(aList, aWeights, aPriors, a) {
        // Lemmer & Gossnik RNOR. Works associatively in the cases of noisy ORs.
        // FIXME: Consider dependent clauses (see RNOR paper)
        // FIXME: This doesn't work associatively for noisy ANDS! Use
        // something like Yuille (2008)
        // Also works for the cases where parents are empty and parents have
        // length 1
        var initw0 = aPriors[a];
        var parentsAndWeights = zip(aList[a], aWeights[a]);
        return ecuder(parentsAndWeights, initw0, function(pandw, w0) {
            var parent = pandw[0];
            var w1 = pandw[1];

            var parentProb = marginal(aList, aWeights, aPriors, parent);

            // Component 1: a happens in the absence of parentProb (c = 0)
            var cmp1 = w0;
            // Component 2: probabiltiy of w manifesting in presence of parentProb,
            // either generative or preventive
            var cmp2 = (w1 >= 0) ?
                1 - ((1 - w0) * (1 - w1)) : // Noisy-or
                w0 * (1 + w1); // Noisy-nand

            return cmp1 * (1 - parentProb) + cmp2 * parentProb;
        });
    });

    // Calculate P(A | B). Same XXXs as above.
    // TODO: This needs to work forwards and backwards
    // Need a more general formula for this.
    // Although inefficient, in the n = 3 case, this is reasonable: just
    // calculate using joint probability and marginal formulas:
    // P(C | B) = P(B, C) / P(B)
    // P(B | C) = P(B, C) / P(C)
    // ^ Marginal, and P(B, C) = \sum_{A}P(A, B, C) = \prod P(X_i | Parents(X_i))
    // In the backwards (explanation) direction:
    // P(B | A):
    // check if A's ancestry contains B.
    // If yes, then since this is a DAG, you need to work backwards.
    // Otherwise, you need to work forwards. It could be that indeed B's
    // ancestry doesn't contain A either, but the propagation will simply not
    // condition on the evidence, which is fine.
    var conditional = dp.cache(function(aList, aWeights, aPriors, a, b, bTruth) {
        var initw0 = aPriors[a];
        var parentsAndWeights = zip(aList[a], aWeights[a]);
        return ecuder(parentsAndWeights, initw0, function(pandw, w0) {
            var parent = pandw[0];
            var w1 = pandw[1];

            var parentProb =
                // Current parent is B, and we're conditioning on B = true.
                // probability of the parent occurring <- 1.
                (pandw[0] === b && bTruth) ? 1 :
                // Current parent is B and condition on B = false.
                // Probability of the parent occurring <- 0
                (pandw[1] === b && !bTruth) ? 0 :
                // Otherwise calculate conditional recursively, propagating the
                // condition of b/bTruth
                conditional(aList, aWeights, aPriors, pandw[0], b, bTruth);

            // OPTIMIZE: calculating both components even if parentProb is 1 or 0.
            var cmp1 = w0;
            var cmp2 = (w1 >= 0) ?
                1 - ((1 - w0) * (1 - w1)) :
                w0 * (1 + w1);

            return cmp1 * (1 - parentProb) + cmp2 * parentProb;
        });
    });

    // a DAG functor, taking in an adjacency list (structure), a set of weights
    // (strength), and returning a function that scores experiments according to responses.
    var DAG = function(aList, aWeights, aPriors) {
        // aList is an object connecting vertices
        // aList is a set of weights for each connection.
        var dagModel = function(x, y) {
            // TODO: Is this the right way of encoding human noisiness (by
            // making the parameter estimates of these models themselves
            // noisy?)
            if (x.type === 'structure') {
                // Any way to make this faster than these linear checks...hash?
                var pIndex = aList[x.child].indexOf(x.parent);
                var compatible = (
                    // "No effect", and no relationship in parents
                    (y === 0) && (pIndex === -1) ||
                    // Generative effect - positive weight in parents
                    (y === 1) && (pIndex !== -1) && aWeights[x.child][pIndex] >= 0 ||
                    // Preventive effect - - negative weight in parents
                    (y === -1) && (pIndex !== -1) && aWeights[x.child][pIndex] < 0
                );
                // To make this delta, p should be 1
                // Let's say 0.9, instead
                return Bernoulli({p: 0.9}).score(compatible);
            } else if (x.type === 'marginal') {
                var marginalMAP = marginal(aList, aWeights, aPriors, x.a);
                return Gaussian({
                    mu: marginalMAP,
                    sigma: 0.1
                }).score(y);
            } else if (x.type === 'conditional') {
                var conditionalMAP = conditional(
                    aList, aWeights, aPriors,
                    x.a, x.b, x.bTruth
                );
                return Gaussian({
                    mu: conditionalMAP,
                    sigma: 0.1
                }).score(y);
            } else {
                err("unknown type " + x.type);
            }
        };
        var mName = JSON.stringify([aList, aWeights, aPriors]);
        return Model(mName, dagModel);
    };

    var sampleStructures = function(nodes) {
        // TODO: Sparsity prior?
        // FIXME: This is the absolute worst way to construct a DAG that will be
        // completely impractical for n > 3. But since n = 3, just go with it
        // There are probably some far more clever things you can do sampling from
        // an adjacency matrix (see OEIS A003024)

        // Assume this is the topological ordering.
        var orderedNodes = shuffle(nodes, []);
        // Now, randomly draw edges with probably 0.5 connecting lower rank to
        // higher rank edges.
        var edges = pamN(orderedNodes.length, function(i) {
            var toNodes = _.rest(orderedNodes, i + 1);
            // Keep edges with probability equal
            return sort(retlif(toNodes, function() {
                flip(0.5);
            }));
        });


        // Sample from noisy-or vs noisy-nand
        // inhibit
        // TODO: when identified joint causes, sample from noisy-or vs noisy-nand

        var unsorted = _.object(orderedNodes, edges);

        var sortedNodes = sort(orderedNodes);
        // Now sort the object in order of keys
        return _.object(sortedNodes, pam(sortedNodes, function(n) {
            return unsorted[n];
        }));
    };

    var enumerateStructures = cache(function(nodes) {
        return Enumerate(function() {
            sampleStructures(nodes);
        }).support();
    });

    var sampleWeights = function(aList) {
        // Create another adjacency-list-esque thing, but instead containing
        // weights
        var aWeights = pamObject(aList, function(from, tos) {
            return pam(tos, function(t) {
                if (discrete) {
                    return uniformDraw(weights);
                } else {
                    // Uniform prior on weights?...but they should be negative?
                    // Alternatively, scale a Beta distribution
                    return sample(Uniform({a: -1, b: 1}));
                }
            });
        });
        // TODO: What are the data structures for the weights
        return aWeights;
    };

    var samplePriors = function(aList) {
        var aPriors = pamObject(aList, function(from, tos) {
            // Ignore tos, just sample a probability
            if (discrete) {
                return uniformDraw(probs);
            } else {
                return sample(Beta({a: 1, b: 1}));
            }
        });

        return aPriors;
    };

    var nodes = ['bright', 'on', 'hot'];

    // FIXME: Any way to sample without replacement instead of this?
    var randomPair = function(nodes) {
        var n1 = nodes[randomInteger(nodes.length)];
        var possN2 = _.without(nodes, n1);
        var n2 = possN2[randomInteger(possN2.length)];
        return [n1, n2];
    };

    // Sample a DAG
    var mSample = function() {
        var structAdjList = uniformDraw(enumerateStructures(nodes));
        var structAdjWeights = sampleWeights(structAdjList);
        var structAdjPriors = samplePriors(structAdjList);
        return DAG(structAdjList, structAdjWeights, structAdjPriors);
    };

    // Sample an experiment
    var xSample = function() {
        // Then later, conditional
        var xType = uniformDraw(['structure', 'marginal', 'conditional']);
        // var xType = 'structure';
        if (xType === 'structure') {
            var pair = randomPair(nodes);
            var child = pair[0],
                parent = pair[1];
            return {
                type: xType,
                child: child,
                parent: parent,
                text: (
                    "Does " + parent +
                    " cause " + child +
                    "[1], prevent " + child +
                    "[-1], or have no effect [0]?"
                )
            };
        } else if (xType === 'marginal') {
            var a = nodes[randomInteger(nodes.length)];
            return {
                type: xType,
                a: a,
                text: (
                    "Image 100 x. How many are " + a +
                    "? in [0, 1]"
                )
            };
        } else if (xType === 'conditional') {
            var pair = randomPair(nodes);
            // TODO: Is there a more proper notation for this than just
            // assuming P(A|B)?
            var a = pair[0],
                b = pair[1];
            return {
                type: xType,
                a: a,
                b: b,
                // Either P(A | B) or P(A | ~B)
                bTruth: flip(),
                text: (
                    "Imagine 100 x that are " + b +
                    ". What proportion are " + a +
                    "? in [0, 1]"
                )
            };
        }
    };

    var ySample = function(x) {
        if (x.type === 'structure') {
            return uniformDraw([-1, 0, 1]);
        } else if (x.type === 'marginal') {
            // Totally uninformative prior
            if (discrete) {
                return uniformDraw(probs);
            } else {
                return sample(Beta({a: 1, b: 1}));
            }
        } else if (x.type === 'conditional') {
            // Totally uninformative prior
            if (discrete) {
                return uniformDraw(probs);
            } else {
                return sample(Beta({a: 1, b: 1}));
            }
        } else {
            err("unknown x type " + x.type);
        }
    };

    var args = {
        M: mSample,
        X: xSample,
        Y: ySample,
        infer: {
            M1: !discrete && function(thunk) {
                console.log('mcmc');
                Infer({
                    method: 'MCMC',
                    kernel: 'MH',
                    samples: 10000,
                    burn: 5000,
                }, thunk);
            },
            M2: !discrete && function(thunk) {
                console.log('mcmc');
                Infer({
                    method: 'MCMC',
                    kernel: 'MH',
                    samples: 500,
                    burn: 100,
                }, thunk);
            },
            X: Enumerate,
            // Only 6, but if using predictive y, then need approximation
            Y: function(thunk) {
                Infer({
                    method: 'enumerate',
                    maxExecutions: 100,
                    // See notes on likelyFirst favoring MAP
                    strategy: 'likelyFirst'
                }, thunk);
            }
            // Y: !discrete && function(thunk) {
                // console.log('mcmc');
                // Infer({
                    // method: 'MCMC',
                    // kernel: 'MH',
                    // samples: 10,
                // }, thunk);
            // }
        }
    };
};

module.exports = infrastructure;
