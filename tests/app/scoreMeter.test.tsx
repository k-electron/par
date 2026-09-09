import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HorizontalScoreMeter } from '../../src/app/ui/HorizontalScoreMeter';
import {
  BREAKPOINT_MARKERS,
  HORIZONTAL_ZONES,
  METER_MAX_SCORE,
  METER_MIN_SCORE,
  SCORE_ZONES,
  scoreToPositionPct,
  zoneForScore,
} from '../../src/app/ui/radialScore';

afterEach(cleanup);

describe('zoneForScore', () => {
  it('identifies troll zone for scores below 75', () => {
    expect(zoneForScore(60).id).toBe('troll');
    expect(zoneForScore(70).id).toBe('troll');
    expect(zoneForScore(74.9).id).toBe('troll');
  });

  it('identifies bad zone for scores [75, 90)', () => {
    expect(zoneForScore(75).id).toBe('bad');
    expect(zoneForScore(82.5).id).toBe('bad');
    expect(zoneForScore(89.9).id).toBe('bad');
  });

  it('identifies meh zone for scores [90, 98)', () => {
    expect(zoneForScore(90).id).toBe('meh');
    expect(zoneForScore(95).id).toBe('meh');
    expect(zoneForScore(97.9).id).toBe('meh');
  });

  it('identifies good zone for scores [98, 104)', () => {
    expect(zoneForScore(98).id).toBe('good');
    expect(zoneForScore(100).id).toBe('good');
    expect(zoneForScore(103.9).id).toBe('good');
  });

  it('identifies ultra zone for scores [104, 110)', () => {
    expect(zoneForScore(104).id).toBe('ultra');
    expect(zoneForScore(107.5).id).toBe('ultra');
    expect(zoneForScore(109.9).id).toBe('ultra');
  });

  it('identifies godlike zone for scores 110 and above', () => {
    expect(zoneForScore(110).id).toBe('godlike');
    expect(zoneForScore(112.5).id).toBe('godlike');
    expect(zoneForScore(115).id).toBe('godlike');
    expect(zoneForScore(120).id).toBe('godlike');
  });

  it('defines 6 contiguous zones spanning from 60 to 115', () => {
    expect(SCORE_ZONES).toHaveLength(6);
    expect(SCORE_ZONES[0]?.minScore).toBe(METER_MIN_SCORE);
    expect(SCORE_ZONES[SCORE_ZONES.length - 1]?.maxScore).toBe(METER_MAX_SCORE);

    for (let i = 0; i < SCORE_ZONES.length - 1; i++) {
      expect(SCORE_ZONES[i]?.maxScore).toBe(SCORE_ZONES[i + 1]?.minScore);
    }
  });
});

describe('HORIZONTAL_ZONES and scoreToPositionPct', () => {
  it('sums to 100% and maintains contiguous start/end percentages', () => {
    const totalWidth = HORIZONTAL_ZONES.reduce((acc, z) => acc + z.widthPct, 0);
    expect(totalWidth).toBe(100);

    expect(HORIZONTAL_ZONES[0]?.startPct).toBe(0);
    expect(HORIZONTAL_ZONES[HORIZONTAL_ZONES.length - 1]?.endPct).toBe(100);

    for (let i = 0; i < HORIZONTAL_ZONES.length - 1; i++) {
      expect(HORIZONTAL_ZONES[i]?.endPct).toBe(HORIZONTAL_ZONES[i + 1]?.startPct);
    }
  });

  it('allocates at least 13% width to every zone for mobile readability', () => {
    for (const zone of HORIZONTAL_ZONES) {
      expect(zone.widthPct).toBeGreaterThanOrEqual(13);
    }
  });

  it('maps key breakpoints monotonically from 0% to 100%', () => {
    expect(scoreToPositionPct(60)).toBe(0);
    expect(scoreToPositionPct(75)).toBe(22);
    expect(scoreToPositionPct(90)).toBe(44);
    expect(scoreToPositionPct(98)).toBe(60);
    expect(scoreToPositionPct(104)).toBe(74);
    expect(scoreToPositionPct(110)).toBe(87);
    expect(scoreToPositionPct(115)).toBe(100);

    // PAR (100) sits between 98 (60%) and 104 (74%)
    const parPct = scoreToPositionPct(100);
    expect(parPct).toBeGreaterThan(60);
    expect(parPct).toBeLessThan(74);
    expect(parPct).toBeCloseTo(64.67, 1);
  });

  it('clamps out-of-range scores to 0% and 100%', () => {
    expect(scoreToPositionPct(40)).toBe(0);
    expect(scoreToPositionPct(130)).toBe(100);
  });
});

describe('HorizontalScoreMeter', () => {
  const lightTheme = createTheme({ palette: { mode: 'light' } });
  const darkTheme = createTheme({ palette: { mode: 'dark' } });

  it('renders meter with semantic h3 score, active zone badge, and all zone names', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter score={102.4} par={100} animated={false} />
      </ThemeProvider>,
    );

    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '102.4');
    expect(meter).toHaveAttribute('aria-valuemin', '60');
    expect(meter).toHaveAttribute('aria-valuemax', '115');

    // Score in h3
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('102.4');

    // Active Zone badge
    expect(screen.getByText('Good Zone')).toBeInTheDocument();
    expect(screen.getByText('(98–104)')).toBeInTheDocument();

    // All 6 zone names are clearly visible
    expect(screen.getByText('Troll')).toBeInTheDocument();
    expect(screen.getByText('Bad')).toBeInTheDocument();
    expect(screen.getByText('Meh')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Ultra')).toBeInTheDocument();
    expect(screen.getByText('Godlike')).toBeInTheDocument();

    // Breakpoints
    for (const bp of BREAKPOINT_MARKERS) {
      expect(screen.getByText(String(bp.score))).toBeInTheDocument();
    }

    // PAR marker
    expect(screen.getByText('▲ PAR')).toBeInTheDocument();
  });

  it('renders correctly in dark mode', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <HorizontalScoreMeter score={108.7} par={100} animated={false} />
      </ThemeProvider>,
    );

    expect(screen.getByText('108.7')).toBeInTheDocument();
    expect(screen.getByText('Ultra Zone')).toBeInTheDocument();
  });

  it('handles clamped boundary scores cleanly', () => {
    const { rerender } = render(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter score={50} animated={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('50.0')).toBeInTheDocument();
    expect(screen.getByText('Troll Zone')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter score={120} animated={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('120.0')).toBeInTheDocument();
    expect(screen.getByText('Godlike Zone')).toBeInTheDocument();
  });

  it('renders without error when animated={true}', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter score={101.5} animated={true} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('meter')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('101.5');
  });
});
