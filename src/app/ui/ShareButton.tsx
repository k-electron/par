import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useCallback, useMemo, useState } from 'react';

import { WORD_LIST_VERSION, guesses as dictionary } from '../../data';
import { SHARE, type ShareVariant } from '../copy/results';
import { shareText } from '../share/share';
import type { GameScore } from '../scoring/protocol';
import type { ConfirmedSettings } from '../storage/repository';

export interface ShareButtonProps {
  readonly puzzleNumber: number;
  readonly score: GameScore;
  readonly settings: ConfirmedSettings;
  readonly guesses: readonly string[];
  /**
   * Whose round this is. Only the wording changes — the text produced is
   * identical either way, which is what makes forwarding lossless.
   */
  readonly variant?: ShareVariant;
}

export function ShareButton({
  puzzleNumber,
  score,
  settings,
  guesses,
  variant = 'own',
}: ShareButtonProps) {
  const words = SHARE[variant];
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const text = useMemo(() => {
    const indices = guesses.map((word) => dictionary.indexOf(word));
    if (indices.some((index) => index < 0)) return null;

    try {
      return shareText({
        puzzleNumber,
        score,
        hardMode: settings.hardMode,
        tookHouseStarter: settings.useHouseStarter,
        guessIndices: indices,
        wordListVersion: WORD_LIST_VERSION,
        origin: typeof location === 'undefined' ? '' : location.origin + location.pathname,
      });
    } catch {
      // Encoding rejects a puzzle number outside its range, which a clock set
      // before the epoch produces. There is no error boundary above this, so an
      // exception here would blank the page at the moment a game ends — losing
      // the player their whole round to hide a button. Drop the button instead.
      return null;
    }
  }, [puzzleNumber, score, settings, guesses]);

  const share = useCallback(async () => {
    if (text === null) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        return;
      }
    } catch {
      // Clipboard access can be refused outright. Fall through to showing the
      // text so sharing is never simply impossible.
    }
    setFallback(text);
  }, [text]);

  if (text === null) return null;

  return (
    <Stack spacing={1}>
      <Button variant="contained" onClick={() => void share()}>
        {words.action}
      </Button>

      {fallback !== null && (
        <TextField
          label="Copy this"
          multiline
          minRows={6}
          value={fallback}
          slotProps={{ htmlInput: { readOnly: true, 'aria-label': 'Shareable result' } }}
        />
      )}

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message={words.copied}
      />
    </Stack>
  );
}
