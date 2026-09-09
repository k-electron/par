export type ScoreZone = 'troll' | 'bad' | 'meh' | 'good' | 'ultra' | 'godlike';

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

export const METER_MIN_SCORE = 60;
export const METER_MAX_SCORE = 115;

export const SCORE_ZONES: readonly ZoneDefinition[] = [
  {
    id: 'troll',
    label: 'Troll',
    minScore: 60,
    maxScore: 75,
    color: { light: '#64748B', dark: '#94A3B8' }, // Slate
  },
  {
    id: 'bad',
    label: 'Bad',
    minScore: 75,
    maxScore: 90,
    color: { light: '#DC2626', dark: '#EF4444' }, // Red / Coral
  },
  {
    id: 'meh',
    label: 'Meh',
    minScore: 90,
    maxScore: 98,
    color: { light: '#D97706', dark: '#F59E0B' }, // Warm Amber
  },
  {
    id: 'good',
    label: 'Good',
    minScore: 98,
    maxScore: 104,
    color: { light: '#16A34A', dark: '#22C55E' }, // Fairway Green
  },
  {
    id: 'ultra',
    label: 'Ultra',
    minScore: 104,
    maxScore: 110,
    color: { light: '#0891B2', dark: '#06B6D4' }, // Electric Cyan
  },
  {
    id: 'godlike',
    label: 'Godlike',
    minScore: 110,
    maxScore: 115,
    color: { light: '#9333EA', dark: '#C084FC' }, // Radiant Purple
  },
] as const;

export function zoneForScore(score: number): ZoneDefinition {
  if (score >= 110) return SCORE_ZONES[5]!;
  if (score >= 104) return SCORE_ZONES[4]!;
  if (score >= 98) return SCORE_ZONES[3]!;
  if (score >= 90) return SCORE_ZONES[2]!;
  if (score >= 75) return SCORE_ZONES[1]!;
  return SCORE_ZONES[0]!;
}

export interface HorizontalZoneSegment extends ZoneDefinition {
  readonly widthPct: number;
  readonly startPct: number;
  readonly endPct: number;
}

/**
 * Option B: Tuned proportional widths.
 * Troll (15 pts) & Bad (15 pts) are the widest (22% each),
 * Meh (8 pts) is 16%, Good (6 pts) is 14%, Ultra (6 pts) is 13%, and Godlike (5 pts) is 13%.
 * Sum = 100%. Ensures all zone labels and breakpoint ticks are readable on mobile.
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

export function scoreToPositionPct(score: number): number {
  const clamped = Math.max(METER_MIN_SCORE, Math.min(METER_MAX_SCORE, score));
  for (const seg of HORIZONTAL_ZONES) {
    if (clamped <= seg.maxScore) {
      const fraction = (clamped - seg.minScore) / (seg.maxScore - seg.minScore);
      return seg.startPct + fraction * seg.widthPct;
    }
  }
  return 100;
}

