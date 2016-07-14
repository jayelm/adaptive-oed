# Adaptive OED

OED for adaptive experiment design. Requires the `20160627-jayelm-adaptive`
feature branch of `jayelm/webppl-oed`.

Make sure to build a minified version of webppl.min.js first with `grunt
webppl`, or nothing will work!

##

To generate a version for browser usage, do:

```
npm install -g uglifyjs # If not already installed
grunt # Runs the ./concat script
```

## Usage

Specify webppl model as a thunk that, when called, declares all of the webppl
infrastructure and models you wish to test.

Feel free to refer to all `webppl` and `webppl-oed` functionality in your
thunk. AOED uses reflection to obtain the code of your function and pass it
into the webppl compiler.

The one requirement of your thunk is that you declare an `args` object that has
exactly the same format as the object you would pass into a traditional `OED()`
call. The libraries does a rudimentary check to make sure this object is
defined, or nothing will work.

Once that's done, call `AOED` to obtain an Adaptive OED object. This object can
be parsed in various ways (TODO: how to deal with the object besides CLI), or
ran in a wrapper such as `runCLI`.

    var adaptive = require('adaptive-oed');

    var infrastructure = function() {
        var model1 = function(...) {
            ...
        };

        var model1 = function(...) {
            ...
        };

        var args = {
            mNameSample: ...,
            mFuncs: ...,
            xSample: ...,
            ySample: ...
        };
    };

    var aoed = adaptive.AOED(infrastructure);
    adaptive.runCLI(aoed);  # Run an AOED "repl"

See the `examples` directory for more examples.

## Examples

A CLI version of adaptive OED with the 20 participants coin model example. The
script will suggest an optimal experiment based on the existing prior
distribution, then ask for the result of the experiment you suggest (for now
assuming that you'll do precisely the experiment suggested). Your response will
be JSON-parsed and must exist in the experiment space.

    $ node examples/adaptiveCoin.js
	loaded webppl-oed [v0.0.1-2a5f596]
	loaded webppl [v0.8.1-2a5f596]
	Prior:
	Marginal({ dist:
	   { '"markovGroup"': { val: 'markovGroup', prob: 0.33333333333333337 },
		 '"fairGroup"': { val: 'fairGroup', prob: 0.33333333333333337 },
		 '"biasGroup"': { val: 'biasGroup', prob: 0.33333333333333337 } } })
	Suggested experiment:
	{ x: [ true, true, true, true ], EIG: 0.7843349496066588 }
	prompt: expt:  [19, 1]  # Response must be valid JSON
	AIG: 0.4377096216828516
	Prior:
	Marginal({ dist:
	   { '"biasGroup"': { val: 'biasGroup', prob: 0.627560159830183 },
		 '"fairGroup"': { val: 'fairGroup', prob: 0.0000689137851265145 },
		 '"markovGroup"': { val: 'markovGroup', prob: 0.3723709263846904 } } })
	Suggested experiment:
	{ x: [ true, true, true, true ], EIG: 3.9534302856162418 }
    ...

## Building

First install required node modules:

    npm install

Then, to build a minified version of webppl.min.js in node_modules/webppl, run

    grunt webppl

Pay close attention to the `grunt` output: if grunt can't find
`webppl.min.js`, the files created in `dist/` will be useless.
