import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useId, useMemo, useState } from 'react';

import { PAR } from '../../engine/config/constants';
import {
  METER_MAX_SCORE,
  METER_MIN_SCORE,
  SCORE_ZONES,
  zoneForScore,
} from './radialScore';

export interface RadialScoreMeterProps {
  readonly score: number;
  readonly par?: number;
  readonly animated?: boolean;
}

/**
 * Arc geometry constants.
 * Center at (110, 105), radius 72.
 * Arc sweeps 200 degrees from 170 deg (bottom-left) to 370 deg (bottom-right).
 */
const CX = 110;
const CY = 105;
const RADIUS = 72;
const START_ANGLE = 170;
const END_ANGLE = 370;
const ANGLE_SPAN = END_ANGLE - START_ANGLE; // 200 degrees
const TRACK_WIDTH = 7;
const FILL_WIDTH = 9;
const GAP_DEG = 1.5;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = degToRad(angleDeg);
  return {
    x: Number((cx + r * Math.cos(rad)).toFixed(2)),
    y: Number((cy + r * Math.sin(rad)).toFixed(2)),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function scoreToAngle(score: number): number {
  const clamped = Math.max(METER_MIN_SCORE, Math.min(METER_MAX_SCORE, score));
  const fraction = (clamped - METER_MIN_SCORE) / (METER_MAX_SCORE - METER_MIN_SCORE);
  return START_ANGLE + fraction * ANGLE_SPAN;
}

export function RadialScoreMeter({ score, par = PAR, animated = false }: RadialScoreMeterProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const labelId = useId();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shouldAnimate = animated && !prefersReducedMotion;

  const [animatedScore, setAnimatedScore] = useState(METER_MIN_SCORE);

  useEffect(() => {
    if (!shouldAnimate) return;

    let frameId: number;
    const startTime = performance.now();
    const duration = 1200; // ms
    const initialScore = METER_MIN_SCORE;
    const delta = score - initialScore;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = initialScore + delta * ease;

      setAnimatedScore(val);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setAnimatedScore(score);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [score, shouldAnimate]);

  const currentScore = shouldAnimate ? animatedScore : score;

  const activeZone = useMemo(() => zoneForScore(currentScore), [currentScore]);
  const finalZone = useMemo(() => zoneForScore(score), [score]);
  const activeColor = isDark ? activeZone.color.dark : activeZone.color.light;

  // Background zone segments
  const zoneSegments = useMemo(() => {
    return SCORE_ZONES.map((zone, index) => {
      const rawStart = scoreToAngle(zone.minScore);
      const rawEnd = scoreToAngle(zone.maxScore);
      // Add small visual gap between segments
      const segmentStart = index === 0 ? rawStart : rawStart + GAP_DEG / 2;
      const segmentEnd = index === SCORE_ZONES.length - 1 ? rawEnd : rawEnd - GAP_DEG / 2;
      const path = describeArc(CX, CY, RADIUS, segmentStart, segmentEnd);
      const color = isDark ? zone.color.dark : zone.color.light;
      const isReached = currentScore >= zone.minScore;

      return {
        ...zone,
        path,
        color,
        isReached,
        midAngle: (segmentStart + segmentEnd) / 2,
      };
    });
  }, [isDark, currentScore]);

  // Active fill arc path
  const activeAngle = scoreToAngle(currentScore);
  const activeFillPath = useMemo(() => {
    if (activeAngle <= START_ANGLE + 0.5) return null;
    return describeArc(CX, CY, RADIUS, START_ANGLE, activeAngle);
  }, [activeAngle]);

  // Needle / indicator position
  const indicatorPos = useMemo(() => {
    return polarToCartesian(CX, CY, RADIUS, activeAngle);
  }, [activeAngle]);

  // PAR marker position
  const parAngle = scoreToAngle(par);
  const parInner = useMemo(() => polarToCartesian(CX, CY, RADIUS - 7, parAngle), [parAngle]);
  const parOuter = useMemo(() => polarToCartesian(CX, CY, RADIUS + 7, parAngle), [parAngle]);
  const parLabelPos = useMemo(() => polarToCartesian(CX, CY, RADIUS + 16, parAngle), [parAngle]);

  return (
    <Box
      role="meter"
      aria-labelledby={labelId}
      aria-valuenow={Number(score.toFixed(1))}
      aria-valuemin={METER_MIN_SCORE}
      aria-valuemax={METER_MAX_SCORE}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 240,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box id={labelId} sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Score: {score.toFixed(1)}, Level: {finalZone.label}
      </Box>

      <Box
        component="svg"
        viewBox="0 0 220 135"
        sx={{
          width: '100%',
          height: 'auto',
          overflow: 'visible',
          display: 'block',
        }}
        aria-hidden="true"
      >
        {/* Background track: 6 zone segments */}
        {zoneSegments.map((seg) => (
          <path
            key={seg.id}
            d={seg.path}
            fill="none"
            stroke={seg.color}
            strokeWidth={TRACK_WIDTH}
            strokeLinecap="round"
            opacity={seg.isReached ? (isDark ? 0.35 : 0.3) : (isDark ? 0.15 : 0.12)}
          />
        ))}

        {/* PAR benchmark tick */}
        <line
          x1={parInner.x}
          y1={parInner.y}
          x2={parOuter.x}
          y2={parOuter.y}
          stroke={theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={0.7}
        />
        <text
          x={parLabelPos.x}
          y={parLabelPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7.5"
          fontWeight="700"
          letterSpacing="0.05em"
          fill={theme.palette.text.secondary}
          opacity={0.8}
        >
          PAR
        </text>

        {/* Active fill arc */}
        {activeFillPath !== null && (
          <path
            d={activeFillPath}
            fill="none"
            stroke={activeColor}
            strokeWidth={FILL_WIDTH}
            strokeLinecap="round"
          />
        )}

        {/* Active needle / pip */}
        <circle
          cx={indicatorPos.x}
          cy={indicatorPos.y}
          r={5.5}
          fill={activeColor}
          stroke={isDark ? '#121212' : '#ffffff'}
          strokeWidth="2"
        />
      </Box>

      {/* Central Score Typography positioned right inside the arc */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'text.primary',
            userSelect: 'none',
          }}
        >
          {score.toFixed(1)}
        </Typography>
      </Box>
    </Box>
  );
}
