# Examples

Run `ALL` examples from root directory, i.e. `node examples/*.js`. Unless
otherwise specified as "Usage:", no IO redirection/other arguments are
necessary.

## Interactive examples

-`adaptiveCoin.js`
    - Sequence predictions example
- `adaptiveBoolean.js`
    - Basically deprecated: the full DAG learning scenario, with adjustable
        levels of granularity
    - Can take a long time depending on the enumeration
- `adaptiveStructure.js`
    - Marginalized structure learning.
- `adaptiveStrength.js`
    - Learning strength with fixed structure
- `interactivePruning.js`
    - basically adaptiveBoolean, but with model pruning

Note that for structure and strength, when you are providing responses, you
must provide them as objects of the form

    {y: y, name: y.toString()}

Since caching depends on `x`s and `y`s having `name` properties.

## Coin examples

- `coinCSV.js`
    - Outputs results of 20 subjects coin experiment with various conditions
        (e.g. including/excluding null model, ignorance/predictive prior)
- `singleCoinConvergence.js`
    - Outputs results of several hundred single coin simulations - used to make colorful lines in aoed_intro.Rmd

## Structure and strength with DAGs sampled from the model space

- `structureTSV.js`
    - For learning structure
    - Usage: `node examples/structureTSV.js | tee data/raw/structure-all.tsv`
    - Tries running models with forced unique questions (`skip == 1`)
- `structureToStrength.js`
    - For learning strength from the above

## Structure and strength with MH priors

- `priorsToJSON.js`
    - To first parse priors into usable JSON format with JPDs
    - Usage: `node examples/priorsToJSON.js`
- `simStructureTSV.js`
    - For learning structure
    - Careful re: out of memory errors (might be an elusive bug somewhere)
    - Usage: `node examples/simStructureTSV.js | tee data/simStructure.tsv`
- `simStructureDist.js`
    - **TODO**: For learning the *distribution* of structures (basically a more
        verbose version of the above), for measuring entropy of structures
- `simStructureToStrength.js`
    - For learning parameters, fixing structure, from the CSV generated by
        `simStructureTSV.js`
    - Usage: `node examples/simStructureToStrength.js --max-old-space-size=4096 | tee data/simStructureToStrength.tsv`
    - I'm actually not sure this is even useful. Seems like a very roundabout
        way to generate JPDs

## Structure and strength with MTurk experiments

- `amtStructureToStrength.js`
    - Assuming fixed structure and learning from `data/raw/*trialdata.csv`

## MISC

- `cacheStructure.js`
    - An important one: caches model scores for the given enumeration settings
    - Saves to `cache/structureCache.json`
    - **TODO**: Implement saving to a `var structureCache = ...` JavaScript file
      too, to prevent having to tweak
        afterwards
- `pruningCSV.js`
    - For displaying CSV about how the fully enumerable model space decreases as questions are
        asked
    - Usage: `node examples/pruningCSV.js > pruning.csv`

## WebPPL infrastructure

- `{coin,singleCoin,boolean,structure,strength}Infrastructure.js` aren't actually run,
    they're disguised WebPPL files that are compiled by `adaptive.js`. But
    changes made here will change the behavior of the other scripts.

## Testing

- `test{Bools, Structure}`
    - Since the infrastructure files are wrapped in a function and have
        `module.exports` lines, these files are not directly compilable in
        WebPPL. Instead, write things you want to run in `test{Bools,
        Structure}.wppl` and run these scripts, which will do some
        file-wrangling and run your code in a temporary file.