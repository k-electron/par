import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * The icons survive the build and are served as themselves.
 *
 * tests/icons.test.ts checks the files in the repository. This checks the ones a
 * browser can actually fetch, which is a different claim: the icons live in
 * `public/`, and whether Vite copies them into `dist/` untouched is a fact about
 * the build rather than about the source.
 *
 * Status alone would not settle it. `public/_redirects` sends every unmatched
 * path to index.html with a 200, so on the deployed site a missing icon does not
 * 404 — it returns the app's HTML, and a browser asked for an icon and handed a
 * web page shows a blank tab. Comparing bytes is what tells the two apart.
 */

const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

const ICONS = ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png'] as const;

for (const icon of ICONS) {
  test(`${icon} is served as the file in public/`, async ({ request }) => {
    const response = await request.get(icon);

    expect(response.status()).toBe(200);
    expect(
      response.headers()['content-type'],
      'an icon served as HTML is the SPA fallback standing in for a missing file',
    ).not.toContain('text/html');
    expect(Buffer.from(await response.body())).toEqual(
      readFileSync(resolve(PUBLIC, icon.replace(/^\//, ''))),
    );
  });
}

test('the served page declares them', async ({ page, request }) => {
  await page.goto('/');

  // Read from the DOM rather than the response text, so this is the head the
  // browser resolved rather than the markup the server happened to send.
  const declared = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

  expect(declared).toEqual([...ICONS]);

  // The tab icon is the one a browser fetches on its own, so prove it is
  // reachable at the path the head gives rather than only present in the bundle.
  expect((await request.get(declared[0]!)).ok()).toBe(true);
});
