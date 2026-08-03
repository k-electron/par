import Box from '@mui/material/Box';
import { useMemo } from 'react';

import { answers, guesses, starters } from '../../data';
import { puzzleNumberAt } from '../../engine/daily/calendar';
import { drawPuzzle } from '../../engine/daily/puzzle';
import { GameScreen } from './GameScreen';

/**
 * This increment plays today's answer with the player's own opener under
 * normal-mode rules. The settings gate that offers the house starter and hard
 * mode — and locks both for the day — is increment 7, so the drawn starter is
 * deliberately unused here rather than shown.
 */
export function App() {
  const puzzle = useMemo(
    () => drawPuzzle(puzzleNumberAt(new Date()), { answers, starters }),
    [],
  );

  const rules = useMemo(() => {
    const dictionary = new Set(guesses);
    return { isAllowedWord: (word: string) => dictionary.has(word) };
  }, []);

  return (
    <Box component="main">
      <GameScreen answer={puzzle.answer} puzzleNumber={puzzle.puzzleNumber} rules={rules} />
    </Box>
  );
}
