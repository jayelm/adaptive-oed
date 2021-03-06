var infrastructure = function() {
    var _ = underscore;

    var nodes = ['bright', 'on', 'hot'];
    // Quantity asked
    var N = 100;

    // If trivial, then weights/probs only have one option: used to iterate
    // quickly
    var trivial = false;
    // Should we Enumerate with the discrete probabilities?
    var discrete = true;
    // Should we remove dependent clause models from the model space?
    var simpleSpace = true;
    // Do I restrict background causes of nodes with parents to be [0, 0.5]?
    // TODO Implement
    var useCausedProbs = true;

    // DISCRETE & CONTINUOUS MODEL JUDGMENTS

    // With these weights, there are probably something like 100k models
    var probs = (trivial) ? [
        0.5
    ] : [
        // 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0
        0.0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0
    ];
    // Uniform prior
    var probsPrior = Beta({a:1, b: 1});

    // ASSUMPTION: If C is caused by B, then C doesn't occur often by itself
    // (intuitively; e.g. Griffiths & Tenenbaum 2005)
    var causedProbs = (trivial) ? [
        0.5
    ] : [
        // 0.0, 0.1, 0.2, 0.3, 0.4, 0.5
        0.0, 0.1, 0.3, 0.5
    ];
    // Skewed towards 0
    var causedProbsPrior = Beta({a: 5, b: 1});

    // ASSUMPTION: if a cause exists, then the cause is strong (0.5 - 1.0)
    // The *strong* part of *sparse and strong* priors (Lu 2008)
    var weights = (trivial) ? [
        0.5
    ] : [
        0.5, 0.7, 0.9, 1
    ];
    // Skewed towards 1
    var weightsPrior = Beta({a: 1, b: 5});

    // Since probs encompass [0, 1], make judgments the same
    var judgments = probs;
    var judgmentsPrior = probsPrior;

    // Utils
    var shuffle = function(toShuffle, shuffled) {
        if (toShuffle.length === 0) {
            return shuffled;
        }
        var toRemove = uniformDraw(toShuffle);
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

    var err = function(msg) {
        console.log(msg);
        console.log(error);
    };

    // Convert a condition to a natural language string.
    var conditionStr = function(cond) {
        var condStr = pam(Object.keys(cond), function(key, acc) {
            return cond[key] ? key : "not " + key;
        }).join(" and ");
        return condStr.replace("and not", "but not");
    };

    // Calculate the JPD table by sampling parent nodes and propagating
    // outwards.
    var JPD = function(aList, aWeights, aPriors) {
        // Identify global parent nodes
        var parents = retlif(Object.keys(aList), function(node) {
            return aList[node].length === 0;
        });
        var parProbs = pam(parents, function(p) {
            return aPriors[p];
        });

        var children = retlif(Object.keys(aList), function(node) {
            return aList[node].length !== 0;
        });

        var jpdDist = Enumerate(function() {
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
                            // DON'T USE === here, p1 is either null *or* undefined
                            return (p1 != null) ? p1 : p2; // jshint ignore:line
                        });
                        var allParentsAssigned = all(function(c) {
                            return c != null; // jshint ignore:line
                        }, parAssns);
                        if (allParentsAssigned) {
                            // Yuille (2008) noisy-logical.
                            // TODO: Encode noisy-logicals for preventive
                            // causes (later on)
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

            var nullAssns = repeat(children.length, function() { return null; });
            var chiObj = assign(_.object(children, nullAssns));
            var boolArr = pam(Object.keys(aList), function(node) {
                return (parObj[node] != null) ? parObj[node] : chiObj[node]; // jshint ignore:line
            });
            // Encode as a boolean, preserving aList order
            // return boolsToN(boolArr);
            return boolArr;
        });

        var jpdVals = _.values(jpdDist.params.dist);
        return zip(
            _.pluck(jpdVals, 'val'),
            _.pluck(jpdVals, 'prob')
        );
    };

    // XXX: To cache or not to cache?
    var marginal = function(jpd, ids, a) {
        // Due to floating point errors, this is sometimes slightly > 1
        return Math.min(1, reduce(function(row, prob) {
            var assns = row[0];
            var p = row[1];
            return (assns[ids[a]]) ? prob + p : prob;
        }, 0, jpd));
    };

    var conditional = function(jpd, ids, a, cond) {
        // The accumulator is [P(A, cond), P(cond)]
        var probs = reduce(function(row, probs) {
            var assns = row[0];
            var p = row[1];
            // Is the condition satisfied? check each condition manually
            var condition = all(function(c) {
                return assns[ids[c]] === cond[c];
            }, Object.keys(cond));
            if (condition) {
                return [
                    (assns[ids[a]]) ? probs[0] + p : probs[0],
                    probs[1] + p
                ];
            } else {
                return probs;
            }
        }, [0, 0], jpd);
        // P(A | cond) = P(A, cond) / P(cond)
        if (probs[0] === 0 && probs[1] === 0) {
            // This was never possible, return 0
            return 0;
        } else {
            return Math.min(1, probs[0] / probs[1]);
        }
    };

    var prettyPrint = function(dag) {
        return dag.toString();
        // Pretty-print the DAG according to the nodes
        // TODO: Or add jpd property to named model functions?
    };

    // Percentile: numeric, details top n% of the model posterior to keep
    // Rounds up
    var pruneModels = function(mPrior, percentile) {
        var sortedModels = sortOn(mPrior.support(), function(m) {
            return -mPrior.score(m);
        });
        var end = Math.ceil(sortedModels.length * percentile);
        var pruned = sortedModels.slice(0, end);
        console.log(pruned);
        return Enumerate(function() {
            var m = uniformDraw(pruned);
            factor(mPrior.score(m));
            return m;
        });
    };

    // a DAG functor, taking in an adjacency list (structure), a set of weights
    // (strength), and returning a function that scores experiments according to responses.
    var DAG = function(aList, aWeights, aPriors, modelName) {

        // XXX: Store JPD here, or add to a cache?
        var jpd = JPD(aList, aWeights, aPriors);
        // Internal numerical IDs for ordering of JPDS
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
                var marginalEst = marginal(jpd, ids, x.a);
                var score = Binomial({
                    n: N,
                    p: marginalEst
                }).score(Math.round(y * N));
                return (score === null) ? -Infinity : score;
            } else if (x.type === 'conditional') {
                var conditionalEst = conditional(jpd, ids, x.a, x.cond);
                var score = Binomial({
                    n: N,
                    p: conditionalEst
                }).score(Math.round(y * N));
                return (score === null) ? -Infinity : score;
            } else {
                err("unknown type " + x.type);
            }
        };
        var mName = modelName || JSON.stringify([aList, aWeights, aPriors, jpd]);
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
        var structs = Enumerate(function() {
            var struct = sampleStructures(nodes);
            if (simpleSpace) {
                // Require that the number of causal links <= 2
                var sCount = reduce(function(node, acc) {
                    return acc + struct[node].length;
                }, 0, nodes);
                condition(sCount <= 2);
            }
            return struct;
        }).support();
        return structs;
    });

    var sampleWeights = function(aList) {
        // Sample causal weights
        var aWeights = pamObject(aList, function(child, parents) {
            return repeat(parents.length, function() {
                // ASSUMPTION: See weights assumption
                return (discrete) ?
                    uniformDraw(weights) :
                    sample(weightsPrior);
            });
        });
        return aWeights;
    };

    var samplePriors = function(aList) {
        // Sample background weights ("priors?")
        var aPriors = pamObject(aList, function(child, parents) {
            // ASSUMPTION: see causedProbs assumption
            if (parents.length > 0) {
                return (discrete) ?
                    uniformDraw(causedProbs) :
                    sample(causedProbsPrior);
            } else {
                return (discrete) ?
                    uniformDraw(probs) :
                    sample(probsPrior);
            }
        });

        return aPriors;
    };

    var sampleN = function(arr, n) {
        var sampleObj = reduce(
            function(i, acc) {
                var s = uniformDraw(acc.rest);
                return {
                    sample: acc.sample.concat(s),
                    rest: _.without(acc.rest, s)
                };
            },
            {sample: [], rest: arr},
            _.range(n)
        );
        return sampleObj.sample;
    };

    // Sample a DAG
    var mSample = function() {
        var structAdjList = uniformDraw(enumerateStructures(nodes));
        var structAdjWeights = sampleWeights(structAdjList);
        var structAdjPriors = samplePriors(structAdjList);
        return DAG(structAdjList, structAdjWeights, structAdjPriors);
    };

    // Sample an experiment
    // TODO: For now, omit structure
    var xSample = function() {
        // var xType = uniformDraw(['structure', 'marginal', 'conditional']);
        var xType = uniformDraw(['marginal', 'conditional']);
        if (xType === 'structure') {
            var pair = sampleN(nodes, 2);
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
            var a = uniformDraw(nodes);
            return {
                type: xType,
                a: a,
                text: (
                    "Imagine 100 x. How many are " + a +
                    "? in [0, 1]"
                )
            };
        } else if (xType === 'conditional') {
            var a = uniformDraw(nodes); // jshint ignore:line
            var rest = _.without(nodes, a);
            // How many other variables to condition on
            var condAmt = randomInteger(rest.length) + 1;
            // var condAmt = 1; // If we just want to condition on 1 thing
            // Assign random varible to each rest
            var condNodes = sampleN(rest, condAmt);
            var cond = _.object(
                sort(condNodes),
                repeat(condAmt, flip)
            );
            return {
                type: xType,
                a: a,
                cond: cond,
                text: (
                    "Imagine 100 x that are " + conditionStr(cond) +
                    ". What proportion are " + a +
                    "? in [0, 1]"
                )
            };
        }
    };

    var ySample = function(x) {
        if (x.type === 'structure') {
            return uniformDraw([-1, 0, 1]);
        } else if (x.type === 'marginal' || x.type === 'conditional') {
            return (discrete) ?
                uniformDraw(judgments) :
                sample(judgmentsPrior);
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
                Infer({
                    method: 'MCMC',
                    kernel: 'MH',
                    samples: 10000,
                    burn: 1000,
                    // verbose: true
                }, thunk);
            },
            M2: !discrete && function(thunk) {
                Infer({
                    method: 'MCMC',
                    kernel: 'HMC',
                    samples: 500,
                    burn: 100,
                    // verbose: true
                }, thunk);
            },
            X: Enumerate,
            // Could use likely-first Enumeration. Idea: likelyfirst inherently
            // favors the top estimates. But might favor it too much.
            Y: !discrete && function(thunk) {
                Infer({
                    method: 'MCMC',
                    // HMC doesn't work - discrete?
                    kernel: 'MH',
                    samples: 1000,
                    burn: 100,
                    // verbose: true
                    // See notes on likelyFirst favoring MAP
                }, thunk);
            }
        }
    };
};

module.exports = infrastructure;
