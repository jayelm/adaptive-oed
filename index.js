require('./webppl.min.js');
var prompt = require('prompt');

var makeSkeleton = function(infraStr) {
    return {
        infrastructure: infraStr,

        initializePrior: function() {
            // The initial prior defined traditionally in args.mNameSample
            var inferM1 = args.inferM1 || Enumerate;
            return inferM1(args.mNameSample);
        },

        suggestExperiment: function() {
            var mPrior = globalStore.mPrior;

            return maxEIG({
                mPrior: mPrior,
                mFuncs: args.mFuncs,
                xSample: args.xSample,
                ySample: args.ySample,
                infer: args.infer
            });
        },

        updateBeliefs: function() {
            var x = globalStore.x,
                y = globalStore.y,
                mPrior = globalStore.mPrior;

            return updatePosterior({
                mPrior: mPrior,
                mFuncs: args.mFuncs, // Should be defined in infrastructure
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
    var infraStr = getThunkBody(skeleton.infrastructure);
    var suggestStr = getThunkBody(skeleton.suggestExperiment);
    var updateStr = getThunkBody(skeleton.updateBeliefs);
    var initialStr = getThunkBody(skeleton.initializePrior);

    // Concat common infrastructure with the other objects
    var suggestSrc = webppl.compile(infraStr + suggestStr);
    var updateSrc = webppl.compile(infraStr + updateStr);
    var initialSrc = webppl.compile(infraStr + initialStr);
    // console.log(initialSrc);

    var handleRunError = function(e) {
        // Just log it for now?
        console.log("ERROR");
        console.log(e);
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

    var suggest = function(mPrior) {
        var globalStore = {
            mPrior: mPrior
        };
        var _code = eval.call({}, suggestSrc)(runner);
        var res = {};
        _code(globalStore, makeStoreFunc(res), '');
        return res.returnValue;
    };
    aoed.suggest = suggest;

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
    // var initialPrior = eval.call({}, initialSrc)(runner);
    var initialPrior = eval.call({}, initialSrc)(runner);
    initialPrior({}, function(store, returnValue) {
        aoed.initialPrior = returnValue;
    }, '');

    return aoed;
};

var runCLI = function(aoed) {
    var repeatUpdate = function(prior) {
        console.log("Prior:");
        console.log(prior);

        var expt = aoed.suggest(prior);
        console.log("Suggested experiment:");
        console.log(expt);

        var x = expt.x;

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
    var infraStr = infraThunk.toString();
    if (infraStr.indexOf("args") === -1) {
        throw "No `args` string detected in thunk, " +
              "or reflection isn't working. Check that your thunk's toString returns " +
              "something useful.";
    }

    var skeleton = makeSkeleton(infraStr);
    return compileSkeleton(skeleton);
};

module.exports = {
    AOED: AOED,
    runCLI: runCLI
};
