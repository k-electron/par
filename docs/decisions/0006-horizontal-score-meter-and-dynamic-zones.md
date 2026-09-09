# 0006 — Horizontal Score Meter and Dynamic Zones

Status: accepted. PRs [#28](https://github.com/k-electron/par/pull/28), [#29](https://github.com/k-electron/par/pull/29), [#30](https://github.com/k-electron/par/pull/30), [#31](https://github.com/k-electron/par/pull/31), and [#32](https://github.com/k-electron/par/pull/32).

## Context

When Par launched, the results screen reported the numeric score directly alongside the skill, outcome, and house starter bonus breakdown. To provide players with immediate qualitative feedback on how their performance compared to par, PR #28 introduced a circular "radial" speedometer gauge. 

While visually striking, user testing revealed several ergonomics and layout issues with a circular gauge on mobile devices:
1. Circular gauges consume excessive vertical screen real estate, forcing the guess-by-guess explainer below the fold.
2. Speedometer arcs make comparing thresholds (Troll, Bad, Meh, Good, Ultra, Godlike) less intuitive than a linear scale.
3. Fixed static score bounds (such as 60 to 115) created unfair or distorted scales across different configurations:
   - Players who chose their own opener forfeited the 3-point starter bonus ($\epsilon = 3$), making the rightmost zone harder to reach.
   - The theoretical maximum score varied across eras and daily word difficulty due to differences in `PAR`.
   - A hole-in-one on guess 1 ($n = 1$) is an act of pure random opener luck rather than tested skill, yet mathematically yielded a score far higher than a player who played two flawless guesses. If the scale ceiling included $n = 1$, Godlike became mathematically unattainable for any player engaging in strategic deduction.
   - Unsolved rounds with weak skill ($< 60.0$) caused the needle to overflow off the left edge of the scale.

## Decision

1. **Replace the radial gauge with a compact horizontal multi-segment meter**:
   - Implemented in [`src/app/ui/HorizontalScoreMeter.tsx`](../../src/app/ui/HorizontalScoreMeter.tsx) and [`src/app/ui/scoreZones.ts`](../../src/app/ui/scoreZones.ts).
   - Conserves vertical viewport height, keeping the score, stroke phrase, and celebratory badges above the fold on mobile screens.

2. **Compute dynamic per-day per-mode curve fitting**:
   - Rather than static global cutoffs, [`computeDynamicZones`](../../src/app/ui/scoreZones.ts) dynamically computes the strategic maximum $S_{\text{max}}$ for the player's specific game:
     $$S_{\text{max}} = 100 + C_{\text{PAR}} \times (\text{PAR} - 2) + (\text{took house starter} ? \epsilon : 0)$$
   - This anchors the upper bound of Godlike to the best possible result achievable through deliberate skill ($n = 2$, 100% skill).
   - Below PAR, thresholds interpolate linearly between 60.0 and PAR.
   - Above PAR, Ultra spans 60% of $(S_{\text{max}} - \text{PAR})$, with Godlike occupying the remainder up to $S_{\text{max}}$.

3. **Isolate edge cases into secret dynamic zones**:
   - **`blind_luck`**: If a player scores a hole-in-one ($n = 1$), a 7th golden zone ("Blind luck", rendered across 2 lines) is dynamically appended beyond $S_{\text{max}}$. It remains hidden for all normal multi-guess play.
   - **`blind`**: If an unsolved round drops below 60.0, a charcoal zone ("Blind") dynamically prepends to the left down to $S_{\text{floor}} = \min(0, \lfloor \text{score} / 10 \rfloor \times 10)$. It remains hidden during standard play ($\ge 60.0$).

4. **Concise social sharing**:
   - Shared clipboard text includes the round's dynamic zone label (e.g. `Par 42 4/6 — 100.4 · Good`), omitting redundant words like "zone".
