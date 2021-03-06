"""
A wrapper around amtStructureToStrength.js.

amtStructureToStrength sometimes results in odd out of memory errors when
recompiling AOED in a single node session. This script takes in a CSV as
generated by csli/experiments/trialdata_to_csv.py, and calls
amtStructureToStrength.js on each participant individually
"""

import pandas as pd
import tempfile
import subprocess


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


if __name__ == '__main__':
    from argparse import ArgumentParser
    parser = ArgumentParser()

    parser.add_argument(
        'tsvfile',
        help="trialdata tsv file (generated from csli/experiments directory)"
    )
    parser.add_argument(
        'outfile',
        help="File to write to"
    )

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

    for amt_id in unique_ids:
        subs = [header] + (lines_startswith(lines, amt_id) * 2)
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
            # Sanitize output later
            out_lines.extend(out.split('\n'))

    # Sanitize output by removing duplicates, then removing the first loading
    # messages
    out_lines = unique(out_lines)
    with open(args.outfile, 'w') as fout:
        fout.write('\n'.join(out_lines))
