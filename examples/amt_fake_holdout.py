"""
This script boosts the economy by saving money

1. Take CSV responses from previous MTurk experiment, but remove a question and
designate it as holdout.

2. Rerun strength learning on remaining questions.
(Probably don't need to rerun structure?)

3. Use JPD to predict holdout queston.
"""

import pandas as pd
import json
import tempfile
import subprocess
from collections import Counter, OrderedDict
from operator import itemgetter
import copy


def unique(seq):
    seen = set()
    seen_add = seen.add
    return [x for x in seq if not (x in seen or seen_add(x))]


# I think this is mainly just "get rid of node loading messages"
def sanitize(output):
    return


def lines_startswith(lines, phrase):
    return filter(
        lambda l: l.startswith(phrase),
        lines
    )


def filter_holdout(header, body):
    header = header.split('\t')
    body = map(
        lambda r: r.split('\t'),
        body
    )
    objs = map(
        lambda row: OrderedDict(zip(header, row)),
        body
    )
    # print objs
    num_xs = Counter(map(itemgetter('xText'), objs))
    min_x = min(num_xs, key=num_xs.get)
    if num_xs[min_x] > 1:
        print "Warning: Minimum for {} is {} with {} trials".format(
            objs[0]['amt_id'], min_x, num_xs[min_x]
        )
    # Drop min_x from results
    objs_dropped = filter(
        lambda obj: obj['xText'] != min_x,
        # Increase number of questions 2x
        objs + copy.deepcopy(objs)
    )

    holdout = filter(
        lambda obj: obj['xText'] == min_x,
        objs
    )[0]

    # Now reassign 
    for index, obj in enumerate(objs_dropped):
        obj['amt_trial'] = index + 1  # Start from one

    new_body = map(
        lambda r: '\t'.join(map(str, r.values())),
        objs_dropped
    )
    return ('\t'.join(header), new_body, holdout)


def compute_exp(x, ids, jpd):
    if x['type'] == 'conditional':
        return conditional(jpd, ids, x['a'], x['cond'])
    elif x['type'] == 'marginal':
        return marginal(jpd, ids, x['a'])
    else:
        raise ValueError("Unknown type {}".format(x['xType']))


def conditional(jpd, ids, a, cond):
    a_i = ids[a]
    probs = [0, 0]
    for conf, prob in jpd:
        if conf[a_i]:
            probs[0] += prob
        probs[1] += prob

    if probs[0] == 0 and probs[1] == 0:
        raise ValueError("Zero probabilities: {}".format(probs))

    return min(1, probs[0] / probs[1])


def marginal(jpd, ids, a):
    a_i = ids[a]
    global_prob = 0
    for conf, prob in jpd:
        if conf[a_i]:
            global_prob += prob
    return min(1, global_prob)  # Potential floating point error


if __name__ == '__main__':
    from argparse import ArgumentParser
    import sys
    parser = ArgumentParser()

    parser.add_argument(
        'tsvfile',
        help="trialdata tsv file (generated from csli/experiments directory)"
    )
    #  parser.add_argument(
        #  'outfile',
        #  help="File to write to"
    #  )

    args = parser.parse_args()

    with open(args.tsvfile, 'r') as fin:
        # Get rid of last two columns, as those are duplicates
        lines_raw = unique(map(
            lambda l: '\t'.join(l.split('\t')[:-2]),
            fin.readlines()
        ))
        header, lines = lines_raw[0], lines_raw[1:]

    # Get unique AMT IDS via splits
    lines_split = map(lambda l: l.split('\t'), lines)

    unique_ids = unique(l[0] for l in lines_split)

    out_lines = []
    printed_header = False

    for amt_id in unique_ids:
        body = lines_startswith(lines, amt_id)
        # Get holdout
        new_header, new_body, holdout = filter_holdout(header, body)
        if not printed_header:
            printed_header = True
            print new_header + '\tobs_y\texp_y'

        subs = [new_header] + new_body

        print "Running amtStructureToStrength on " + amt_id
        with tempfile.NamedTemporaryFile() as temp:
            temp.write('\n'.join(subs))
            temp.flush()
            try:
                out = subprocess.check_output(
                    'node examples/amtStructureToStrength.js ' + temp.name,
                    shell=True
                )
            except subprocess.CalledProcessError as e:
                print e.cmd
                print e.output
                raise e

            # Add to output lines as usual
            this_out_lines = out.split('\n')[:-1]  # Last line is empty

        out_lines.extend(this_out_lines)

        #  import ipdb; ipdb.set_trace()

        # But now compute stuff
        holdout_x = {
            'text': json.loads(holdout['xText']),
            'name': json.loads(holdout['xText']),
            'type': json.loads(holdout['xType']),
            'a': json.loads(holdout['xA']),
            'cond': ('xCond' in holdout) and json.loads(holdout['xCond'])
        }
        jpd_names = map(
            json.loads,
            this_out_lines[0].split('\t')[-8:]
        )
        jpd_vals = map(
            float,
            this_out_lines[-1].split('\t')[-8:]
        )
        jpd = zip(jpd_names, jpd_vals)
        obs_y = holdout['y']
        # FIXME: Stop hardcoding ids
        ids = {
            'bright': 0,
            'hot': 1,
            'on': 2
        }
        exp_y = compute_exp(holdout_x, ids, jpd)
        print '\t'.join(map(str, holdout.values() + [obs_y, exp_y]))
        sys.stdout.flush()
