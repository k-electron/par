import { describe, expect, it } from 'vitest';
import { theme } from '../src/app/theme/theme';

describe('the theme', () => {
  it('is dark by default', () => {
    expect(theme.palette.mode).toBe('dark');
  });

  it('resolves a background and a contrasting text colour, so CssBaseline has something to apply', () => {
    expect(theme.palette.background.default).toEqual(expect.any(String));
    expect(theme.palette.text.primary).toEqual(expect.any(String));
    expect(theme.palette.background.default).not.toBe(theme.palette.text.primary);
  });
});
