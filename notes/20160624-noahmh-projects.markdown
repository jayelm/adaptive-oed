# 20160624 Noah + MH first projects

- Lab spans spectrum from cogsci to cs (ppls)
- CS side:
    - OED
        - Incorporating it better into psych workflow
        - **1) ADAPTIVE OED w/ prior elicitiation  start from psych experiment goals, improve engineering**
            - NIPS paper was batch mode
            - Is PPL just sitting around running in the background of an mturk?
            - Or do you use OED to get a simpler decisiont tree/game plan?
            - MAIN TARGET DOMAIN (PSYCHOLOGY ANCHOR):
                - Make progress on prior elicitation
                - Franke ^^^ distributions over scalar dimensions
                    - Read citations here. Get examples of prior elicitation
                        used in papers (e.g. MH syllogisms, Justine ??) to
                        familiarize yourself with what's going on
                - Relationships between predicate events
            - **Concrete next steps:**
                - Jesse: familiarize w/ prior elicitation experiments
                    - Uses BDA to elicit priors
                - Engineering side - taking OED code, hacking it up to
                    represent the iterative OED
                - Write library functions that do iterative OED, without
                    worrying too much about tractability. Implement Loop.
                    Update belief dist of models, run OED as prior, potential
                    working w/ mturk API.
                    - Markov model?
                - Then test on 1. Coin models? 2. Prior elicitation?
                - Server vs client side tradeoff. Theoretically, easy to run
                    WebPPL embedded into experiment
                - Policy inference (LEARN DECISION TREE)...searching over
                    policies, scary and hard, but can do on server, then send
                    cheap stuff to client side
                - How much better is adaptive versus a priori sequential OED?
                - A priori sequential OED
                    - Are there limits to EIG?
                    - The way to make this more useful/accurate to the
                        scientist is to have more confident estimates around
                        what EIG will be
                    - I.e. a better measure of distribution
                    - If IG is possible to learn a TON but it's a very unlikely
                        event, there's some kind of a risk tolerance here
        - 2) Decide what experiments are best for your model if you don't have an
            alternative hypothesis (you only have ONE model)
            - Iffy idea: baseline - test a bunch of silly models and rule those
                out
            - "If all the points are clumped together, disappointing scatter plot"
            - ^^^ Problem with argstruct
            - *** In sum: how do we take a single OED model and get experiments
                that really test the model well (prediction should have high
                entropy, qualitative effects built-in,)
            - MAIN TARGET DOMAIN (PSYCH ANCHOR):
                - Contrast classes
                - Project could end up being 1. contrast classes, 2. OED for model extractions
            - Concrete steps
                - Talk through contrast class, cognitive modeling
                - Come up with contrast class examples
- Psych side
    - Generics
        - Do people use generics to infer abstract knowledge
- Prior elicitation
    - Use OED? Single experiment - future examples adapt to previous answers
- MH: implicit contrast class/comparison class question 
    - E.g. Dogs are tall
    - Ciyang Qing
    - "Flies are tiny" compared to...other insects? Humans? "Things normally
        seen from human perspective"?
