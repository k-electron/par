import { describe, expect, it } from 'vitest';
import { theme } from '../src/app/theme/theme';

describe('the theme', () => {
  it('is dark by default', () => {
    expect(theme.palette.mode).toBe('dark');
  });

  it('resolves a background and a contrasting text colour, so CssBaseline has something to apply', () => {
    expect(theme.palette.background.default).not.toBe(theme.palette.text.primary);
  });

  it('configures cosmic obsidian background and modern space typography', () => {
    expect(theme.palette.background.default).toBe('#05070E');
    expect(theme.typography.fontFamily).toContain('Space Grotesk');
    expect(theme.tiles.correct).toBe('#00FFA3');
  });
});
