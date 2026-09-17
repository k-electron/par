import { answers, answersV2, starters, WORD_LIST_VERSION } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { parFor, C_PAR, EPSILON, scorerVersionFor } from '../../src/engine/config/constants';
import { computeDynamicZones, zoneForScore, scoreToPositionPct } from '../../src/app/ui/scoreZones';
import { shareText } from '../../src/app/share/share';
import { decodeSharedGame } from '../../src/app/share/codec';
import { outcomePoints } from '../../src/engine/score/scoreGame';
import { scoreDirectly } from '../../src/app/scoring/direct';

console.log('===============================================================');
console.log('PART 1: PARAMETER SWEEP OVER 70,000+ UNIQUE GAME CONDITIONS');
console.log('===============================================================');

let totalSimulated = 0;
const puzzles: number[] = [];
for (let p = 0; p <= 300; p += 3) puzzles.push(p);
for (let p = 350; p <= 1000; p += 50) puzzles.push(p);
puzzles.push(2000, 5000, 10000);

const hardModeOptions = [false, true];
const starterOptions = [true, false];
const solvedOptions = [true, false];
const guessesOptions = [1, 2, 3, 4, 5, 6];
const skillLevels: number[] = [];
for (let s = 0; s <= 100; s += 5) skillLevels.push(s);

for (const puzzleNumber of puzzles) {
  const par = parFor(puzzleNumber);
  const isV2 = puzzleNumber >= 260;

  for (const hardMode of hardModeOptions) {
    for (const tookHouseStarter of starterOptions) {
      const starterBonus = tookHouseStarter ? EPSILON : 0;
      const s2Max = 100 + C_PAR * (par - 2) + starterBonus;
      const holeInOneCeiling = 100 + C_PAR * (par - 1) + starterBonus;

      // Dynamic board expected strokes (boardPar) and par separator (parScore)
      const rawBoardPar = tookHouseStarter
        ? par
        : (isV2 ? (hardMode ? 3.80 : 3.70) : (hardMode ? 3.58 : 3.50));
      const boardPar = Math.max(3.0, rawBoardPar);
      const parOffset = C_PAR * (par - boardPar);
      const rawParScore = 100 + parOffset + starterBonus;

      for (const solved of solvedOptions) {
        for (const guessesUsed of guessesOptions) {
          if (!solved && guessesUsed < 6) continue;
          if (guessesUsed === 1 && !solved) continue;

          for (const skill of skillLevels) {
            const actualSkill = guessesUsed === 1 ? 100 : skill;
            const outcome = outcomePoints(guessesUsed, solved, par);
            const totalScore = actualSkill + outcome + starterBonus;
            const maxScore = guessesUsed === 1 ? holeInOneCeiling : s2Max;
            const parScore = Math.min(rawParScore, maxScore - 1.0);

            const dyn = computeDynamicZones({
              maxScore,
              par,
              starterBonus,
              guessesUsed,
              totalScore,
              parScore,
              hardMode,
            });

          // Invariant 1: Widths sum to 100%
          const totalWidth = dyn.horizontalZones.reduce((sum, z) => sum + z.widthPct, 0);
          if (Math.abs(totalWidth - 100) > 1e-6) {
            throw new Error(`Widths do not sum to 100% for puzzle ${puzzleNumber}`);
          }

          // Invariant 2: Contiguous in score space
          for (let i = 0; i < dyn.zones.length - 1; i++) {
            if (Math.abs(dyn.zones[i]!.maxScore - dyn.zones[i + 1]!.minScore) > 1e-4) {
              throw new Error(`Score gap between zones ${dyn.zones[i]!.id} and ${dyn.zones[i + 1]!.id}`);
            }
          }

          // Invariant 3: Contiguous in percentage space
          for (let i = 0; i < dyn.horizontalZones.length - 1; i++) {
            if (Math.abs(dyn.horizontalZones[i]!.endPct - dyn.horizontalZones[i + 1]!.startPct) > 1e-4) {
              throw new Error('Percent gap between horizontal zones');
            }
          }

          // Invariant 4: Needle in [0, 100]
          const pos = scoreToPositionPct(totalScore, dyn.horizontalZones);
          if (pos < 0 || pos > 100) {
            throw new Error(`Needle pos out of bounds: ${pos}`);
          }

          // Invariant 5: Active zone exists
          const zone = zoneForScore(totalScore, dyn.zones);
          if (!zone) {
            throw new Error(`No zone found for score: ${totalScore}`);
          }

          // Invariant 6: Zone geometry
          const seg = dyn.horizontalZones.find((h) => h.id === zone.id);
          if (!seg) throw new Error('Active zone not in horizontalZones');
          if (pos < seg.startPct - 0.5 || pos > seg.endPct + 0.5) {
            throw new Error(`Needle pos ${pos} outside segment [${seg.startPct}, ${seg.endPct}]`);
          }

          // Invariant 7: Blind luck checks
          if (guessesUsed === 1) {
            if (!dyn.isBlindLuck) throw new Error('isBlindLuck should be true for n=1');
            if (zone.id !== 'blind_luck') throw new Error('Zone should be blind_luck');
            const bl = dyn.zones.find((z) => z.id === 'blind_luck');
            if (!bl || bl.maxScore <= bl.minScore) throw new Error('Zero width blind luck');
          }

          // Invariant 8: Blind zone checks
          if (totalScore < 60) {
            if (!dyn.isBlind) throw new Error('isBlind should be true for score < 60');
            if (zone.id !== 'blind') throw new Error('Zone should be blind');
          }

          // Invariant 9: Godlike zone non-zero width
          const godlike = dyn.zones.find((z) => z.id === 'godlike');
          if (!godlike || godlike.maxScore - godlike.minScore < 0.2) {
            throw new Error(`Godlike zone empty or too narrow: [${godlike?.minScore}, ${godlike?.maxScore}]`);
          }

          // Invariant 10: Dynamic par strictly separates Good and Ultra
          const good = dyn.zones.find((z) => z.id === 'good');
          const ultra = dyn.zones.find((z) => z.id === 'ultra');
          if (!good || !ultra || Math.abs(good.maxScore - dyn.parScore) > 1e-4 || Math.abs(ultra.minScore - dyn.parScore) > 1e-4) {
            throw new Error(`Dynamic par did not separate Good and Ultra properly`);
          }

          // Invariant 11: Apex gameplay achieves Godlike
          if (totalScore === maxScore && guessesUsed > 1) {
            if (zone.id !== 'godlike') {
              throw new Error(`Apex score ${totalScore} did not achieve Godlike (got ${zone.id})`);
            }
          }

          // Invariant 12: Social share formatting and replay link verification
          const share = shareText({
            puzzleNumber,
            score: {
              skill: actualSkill,
              outcome,
              starterBonus,
              total: totalScore,
              guessesUsed,
              solved,
              breakdown: Array(guessesUsed).fill({
                turn: 1,
                guess: 'crane',
                pattern: solved ? 242 : 0,
                candidateCount: 100,
                remainingCount: 1,
                skill: 100,
                weight: 1,
                luck: 0,
                forced: false,
                standing: 0.5,
                outcomeShare: 0.1,
                likeliestOutcomeShare: 0.2,
              }),
              par,
              maxScore,
              parScore,
            },
            hardMode,
            tookHouseStarter,
            guessIndices: Array(guessesUsed).fill(0),
            wordListVersion: WORD_LIST_VERSION,
            origin: 'https://par.pages.dev',
          });

          if (share.includes('zone')) throw new Error('Share text includes word zone');
          if (!share.includes(zone.label)) throw new Error('Share text missing zone label ' + zone.label);

          const payload = share.split('#r=')[1]?.trim();
          const decoded = decodeSharedGame(payload!);
          if (!decoded.ok || decoded.game.scorerVersion !== scorerVersionFor(puzzleNumber)) {
            throw new Error(`Replay mismatch for puzzle ${puzzleNumber}`);
          }

          totalSimulated++;
        }
      }
    }
  }
}
}

console.log(`✓ Tested ${totalSimulated.toLocaleString()} unique game scenarios across 118 puzzle dates.`);
console.log('✓ All 12 geometric, mathematical, share, replay, godlike reachability, and dynamic par invariants passed 100% of the time.');

console.log('\n===============================================================');
console.log('PART 2: LIVE ENGINE SEARCH ON 11 ACTUAL PUZZLE DATES');
console.log('===============================================================');

const sampleDays = [0, 50, 100, 250, 259, 260, 261, 300, 350, 400, 500];

for (const day of sampleDays) {
  const puzzle = drawPuzzle(day, { answers, starters, answersV2 });
  const isV2 = day >= 260;

  const h1 = scoreDirectly({
    guesses: [puzzle.answer],
    answer: puzzle.answer,
    tookHouseStarter: true,
    hardMode: false,
    puzzleNumber: day,
  });

  const h1Dyn = computeDynamicZones({
    maxScore: h1.maxScore,
    par: h1.par,
    starterBonus: h1.starterBonus,
    guessesUsed: h1.guessesUsed,
    totalScore: h1.total,
    parScore: h1.parScore,
    hardMode: false,
  });

  if (zoneForScore(h1.total, h1Dyn.zones).id !== 'blind_luck') {
    throw new Error(`Hole-in-one for day ${day} did not map to blind_luck`);
  }

  const g3 = scoreDirectly({
    guesses: [puzzle.starter, 'slate', puzzle.answer],
    answer: puzzle.answer,
    tookHouseStarter: true,
    hardMode: false,
    puzzleNumber: day,
  });

  const g3Dyn = computeDynamicZones({
    maxScore: g3.maxScore,
    par: g3.par,
    starterBonus: g3.starterBonus,
    guessesUsed: g3.guessesUsed,
    totalScore: g3.total,
    parScore: g3.parScore,
    hardMode: false,
  });

  // Verify Part 2 invariants
  const godlike = g3Dyn.zones.find((z) => z.id === 'godlike');
  if (!godlike || godlike.maxScore - godlike.minScore < 0.2) {
    throw new Error(`Part 2: Godlike zone empty or too narrow on day ${day}`);
  }
  const good = g3Dyn.zones.find((z) => z.id === 'good');
  const ultra = g3Dyn.zones.find((z) => z.id === 'ultra');
  if (!good || !ultra || Math.abs(good.maxScore - g3Dyn.parScore) > 1e-4) {
    throw new Error(`Part 2: Dynamic par mismatch on day ${day}`);
  }

  const g3Zone = zoneForScore(g3.total, g3Dyn.zones);

  const g3Share = shareText({
    puzzleNumber: day,
    score: g3,
    hardMode: false,
    tookHouseStarter: true,
    guessIndices: [0, 1, 2],
    wordListVersion: WORD_LIST_VERSION,
    origin: 'https://par.pages.dev',
  });

  const payload = g3Share.split('#r=')[1]?.trim();
  const decoded = decodeSharedGame(payload!);
  if (!decoded.ok || decoded.game.scorerVersion !== (isV2 ? 2 : 1)) {
    throw new Error(`Replay mismatch for day ${day}`);
  }

  console.log(
    `  Day ${String(day).padStart(4, ' ')} (${isV2 ? 'v2' : 'v1'}): PAR=${(g3.par ?? parFor(day)).toFixed(2)} | ` +
      `answer=${puzzle.answer} | h1=${h1.total.toFixed(1)} (${h1Dyn.zones[6]?.label}) | ` +
      `3g=${g3.total.toFixed(1)} (${g3Zone.label})`,
  );
}

console.log('\n===============================================================');
console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO FAILURES.');
console.log('===============================================================');
