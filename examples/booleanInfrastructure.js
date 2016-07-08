var infrastructure = function() {
    var _ = underscore;

    // Q: how many DAGs possible for 3 variables?
    // There are 25 DAGs possible for 3 variables. We wish to learn this structure.`

    // Questions about the presence of causal relationships inform structure.
    // Questions about the strength of causal relationships inform weights \in [0, 1].

    // A "generate all DAG aLists" function?

    // Cache the enumeration of all possible DAGs. Sample weights from the DAGs.
    // Model sampling funciton: pick a DAG, pick some weights. Give the option to
    // specify priors if you believe some weights to be true: likely-first
    // enumeration would be nice

    // Seems like OED can handle two sets of experiments? Just stratify the
    // response sample and the scoring function (i.e. if (type is exp1) return
    // scoreexp1, else)

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

    // a DAG functor, taking in an adjacency list (structure), a set of weights
    // (strength), and returning a function that scores experiments according to responses.
    var DAG = function(aList, aWeights) {
        // aList is an object connecting vertices
        // aList is a set of weights for each connection.
        // You need to assert that the weights are the same as the list
        // TODO: This should return a MODEL (MODEL WRAPPER)!
        var dagModel = function(x, y) {
            if (x.type === 'structure') {
                // console.log('structure');
                // console.log(aList[x.child]);
                // console.log(x.child);
                // console.log(x.parent);
                // If the current list has the correct weights
                // Any way to make this faster than these linear checks...hash?
                if (y && aList[x.child].includes(x.parent) ||
                    !y && !aList[x.child].includes(x.parent)) {
                    // console.log("Yup");
                    return 0;
                } else {
                    return -Infinity; // Problem: are judgments a bit noisy?
                }
            } else {
                // assert x.type === 'strength'
                // score by strength
                // It's a prior?
            }
        };
        var mName = JSON.stringify([aList, aWeights]);
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
                // Uniform prior on weights?
                sample(Uniform({a: 0, b: 1}));
            });
        });
        // TODO: What are the data structures for the weights
        return aWeights;
    };

    var nodes = ['bright', 'on', 'hot'];

    // Sample a DAG
    var mSample = function() {
        var structAdjList = uniformDraw(enumerateStructures(nodes));
        var structAdjWeights = sampleWeights(structAdjList);
        // return [structAdjList, structAdjWeights];
        return DAG(structAdjList, structAdjWeights);
    };

    // Sample an experiment
    var xSample = function() {
        // var xType = uniformDraw(['structure', 'strength']);
        var xType = 'structure';
        if (xType === 'structure') {
            // Please let there be sample w/o replacement later...
            var child = nodes[randomInteger(nodes.length)];
            var possParents = _.without(nodes, child);
            var parent = possParents[randomInteger(possParents.length)];
            return {
                type: xType,
                child: child,
                parent: parent
            };
        } else {

        }
        // Should incorporate nodes here, obviously
        // Pick a random relationship
        // return x;
    };

    // TODO:
    // http://cs.stackexchange.com/questions/580/what-combination-of-data-structures-efficiently-stores-discrete-bayesian-network
    // Remember that edge weights encode weights of noisy-ors, for which you calculate the CPT
    // Remember that edge weights could be negative (make sure to find some way of
    // identifying preventative)
    // Remember that when you don't know fixed values for priors, etc. you need to
    // integrate over them


    // Verify DAG? Check if loops (depth first search)
    var ySample = function() {
        // Can we optimize this away (OED)?
        return flip();
        // var yType = uniformDraw(['structure', 'strength']);
        // if (yType === 'structure') {

        // } else {

        // }
        // return y;
    };

    // repeat(400, mSample);
    // var mDist = Infer({method: 'MCMC', kernel: 'MH', samples: 100000, burn: 5000, verbose: true}, mSample);
    // sample(mDist);
    // Enumerate(xSample);
    var args = {
        M: mSample,
        X: xSample,
        Y: ySample,
        infer: {
            M1: function(thunk) {
                Infer({
                    method: 'MCMC',
                    kernel: 'MH',
                    samples: 10000,
                    burn: 5000,
                    // verbose: true
                }, thunk);
            },
            M2: function(thunk) {
                Infer({
                    method: 'MCMC',
                    kernel: 'MH',
                    samples: 1000,
                    burn: 500,
                    // verbose: true
                }, thunk);
            },
            X: Enumerate, // only 6
            Y: Enumerate, // true or false
            // usePredictiveY: true
        }
    };
};

module.exports = infrastructure;
