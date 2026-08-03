import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Appearance, including the accessibility options spec §9 asks for.
 *
 * Tile colours live here rather than in components because they are the one
 * thing the colourblind-safe option changes, and a palette scattered through
 * markup cannot be swapped.
 */

export type Appearance = 'dark' | 'light';
export type TilePalette = 'classic' | 'accessible';

export interface AppearancePreferences {
  readonly appearance: Appearance;
  readonly tilePalette: TilePalette;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  // Dark by default, with light available.
  appearance: 'dark',
  tilePalette: 'classic',
};

export interface TileColours {
  readonly absent: string;
  readonly present: string;
  readonly correct: string;
  readonly text: string;
  readonly emptyBorder: string;
  readonly filledBorder: string;
  readonly keyIdle: string;
}

/**
 * The two tile palettes.
 *
 * `classic` is the green/yellow scheme players expect. `accessible` swaps to
 * orange and blue, which stays distinguishable under red-green colour blindness
 * — the common form, and the one the familiar palette is worst for.
 */
const TILES: Record<Appearance, Record<TilePalette, TileColours>> = {
  dark: {
    classic: {
      absent: '#3a3a3c',
      present: '#b59f3b',
      correct: '#538d4e',
      text: '#ffffff',
      emptyBorder: '#3a3a3c',
      filledBorder: '#565758',
      keyIdle: '#818384',
    },
    accessible: {
      absent: '#3a3a3c',
      present: '#cc7722',
      correct: '#1b6ca8',
      text: '#ffffff',
      emptyBorder: '#3a3a3c',
      filledBorder: '#565758',
      keyIdle: '#818384',
    },
  },
  light: {
    classic: {
      absent: '#787c7e',
      present: '#c9b458',
      correct: '#6aaa64',
      text: '#ffffff',
      emptyBorder: '#d3d6da',
      filledBorder: '#878a8c',
      keyIdle: '#d3d6da',
    },
    accessible: {
      absent: '#787c7e',
      present: '#d2691e',
      correct: '#0f5c8c',
      text: '#ffffff',
      emptyBorder: '#d3d6da',
      filledBorder: '#878a8c',
      keyIdle: '#d3d6da',
    },
  },
};

export function tileColours(preferences: AppearancePreferences): TileColours {
  return TILES[preferences.appearance][preferences.tilePalette];
}

export function createAppTheme(preferences: AppearancePreferences): Theme {
  const colours = tileColours(preferences);

  return createTheme({
    palette: {
      mode: preferences.appearance,
      ...(preferences.appearance === 'light' ? { background: { default: '#ffffff' } } : {}),
    },
    typography: {
      fontFamily: [
        'system-ui',
        '-apple-system',
        'Segoe UI',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Respect a reduced-motion preference globally rather than per
          // component, so a new animation cannot forget to honour it.
          '@media (prefers-reduced-motion: reduce)': {
            '*': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
    },
    // Read by the board and the keyboard through the theme, so switching
    // palettes needs no component to change.
    tiles: colours,
  } as Parameters<typeof createTheme>[0]);
}

/** The default theme, for anything that does not read preferences. */
export const theme = createAppTheme(DEFAULT_APPEARANCE);

declare module '@mui/material/styles' {
  interface Theme {
    tiles: TileColours;
  }
  interface ThemeOptions {
    tiles?: TileColours;
  }
}
