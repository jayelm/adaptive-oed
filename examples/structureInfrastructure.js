var infrastructure = function() {
    var nodes = ['bright', 'on', 'hot'];
    var thing = 'lightbulbs';
    // Quantity asked
    var N = 100;

    // Make model enumeration very quick, by fixing background probabilities to
    // 0.5. Used for iteration
    var trivial = false;
    // If this is true, then rely entirely on the passed-in cache; attempting
    // to score models will result in an error
    var cacheEverything = true;
    // Should we Enumerate with the discrete probabilities?
    var discrete = true;
    // What is the bin width of the beta discretization?
    var binWidth = 0.1;
    // Should we remove dependent clause models from the model space?
    var simpleSpace = true;

    var roundTo = function(n, mult) {
        return mult * Math.round(n / mult);
    };

    var EPSILON = 0.000001;
    var discretizeBeta = function(bd, binWidth, nSamples, keepZeros) {
        return Infer({method: 'rejection', samples: nSamples}, function() {
            var samp = sample(bd);
            var rounded = roundTo(samp, binWidth);
            if (!keepZeros) {
                // For structural weights, it doesn't make sense to have 0
                // probabilities
                condition(rounded !== 0);
            }
            // Modify 0 and 1 by infinitesimal values to prevent philosophical
            // conundrums that make us question the nature of zero,
            // impossibility, and mathematics itself
            if (rounded === 0) {
                return rounded + EPSILON;
            } else if (rounded === 1) {
                return rounded - EPSILON;
            } else {
                return rounded;
            }
        });
    };

    // Uniform background probabilities and judgments
    var probs = discretizeBeta(Beta({a: 1, b: 1}), binWidth, 100000, true);
    var probsPrior = Beta({a: 1, b: 1});

    var weights = discretizeBeta(Beta({a: 4, b: 1}), binWidth, 100000, false);
    var weightsPrior = Beta({a: 4, b: 1});  // Skewed towards 1 (*strong*)

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
        return condStr;
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

            var parObj = _.object(parents, parAssns);

            var assign = function(chiObj) {
                var newChiObj = pamObject(chiObj, function(node, val) {
                    if (val === null) {
                        // Obtain parent values
                        var childPars = aList[node];
                        var parAssns = pam(childPars, function(c) {
                            // Either assigned as other children, or assigned
                            // as parents
                            var p1 = chiObj[c];
                            var p2 = parObj[c];
                            // DON'T USE === here, p1 is either null *or* undefined
                            return (p1 != null) ? p1 : p2; // jshint ignore:line
                        });
                        var allParentsAssigned = all(function(c) {
                            return c != null; // jshint ignore:line
                        }, parAssns);
                        if (allParentsAssigned) {

                            // The probability of c occurring absent of causes
                            var initw0 = aPriors[node];

                            // Assignments to the parents, and their weights
                            var parentsAndWeights = zip(parAssns, aWeights[node]);

                            var prob = reduce(
                                function(pArr, w0) {
                                    var parent = pArr[0];
                                    var w1 = pArr[1];
                                    if (!parent) {
                                        return w0;
                                    } else {
                                        var cmp2 = (w1 >= 0) ?
                                            1 - ((1 - w0) * (1 - w1)) : // Noisy-or
                                            w0 * (1 + w1); // Noisy-not-and
                                        return cmp2;
                                    }
                                },
                                initw0,
                                parentsAndWeights
                            );

                            return flip(prob);
                        } else {
                            return null;
                        }
                    } else {
                        return val;
                    }
                });

                if (_.values(newChiObj).indexOf(null) !== -1) {
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
            // This shouldn't happen, since we never have zero probabilities
            err(probs);
        } else {
            return Math.min(1, probs[0] / probs[1]);
        }
    };

    var prettyPrint = function(dag) {
        return dag.toString();
        // Pretty-print the DAG according to the nodes
    };

    // a DAG functor, taking in an adjacency list (structure), a set of weights
    // (strength), and returning a function that scores experiments according to responses.
    var DAG = function(aList, modelName) {

        var jpds = enumerateJPD(aList);
        // console.log(jpds);
        // console.log(jpds.support().length);

        // Internal numerical IDs for ordering of JPDS
        var ids = _.object(Object.keys(aList), _.range(Object.keys(aList).length));
        // TODO: Only works reliably w/ Enumerate (so that this is
        // deterministic)
        // Don't cache, since we're caching outside of this
        var dagModel = function(x, y) {
            if (x.type === 'structure') {
                err('structure not implemented for this model');
            } else if (x.type === 'marginal') {
                var marginalScores = Enumerate(function() {
                    var jpd = sample(jpds);
                    var marginalEst = marginal(jpd, ids, x.a);
                    var score = Binomial({
                        n: N,
                        p: marginalEst
                    }).score(Math.round(y.y * N));

                    return (score === null) ? -Infinity : score;
                });
                return logsumexpectation(marginalScores);
            } else if (x.type === 'conditional') {
                var conditionalScores = Enumerate(function() {
                    var jpd = sample(jpds);
                    var conditionalEst = conditional(jpd, ids, x.a, x.cond);
                    var score = Binomial({
                        n: N,
                        p: conditionalEst
                    }).score(Math.round(y.y * N));

                    return (score === null) ? -Infinity : score;
                });
                return logsumexpectation(conditionalScores);
            } else {
                err("unknown type " + x.type);
            }
        };
        var mName = modelName || JSON.stringify([aList]);
        return Model(mName, dagModel);
    };


    var sampleWeights = function(aList) {
        // Sample causal weights
        var aWeights = pamObject(aList, function(child, parents) {
            return repeat(parents.length, function() {
                // ASSUMPTION: See weights assumption
                return (discrete) ?
                    sample(weights) :
                    sample(weightsPrior);
            });
        });
        return aWeights;
    };

    var samplePriors = function(aList) {
        // TEST: Are probability MAPs the same across a uniform prior if you
        // incude 0:1:0.1, versus just 0.5?
        var aPriors = pamObject(aList, function(child, parents) {
            return (discrete) ?
                sample(probs) :
                sample(probsPrior);
        });

        return aPriors;
    };

    // ONLY return 0.5 and see if it works
    var sampleDumbPriors = function(aList) {
        return pamObject(aList, function(child, parents) {
            return 0.2;
        });
    };

    var sampleDumbWeights = function(aList) {
        return pamObject(aList, function(child, parents) {
            return repeat(parents.length, function() { return 0.7; });
        });
    };

    var enumerateJPD = function(aList) {
        var jpdDist = Enumerate(function() {
            var aPriors = (trivial) ?
                sampleDumbPriors(aList) :
                samplePriors(aList);

            var aWeights = (trivial) ?
                sampleDumbWeights(aList) :
                sampleWeights(aList);

            return JPD(aList, aWeights, aPriors);
        });

        return jpdDist;
    };

    // More information returned from JPD for debugging
    var enumerateJPD2 = function(aList) {
        var jpdDist = Enumerate(function() {
            var aPriors = (trivial) ?
                sampleDumbPriors(aList) :
                samplePriors(aList);

            var aWeights = (trivial) ?
                sampleDumbWeights(aList) :
                sampleWeights(aList);

            return {
                jpd: JPD(aList, aWeights, aPriors),
                aList: aList,
                aWeights: aWeights,
                aPriors: aPriors
            };
        });

        return jpdDist;
    };

    var sampleStructures = function(nodes) {
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
        // TODO: Sparsity! Factor by the number of connections?
        // Still need sparsity prior here...
        var structAdjList = uniformDraw(enumerateStructures(nodes));
        // var structAdjList = enumerateStructures(nodes)[3];
        if (cacheEverything) {
            return Model(
                JSON.stringify([structAdjList]),
                function(x, y) {
                    console.log(x, y);
                    err('x, y not in cache');
                }
            );
        } else {
            return DAG(structAdjList);
        }
    };

    // Sample an experiment
    // TODO: For now, omit structure
    var xSample = function() {
        var xType = uniformDraw(['marginal', 'conditional']);
        if (xType === 'structure') {
            var pair = sampleN(nodes, 2);
            var child = pair[0],
                parent = pair[1];
            return {
                type: xType,
                child: child,
                parent: parent,
                name: (
                    "Does " + parent +
                    " cause " + child +
                    "[1], prevent " + child +
                    "[-1], or have no effect [0]?"
                )
            };
        } else if (xType === 'marginal') {
            var a = uniformDraw(nodes);
            // Messed around and set this s.t. marginals and conditionals are
            // favored equally if taking into account weighted computations
            factor(-1.5);
            return {
                type: xType,
                a: a,
                name: (
                    "Imagine 100 " + thing + ". How many are " + a +
                    "? in [0, 1]"
                )
            };
        } else if (xType === 'conditional') {
            var a = uniformDraw(nodes); // jshint ignore:line
            var rest = _.without(nodes, a);
            // How many other variables to condition on
            // var condAmt = randomInteger(rest.length) + 1;
            // FIXME: Assumes rest.length is 2
            var condAmt = sample(Categorical({
                vs: [1, 2],
                ps: [0.6, 0.4]
            }));
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
                name: (
                    "Imagine 100 " + thing + " that are " + conditionStr(cond) +
                    ". What proportion are " + a +
                    "? in [0, 1]"
                ),
            };
        }
    };

    var ySample = function(x) {
        if (x.type === 'structure') {
            var y = uniformDraw([-1, 0, 1]);
            return {
                y: y,
                name: y.toString()
            };
        } else if (x.type === 'marginal' || x.type === 'conditional') {
            var y = (discrete) ?
                sample(judgments) :
                sample(judgmentsPrior);
            return {
                y: y,
                name: y.toString()
            };
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
                    verbose: true
                }, thunk);
            },
            M2: !discrete && function(thunk) {
                Infer({
                    method: 'MCMC',
                    kernel: 'HMC',
                    samples: 500,
                    burn: 100,
                    verbose: true
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
                    verbose: true
                    // See notes on likelyFirst favoring MAP
                }, thunk);
            }
        }
    };
};

module.exports = infrastructure;
