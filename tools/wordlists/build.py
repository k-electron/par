#!/usr/bin/env python3
"""Generate Par's three word lists into src/data.

Run this only when the lists need to change. The output is committed, so
building, testing and running the app never require Python. See
docs/wordlists.md for the recipe and for what each list is for.

Every ordering here is total and explicit. Frequency ties break alphabetically,
never by dictionary or set iteration order, because the order of the guess
dictionary is part of the scorer's contract: entropy ties break by guess index,
and the ranking decides which guesses the search explores.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from collections import Counter
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parents[1]
DATA_DIR = REPO_ROOT / "src" / "data"
CACHE_DIR = TOOL_DIR / ".cache"

# Collins Scrabble Words 2019. Spec §4 asks for a Scrabble lexicon and calls
# Collins "strongly preferred"; the Scrabble intersection is also the
# proper-noun filter, which is what keeps WAYNE and DUBAI out of the answers.
LEXICON_URL = (
    "https://raw.githubusercontent.com/scrabblewords/scrabblewords"
    "/main/words/British/CSW19.txt"
)
LEXICON_FILENAME = "CSW19.txt"
LEXICON_SHA256 = "78f98df02a50a8149b9ccaf50c20ed19fe5934beb27e401b5757859730a6c7b3"

WORD_LENGTH = 5

# Spec §4 sizes. The dictionary is whatever the lexicon yields at five letters;
# the other two are cut to a fixed size so the lists are reproducible.
ANSWER_COUNT = 3_000
STARTER_COUNT = 5_000
STARTER_DISTINCT_SHARE = 0.90
STARTER_SHARE_TOLERANCE = 0.01  # "within a percentage point or so"

# wordfreq reports Zipf values on a log scale where 1.0 is one occurrence per
# hundred million words. Nothing in this corpus lands strictly between 0 and 1,
# so this floor is exactly equivalent to "appears in the corpus at all" — it is
# what keeps XYLYL-tier words out of the starter pool (philosophy position 9).
MIN_STARTER_ZIPF = 1.0

SHAPE_DISTINCT = "distinct"
SHAPE_ONE_PAIR = "one_pair"
SHAPE_EXCLUDED = "excluded"


class BuildError(RuntimeError):
    """A required property does not hold. Never emit output in this case."""


def fetch_lexicon(refresh: bool) -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / LEXICON_FILENAME

    if refresh or not cached.exists():
        print(f"Downloading {LEXICON_URL}")
        with urllib.request.urlopen(LEXICON_URL, timeout=120) as response:
            cached.write_bytes(response.read())

    payload = cached.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != LEXICON_SHA256:
        raise BuildError(
            f"{LEXICON_FILENAME} hashes to {digest}, expected {LEXICON_SHA256}. "
            "The upstream lexicon changed; review the diff before updating the "
            "pinned hash, because it moves every list and the version id."
        )
    return payload.decode("utf-8")


def parse_dictionary(raw: str) -> list[str]:
    """Five-letter words from the lexicon, lowercased and sorted."""
    words: set[str] = set()
    for line in raw.splitlines():
        line = line.strip()
        # The file opens with a HarperCollins copyright notice.
        if not line or line.startswith("#"):
            continue
        entry = line.split()[0].lower()
        if len(entry) == WORD_LENGTH and entry.isascii() and entry.isalpha():
            words.add(entry)
    return sorted(words)


def letter_shape(word: str) -> str:
    counts = Counter(word)
    if max(counts.values()) >= 3:
        return SHAPE_EXCLUDED
    pairs = sum(1 for count in counts.values() if count == 2)
    if pairs == 0:
        return SHAPE_DISTINCT
    if pairs == 1:
        return SHAPE_ONE_PAIR
    return SHAPE_EXCLUDED  # two pairs


def rank_by_frequency(words: list[str], zipf: dict[str, float]) -> list[str]:
    """Most common first, alphabetical within a tie. Total and reproducible."""
    return sorted(words, key=lambda word: (-zipf[word], word))


def take(pool: list[str], count: int, label: str) -> list[str]:
    if len(pool) < count:
        raise BuildError(
            f"Need {count} words for the {label} but only {len(pool)} qualify. "
            "Lower the target or relax the frequency floor."
        )
    return pool[:count]


def check_list(words: list[str], label: str, dictionary: set[str] | None) -> None:
    if len(set(words)) != len(words):
        raise BuildError(f"The {label} contains duplicates.")
    for word in words:
        if len(word) != WORD_LENGTH or not word.isalpha() or not word.islower():
            raise BuildError(f"The {label} contains {word!r}, which is not five lowercase letters.")
    if dictionary is not None:
        missing = [word for word in words if word not in dictionary]
        if missing:
            raise BuildError(
                f"The {label} is not a subset of the guess dictionary: {missing[:5]}"
            )


def check_starter_composition(starters: list[str]) -> tuple[int, int]:
    distinct = 0
    one_pair = 0
    for word in starters:
        shape = letter_shape(word)
        if shape == SHAPE_DISTINCT:
            distinct += 1
        elif shape == SHAPE_ONE_PAIR:
            one_pair += 1
        else:
            raise BuildError(
                f"The starter pool contains {word!r}, which has two pairs or a "
                "letter three or more times. Spec §4 excludes those entirely."
            )

    share = distinct / len(starters)
    if abs(share - STARTER_DISTINCT_SHARE) > STARTER_SHARE_TOLERANCE:
        raise BuildError(
            f"The starter pool is {share:.2%} distinct-letter words, outside a "
            f"percentage point of {STARTER_DISTINCT_SHARE:.0%}."
        )
    return distinct, one_pair


def compute_version(lists: dict[str, list[str]]) -> str:
    """A stable identifier derived from the contents, for share links (spec §5)."""
    digest = hashlib.sha256()
    for name in sorted(lists):
        digest.update(name.encode("utf-8"))
        digest.update(b"\n")
        digest.update("\n".join(lists[name]).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()[:12]


def render_list_module(constant: str, words: list[str], description: str) -> str:
    body = "\n".join(words)
    return (
        "// Generated by tools/wordlists/build.py. Do not edit by hand.\n"
        f"// {description}\n"
        "//\n"
        "// Packed as one newline-separated string rather than an array literal:\n"
        "// it keeps line-based diffs readable, costs less to parse, and avoids\n"
        "// handing the type checker a several-thousand-element tuple.\n"
        "\n"
        f"export const {constant} = `{body}`;\n"
    )


def render_version_module(version: str, sizes: dict[str, int]) -> str:
    summary = ", ".join(f"{name} {sizes[name]}" for name in sorted(sizes))
    return (
        "// Generated by tools/wordlists/build.py. Do not edit by hand.\n"
        "//\n"
        "// Derived from the contents of all three lists. Share links carry this\n"
        "// so a replay built against different lists is flagged rather than\n"
        "// silently rescored against the wrong words (spec §5).\n"
        f"// Current lists: {summary}.\n"
        "\n"
        f"export const WORD_LIST_VERSION = '{version}';\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="re-download the lexicon instead of using the cached copy",
    )
    args = parser.parse_args()

    try:
        from wordfreq import zipf_frequency
    except ModuleNotFoundError:
        print(
            "wordfreq is not importable. See docs/wordlists.md — the short "
            "version is:\n"
            "  python3 -m pip install --target tools/wordlists/.pydeps "
            "-r tools/wordlists/requirements.txt\n"
            "  PYTHONPATH=tools/wordlists/.pydeps python3 tools/wordlists/build.py",
            file=sys.stderr,
        )
        return 2

    try:
        dictionary = parse_dictionary(fetch_lexicon(args.refresh))
    except BuildError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if not dictionary:
        print("error: the lexicon yielded no five-letter words", file=sys.stderr)
        return 1

    zipf = {word: zipf_frequency(word, "en") for word in dictionary}

    try:
        answers = take(
            rank_by_frequency([w for w in dictionary if zipf[w] > 0.0], zipf),
            ANSWER_COUNT,
            "answer list",
        )

        distinct_pool = rank_by_frequency(
            [w for w in dictionary if zipf[w] >= MIN_STARTER_ZIPF and letter_shape(w) == SHAPE_DISTINCT],
            zipf,
        )
        pair_pool = rank_by_frequency(
            [w for w in dictionary if zipf[w] >= MIN_STARTER_ZIPF and letter_shape(w) == SHAPE_ONE_PAIR],
            zipf,
        )

        want_distinct = round(STARTER_COUNT * STARTER_DISTINCT_SHARE)
        starters = sorted(
            take(distinct_pool, want_distinct, "starter pool (distinct letters)")
            + take(pair_pool, STARTER_COUNT - want_distinct, "starter pool (one pair)")
        )

        dictionary_set = set(dictionary)
        check_list(dictionary, "guess dictionary", None)
        check_list(answers, "answer list", dictionary_set)
        check_list(starters, "starter pool", dictionary_set)
        distinct_count, pair_count = check_starter_composition(starters)
    except BuildError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    lists = {"guesses": dictionary, "answers": answers, "starters": starters}
    version = compute_version(lists)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "guesses.generated.ts").write_text(
        render_list_module(
            "GUESSES_PACKED", dictionary, "Every word a player may type. Collins CSW19, five letters."
        ),
        encoding="utf-8",
    )
    (DATA_DIR / "answers.generated.ts").write_text(
        render_list_module(
            "ANSWERS_PACKED", answers, "The possible answers. Frequency-ranked, a subset of the dictionary."
        ),
        encoding="utf-8",
    )
    (DATA_DIR / "starters.generated.ts").write_text(
        render_list_module(
            "STARTERS_PACKED", starters, "The house-starter pool. Frequency-ranked and letter-filtered."
        ),
        encoding="utf-8",
    )
    (DATA_DIR / "version.generated.ts").write_text(
        render_version_module(version, {name: len(words) for name, words in lists.items()}),
        encoding="utf-8",
    )

    print(f"guess dictionary  {len(dictionary):>6}")
    print(f"answer list       {len(answers):>6}   cutoff {answers[-1]!r} at Zipf {zipf[answers[-1]]:.2f}")
    print(
        f"starter pool      {len(starters):>6}   "
        f"{distinct_count} distinct ({distinct_count / len(starters):.1%}), {pair_count} one-pair"
    )

    distinct_cut = min((w for w in starters if letter_shape(w) == SHAPE_DISTINCT), key=lambda w: zipf[w])
    pair_cut = min((w for w in starters if letter_shape(w) == SHAPE_ONE_PAIR), key=lambda w: zipf[w])
    print(f"  distinct tail   {distinct_cut!r} at Zipf {zipf[distinct_cut]:.2f}")
    print(f"  one-pair tail   {pair_cut!r} at Zipf {zipf[pair_cut]:.2f}")
    thin = sum(1 for w in starters if zipf[w] < 2.0)
    print(f"  below Zipf 2.0  {thin} ({thin / len(starters):.1%}) of the pool")
    print(f"version           {version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
