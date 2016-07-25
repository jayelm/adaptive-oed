require('./webppl.min.js');

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
                var m = M(); // jshint ignore:line
                return {name: m.name, func: m};
            });
        },

        suggestExperiment: function() {
            var mPrior = globalStore.mPrior,
                usePredictiveY = globalStore.usePredictiveY,
                returnKL = globalStore.returnKL,
                cache = globalStore.cache;

            var eigs = EIG({
                mPrior: mPrior,
                X: args.X,
                Y: args.Y,
                infer: args.infer,
                usePredictiveY: usePredictiveY,
                returnKL: returnKL,
                cache: cache
            });

            return getBestExpt(eigs.support());
        },

        suggestAll: function() {
            var mPrior = globalStore.mPrior,
                usePredictiveY = globalStore.usePredictiveY,
                returnKL = globalStore.returnKL,
                cache = globalStore.cache;

            var eigs = EIG({
                mPrior: mPrior,
                X: args.X,
                Y: args.Y,
                infer: args.infer,
                usePredictiveY: usePredictiveY,
                returnKL: returnKL,
                cache: cache
            });

            return eigs.support();
        },

        updateBeliefs: function() {
            var x = globalStore.x,
                y = globalStore.y,
                mPrior = globalStore.mPrior,
                cache = globalStore.cache;

            // FIXME: These functions really ought to be converted to args
            // objects
            var prune = globalStore.prune || {},
                pruneMin = prune.min || Infinity,
                keepPercent = prune.keepPercent || 1.0;

            var res = updatePosterior({
                mPrior: mPrior,
                x: x,
                y: y,
                infer: args.infer,
                cache: cache
            });

            if (res.mPosterior.support().length > pruneMin) {
                var pruned = pruneModels(res.mPosterior, keepPercent);
                return {
                    mPosterior: pruned,
                    AIG: res.AIG
                };
            } else {
                return res;
            }
        },

        cache: function() {
            return cacheScores(args);
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
    var cacheStr = getThunkBody(skeleton.cache);

    // Concat common with the other objects
    var suggestSrc = webppl.compile(commonStr + suggestStr);
    var updateSrc = webppl.compile(commonStr + updateStr);
    var initialSrc = webppl.compile(commonStr + initialStr);
    var suggestAllSrc = webppl.compile(commonStr + suggestAllStr);
    var cacheSrc = webppl.compile(commonStr + cacheStr);

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
            returnKL: !!args.returnKL,
            cache: args.cache
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
            returnKL: !!args.returnKL,
            cache: args.cache
        };
        var _code = eval.call({}, suggestAllSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.suggestAll = suggestAll;

    var update = function(mPrior, x, y, opts) {
        var globalStore = {
            mPrior: mPrior,
            x: x,
            y: y,
            prune: opts && opts.prune,
            cache: opts && opts.cache
        };
        var _code = eval.call({}, updateSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.update = update;

    var cache = function() {
        var _code = eval.call({}, cacheSrc)(runner);
        var res = {};
        _code({}, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.cache = cache;

    // Functions for compiling and running arbitrary code
    var compile = function(wpplStr) {
        // Add infrastructure and utils
        return webppl.compile(commonStr + wpplStr);
    };
    aoed.compile = compile;

    // Helper for getting the body of a thunk
    var compileThunk = function(thunk) {
        // Add infrastructure and utils
        var wpplStr = getThunkBody(thunk);
        return compile(wpplStr);
    };
    aoed.compileThunk = compileThunk;

    var run = function(wpplSrc, globalStore) {
        var _code = eval.call({}, wpplSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.run = run;

    // For one-off convenience
    var compileAndRun = function(wpplStr, globalStore) {
        var wpplSrc = compile(wpplStr);
        return run(wpplSrc, globalStore);
    };
    aoed.compileAndRun = compileAndRun;

    // For getting variables defined in the thunk
    var retrieve = function(name) {
        return compileAndRun('return ' + name + ';', {});
    };
    aoed.retrieve = retrieve;

    // Actually call the initialize source code to get the first model prior
    var initialPrior = eval.call({}, initialSrc)(runner);
    initialPrior({}, function(store, returnValue) {
        aoed.initialPrior = returnValue;
    }, '');

    return aoed;
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
    AOED: AOED
};
