import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * Runs against the production build rather than the dev server, because two of
 * the things being verified — that the scoring worker is bundled correctly and
 * that a deep link survives a cold load through the SPA fallback — only exist
 * in a built artefact.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] === undefined ? 0 : 1,
  reporter: process.env['CI'] === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Mobile-first is a requirement, so the suite runs on a phone viewport too.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    // Vite's preview binds to localhost by default, which does not always
    // resolve to the 127.0.0.1 the health check polls. Pinning the host makes
    // the two agree. Invoked directly rather than through `npm run` so the flags
    // cannot be swallowed by argument forwarding.
    command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 180_000,
  },
});
