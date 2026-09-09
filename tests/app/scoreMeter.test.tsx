import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HorizontalScoreMeter } from '../../src/app/ui/HorizontalScoreMeter';
import {
  HORIZONTAL_ZONES,
  METER_MAX_SCORE,
  METER_MIN_SCORE,
  SCORE_ZONES,
  computeDynamicZones,
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

describe('computeDynamicZones', () => {
  it('computes percentage-based curve fitting for Own Opener (Normal or Hard)', () => {
    const dyn = computeDynamicZones({
      maxScore: 107.92,
      par: 3.9733,
      starterBonus: 0,
      guessesUsed: 4,
      totalScore: 99.5,
    });

    expect(dyn.isBlindLuck).toBe(false);
    expect(dyn.meterMinScore).toBe(60);
    expect(dyn.parScore).toBe(100);
    expect(dyn.meterMaxScore).toBe(107.92);
    expect(dyn.zones).toHaveLength(6);

    // Thresholds: DeltaBelow = 40 (60 -> 100)
    // Troll: 60 -> 72 (30%)
    // Bad: 72 -> 84 (30%)
    // Meh: 84 -> 92 (20%)
    // Good: 92 -> 100 (20%)
    expect(dyn.zones[0]?.id).toBe('troll');
    expect(dyn.zones[0]?.minScore).toBe(60);
    expect(dyn.zones[0]?.maxScore).toBeCloseTo(72, 1);

    expect(dyn.zones[1]?.id).toBe('bad');
    expect(dyn.zones[1]?.minScore).toBeCloseTo(72, 1);
    expect(dyn.zones[1]?.maxScore).toBeCloseTo(84, 1);

    expect(dyn.zones[2]?.id).toBe('meh');
    expect(dyn.zones[2]?.minScore).toBeCloseTo(84, 1);
    expect(dyn.zones[2]?.maxScore).toBeCloseTo(92, 1);

    expect(dyn.zones[3]?.id).toBe('good');
    expect(dyn.zones[3]?.minScore).toBeCloseTo(92, 1);
    expect(dyn.zones[3]?.maxScore).toBe(100);

    // DeltaAbove = 7.92 (100 -> 107.92)
    // Ultra: 100 -> 104.75 (60%)
    // Godlike: 104.75 -> 107.92 (40%)
    expect(dyn.zones[4]?.id).toBe('ultra');
    expect(dyn.zones[4]?.minScore).toBe(100);
    expect(dyn.zones[4]?.maxScore).toBeCloseTo(104.75, 1);

    expect(dyn.zones[5]?.id).toBe('godlike');
    expect(dyn.zones[5]?.minScore).toBeCloseTo(104.75, 1);
    expect(dyn.zones[5]?.maxScore).toBe(107.92);

    // Proportional visual widths sum to 100%
    const totalWidth = dyn.horizontalZones.reduce((acc, z) => acc + z.widthPct, 0);
    expect(totalWidth).toBe(100);
  });

  it('computes curve fitting for House Starter with starterBonus', () => {
    const dyn = computeDynamicZones({
      maxScore: 108.5,
      par: 3.9733,
      starterBonus: 3,
      guessesUsed: 3,
      totalScore: 105.0,
    });

    expect(dyn.isBlindLuck).toBe(false);
    expect(dyn.parScore).toBe(103);
    expect(dyn.meterMaxScore).toBe(108.5);
    expect(dyn.zones).toHaveLength(6);

    // Good zone ends at 103 (parScore)
    expect(dyn.zones[3]?.maxScore).toBe(103);
    // Ultra begins at 103
    expect(dyn.zones[4]?.minScore).toBe(103);
    // Godlike ends at 108.5
    expect(dyn.zones[5]?.maxScore).toBe(108.5);
  });

  it('reveals secret "Blind luck" 7th zone when player achieves a 1-guess hole-in-one', () => {
    const dyn = computeDynamicZones({
      maxScore: 107.92,
      par: 3.9733,
      starterBonus: 0,
      guessesUsed: 1, // 1-guess hole-in-one!
      totalScore: 111.89,
    });

    expect(dyn.isBlindLuck).toBe(true);
    expect(dyn.zones).toHaveLength(7);
    expect(dyn.horizontalZones).toHaveLength(7);

    const blindLuckZone = dyn.zones[6];
    expect(blindLuckZone?.id).toBe('blind_luck');
    expect(blindLuckZone?.label).toBe('Blind luck');
    expect(blindLuckZone?.minScore).toBe(107.92);
    expect(blindLuckZone?.maxScore).toBeCloseTo(111.89, 1);

    // All 7 widths sum to 100%
    const totalWidth = dyn.horizontalZones.reduce((acc, z) => acc + z.widthPct, 0);
    expect(totalWidth).toBe(100);

    // zoneForScore maps hole-in-one score to 'blind_luck'
    expect(zoneForScore(111.89, dyn.zones).id).toBe('blind_luck');
  });

  it('allows players to achieve Godlike without needing a hole-in-one', () => {
    const dyn = computeDynamicZones({
      maxScore: 107.92,
      par: 3.9733,
      starterBonus: 0,
      guessesUsed: 2,
      totalScore: 106.5,
    });

    // Score 106.5 is in Godlike zone [104.75, 107.92]
    expect(zoneForScore(106.5, dyn.zones).id).toBe('godlike');
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

  it('renders meter with semantic h3 score and standard 6 zones for normal games', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter
          score={102.4}
          par={3.9733}
          maxScore={107.9}
          starterBonus={0}
          guessesUsed={3}
          animated={false}
        />
      </ThemeProvider>,
    );

    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '102.4');
    expect(meter).toHaveAttribute('aria-valuemin', '60');
    expect(meter).toHaveAttribute('aria-valuemax', '107.9');

    // Score in h3
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('102.4');

    // All 6 zone names are clearly visible
    expect(screen.getByText('Troll')).toBeInTheDocument();
    expect(screen.getByText('Bad')).toBeInTheDocument();
    expect(screen.getByText('Meh')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Ultra')).toBeInTheDocument();
    expect(screen.getByText('Godlike')).toBeInTheDocument();

    // "Blind luck" is HIDDEN for normal games
    expect(screen.queryByText('Blind luck')).toBeNull();

    // PAR marker
    expect(screen.getByText('▲ PAR')).toBeInTheDocument();
  });

  it('renders the 7th "Blind luck" zone when a hole-in-one is achieved (n = 1)', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter
          score={111.9}
          par={3.9733}
          maxScore={107.9}
          starterBonus={0}
          guessesUsed={1}
          animated={false}
        />
      </ThemeProvider>,
    );

    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '111.9');

    // "Blind luck" zone label is present!
    expect(screen.getByText('Blind luck')).toBeInTheDocument();
    expect(screen.getByText('Godlike')).toBeInTheDocument();
    expect(screen.getByText('Ultra')).toBeInTheDocument();
  });

  it('renders correctly in dark mode', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <HorizontalScoreMeter score={108.7} par={100} animated={false} />
      </ThemeProvider>,
    );

    expect(screen.getByText('108.7')).toBeInTheDocument();
  });

  it('handles clamped boundary scores cleanly', () => {
    const { rerender } = render(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter score={50} animated={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('50.0')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={lightTheme}>
        <HorizontalScoreMeter score={120} animated={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('120.0')).toBeInTheDocument();
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

