var prompt = require('prompt');

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
            // Log all expts except ignore KLDist
            for (var i = 0; i < expts.length; i++) {
                var expt = expts[i];
                console.log(expt.x, "(" + expt.EIG + ")");
            }
        }
        // Get best experiment manually, so that we can display all of them if
        // wanted ^
        var bestExpt = {x: null, EIG: -Infinity};
        for (var j = 0; j < expts.length; j++) {
            var expt2 = expts[j];
            if (expt2.EIG > bestExpt.EIG) {
                bestExpt = expt2;
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
            var res = aoed.update(prior, x, y, args);
            console.log("AIG: " + res.AIG);
            repeatUpdate(res.mPosterior);
        });
    };

    repeatUpdate(args.mPrior || aoed.initialPrior);
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
            var res = aoed.update(prior, x, y, args);
            console.log("AIG: " + res.AIG);
            repeatUpdate(res.mPosterior);
        });
    };

    repeatUpdate(args.mPrior || aoed.initialPrior);
};

module.exports = {
    runCLI: runCLI,
    runCLIAll: runCLIAll
};
