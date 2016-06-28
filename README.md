# Adaptive OED

OED for adaptive experiment design. Requires the `20160627-jayelm-adaptive`
feature branch of `jayelm/webppl-oed`.

Make sure to build a minified version of webppl.min.js first with `grunt
webppl`, or nothing will work!

# Building

First install required node modules:

    npm install

Then, to build a minified version of webppl.min.js in node_modules/webppl, run

    grunt webppl

Finally just run `grunt` to concatenate `index.js` and `webppl.min.js` for
release in `./dist/`.

Again, pay close attention to the `grunt` output: if grunt can't find
`webppl.min.js`, the files created in `dist/` will be useless.

<!-- Also contains notes, logistics, misc stuff from my time at CSLI. -->
