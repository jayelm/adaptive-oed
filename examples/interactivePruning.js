/**
 * Interactive model pruning. Idea: run some experiments first, then launch
 * into the REPL. Take a look at what the model space looks
 * like/tractability.
 */

var adaptive = require('../adaptive');
var acli = require('../acli');
var infrastructure = require('./booleanInfrastructure.js');
var _ = require('underscore');

var aoed = adaptive.AOED(infrastructure);

var expts = [
    [{type: 'conditional', a: 'on', cond: {bright: true, hot: true}}, 0.9],
    [{type: 'marginal', a: 'on'}, 0.5],
    [{type: 'conditional', a: 'bright', cond: {hot: true}}, 0.9]
    // [{type: 'marginal', a: 'hot'}, 0.5],
    // [{type: 'conditional', a: 'hot', cond: {bright: true}}, 0.9],
    // [{type: 'marginal', a: 'bright'}, 0.5],
    // [{type: 'conditional', a: 'on', cond: {bright: false}}, 0.1],
    // [{type: 'conditional', a: 'hot', cond: {bright: false}}, 0.2]
];

var pruneArgs = {
    min: 7500,
    keepPercent: 0.33
};

console.log('Initial # models: ', aoed.initialPrior.support().length);

var initialPrior = _.reduce(expts, function(prior, expt) {
    console.log('Running:', expt);

    var res = aoed.update(prior, expt[0], expt[1], pruneArgs);

    console.log('Done');
    console.log('# Models:', res.mPosterior.support().length);

    return res.mPosterior;
}, aoed.initialPrior);

var args = {
    usePredictiveY: true,
    returnKL: true,
    verbose: false,
    mPrior: initialPrior,
    prune: pruneArgs
};

acli.runCLI(aoed, args);
