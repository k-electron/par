import { C_PAR, PAR } from '../../engine/config/constants';

export type ScoreZone = 'troll' | 'bad' | 'meh' | 'good' | 'ultra' | 'godlike' | 'blind_luck';

export interface ZoneDefinition {
  readonly id: ScoreZone;
  readonly label: string;
  readonly minScore: number;
  readonly maxScore: number;
  readonly color: {
    readonly light: string;
    readonly dark: string;
  };
}

export const ZONE_COLORS: Record<ScoreZone, { readonly light: string; readonly dark: string }> = {
  troll: { light: '#64748B', dark: '#94A3B8' }, // Slate
  bad: { light: '#DC2626', dark: '#EF4444' }, // Red / Coral
  meh: { light: '#D97706', dark: '#F59E0B' }, // Warm Amber
  good: { light: '#16A34A', dark: '#22C55E' }, // Fairway Green
  ultra: { light: '#0891B2', dark: '#06B6D4' }, // Electric Cyan
  godlike: { light: '#9333EA', dark: '#C084FC' }, // Radiant Purple
  blind_luck: { light: '#CA8A04', dark: '#FACC15' }, // Radiant Gold
};

export const METER_MIN_SCORE = 60;
export const METER_MAX_SCORE = 115;

export const SCORE_ZONES: readonly ZoneDefinition[] = [
  {
    id: 'troll',
    label: 'Troll',
    minScore: 60,
    maxScore: 75,
    color: ZONE_COLORS.troll,
  },
  {
    id: 'bad',
    label: 'Bad',
    minScore: 75,
    maxScore: 90,
    color: ZONE_COLORS.bad,
  },
  {
    id: 'meh',
    label: 'Meh',
    minScore: 90,
    maxScore: 98,
    color: ZONE_COLORS.meh,
  },
  {
    id: 'good',
    label: 'Good',
    minScore: 98,
    maxScore: 104,
    color: ZONE_COLORS.good,
  },
  {
    id: 'ultra',
    label: 'Ultra',
    minScore: 104,
    maxScore: 110,
    color: ZONE_COLORS.ultra,
  },
  {
    id: 'godlike',
    label: 'Godlike',
    minScore: 110,
    maxScore: 115,
    color: ZONE_COLORS.godlike,
  },
] as const;

export interface HorizontalZoneSegment extends ZoneDefinition {
  readonly widthPct: number;
  readonly startPct: number;
  readonly endPct: number;
}

/**
 * Static baseline widths (6 zones: sum = 100%).
 */
export const HORIZONTAL_ZONES: readonly HorizontalZoneSegment[] = [
  { ...SCORE_ZONES[0]!, widthPct: 22, startPct: 0, endPct: 22 },
  { ...SCORE_ZONES[1]!, widthPct: 22, startPct: 22, endPct: 44 },
  { ...SCORE_ZONES[2]!, widthPct: 16, startPct: 44, endPct: 60 },
  { ...SCORE_ZONES[3]!, widthPct: 14, startPct: 60, endPct: 74 },
  { ...SCORE_ZONES[4]!, widthPct: 13, startPct: 74, endPct: 87 },
  { ...SCORE_ZONES[5]!, widthPct: 13, startPct: 87, endPct: 100 },
];

export interface BreakpointMarker {
  readonly score: number;
  readonly pct: number;
}

export const BREAKPOINT_MARKERS: readonly BreakpointMarker[] = [
  { score: 60, pct: 0 },
  { score: 75, pct: 22 },
  { score: 90, pct: 44 },
  { score: 98, pct: 60 },
  { score: 104, pct: 74 },
  { score: 110, pct: 87 },
  { score: 115, pct: 100 },
];

export interface DynamicZonesOptions {
  /** The 2-guess gameplay ceiling computed by the engine. */
  readonly maxScore?: number | undefined;
  /** Benchmark par in strokes (defaults to PAR). */
  readonly par?: number | undefined;
  /** Starter bonus (3 for house starter, 0 for own opener). */
  readonly starterBonus?: number | undefined;
  /** Number of guesses used by the player in this round. */
  readonly guessesUsed?: number | undefined;
  /** Final total score. */
  readonly totalScore?: number | undefined;
}

export interface DynamicZonesResult {
  readonly isBlindLuck: boolean;
  readonly meterMinScore: number;
  readonly meterMaxScore: number;
  readonly parScore: number;
  readonly zones: readonly ZoneDefinition[];
  readonly horizontalZones: readonly HorizontalZoneSegment[];
  readonly breakpointMarkers: readonly BreakpointMarker[];
}

/**
 * Computes dynamic, percentage-based score zones tailored to the exact board,
 * mode, and starter choice with zero global averages.
 */
export function computeDynamicZones(options: DynamicZonesOptions = {}): DynamicZonesResult {
  const starterBonus = options.starterBonus ?? 0;
  const parStrokes = options.par !== undefined && options.par < 50 ? options.par : PAR;
  const parScore = 100 + starterBonus;

  // Theoretical ceiling for 2-guess play (Option 2A)
  const sMax = options.maxScore !== undefined
    ? options.maxScore
    : 100 + C_PAR * (parStrokes - 2) + starterBonus;

  // Hole-in-one theoretical maximum (Option 2B)
  const holeInOneScore = 100 + C_PAR * (parStrokes - 1) + starterBonus;

  // Reveal secret "Blind luck" zone if player scored a 1-guess finish or exceeded sMax
  const isBlindLuck =
    options.guessesUsed === 1 ||
    (options.totalScore !== undefined && options.totalScore > sMax + 0.05);

  const meterMinScore = METER_MIN_SCORE;
  const meterMaxScore = isBlindLuck ? holeInOneScore : sMax;

  // Below PAR: proportional interpolation of (parScore - 60)
  // Troll (30%), Bad (30%), Meh (20%), Good (20%)
  const deltaBelow = parScore - meterMinScore;
  const t1 = meterMinScore + 0.30 * deltaBelow;
  const t2 = meterMinScore + 0.60 * deltaBelow;
  const t3 = meterMinScore + 0.80 * deltaBelow;
  const tPar = parScore;

  // Above PAR: proportional interpolation of (sMax - parScore)
  // Ultra (60%), Godlike (40%)
  const deltaAbove = Math.max(0.1, sMax - parScore);
  const t4 = parScore + 0.60 * deltaAbove;

  const zones: ZoneDefinition[] = [
    { id: 'troll', label: 'Troll', minScore: meterMinScore, maxScore: t1, color: ZONE_COLORS.troll },
    { id: 'bad', label: 'Bad', minScore: t1, maxScore: t2, color: ZONE_COLORS.bad },
    { id: 'meh', label: 'Meh', minScore: t2, maxScore: t3, color: ZONE_COLORS.meh },
    { id: 'good', label: 'Good', minScore: t3, maxScore: tPar, color: ZONE_COLORS.good },
    { id: 'ultra', label: 'Ultra', minScore: tPar, maxScore: t4, color: ZONE_COLORS.ultra },
    { id: 'godlike', label: 'Godlike', minScore: t4, maxScore: sMax, color: ZONE_COLORS.godlike },
  ];

  if (isBlindLuck) {
    zones.push({
      id: 'blind_luck',
      label: 'Blind luck',
      minScore: sMax,
      maxScore: holeInOneScore,
      color: ZONE_COLORS.blind_luck,
    });
  }

  // Visual segment widths (sum = 100%)
  const widths = isBlindLuck
    ? [18, 18, 14, 13, 12, 12, 13]
    : [22, 22, 16, 14, 13, 13];

  let currentStart = 0;
  const horizontalZones: HorizontalZoneSegment[] = zones.map((zone, i) => {
    const widthPct = widths[i]!;
    const startPct = currentStart;
    const endPct = currentStart + widthPct;
    currentStart = endPct;
    return {
      ...zone,
      widthPct,
      startPct,
      endPct,
    };
  });

  // Breakpoint ticks below the bar
  const breakpointMarkers: BreakpointMarker[] = [
    { score: Math.round(meterMinScore), pct: 0 },
    { score: Math.round(t1), pct: horizontalZones[1]!.startPct },
    { score: Math.round(t2), pct: horizontalZones[2]!.startPct },
    { score: Math.round(t3), pct: horizontalZones[3]!.startPct },
    { score: Math.round(tPar), pct: horizontalZones[4]!.startPct },
    { score: Math.round(t4), pct: horizontalZones[5]!.startPct },
  ];

  if (isBlindLuck) {
    breakpointMarkers.push(
      { score: Number(sMax.toFixed(1)), pct: horizontalZones[6]!.startPct },
      { score: Number(holeInOneScore.toFixed(1)), pct: 100 },
    );
  } else {
    breakpointMarkers.push({ score: Number(sMax.toFixed(1)), pct: 100 });
  }

  return {
    isBlindLuck,
    meterMinScore,
    meterMaxScore,
    parScore,
    zones,
    horizontalZones,
    breakpointMarkers,
  };
}

export function zoneForScore(
  score: number,
  zones: readonly ZoneDefinition[] = SCORE_ZONES,
): ZoneDefinition {
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i]!;
    if (score >= zone.minScore) {
      return zone;
    }
  }
  return zones[0]!;
}

export function scoreToPositionPct(
  score: number,
  horizontalZones: readonly HorizontalZoneSegment[] = HORIZONTAL_ZONES,
  meterMinScore: number = METER_MIN_SCORE,
  meterMaxScore: number = METER_MAX_SCORE,
): number {
  const clamped = Math.max(meterMinScore, Math.min(meterMaxScore, score));
  for (const seg of horizontalZones) {
    if (clamped <= seg.maxScore) {
      const span = seg.maxScore - seg.minScore;
      const fraction = span > 0 ? (clamped - seg.minScore) / span : 0;
      return seg.startPct + fraction * seg.widthPct;
    }
  }
  return 100;
}

