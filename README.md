# Par

Par is a daily five-letter word game that scores the quality of your decisions rather than the
luck of your outcomes. A conventional word game rewards you for how few guesses you took; Par
measures each guess against what was actually knowable when you made it, so a lucky hit earns no
credit for its luck and a well-judged guess that happened not to land still scores well.

**Status: complete.** All eleven increments have landed. The scoring engine is proven against the
specification's verification suite, and the daily loop runs end to end: confirm your settings, play,
see your round scored, share it, and open somebody else's link to the same total they saw.

## Requirements

Node, at the version pinned in [`.node-version`](.node-version). Nothing else — no database, no
environment variables, and no server runtime. The app is a static bundle.

Python is needed only to regenerate the word lists, which is a rare, deliberate act. The generated
lists are committed, so building, testing and running the app never require it.

## Getting started

```bash
npm ci        # install exactly what the lockfile specifies
npm run dev   # start the dev server on http://localhost:5173
```

## Scripts

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Vite dev server with hot module replacement                |
| `npm run build`     | Typecheck, then emit the static production bundle to `dist/` |
| `npm run preview`   | Serve the built `dist/` locally                            |
| `npm run typecheck` | TypeScript across `src/` and `tests/`, no emit             |
| `npm run lint`      | ESLint, including the dependency rule below                |
| `npm run test`      | Vitest, once                                               |
| `npm run test:watch`| Vitest in watch mode                                       |
| `npm run test:e2e`  | Playwright against a production build                      |

`typecheck`, `lint`, `test` and `build` form the quality gate, and `test:e2e` runs as a second job.
CI runs both on every pull request and on pushes to `main`; a push to a feature branch with no open
pull request runs nothing.

Both jobs are required checks on `main`, which a repository ruleset protects: changes arrive through
a pull request, the branch must be up to date with `main` before it merges, and neither job may be
failing. No approving review is required, so a solo change is still one `gh pr merge --auto` away —
it simply cannot merge red. That requirement is load-bearing for the deploy rather than a matter of
taste, for the reason given under [deploying](#deploying-to-cloudflare-pages).

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/spec.md`](docs/spec.md) | The build specification. Normative. |
| [`docs/philosophy.md`](docs/philosophy.md) | Why the game is designed this way. Governs judgement calls the spec leaves open. |
| [`docs/scoring.md`](docs/scoring.md) | The scoring model as implemented, and what each constant trades. |
| [`docs/determinism.md`](docs/determinism.md) | Why a score is bit-identical everywhere, and what would break it. |
| [`docs/wordlists.md`](docs/wordlists.md) | Sources, licensing, generation, and the asserted properties. |
| [`docs/architecture.md`](docs/architecture.md) | The module map, the ports, and the invariants enforced by shape. |
| [`docs/decisions/`](docs/decisions) | Calls the spec and philosophy left open. |
| [`CHANGELOG.md`](CHANGELOG.md) | What landed in each increment, and what was verified. |

If you read one beyond the spec, read `docs/determinism.md`. Cross-client determinism is the second
priority in the specification and the requirement most likely to be broken silently by a reasonable
looking change.

## Layout and the dependency rule

The module map, the ports, and the invariants the architecture enforces by shape are described in
[`docs/architecture.md`](docs/architecture.md). The short version is that dependencies run one way:

- `src/engine/` imports nothing from `src/app/`, `src/worker/` or `src/data/`.
- `src/app/ui/` never imports `src/engine/search/`; it reaches scoring through `src/app/scoring/`.

This is enforced by ESLint, not by convention, and `tests/boundaries.test.ts` lints deliberately
illegal fixtures to prove the rule still reports. If you add a module and the rule refuses it, the
rule is probably right — read `docs/architecture.md` before working around it.

## Regenerating the word lists

The three lists under [`src/data/`](src/data) are generated from Collins Scrabble Words 2019
intersected with the `wordfreq` corpus, and are committed. Regenerate only when the lists
themselves should change:

```bash
python3 -m pip install --target tools/wordlists/.pydeps -r tools/wordlists/requirements.txt
PYTHONPATH=tools/wordlists/.pydeps python3 tools/wordlists/build.py
```

The generator refuses to emit anything unless every property in spec §4 holds, and prints where
each list bottoms out so tail quality stays a measured fact. Afterwards, run `npm test` to confirm
the committed lists still satisfy those properties, and **recompute `PAR`** — it is derived from
the lists, so changing them leaves it stale.

[`docs/wordlists.md`](docs/wordlists.md) covers the source, the licensing position, why the pool is
sized as it is, and what the version identifier protects.

## When the puzzle rolls over

The day boundary is anchored to **US Eastern** (`America/New_York`), and puzzle 0 is
**1 January 2026**. Both are build-time constants in
[`src/engine/daily/calendar.ts`](src/engine/daily/calendar.ts) and deliberately not settings: if
players could change the anchor they would get different puzzles on the same day and the whole
premise of comparing scores collapses.

So the puzzle changes at midnight Eastern — 05:00 UTC in winter, 04:00 in summer — wherever the
player happens to be. A friend in London gets the same word as a friend in New York, and they roll
over at the same moment rather than eight hours apart.

To move the anchor, change `PUZZLE_TIME_ZONE`. Be aware that it shifts which puzzle every date maps
to, so existing share links will point at a different day's board.

## Recomputing `PAR`

`PAR` is the mean guess count for strong play opening from house starters. It is derived from
the word lists, so regenerating them leaves it stale and every total mis-centred:

```bash
npm run compute-par -- --days 300      # writes src/engine/config/par.generated.ts
npm run check-incentives -- --days 120 # confirms the incentives still point the right way
```

The first takes a few minutes and prints the guess distribution plus what the house starter
costs against a fixed strong opener. The second exits non-zero if taking the house starter
stops being the mildly better habit, or if collecting the bonus and then ignoring the clues
stops being the worst option.

Recomputing `PAR` moves the golden score snapshots, because the outcome term is measured
against it. That is intended — it forces someone to look at the new numbers. Review the diff,
then `npx vitest run -u`.

[`docs/scoring.md`](docs/scoring.md) explains the model, what each constant trades, and what
these runs measured for the shipped lists.

## Deploying to Cloudflare Pages

The build is fully static, so connecting the repository once is the whole of the setup.

**Why the branch protection matters here.** Cloudflare's Git integration builds and deploys every
push to `main` independently of GitHub Actions. It runs `npm run build` and ships whatever comes
out, and because the build only typechecks, a commit with failing tests would deploy perfectly
happily. The spec rules out the obvious alternative — routing the deploy through CI needs an API
token, and §11 requires that no deploy credentials live in CI — so the gate sits at the branch
instead: nothing reaches `main` red, therefore nothing Cloudflare sees is red. Delete that ruleset
and you have silently removed the only thing between a failing test and production.

In the Cloudflare dashboard:

1. Go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Authorise Cloudflare for the GitHub account, then **Install & Authorize** and **Begin setup**.
   Public and private repositories both work; you can grant access to all of them or to this one.
3. In **Set up builds and deployments**, enter exactly:

   | Setting                 | Value                                     |
   | ----------------------- | ----------------------------------------- |
   | Project name            | `par` (this becomes `par.pages.dev`)      |
   | Production branch       | `main`                                    |
   | Framework preset        | `React (Vite)` — or `None`, see below     |
   | Build command           | `npm run build`                           |
   | Build output directory  | `dist`                                    |
   | Root directory          | *leave empty* (the project is at the repo root) |
   | Environment variables   | *none*                                    |

   The framework preset only pre-fills the build command and output directory. `React (Vite)` fills
   in exactly the two values above; if the preset is not offered, choose `None` and type them in.
   The result is identical.

   The project name is also the hostname, and `pages.dev` names are globally unique. If `par` is
   refused, someone else holds it; pick another and expect the URL to follow.

4. Select **Save and Deploy**.

**Node version.** Do not set one in the dashboard. Cloudflare's v3 build image reads
[`.node-version`](.node-version) from the repository root, which is the same file CI reads, so the
build environment and the quality gate cannot drift apart. Any version is supported and the build
log names the one it used; if that log shows the image default rather than the pinned version, the
project is on an older build image and wants moving to v3 under **Settings** → **Build**. If you
ever do need to override it from the dashboard instead, the variable is `NODE_VERSION` and it must
match that file.

**SPA fallback.** [`public/_redirects`](public/_redirects) maps every path to `index.html` with a
`200`, and Vite copies it into `dist/` on build. CI asserts it survives. Replay links do not
actually need it — they are of the form `/#r=...`, so the path is always `/` — but it costs nothing
and means a mistyped or future deep path lands on the app rather than a 404.

Once connected, Cloudflare builds `main` on every push and gives each pull request its own preview
URL. Since every change now arrives through a pull request, that preview is the ordinary way to see
a change running before it merges.

**On Pages versus Workers.** Cloudflare froze Pages for new features in 2025 and points new projects
at Workers static assets instead. Pages is still supported and still the shortest path for a bundle
with no server code, which is exactly what this is, so there is nothing to gain by moving today. If
that changes, the migration is a `wrangler.jsonc` with an `assets` block pointing at `dist/`, and
`_redirects` is honoured either way.

## Toolchain notes

Two version constraints are deliberate and worth knowing before you upgrade anything:

- **TypeScript is pinned to 6.0.x.** TypeScript 7 is released, but `typescript-eslint` 8 declares a
  peer range of `>=4.8.4 <6.1.0`, so moving to 7 would leave the project unable to lint TypeScript
  at all. Revisit when `typescript-eslint` ships TypeScript 7 support.
- **MUI 9 removed system props from components.** Shorthands such as `alignItems`, `fontWeight` and
  `textAlign` are no longer accepted as direct props and must be written inside `sx`. This is a
  typecheck error rather than a silent no-op, so it surfaces immediately.
