var infrastructure = function() {
    var _ = underscore;

    // TODO: This also assumes discrete judgments (for now), that come from
    // probs
    var discrete = true;
    // var probs = [0, 0.5];
    var weights = [-1, 1];

    var probs = [
        0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1
    ];
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

    var reflit = function(arr, f) {
        return filter(f, arr);
    };

    var lla = function(arr, pred) {
        return all(pred, all);
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

    var err = function(msg) {
        console.log(msg);
        console.log(error);
    };

    // Calculate the JPD table by sampling parent nodes and propagating
    // outwards.
    var JPD = function(aList, aWeights, aPriors) {
        // Identify global parent nodes
        var parents = reflit(Object.keys(aList), function(node) {
            return aList[node].length === 0;
        });
        var parProbs = pam(parents, function(p) {
            return aPriors[p];
        });

        var children = reflit(Object.keys(aList), function(node) {
            return aList[node].length !== 0;
        });

        return Enumerate(function() {
            // Parents occur with probability equal to background cause
            var parAssns = pamN(parents.length, function(i) {
                return flip(parProbs[i]);
            });
            // FIXME: after probmods/webppl#552
            // var parAssns = sample(MultivariateBernoulli({
                // ps: parProbs
            // }));
            var parObj = _.object(parents, parAssns);
            // Loop through children. If some of the parents aren't assigned,
            // skip that node. We want information to proceed in a "logical"
            // manner
            var assign = function(chiObj) {
                var newChiObj = pamObject(chiObj, function(node, val) {
                    // Careful: only use === to compare with chiObj vals, which
                    // are explicitly nulled
                    if (val === null) {
                        // Obtain parent values
                        var childPars = aList[node];
                        var parAssns = pam(childPars, function(c) {
                            // Either assigned as other children, or assigned
                            // as parents
                            // Need to check for presence of val, but can't use
                            // truthiness, since 0 is false
                            var p1 = chiObj[c];
                            var p2 = parObj[c];
                            return (p1 !== null) ? p1 : p2;
                        });
                        var allParentsAssigned = all(function(c) {
                            return c != null;
                        }, parAssns);
                        if (allParentsAssigned) {
                            // Yuille (2008) noisy-logical.
                            // XXX: For the case of one generative cause ~G,
                            // one preventive ~P, and one background cause ~B,
                            // we assume the boolean function (~G ^ ~P) v ~B.
                            // This is a rather arbitrary selection, and WON'T
                            // work if expanding to 4 boolean predicates.
                            // Alternatively, we'd need to sample from possible
                            // boolean combinations (perhaps sample a unique
                            // "precedence" for G, B, P, etc.)

                            // The probability of c occurring absent of causes
                            var initw0 = aPriors[node];

                            // Assignments to the parents, and their weights
                            var parentsAndWeights = zip(parAssns, aWeights[node]);

                            var prob = reduce(
                                function(pArr, w0) {
                                    var parent = pArr[0];
                                    var w1 = pArr[1];

                                    // If parent is not ON, then whatever effect
                                    // (generative/preventive) won't manifest, so
                                    // leave w0 alone
                                    if (!parent) {
                                        return w0;
                                    } else {
                                        // Otherwise, calculate increased/decreased
                                        // probability
                                        var cmp2 = (w1 >= 0) ?
                                            1 - ((1 - w0) * (1 - w1)) : // Noisy-or
                                            w0 * (1 + w1); // Noisy-not-and
                                        return cmp2;
                                    }
                                },
                                initw0,
                                parentsAndWeights
                            );

                            // Assign random flip according to this probability
                            return flip(prob);
                        } else {
                            // Wait for other children to be assigned
                            return null;
                        }
                    } else {
                        // Value has already been sampled; return value as is
                        return val;
                    }
                });

                if (_.values(newChiObj).indexOf(null) !== -1) {
                    // Some still unassigned
                    return assign(newChiObj);
                } else {
                    return newChiObj;
                }
            };

            var nullAssns = pamN(children.length, function(c) { return null; });
            var chiObj = assign(_.object(children, nullAssns));
            // Return these in aList order
            return pam(Object.keys(aList), function(node) {
                return (parObj[node] != null) ? parObj[node] : chiObj[node];
            });
        });
    };

    // a DAG functor, taking in an adjacency list (structure), a set of weights
    // (strength), and returning a function that scores experiments according to responses.
    var DAG = function(aList, aWeights, aPriors) {
        // XXX: Store JPD here, or add to a cache?
        var jpd = JPD(aList, aWeights, aPriors);
        // Numerical IDs for ordering of JPDS
        var ids = _.object(Object.keys(aList), _.range(Object.keys(aList).length));
        var dagModel = function(x, y) {
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
                // To make this delta, p should be 1. For noise, decrease p
                return Bernoulli({p: 0.9}).score(compatible);
            } else if (x.type === 'marginal') {
                var marginalEst = marginal(jpd, ids[x.a]);
                return Binomial({
                    n: 100,
                    p: marginalEst
                }).score(y);
            } else if (x.type === 'conditional') {
                var conditionalEst = conditional(jpd, ids[x.a], x.rest);
                return Binomial({
                    n: 100,
                    p: conditionalEst
                }).score(y);
            } else {
                err("unknown type " + x.type);
            }
        };
        // Don't encode JPDs into model name, too verbose
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
            // Keep edges with probability equal (normalize later)
            return sort(retlif(toNodes, function() {
                flip(0.5);
            }));
        });

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
        // Sample causal weights
        var aWeights = pamObject(aList, function(from, tos) {
            return pam(tos, function(t) {
                if (discrete) {
                    return uniformDraw(weights);
                } else {
                    // Alternatively, scale a Beta distribution
                    return sample(Uniform({a: -1, b: 1}));
                }
            });
        });
        return aWeights;
    };

    var samplePriors = function(aList) {
        // Sample background weights ("priors?")
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
    // var mSample = function() {
        // var structAdjList = uniformDraw(enumerateStructures(nodes));
        // var structAdjWeights = sampleWeights(structAdjList);
        // var structAdjPriors = samplePriors(structAdjList);
        // return DAG(structAdjList, structAdjWeights, structAdjPriors);
    // };
    var mSample = function() {
        return uniformDraw([
            // Null
            DAG(
                {bright: [], hot: [], on: []},
                {bright: [], hot: [], on: []},
                {bright: 0.5, hot: 0.5, on: 0.5}
            ),
            // half bulbs are on, and all are bright + hot
            DAG(
                {bright: ['on'], hot: ['on'], on: []},
                {bright: [1], hot: [1], on: []},
                {bright: 0, hot: 0, on: 0.5}
            ),
            // Hot causes brightness
            DAG(
                {bright: ['hot'], hot: ['on'], on: []},
                {bright: [1], hot: [1], on: []},
                {bright: 0, hot: 0, on: 0.5}
            ),
            // "Some bulbs are eco-friendly"
            // DAG(
                // {bright: ['on'], hot: ['on'], on: []},
                // {bright: [1], hot: [0.8], on: []},
                // {bright: 0, hot: 0, on: 0.5}
            // ),
            // "Most lightbulbs are off"
            // DAG(
                // {bright: ['on'], hot: ['on'], on: []},
                // {bright: [1], hot: [1], on: []},
                // {bright: 0, hot: 0, on: 0.2}
            // )
        ]);
    };

    // Sample an experiment
    // TODO: For now, omit structure
    var xSample = function() {
        // var xType = uniformDraw(['structure', 'marginal', 'conditional']);
        var xType = uniformDraw(['marginal', 'conditional']);
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
                    "Imagine 100 x. How many are " + a +
                    "? in [0, 1]"
                )
            };
        } else if (xType === 'conditional') {
            var a = nodes[randomInteger(nodes.length)];
            var rest = _.without(nodes, a);
            // How many other variables to condition on
            var condAmt = randomInteger(rest.length) + 1;
            // Assign random varible to each rest
            var condNodes = sampleN(rest, condAmt);
            var cond = _.object(
                condNodes,
                repeat(condAmt, flip)
            );
            return {
                type: xType,
                a: a,
                cond: cond,
                text: (
                    "Imagine 100 x that are " + cond +
                    ". What proportion are " + a +
                    "? in [0, 1]"
                )
            };
        }
    };

    var ySample = function(x) {
        if (x.type === 'structure') {
            return uniformDraw([-1, 0, 1]);
            // Responses on marginal/conditionals are continuous
        } else if (x.type === 'marginal' || x.type === 'conditional') {
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
            // Y: function(thunk) {
                // Infer({
                    // method: 'enumerate',
                    // maxExecutions: 100,
                    // // See notes on likelyFirst favoring MAP
                    // strategy: 'likelyFirst'
                // }, thunk);
            // }
            Y: !discrete && function(thunk) {
                console.log('mcmc');
                Infer({
                    method: 'MCMC',
                    kernel: 'MH',
                    samples: 10,
                }, thunk);
            }
        }
    };
};

module.exports = infrastructure;
