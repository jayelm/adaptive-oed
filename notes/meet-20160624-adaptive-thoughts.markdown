## Some Friday thoughts on adaptive OED

### A priori sequential OED
A priori sequential OED can never be as good as running OED adaptively and
conditioning on responses as you receive them. But how much better can
running OED adaptively be?

You can test this empirically.

Extending that, it would be cool to have some predictor of how much
better adaptive OED would be when running a priori sequential OED as a
baseline to future adaptive OED runs.

This has to do with understanding the range we expect EIG to fall into. If
we are very uncertain about the EIG from an optimal sequence of experiments,
then we are also very uncertain about what the state of our model posterior
will be after running the sequenece of experiments (CHECK).
So we gain a lot by actually conditioning on each trial, since as we
project beyond more and more uncertain model priors, our estimates about the
next best experiment become similarly fuzzy.

So coming up with some measure of uncertainty (confidence interval) will be
good.

As Long says, variance of the EIG doesn't work terribly well, since the vars
are super small. Bootstrapping?

### Where to embed adaptive OED
Computational resources with running adaptive OED. Could embed it in
client-side, but is calculating this stuff expensive?

Noah: We could also learn POLICIES on the server side before sending
something cheaper and more concrete (e.g. decision tree) to the client.
Integrating this into an experiment framework would be sweet.

Of course, ideally we'd learn the exhaustive policy, like some kind of
exhaustive search tree. This might be really huge, though. For
within-subject experiments with relatively small responses (e.g. coin
model) it seems plausible to enumerate the entire tree. Is there a range of
experiment sizes for which it's tractable to learn the exhaustive policy
beforehand?

I have doubts on when this would ever be useful. If it's not hard to
embed/consult adaptive OED in whatever context you're in, then you should
prefer running it on the spot. If it is slow to run OED client-side, then
for similar reasons it's probably also prohibitively slow to enumerate
experiment policies on the server side. Where this would be useful is (at
least for now) in the fine line between these two issues, if it exists.

### Multiprocessing
Would be cool to start formalize parallel processing for OED specifically.
WebPPL itself is harder, but given that in OED it's possible to just split
up searches of the experiment space, Enumeration mp seems plausible.

### Why does OED really like TTT experiments?
