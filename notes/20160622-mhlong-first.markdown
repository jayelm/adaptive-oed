## 20160622 OED extensions

1. Confirm that OED doesn't work when differentiating between identical models
    (EIG is 0 for each experiment)
2. Better measure on uncertainty of EIG (variance doesn't work, too small)
3. Identifiability of A and B - A and B are unidentifiable if there's no way to
    distinguish between the two. A and B could perhaps make the same predictions on
    stimuli with different parameters (fiddling with parameters) but if the
    models have different priors on the parameters then we can begin to
    distinguish
4. Find a good experiment w/ continuous experiment space, and test out
    searching experiments with something other than Enumerate
5. Understanding more about EIG/AIG correlation, and what this means wrt your
    models
    a. Get benchmark for maximal correlation between EIG and AIG. There can't
        be a perfect correlation, since AIG will never equal EIG in every case.
    b. If you have a model close to the true model but maybe not
        precisely correct, can you tell from EIG/AIG correlation?
    c. EIG depends on how good your models are - predictions about IG will be
       off if you don't have the right model - the data is following a different
       process
6. Use OED for parameter estimation. Identify experiments that best help arrive
    at suitable parameter estimates. How would you do this?
    a. cf. mixture models
7. Staircasing (psychophysics)
    a. Compare staircasing to OED
    b. Using OED for prior elicitation
    c. Mikhail Franca Tubingen + Noah + MH - different methods of measuring
    priors (what does the crowd believe, CogSci 2016) 
        1. Three methods:
            i. compare binary judgments,
            ii. single judgment about continuous space,
            iii. plausibility judgments about discretizations (histogramesque)
        2. Binary judgments aren't good? But sometimes necessary (e.g. kids)?
        3. Betting strategy doesn't work for, e.g. novel features, novel categories.
    d. "Sequential" OED
