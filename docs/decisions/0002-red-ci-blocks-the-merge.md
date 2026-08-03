# 0002 — Red CI blocks the merge, because the deploy will not

Status: accepted. Departs from `docs/spec.md` §11 deliberately; read this before restoring the
spec's wording.

## What the spec says

Section 11 makes two statements that are each reasonable on their own:

> Static build, deployed to **Cloudflare Pages** via its native GitHub integration — pushes to the
> main branch deploy, pull requests get previews, and no deploy credentials live in CI.

> **GitHub Actions** runs the quality gate on pushes and PRs: type checking, linting, tests, and a
> production build. Red CI blocks nothing automatically, but it must be meaningful.

## Why they do not compose

Cloudflare's Git integration is not aware of GitHub Actions. It watches the branch, runs
`npm run build`, and publishes whatever that produces. The build script is `tsc -b && vite build`,
so it fails on a type error and on nothing else — a commit whose tests fail, whose lint fails, or
whose end-to-end run fails still builds cleanly and still ships.

Put together, then, the two bullets say that a commit with a broken scoring engine deploys to
production automatically and that nothing stops it. That is not what "red CI must be meaningful"
is trying to buy, and it sits badly against §1, which asks for exactness first and describes the
scoring model as the product.

This was not hypothetical. Commit `466c886` left `main` red for two commits. `npm run build`
succeeded on it.

## What we do instead

`main` carries a repository ruleset, *main is always deployable*:

- Changes land through a pull request. No approving review is required, so a solo change is still
  one `gh pr merge --auto` away.
- Both CI jobs — `Typecheck, lint, test, build` and `End to end` — are required, and pinned to the
  GitHub Actions app so the contexts cannot be satisfied by anything else reporting the same name.
- The branch must be up to date with `main` before it merges. This is the part that is easy to skip
  and should not be: Cloudflare builds the *merged* commit, so without it a pull request could be
  green against an older `main` and produce an untested tree that deploys anyway.
- `main` cannot be deleted or force-pushed.

There is no bypass actor. If CI is wedged for a reason that has nothing to do with the change, the
escape hatch is to set the ruleset to disabled in the repository settings and turn it back on,
which is deliberately a visible act rather than a quiet flag on a merge.

## Why not deploy from CI instead

The obvious alternative is a GitHub Actions job that runs `wrangler pages deploy` after the gate
passes, which gates the deploy directly rather than gating the branch. Section 11 forecloses it:
that job needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets, and the
spec requires that no deploy credentials live in CI. Gating the branch reaches the same end without
holding a token, so the spec's constraint is met rather than argued with.

## What it costs

Direct pushes to `main` stop working; everything goes through a branch and a pull request. For a
solo project that is friction, and it is the whole of the cost. It buys back the Cloudflare preview
URL on every change, which the spec already asked for and which nobody sees when work is pushed
straight to `main`.

## Reversing it

Delete the ruleset and §11 holds again exactly as written, along with the failure mode described
above. Nothing in the source depends on it.
