import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The specification's end-to-end check, in one test:
 *
 *   confirm settings → play a full game → share → open the link in a clean
 *   browser profile → see the same board and the same total
 *
 * The last step is the one that matters. A replay link that re-scored to a
 * different number would make comparing scores with a friend meaningless, and
 * it would do so silently — which is exactly the failure the specification
 * ranks as worse than a visible bug.
 *
 * Each test gets a fresh context, so "a clean browser profile" is the default
 * rather than something to arrange.
 */

/** The board's letters, row by row, as the player sees them. */
async function boardRows(page: Page): Promise<string[]> {
  const rows: string[] = [];
  for (let row = 0; row < 6; row += 1) {
    const letters: string[] = [];
    for (let column = 0; column < 5; column += 1) {
      letters.push((await page.getByTestId(`tile-${row}-${column}`).textContent()) ?? '');
    }
    rows.push(letters.join(''));
  }
  return rows;
}

/**
 * Both the board and the keyboard are narrower than the column they sit in and
 * centre themselves with `mx: 'auto'`. MUI's Stack spaces its children with
 * margins unless told otherwise, and the reset that comes with that,
 * `& > :not(style):not(style) { margin: 0 }`, outranks a child's own margin on
 * specificity. So anything centring itself that way is silently shoved to the
 * left edge the moment it becomes a direct Stack child — which is what happened
 * to the replay board, 83px off centre. Layout that only breaks in one of two
 * places that render the same component is exactly what a unit test cannot see.
 */
async function expectHorizontallyCentred(page: Page, target: Locator, label: string) {
  const box = await target.boundingBox();
  expect(box, `${label} should be rendered`).not.toBeNull();

  const viewport = page.viewportSize();
  expect(viewport, 'viewport size should be known').not.toBeNull();

  const offset = box!.x + box!.width / 2 - viewport!.width / 2;
  expect(Math.abs(offset), `${label} is ${offset.toFixed(1)}px off centre`).toBeLessThanOrEqual(1);
}

async function readTotal(page: Page): Promise<string> {
  // The headline figure sits directly above the "played at N%" line.
  await expect(page.getByText(/played at \d+%/)).toBeVisible();
  const total = page.locator('h3').first();
  return ((await total.textContent()) ?? '').trim();
}

test('a full round, shared and replayed to the same total', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/');

  // 1. Confirm the day's settings. The house starter must not be readable yet.
  const gate = page.getByRole('dialog');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('Use the house starter');
  await expect(page.getByRole('grid')).toHaveCount(0);

  await page.getByRole('button', { name: 'Start' }).click();
  await expect(gate).toHaveCount(0);

  // The starter is played for the player, so row one is filled in.
  await expect(page.getByTestId('tile-0-0')).not.toHaveText('');

  // 2. Play until the game ends, guessing real words.
  const words = ['crane', 'moist', 'pluck', 'begun', 'dwarf'];
  for (const word of words) {
    if (await page.getByText(/played at \d+%/).isVisible()) break;
    await page.keyboard.type(word);
    await page.keyboard.press('Enter');
    // An unknown word is refused without costing a turn; these are all real, so
    // the only reason to wait is the reveal.
    await page.waitForTimeout(120);
  }

  await expect(page.getByText(/played at \d+%/)).toBeVisible({ timeout: 15_000 });

  const senderRows = await boardRows(page);
  const senderTotal = await readTotal(page);
  expect(senderTotal).toMatch(/^-?\d+\.\d$/);

  // 3. Share, and take the link out of the clipboard.
  await page.getByRole('button', { name: 'Share' }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());

  // The shared text spoils nothing: an emoji grid, a score, badges, no words.
  expect(shared).toMatch(/[\u2B1C\u{1F7E8}\u{1F7E9}]{5}/u);
  expect(shared).toContain(senderTotal);
  for (const word of senderRows.filter((row) => row !== '')) {
    expect(shared.toLowerCase()).not.toContain(word);
  }

  const link = shared.split('\n').at(-1) ?? '';
  expect(link).toContain('#r=');

  // 4. Open it in a genuinely clean profile — no storage, no history, nothing
  //    that could make the score come out right by remembering it.
  const clean = await page.context().browser()!.newContext();
  const recipient = await clean.newPage();
  await recipient.goto(link);

  // A recipient who has not played that day is warned first.
  await expect(recipient.getByText(/will spoil puzzle/i)).toBeVisible();
  await recipient.getByRole('button', { name: /show me anyway/i }).click();

  // 5. The same board, and the same total, recomputed from scratch.
  await expect(recipient.getByRole('grid')).toBeVisible();
  expect(await boardRows(recipient)).toEqual(senderRows);
  expect(await readTotal(recipient)).toBe(senderTotal);
  await expectHorizontallyCentred(recipient, recipient.getByRole('grid'), 'the replayed board');

  await clean.close();
});

test('the results sit below the board rather than on top of it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();

  for (const word of ['crane', 'moist', 'pluck', 'begun', 'dwarf', 'skimp']) {
    if (await page.getByText(/played at \d+%/).isVisible().catch(() => false)) break;
    await page.keyboard.type(word);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  await expect(page.getByText(/played at \d+%/)).toBeVisible({ timeout: 15_000 });

  // While playing, the layout is pinned to the viewport so the board and
  // keyboard fit without scrolling. The results are legitimately taller than
  // the screen, so that height has to be released — when it was not, the score
  // rendered straight over the tiles and neither could be read.
  const lastTile = await page.getByTestId('tile-5-4').boundingBox();
  const total = await page.getByText(/played at \d+%/).boundingBox();

  expect(lastTile).not.toBeNull();
  expect(total).not.toBeNull();
  expect(total!.y).toBeGreaterThan(lastTile!.y + lastTile!.height);
});

test('the board and the keyboard sit centred in the column', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();

  await expect(page.getByRole('grid')).toBeVisible();
  await expectHorizontallyCentred(page, page.getByRole('grid'), 'the board');
  await expectHorizontallyCentred(page, page.getByTestId('keyboard'), 'the keyboard');
});

test('an in-progress game survives a reload exactly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();

  await page.keyboard.type('crane');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  const before = await boardRows(page);

  await page.reload();

  // No settings gate: the choice was locked, and a reload is exactly how
  // somebody would try to escape it.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await boardRows(page)).toEqual(before);
});

test('a malformed link fails gracefully', async ({ page }) => {
  await page.goto('/#r=obviouslyNotAValidPayload');

  await expect(page.getByText(/damaged or incomplete|newer version/i)).toBeVisible();
  await page.getByRole('button', { name: /play today/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the board is comfortable on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only meaningful on the mobile project.');

  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();

  // Everything needed to play has to be reachable without scrolling, or
  // one-handed play on a phone is not really possible.
  const keyboard = page.getByRole('button', { name: 'Submit guess' });
  await expect(keyboard).toBeInViewport();
  await expect(page.getByTestId('tile-5-4')).toBeInViewport();
});
