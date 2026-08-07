# AGENTS.md

## Cursor Cloud specific instructions

Par is a fully static Vite + React + TypeScript app — no backend, no database, no
environment variables. Standard commands live in [`README.md`](README.md) and
`package.json` scripts (`dev`, `build`, `preview`, `typecheck`, `lint`, `test`,
`test:e2e`); use those rather than re-deriving them.

Non-obvious things worth knowing:

- **Scoring only works on a production build, not the `npm run dev` server.** The
  scoring runs in a Web Worker that is heavy. On the raw dev server (`npm run dev`,
  port 5173) the results screen hangs indefinitely on "Working out your round…"
  (observed >120s and never settling). On a production build it scores instantly.
  So to exercise or test anything that ends in a *score* (a full round, share
  links, replay), build and preview first:

  ```bash
  npm run build
  npm run preview   # serves dist/ on http://localhost:4173
  ```

  This is why the Playwright e2e suite deliberately runs against `vite preview`,
  not the dev server. Use `npm run dev` for UI/layout iteration (HMR, typing,
  tile animations all work there); switch to the preview build to verify scoring.

- **Node version.** `.node-version` pins 26.5.0, but this VM's system Node
  (currently v22.14.0, provided on `PATH` via `/exec-daemon` which shadows nvm)
  is what actually runs. It satisfies `engines` (`>=22.12.0`) and the full gate
  passes on it: `typecheck`, `lint`, all unit tests, `build`, and e2e. `npm ci`
  prints harmless `EBADENGINE` warnings (jsdom/undici want a slightly newer 22.x);
  they are advisory and do not affect results.

- **E2E browsers.** Playwright needs its Chromium binary
  (`npx playwright install chromium`). It also builds `dist/` and starts its own
  preview server automatically, so you do not start a server before `npm run test:e2e`.
