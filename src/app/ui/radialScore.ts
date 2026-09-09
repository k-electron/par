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
