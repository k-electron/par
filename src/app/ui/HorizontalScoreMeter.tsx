import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useId, useMemo, useState } from 'react';

import { PAR } from '../../engine/config/constants';
import {
  computeDynamicZones,
  scoreToPositionPct,
  zoneForScore,
} from './scoreZones';

export interface HorizontalScoreMeterProps {
  readonly score: number;
  readonly par?: number | undefined;
  readonly animated?: boolean | undefined;
  readonly maxScore?: number | undefined;
  readonly starterBonus?: number | undefined;
  readonly guessesUsed?: number | undefined;
}

const visuallyHiddenStyle = {
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

export function HorizontalScoreMeter({
  score,
  par = PAR,
  animated = false,
  maxScore,
  starterBonus,
  guessesUsed,
}: HorizontalScoreMeterProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const labelId = useId();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shouldAnimate = animated && !prefersReducedMotion;

  const dynamic = useMemo(
    () =>
      computeDynamicZones({
        maxScore,
        par,
        starterBonus,
        guessesUsed,
        totalScore: score,
      }),
    [maxScore, par, starterBonus, guessesUsed, score],
  );

  const [animatedScore, setAnimatedScore] = useState(dynamic.meterMinScore);

  useEffect(() => {
    if (!shouldAnimate) return;

    let frameId: number;
    const startTime = performance.now();
    const duration = 1200; // ms
    const initialScore = dynamic.meterMinScore;
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
  }, [score, shouldAnimate, dynamic.meterMinScore]);

  const currentScore = shouldAnimate ? animatedScore : score;
  const activeZone = useMemo(
    () => zoneForScore(currentScore, dynamic.zones),
    [currentScore, dynamic.zones],
  );
  const finalZone = useMemo(
    () => zoneForScore(score, dynamic.zones),
    [score, dynamic.zones],
  );
  const activeColor = isDark ? activeZone.color.dark : activeZone.color.light;

  const currentPct = useMemo(
    () =>
      scoreToPositionPct(
        currentScore,
        dynamic.horizontalZones,
        dynamic.meterMinScore,
        dynamic.meterMaxScore,
      ),
    [currentScore, dynamic.horizontalZones, dynamic.meterMinScore, dynamic.meterMaxScore],
  );
  const parPct = useMemo(
    () =>
      scoreToPositionPct(
        dynamic.parScore,
        dynamic.horizontalZones,
        dynamic.meterMinScore,
        dynamic.meterMaxScore,
      ),
    [dynamic.parScore, dynamic.horizontalZones, dynamic.meterMinScore, dynamic.meterMaxScore],
  );

  return (
    <Box
      role="meter"
      aria-labelledby={labelId}
      aria-valuenow={Number(score.toFixed(1))}
      aria-valuemin={dynamic.meterMinScore}
      aria-valuemax={Number(dynamic.meterMaxScore.toFixed(1))}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 440,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      <Box id={labelId} sx={visuallyHiddenStyle}>
        Score: {score.toFixed(1)}, Level: {finalZone.label}
      </Box>

      {/* Score Number */}
      <Typography
        variant="h3"
        sx={{
          fontWeight: 800,
          fontFamily: 'Space Grotesk, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: 'text.primary',
          textShadow: isDark
            ? '0 0 20px rgba(0, 240, 255, 0.4), 0 0 40px rgba(0, 240, 255, 0.15)'
            : undefined,
          mb: 1.25,
        }}
      >
        {score.toFixed(1)}
      </Typography>

      {/* 3. Multi-Segment Bar Meter Section */}
      <Box sx={{ width: '100%', px: 0.5 }}>
        {/* Zone Names Row */}
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            mb: 0.5,
            gap: '2px',
            alignItems: 'flex-end',
            minHeight: 28,
          }}
        >
          {dynamic.horizontalZones.map((zone) => {
            const isCurrent = zone.id === activeZone.id;
            const zoneColor = isDark ? zone.color.dark : zone.color.light;
            return (
              <Box
                key={zone.id}
                sx={{
                  width: `${zone.widthPct}%`,
                  textAlign: 'center',
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: '0.70rem',
                    fontWeight: isCurrent ? 800 : 500,
                    color: isCurrent ? zoneColor : 'text.secondary',
                    textShadow:
                      isCurrent && isDark
                        ? `0 0 8px ${zoneColor}, 0 0 16px ${zoneColor}80`
                        : undefined,
                    opacity: isCurrent ? 1 : 0.65,
                    lineHeight: 1.15,
                    whiteSpace: 'normal',
                    letterSpacing: isCurrent ? '0.02em' : '-0.01em',
                    transition: 'color 0.2s ease, text-shadow 0.2s ease',
                  }}
                >
                  {zone.id === 'blind_luck' ? (
                    <>
                      Blind
                      <br />
                      luck
                    </>
                  ) : (
                    zone.label
                  )}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* The Track & Segments */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 16,
            borderRadius: 2,
            p: '2px',
            backgroundColor: isDark ? 'rgba(8, 12, 22, 0.85)' : 'rgba(240, 244, 248, 0.85)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(0, 240, 255, 0.28)' : 'rgba(0, 0, 0, 0.12)',
            boxShadow: isDark
              ? '0 0 14px rgba(0, 240, 255, 0.15), inset 0 0 10px rgba(0, 0, 0, 0.7)'
              : 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'visible',
          }}
        >
          {/* Background & Filled Segments */}
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: '100%',
              borderRadius: 1.5,
              overflow: 'hidden',
              gap: '2px',
              position: 'relative',
            }}
          >
            {/* Subtle segmented LED scanlines */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0, 0, 0, 0.25) 3px, rgba(0, 0, 0, 0.25) 4px)',
                pointerEvents: 'none',
                zIndex: 1,
                opacity: isDark ? 0.6 : 0.2,
              }}
            />

            {dynamic.horizontalZones.map((zone, idx) => {
              const zoneColor = isDark ? zone.color.dark : zone.color.light;
              let fillPct = 0;
              if (currentScore >= zone.maxScore) {
                fillPct = 100;
              } else if (currentScore > zone.minScore) {
                fillPct = ((currentScore - zone.minScore) / (zone.maxScore - zone.minScore)) * 100;
              }

              return (
                <Box
                  key={zone.id}
                  sx={{
                    width: `${zone.widthPct}%`,
                    height: '100%',
                    position: 'relative',
                    backgroundColor: isDark ? `${zoneColor}22` : `${zoneColor}18`,
                    borderTopLeftRadius: idx === 0 ? 4 : 1.5,
                    borderBottomLeftRadius: idx === 0 ? 4 : 1.5,
                    borderTopRightRadius: idx === dynamic.horizontalZones.length - 1 ? 4 : 1.5,
                    borderBottomRightRadius: idx === dynamic.horizontalZones.length - 1 ? 4 : 1.5,
                    overflow: 'hidden',
                  }}
                >
                  {fillPct > 0 && (
                    <Box
                      sx={{
                        width: `${fillPct}%`,
                        height: '100%',
                        background: isDark
                          ? `linear-gradient(90deg, ${zoneColor}b3, ${zoneColor})`
                          : zoneColor,
                        boxShadow: fillPct > 0 && isDark ? `0 0 10px ${zoneColor}99` : undefined,
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Benchmark PAR Notch */}
          <Box
            title={`PAR: ${dynamic.parScore.toFixed(0)} pts`}
            sx={{
              position: 'absolute',
              top: -4,
              bottom: -4,
              left: `${parPct}%`,
              width: '2px',
              backgroundColor: isDark ? '#00F0FF' : '#0f172a',
              boxShadow: isDark
                ? '0 0 8px #00F0FF, 0 0 16px rgba(0, 240, 255, 0.6)'
                : '0 0 4px rgba(0,0,0,0.4)',
              transform: 'translateX(-50%)',
              zIndex: 2,
              pointerEvents: 'none',
              borderRadius: 1,
            }}
          />

          {/* Active Score Indicator Laser Needle & Optical Reticle */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: `${currentPct}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 3,
              pointerEvents: 'none',
              transition: shouldAnimate ? 'none' : 'left 0.2s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 24,
            }}
          >
            {/* Laser Needle Line */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: activeColor,
                boxShadow: isDark
                  ? `0 0 6px ${activeColor}, 0 0 12px ${activeColor}80`
                  : `0 0 4px ${activeColor}80`,
                borderRadius: 1,
              }}
            />
            {/* Glowing Optics Reticle Core */}
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: activeColor,
                border: isDark ? '2px solid #05070E' : '2px solid #ffffff',
                boxShadow: isDark
                  ? `0 0 0 2px ${activeColor}40, 0 0 10px ${activeColor}, 0 0 18px ${activeColor}99`
                  : `0 0 0 2px ${activeColor}30, 0 2px 6px rgba(0,0,0,0.3)`,
                transition: shouldAnimate ? 'none' : 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&::after': {
                  content: '""',
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                },
              }}
            />
          </Box>
        </Box>

        {/* Breakpoints Ticks Row */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 30,
            mt: 0.5,
          }}
        >
          {dynamic.breakpointMarkers.map((bp, idx) => {
            // Align left at 0%, right at 100%, center otherwise
            const transform =
              bp.pct === 0
                ? 'translateX(0)'
                : bp.pct === 100
                  ? 'translateX(-100%)'
                  : 'translateX(-50%)';

            return (
              <Box
                key={`${bp.score}-${idx}`}
                sx={{
                  position: 'absolute',
                  left: `${bp.pct}%`,
                  transform,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems:
                    bp.pct === 0
                      ? 'flex-start'
                      : bp.pct === 100
                        ? 'flex-end'
                        : 'center',
                }}
              >
                <Box
                  sx={{
                    width: 1,
                    height: 4,
                    backgroundColor: isDark
                      ? 'rgba(0, 240, 255, 0.4)'
                      : theme.palette.text.disabled,
                    opacity: 0.8,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    opacity: 0.85,
                    lineHeight: 1.2,
                  }}
                >
                  {bp.score}
                </Typography>
              </Box>
            );
          })}

          {/* PAR Marker Label below */}
          <Box
            sx={{
              position: 'absolute',
              left: `${parPct}%`,
              top: 15,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: isDark ? '#00F0FF' : 'text.primary',
                textShadow: isDark ? '0 0 8px rgba(0, 240, 255, 0.6)' : undefined,
                lineHeight: 1,
              }}
            >
              ▲ PAR
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
