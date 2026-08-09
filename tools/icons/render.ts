/**
 * Rasterise public/favicon.svg into the icons that cannot be vector.
 *
 * The SVG is the mark. Everything this writes is a fallback for a client that
 * will not take it: `favicon.ico` for Safari before 17 and for a Windows
 * taskbar pin, and `apple-touch-icon.png` for an iOS home screen, which ignores
 * `rel="icon"` entirely. A daily game gets added to home screens, so that last
 * one is not a formality.
 *
 * Every size is rasterised from the vector at its own size rather than resampled
 * from one large bitmap. That is the whole reason for a generator: at 16 pixels
 * the difference between a hand-placed edge and a downscaled one is the whole
 * icon, and the mark's coordinates are chosen (see the comment in the SVG) so
 * that every straight edge lands on a whole pixel at each of the sizes below
 * that a tab is ever painted at.
 *
 * Chromium does the rasterising, because Playwright already ships it for the
 * end-to-end suite and it is the same engine that will paint the SVG in a tab.
 * So this needs browsers installed, and like the word-list generator it is run
 * deliberately and its output committed:
 *
 *   npx playwright install chromium
 *   npm run render-icons
 *
 * Nothing checks that the committed rasters are current. A byte comparison
 * would go red on a Playwright bump, since antialiasing is not promised to be
 * stable across Chromium versions, and a check that fails for reasons unrelated
 * to the icon is one people learn to ignore. Re-run this after editing the SVG;
 * tests/icons.test.ts holds what can be checked without a browser.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { chromium, type Page } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../../public');
const SOURCE = resolve(PUBLIC, 'favicon.svg');

/**
 * What goes into favicon.ico.
 *
 * 16 is the browser tab, 32 the same tab on a HiDPI screen and what Safari
 * takes for bookmarks and history, 48 a Windows taskbar pin. index.html
 * declares these three, and tests/icons.test.ts holds the declaration and the
 * container to each other.
 */
const ICO_SIZES = [16, 32, 48] as const;

/** iOS scales one 180 down for every older device, so one size is enough. */
const APPLE_TOUCH_SIZE = 180;

/**
 * Rasterise the mark at one size.
 *
 * Through an `<img>` rather than by pasting the SVG into the page, because that
 * is how a browser consumes a favicon and it is a stricter test of the file. An
 * inline SVG is parsed as HTML, which forgives things XML does not: a stray
 * control byte in the comment above the mark, left by an editor, rendered
 * perfectly here and was a broken-image icon in every real tab. `decode()`
 * rejects on a file a browser cannot use, so that failure now stops generation
 * instead of being baked into the icons.
 *
 * The SVG carries a viewBox and no width or height, so it takes the size of the
 * element it is given, which is what lets one file serve every size. Screenshots
 * omit the background so the corners the rounded tile leaves transparent are not
 * filled in white.
 */
async function rasterise(page: Page, svg: string, size: number): Promise<Buffer> {
  const source = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>
       html, body { margin: 0; padding: 0; background: transparent; }
       #icon { display: block; width: ${size}px; height: ${size}px; }
     </style><img id="icon" src="${source}">`,
  );
  await page.evaluate(async () => {
    const icon = document.getElementById('icon') as HTMLImageElement;
    await icon.decode();
  });

  const png = await page.locator('#icon').screenshot({ omitBackground: true });
  const painted = pngSize(png);
  if (painted.width !== size || painted.height !== size) {
    throw new Error(
      `asked for ${size}x${size} but got ${painted.width}x${painted.height}; ` +
        'the page is scaling the icon rather than rendering it at size',
    );
  }
  return png;
}

/** A PNG's dimensions, read from the IHDR chunk that has to come first. */
function pngSize(png: Buffer): { readonly width: number; readonly height: number } {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new Error('not a PNG');
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/**
 * Pack PNGs into an ICO.
 *
 * ICO is a directory of images rather than a format of its own: a six-byte
 * header, a sixteen-byte entry per image, then the images. Storing PNGs in it
 * instead of the older BMP payload is understood by every browser that still
 * asks for an ICO at all, and keeps the bytes in here the same bytes Chromium
 * rasterised.
 */
function ico(images: readonly { readonly size: number; readonly png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 is an icon, 2 would be a cursor
  header.writeUInt16LE(images.length, 4);

  const ENTRY_BYTES = 16;
  const directory = Buffer.alloc(ENTRY_BYTES * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, png }, index) => {
    const entry = index * ENTRY_BYTES;
    // A dimension is one byte, so 256 is written as 0. Nothing here is that big,
    // but a 256 entry silently becoming a 0 is the classic way to corrupt an ICO.
    if (size > 256) throw new RangeError(`${size} does not fit an ICO entry`);
    directory.writeUInt8(size === 256 ? 0 : size, entry);
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2); // no colour palette
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ png }) => png)]);
}

async function main(): Promise<void> {
  const svg = readFileSync(SOURCE, 'utf8');
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 256, height: 256 } });

    const packed: { readonly size: number; readonly png: Buffer }[] = [];
    for (const size of ICO_SIZES) {
      packed.push({ size, png: await rasterise(page, svg, size) });
    }
    const container = resolve(PUBLIC, 'favicon.ico');
    writeFileSync(container, ico(packed));
    console.log(`wrote ${container} (${ICO_SIZES.join(', ')})`);

    const apple = resolve(PUBLIC, 'apple-touch-icon.png');
    writeFileSync(apple, await rasterise(page, svg, APPLE_TOUCH_SIZE));
    console.log(`wrote ${apple} (${APPLE_TOUCH_SIZE})`);
  } finally {
    await browser.close();
  }
}

await main();
