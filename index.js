require('./webppl.min.js');
var prompt = require('prompt');

var makeSkeleton = function(infraThunk) {
    return {
        common: infraThunk,

        // Functionality that I want in all AOED methods
        commonUtils: function() {
        },

        initializePrior: function() {
            // The initial prior implied by args.M
            // TODO: If oed switches to reusable construct prior function, then
            // switch this too
            var M = args.M,
                inferM1 = (args.infer && args.infer.M1) || Enumerate;

            return inferM1(function() {
                var m = M();
                return {name: m.name, func: m};
            });
        },

        suggestExperiment: function() {
            var mPrior = globalStore.mPrior,
                usePredictiveY = globalStore.usePredictiveY,
                returnKL = globalStore.returnKL;

            var eigs = EIG({
                mPrior: mPrior,
                X: args.X,
                Y: args.Y,
                infer: args.infer,
                usePredictiveY: usePredictiveY,
                returnKL: returnKL
            });

            return getBestExpt(eigs.support());
        },

        suggestAll: function() {
            var mPrior = globalStore.mPrior,
                usePredictiveY = globalStore.usePredictiveY,
                returnKL = globalStore.returnKL;

            var eigs = EIG({
                mPrior: mPrior,
                X: args.X,
                Y: args.Y,
                infer: args.infer,
                usePredictiveY: usePredictiveY,
                returnKL: returnKL
            });

            return eigs.support();
        },

        updateBeliefs: function() {
            var x = globalStore.x,
                y = globalStore.y,
                mPrior = globalStore.mPrior;

            return updatePosterior({
                mPrior: mPrior,
                x: x,
                y: y,
                infer: args.infer // infrastructure
            });
        }
    };
};

var getThunkBody = function(thunk) {
    var thunkStr = thunk.toString();
    // Remove function() { ... };
    return thunkStr.slice(
        thunkStr.indexOf("{") + 1, thunkStr.lastIndexOf("}")
    );
};

var compileSkeleton = function(skeleton) {
    // Common to all functions
    var commonInfraStr = getThunkBody(skeleton.common);
    var commonUtilsStr = getThunkBody(skeleton.commonUtils);
    var commonStr = commonInfraStr + commonUtilsStr;

    // Individual functions
    var suggestStr = getThunkBody(skeleton.suggestExperiment);
    var suggestAllStr = getThunkBody(skeleton.suggestAll);
    var updateStr = getThunkBody(skeleton.updateBeliefs);
    var initialStr = getThunkBody(skeleton.initializePrior);

    // Concat common with the other objects
    var suggestSrc = webppl.compile(commonStr + suggestStr);
    var updateSrc = webppl.compile(commonStr + updateStr);
    var initialSrc = webppl.compile(commonStr + initialStr);
    var suggestAllSrc = webppl.compile(commonStr + suggestAllStr);

    var handleRunError = function(e) {
        // Just log it for now?
        throw e;
    };
    // XXX: Switch .cli to .web when using browser
    var runner = util.trampolineRunners.cli(handleRunError);

    // Need to get a container to store return values
    // XXX: Not sure if this will cause an asynchronous problem?
    // result -> ((store, returnValue) -> ())
    // side effect of return value func: result has returnValue property
    var makeStoreFunc = function(res) {
        return function(store, returnValue) {
            res.returnValue = returnValue;
        };
    };

    var aoed = {};

    // XXX: If you need to add any more arguments just switch to using an args
    // object. Right now this maintains backwards compatibility with other
    // suggest calls, since if usePredictiveY is unspecified, !!undefined is
    // false. Then make sure to update other calls to suggest in
    // examples/runCLI
    var suggest = function(mPrior, args) {
        var globalStore = {
            mPrior: mPrior,
            usePredictiveY: !!args.usePredictiveY,
            returnKL: !!args.returnKL
        };
        var _code = eval.call({}, suggestSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.suggest = suggest;

    var suggestAll = function(mPrior, args) {
        var globalStore = {
            mPrior: mPrior,
            usePredictiveY: !!args.usePredictiveY,
            returnKL: !!args.returnKL
        };
        var _code = eval.call({}, suggestAllSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.suggestAll = suggestAll;

    var update = function(mPrior, x, y) {
        // TODO: Make functor for $suggest, $update?
        var globalStore = {
            mPrior: mPrior,
            x: x,
            y: y
        };
        var _code = eval.call({}, updateSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.update = update;

    // Actually call the initialize source code to get the first model prior
    var initialPrior = eval.call({}, initialSrc)(runner);
    initialPrior({}, function(store, returnValue) {
        aoed.initialPrior = returnValue;
    }, '');

    return aoed;
};

var runCLI = function(aoed, args) {
    var repeatUpdate = function(prior) {
        console.log("Prior:");
        if (args.verbose) {
            console.log(prior);
            console.log("MAP:");
        }
        console.log(prior.MAP());

        var expts = aoed.suggestAll(prior, args);
        if (args.verbose) {
            console.log(expts);
        }
        // Get best experiment manually, so that we can display all of them if
        // wanted ^
        var bestExpt = {x: null, EIG: -Infinity};
        for (var i = 0; i < expts.length; i++) {
            var expt = expts[i];
            if (expt.EIG > bestExpt.EIG) {
                bestExpt = expt;
            }
        }
        console.log("Suggested experiment:");
        console.log(bestExpt);

        var x = bestExpt.x;

        prompt.start();
        prompt.get([
            {
                name: 'expt',
                message: 'Enter experiment result',
                type: 'string'
            }
        ], function(err, result) {
            if (err) {
                console.log(err);
                return 1;
            }
            var y = JSON.parse(result.expt);
            var res = aoed.update(prior, x, y);
            console.log("AIG: " + res.AIG);
            repeatUpdate(res.mPosterior);
        });
    };

    repeatUpdate(aoed.initialPrior);
};

// Like runCLI but doesn't force you to choose the best experiment
var runCLIAll = function(aoed, args) {
    var repeatUpdate = function(prior) {
        console.log("Prior:");
        if (args.verbose) {
            console.log(prior);
            console.log("MAP:");
        }
        console.log(prior.MAP());

        var expt = aoed.suggestAll(prior, args);
        console.log("Suggested experiments:");
        console.log(expt);

        prompt.start();
        prompt.get([
            {
                name: 'expt',
                message: 'Enter experiment',
                type: 'string'
            },
            {
                name: 'res',
                message: 'Enter experiment result',
                type: 'string'
            }
        ], function(err, result) {
            if (err) {
                console.log(err);
                return 1;
            }
            var x = JSON.parse(result.expt);
            var y = JSON.parse(result.res);
            var res = aoed.update(prior, x, y);
            console.log("AIG: " + res.AIG);
            repeatUpdate(res.mPosterior);
        });
    };

    repeatUpdate(aoed.initialPrior);
};

var AOED = function(infraThunk) {
    // Important: reflection must work on whatever platform this is running on.
    // Aside from that, the function must also have an args argument.
    // The lamest assert that these two issues are true is to search for "args"
    // as a substring.
    // XXX: There might be workarounds, e.g. have a separate args thunk that
    // returns an object, etc.

    // Fast isFunction check by underscore.js
    if (!(infraThunk && infraThunk.constructor &&
        infraThunk.call && infraThunk.apply)) {
        throw "argument is not a function";
    }

    // Check if the string is good to go
    var commonStr = infraThunk.toString();
    if (commonStr.indexOf("args") === -1) {
        throw "No `args` string detected in thunk, " +
              "or reflection isn't working. Check that your thunk's toString returns " +
              "something useful.";
    }

    var skeleton = makeSkeleton(infraThunk);
    return compileSkeleton(skeleton);
};

module.exports = {
    AOED: AOED,
    runCLI: runCLI,
    runCLIAll: runCLIAll,
};
