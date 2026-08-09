/**
 * The favicon, and the four ways it can quietly stop working.
 *
 * An icon is the one part of the app nobody notices until it is wrong, and every
 * failure here is silent: the page still loads, the game still plays, and the tab
 * shows a blank sheet of paper. So each of these is a fact index.html or the
 * generator asserts, checked rather than trusted.
 *
 * 1. A file named in the head is missing, or one nobody names is still committed
 *    after a rename.
 * 2. The SVG is not well-formed XML. HTML forgives a stray byte and an inline
 *    copy renders perfectly; a browser fetching the same file as an image does
 *    not, and shows a broken icon instead. This happened during the build.
 * 3. The mark drifts off the theme's palette, so the tab is a green that appears
 *    nowhere in the game.
 * 4. The raster fallbacks stop matching what the head claims of them, which is
 *    how a browser ends up scaling the wrong entry or none.
 *
 * What no test here can see is whether the committed rasters are current with the
 * SVG; tools/icons/render.ts says why not.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_APPEARANCE, tileColours } from '../src/app/theme/theme';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

/** An icon as index.html declares it. */
interface Declared {
  readonly rel: string;
  readonly href: string;
  /** The sizes the markup claims the file holds, in pixels. */
  readonly sizes: readonly number[];
}

const DECLARED: readonly Declared[] = (() => {
  const head = new DOMParser().parseFromString(
    readFileSync(resolve(ROOT, 'index.html'), 'utf8'),
    'text/html',
  );

  return [...head.querySelectorAll('link')]
    .filter((link) => (link.getAttribute('rel') ?? '').includes('icon'))
    .map((link) => ({
      rel: link.getAttribute('rel')!,
      href: link.getAttribute('href')!,
      // `sizes="16x16 32x32"` is a set, and both dimensions of each entry are
      // the same here, so one number per entry is enough to compare.
      sizes: (link.getAttribute('sizes') ?? '')
        .split(/\s+/)
        .filter((size) => /^\d+x\d+$/.test(size))
        .map((size) => Number(size.split('x')[0])),
    }));
})();

function contents(href: string): Buffer {
  return readFileSync(resolve(PUBLIC, href.replace(/^\//, '')));
}

/** A PNG's dimensions, from the IHDR chunk the format requires to come first. */
function pngSize(png: Buffer): { readonly width: number; readonly height: number } {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(png.subarray(0, SIGNATURE.length).equals(SIGNATURE), 'PNG signature').toBe(true);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('the icons index.html declares', () => {
  it('declares an SVG, an ICO and an apple touch icon, in that order', () => {
    // Order is the fallback: a browser takes the first icon it understands, so
    // the SVG has to precede the .ico or every modern tab gets the raster.
    expect(DECLARED.map((icon) => icon.href)).toEqual([
      '/favicon.svg',
      '/favicon.ico',
      '/apple-touch-icon.png',
    ]);
    expect(DECLARED.map((icon) => icon.rel)).toEqual(['icon', 'icon', 'apple-touch-icon']);
  });

  it.each(DECLARED)('serves $href from public/', ({ href }) => {
    expect(href.startsWith('/'), 'an icon href is absolute, so a deep link resolves it').toBe(true);
    expect(contents(href).length).toBeGreaterThan(0);
  });

  it('leaves no icon in public/ that nothing declares', () => {
    // The mirror of the check above. A rename that leaves the old file behind is
    // invisible until somebody wonders which of the two is the real one.
    const committed = readdirSync(PUBLIC)
      .filter((file) => /\.(svg|png|ico)$/.test(file))
      .sort();

    expect(committed).toEqual(
      DECLARED.map((icon) => icon.href.replace(/^\//, ''))
        .slice()
        .sort(),
    );
  });
});

describe('the mark', () => {
  const source = readFileSync(resolve(PUBLIC, 'favicon.svg'), 'utf8');
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml');

  it('is well-formed XML, which is how a browser reads it', () => {
    expect([...svg.getElementsByTagName('parsererror')]).toEqual([]);
    expect(svg.documentElement.tagName).toBe('svg');
  });

  it('scales to any size, carrying a square viewBox and no fixed dimensions', () => {
    const root = svg.documentElement;
    expect(root.getAttribute('width')).toBeNull();
    expect(root.getAttribute('height')).toBeNull();

    const box = (root.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
    expect(box).toHaveLength(4);
    expect(box[2]).toBe(box[3]);
  });

  it('uses the theme\u2019s colours rather than near misses of them', () => {
    // The tile is the colour a correct letter lands on, and the flag is tile
    // text. Both come from the palette the app opens in, so a palette change is
    // visibly a palette change rather than something the icon opts out of.
    const tiles = tileColours(DEFAULT_APPEARANCE);
    const fills = [...svg.documentElement.children].map((element) => element.getAttribute('fill'));

    expect(fills).toEqual([tiles.correct, tiles.text]);
  });

  it('draws the flag as one shape, so no seam can open along a shared edge', () => {
    // Two adjacent shapes are antialiased separately. Where their shared edge
    // falls between pixels neither covers it fully and the tile behind shows
    // through, which is what a stem and a pennant meeting at x=14 did: a green
    // line down the height of the flag, invisible at 16 and 32 because the edge
    // landed on a whole pixel there, and plain at 180.
    expect(svg.documentElement.getElementsByTagName('path')).toHaveLength(1);
  });

  it('keeps every coordinate even, so no straight edge lands on a half pixel', () => {
    // The grid is 32 units and the size that matters is 16 pixels. An odd
    // coordinate halves to a pixel boundary and the stem renders three blurred
    // pixels wide instead of two crisp ones, which is visible in a tab. Deltas
    // in a relative path are even exactly when the points they reach are, so
    // scanning the numbers as written is enough.
    const GEOMETRY = ['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r'];

    const odd = [...svg.documentElement.children].flatMap((element) =>
      GEOMETRY.flatMap((name) => {
        const value = element.getAttribute(name);
        if (value === null) return [];
        return (value.match(/-?\d+(\.\d+)?/g) ?? [])
          .map(Number)
          .filter((number) => !Number.isInteger(number / 2))
          .map((number) => `${element.tagName} ${name}="${value}" has ${number}`);
      }),
    );

    expect(odd).toEqual([]);
  });
});

describe('the raster fallbacks', () => {
  it('packs exactly the sizes favicon.ico is declared to hold', () => {
    const declared = DECLARED.find((icon) => icon.href.endsWith('.ico'))!;
    const ico = contents(declared.href);

    expect(ico.readUInt16LE(0), 'reserved').toBe(0);
    expect(ico.readUInt16LE(2), 'an icon rather than a cursor').toBe(1);

    const count = ico.readUInt16LE(4);
    expect(count).toBe(declared.sizes.length);

    const packed = Array.from({ length: count }, (_, index) => {
      const entry = 6 + 16 * index;
      // A dimension is one byte, and 256 is stored as zero.
      const size = ico.readUInt8(entry) || 256;
      const bytes = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      const image = ico.subarray(offset, offset + bytes);

      expect(ico.readUInt8(entry + 1), `entry ${size} is square`).toBe(ico.readUInt8(entry));
      expect(offset + bytes, `entry ${size} lies inside the file`).toBeLessThanOrEqual(ico.length);
      // Each entry is a whole PNG, so the bytes in the container are the bytes
      // that were rasterised. An entry claiming a size its image is not is the
      // one corruption a viewer will not show you.
      expect(pngSize(image), `entry ${size} holds a PNG of its own size`).toEqual({
        width: size,
        height: size,
      });

      return size;
    });

    expect(packed).toEqual([...declared.sizes]);
  });

  it('sizes the apple touch icon as declared, at the 180 iOS asks for', () => {
    const declared = DECLARED.find((icon) => icon.rel === 'apple-touch-icon')!;
    expect(declared.sizes).toEqual([180]);
    expect(pngSize(contents(declared.href))).toEqual({ width: 180, height: 180 });
  });
});
