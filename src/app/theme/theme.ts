import { createTheme, type Theme, type SxProps } from '@mui/material/styles';

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
  readonly textOnCorrect: string;
  readonly textOnPresent: string;
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
      absent: '#141923',
      present: '#FFB800',
      correct: '#00FFA3',
      text: '#FFFFFF',
      textOnCorrect: '#05070E',
      textOnPresent: '#05070E',
      emptyBorder: 'rgba(0, 240, 255, 0.18)',
      filledBorder: 'rgba(0, 240, 255, 0.45)',
      keyIdle: '#1E2536',
    },
    accessible: {
      absent: '#141923',
      present: '#FF6B00',
      correct: '#00D2FF',
      text: '#FFFFFF',
      textOnCorrect: '#05070E',
      textOnPresent: '#05070E',
      emptyBorder: 'rgba(0, 210, 255, 0.25)',
      filledBorder: 'rgba(0, 210, 255, 0.55)',
      keyIdle: '#1E2536',
    },
  },
  light: {
    classic: {
      absent: '#787c7e',
      present: '#c9b458',
      correct: '#6aaa64',
      text: '#ffffff',
      textOnCorrect: '#ffffff',
      textOnPresent: '#ffffff',
      emptyBorder: '#d3d6da',
      filledBorder: '#878a8c',
      keyIdle: '#d3d6da',
    },
    accessible: {
      absent: '#787c7e',
      present: '#d2691e',
      correct: '#0f5c8c',
      text: '#ffffff',
      textOnCorrect: '#ffffff',
      textOnPresent: '#ffffff',
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
      ...(preferences.appearance === 'light'
        ? {
            background: { default: '#ffffff', paper: '#f8fafc' },
            text: { primary: '#0f172a', secondary: '#475569' },
          }
        : {
            background: {
              default: '#05070E',
              paper: 'rgba(12, 17, 29, 0.85)',
            },
            text: {
              primary: '#F1F5F9',
              secondary: '#94A3B8',
            },
            primary: {
              main: '#00FFA3',
              contrastText: '#05070E',
            },
            secondary: {
              main: '#00D2FF',
              contrastText: '#05070E',
            },
            divider: 'rgba(0, 240, 255, 0.14)',
          }),
    },
    typography: {
      fontFamily: [
        'Space Grotesk',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ].join(','),
      fontFamilyMonospace: [
        'JetBrains Mono',
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        'monospace',
      ].join(','),
    },
    components: {
      // Stack spaces its children with margins unless told otherwise, and the
      // reset that comes with that — `& > :not(style):not(style) { margin: 0 }`
      // — outranks a child's own `mx: 'auto'` on specificity. Anything that
      // centres itself that way is silently left-aligned the moment it becomes
      // a direct Stack child, which is what happened to the replay board.
      // Spacing with `gap` leaves child margins alone.
      MuiStack: {
        defaultProps: { useFlexGap: true },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            ...(preferences.appearance === 'dark'
              ? {
                  backgroundColor: 'rgba(12, 17, 29, 0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0, 240, 255, 0.12)',
                }
              : {}),
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: preferences.appearance === 'dark' ? '#05070E' : '#ffffff',
            color: preferences.appearance === 'dark' ? '#F1F5F9' : '#0f172a',
          },
          'code, kbd, samp, pre': {
            fontFamily: [
              'JetBrains Mono',
              'ui-monospace',
              'SFMono-Regular',
              'Menlo',
              'Monaco',
              'Consolas',
              'monospace',
            ].join(','),
          },
          // Respect a reduced-motion preference globally rather than per
          // component, so a new animation cannot forget to honour it.
          '@media (prefers-reduced-motion: reduce)': {
            '*': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
              // Delay matters as much as duration. The staggered tile reveal
              // spaces its tiles by delay, so zeroing only the duration would
              // leave six instantaneous flips spread over a second and a half —
              // still motion, just jerkier.
              animationDelay: '0ms !important',
              transitionDelay: '0ms !important',
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

/** Glowing sci-fi switch styling for AppearanceMenu and SettingsGate. */
export const sciFiSwitchSx: SxProps<Theme> = {
  ml: 1,
  '& .MuiSwitch-switchBase': {
    '&.Mui-checked': {
      color: '#00FFA3',
      transform: 'translateX(20px)',
      '& + .MuiSwitch-track': {
        backgroundColor: '#00FFA3',
        opacity: 0.35,
      },
      '& .MuiSwitch-thumb': {
        backgroundColor: '#00FFA3',
        boxShadow: '0 0 10px rgba(0, 255, 163, 0.8)',
      },
    },
  },
  '& .MuiSwitch-track': {
    borderRadius: 16,
    backgroundColor: (theme: Theme) =>
      theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.25)',
    opacity: 0.5,
    border: (theme: Theme) =>
      theme.palette.mode === 'dark' ? '1px solid rgba(0, 240, 255, 0.2)' : undefined,
  },
  '& .MuiSwitch-thumb': {
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
};

/**
 * Off the screen, still in the accessibility tree.
 *
 * Every length here is a string on purpose. `sx` is not CSS: it runs numbers
 * through MUI's transforms, and the two that apply here disagree about what a
 * bare 1 means. `width: 1` and `height: 1` go through the sizing transform,
 * which reads anything up to 1 as a fraction — so these were 100% × 100%,
 * eighteen viewport-sized absolutely-positioned boxes that scrolled the page
 * 670px past its own content once the table appeared. `m: -1` goes through
 * the spacing scale instead and means -8px, where the recipe wants -1px.
 */
export const visuallyHiddenStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

declare module '@mui/material/styles' {
  interface Theme {
    tiles: TileColours;
  }
  interface ThemeOptions {
    tiles?: TileColours;
  }
  interface TypographyVariants {
    fontFamilyMonospace: string;
  }
  interface TypographyVariantsOptions {
    fontFamilyMonospace?: string;
  }
}
