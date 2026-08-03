# Par

Par is a daily five-letter word game that scores the quality of your decisions rather than the
luck of your outcomes. A conventional word game rewards you for how few guesses you took; Par
measures each guess against what was actually knowable when you made it, so a lucky hit earns no
credit for its luck and a well-judged guess that happened not to land still scores well.

**Status: increment 2.** This repository holds the scaffold — toolchain, module skeleton,
architectural boundary rule and deployment pipeline — plus the three generated word lists. There is
no board and no scoring yet; those arrive in later increments, on top of a pipeline already proven
to build and deploy.

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

Every one of these runs in CI on each push and pull request, and each commit on `main` is expected
to leave all of them passing.

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

## Deploying to Cloudflare Pages

The build is fully static, so connecting the repository once is the whole of the setup. In the
Cloudflare dashboard:

1. Go to **Workers & Pages** → **Create application** → **Pages** → **Import an existing Git
   repository**.
2. Authorise Cloudflare for the GitHub account and select this repository. It is private, so you
   may need to grant access to it specifically rather than to all repositories.
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

4. Select **Save and Deploy**.

**Node version.** Do not set one in the dashboard. Cloudflare reads
[`.node-version`](.node-version) from the repository root, which is the same file CI reads, so the
build environment and the quality gate cannot drift apart. If you ever do need to override it from
the dashboard instead, the variable is `NODE_VERSION` and it must match that file.

**SPA fallback.** [`public/_redirects`](public/_redirects) maps every path to `index.html` with a
`200`, and Vite copies it into `dist/` on build. CI asserts it is still there after a build, because
replay links in a later increment depend on a deep link surviving a cold load.

Once connected, Cloudflare builds `main` on every push and gives each pull request its own preview
URL, which is how later increments get reviewed against a live deployment.

## Toolchain notes

Two version constraints are deliberate and worth knowing before you upgrade anything:

- **TypeScript is pinned to 6.0.x.** TypeScript 7 is released, but `typescript-eslint` 8 declares a
  peer range of `>=4.8.4 <6.1.0`, so moving to 7 would leave the project unable to lint TypeScript
  at all. Revisit when `typescript-eslint` ships TypeScript 7 support.
- **MUI 9 removed system props from components.** Shorthands such as `alignItems`, `fontWeight` and
  `textAlign` are no longer accepted as direct props and must be written inside `sx`. This is a
  typecheck error rather than a silent no-op, so it surfaces immediately.
