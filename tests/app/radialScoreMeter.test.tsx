import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RadialScoreMeter } from '../../src/app/ui/RadialScoreMeter';
import {
  METER_MAX_SCORE,
  METER_MIN_SCORE,
  SCORE_ZONES,
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

describe('RadialScoreMeter', () => {
  const lightTheme = createTheme({ palette: { mode: 'light' } });
  const darkTheme = createTheme({ palette: { mode: 'dark' } });

  it('renders a meter element with correct aria attributes and score text', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <RadialScoreMeter score={102.4} par={100} animated={false} />
      </ThemeProvider>,
    );

    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '102.4');
    expect(meter).toHaveAttribute('aria-valuemin', '60');
    expect(meter).toHaveAttribute('aria-valuemax', '115');

    expect(screen.getByText('102.4')).toBeInTheDocument();
    expect(screen.getByText('PAR')).toBeInTheDocument();
  });

  it('renders correctly in dark mode', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <RadialScoreMeter score={108.7} par={100} animated={false} />
      </ThemeProvider>,
    );

    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '108.7');
    expect(screen.getByText('108.7')).toBeInTheDocument();
  });

  it('handles clamped boundary scores cleanly', () => {
    const { rerender } = render(
      <ThemeProvider theme={lightTheme}>
        <RadialScoreMeter score={50} animated={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('50.0')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={lightTheme}>
        <RadialScoreMeter score={120} animated={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('120.0')).toBeInTheDocument();
  });

  it('renders without error when animated={true}', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <RadialScoreMeter score={101.5} animated={true} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('meter')).toBeInTheDocument();
    expect(screen.getByText('101.5')).toBeInTheDocument();
  });
});
