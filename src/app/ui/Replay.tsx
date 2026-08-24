import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';

import { guesses as dictionary, answers, starters, WORD_LIST_VERSION } from '../../data';
import { MAX_GUESSES, SCORER_VERSION } from '../../engine/config/constants';
import { OUTCOME, RESULTS } from '../copy/results';
import { drawPuzzle } from '../../engine/daily/puzzle';
import { rulesetFor } from '../../engine/rules/ruleset';
import { boardRows, replaySession } from '../state/gameSession';
import type { ScoringClient } from '../scoring/client';
import type { GameScore } from '../scoring/protocol';
import type { Repository } from '../storage/repository';
import { decodeSharedGame, type SharedGame } from '../share/codec';
import { Board } from './Board';
import { DefinitionLink } from './DefinitionLink';
import { Results } from './Results';
import { ScoringExplainer } from './ScoringExplainer';
import { ShareButton } from './ShareButton';

export interface ReplayProps {
  /** The fragment payload, without the `r=` prefix. */
  readonly payload: string;
  readonly store: Repository;
  readonly scoring: ScoringClient | undefined;
  readonly onDismiss: () => void;
}

type Stage = 'gated' | 'revealed';

export function Replay({ payload, store, scoring, onDismiss }: ReplayProps) {
  const decoded = useMemo(() => decodeSharedGame(payload), [payload]);

  /**
   * Whether the recipient has already finished that day themselves. If not they
   * get warned first — a link shared in a group thread should not spoil someone
   * who had not played yet.
   */
  const alreadyPlayed = useMemo(() => {
    if (!decoded.ok) return false;
    const record = store.loadDay(decoded.game.puzzleNumber);
    return record !== null && record.status !== 'playing';
  }, [decoded, store]);

  const [stage, setStage] = useState<Stage>(alreadyPlayed ? 'revealed' : 'gated');

  if (!decoded.ok) {
    return (
      <Stack spacing={2} sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="warning">
          {decoded.failure.kind === 'unsupported-version'
            ? 'This link was made by a newer version of Par than this one. Ask for a fresh link, or reload the page.'
            : 'This link is damaged or incomplete, so there is nothing to show. Chat apps sometimes cut long links short.'}
        </Alert>
        <Button variant="contained" onClick={onDismiss}>
          Play today&rsquo;s puzzle
        </Button>
      </Stack>
    );
  }

  const game = decoded.game;

  if (stage === 'gated') {
    return (
      <Stack spacing={2} sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Typography variant="h6">Hold on — this will spoil puzzle {game.puzzleNumber}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Somebody has shared their full game, every guess and the answer. You have not finished
          that one yet.
        </Typography>
        <Button variant="contained" onClick={onDismiss}>
          Let me play it first
        </Button>
        {/* A confirmation, not a wall: whoever chooses to look gets straight in. */}
        <Button variant="text" onClick={() => setStage('revealed')}>
          Show me anyway
        </Button>
      </Stack>
    );
  }

  return <RevealedReplay game={game} scoring={scoring} onDismiss={onDismiss} />;
}

function RevealedReplay({
  game,
  scoring,
  onDismiss,
}: {
  readonly game: SharedGame;
  readonly scoring: ScoringClient | undefined;
  readonly onDismiss: () => void;
}) {
  const [explaining, setExplaining] = useState(false);
  const [score, setScore] = useState<GameScore | null>(null);

  const rebuilt = useMemo(() => {
    const words = game.guessIndices.map((index) => dictionary[index]);
    if (words.some((word) => word === undefined)) return null;

    const puzzle = drawPuzzle(game.puzzleNumber, { answers, starters });
    const session = replaySession(
      puzzle.answer,
      rulesetFor(game.hardMode ? 'hard' : 'normal'),
      words as string[],
    );
    return { puzzle, session, words: words as string[] };
  }, [game]);

  useEffect(() => {
    if (rebuilt === null || scoring === undefined) return;
    let current = true;

    // Recomputed from scratch rather than carried in the link. That is the whole
    // point: if the number did not come out the same on the recipient's machine,
    // comparing scores would mean nothing.
    void scoring
      .score({
        guesses: rebuilt.words,
        answer: rebuilt.puzzle.answer,
        tookHouseStarter: game.tookHouseStarter,
        hardMode: game.hardMode,
      })
      .then((result) => {
        if (current) setScore(result);
      })
      .catch(() => {
        if (current) setScore(null);
      });

    return () => {
      current = false;
    };
  }, [rebuilt, scoring, game.tookHouseStarter, game.hardMode]);

  if (rebuilt === null) {
    return (
      <Stack spacing={2} sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="warning">
          This link points at words this version does not have, so its board cannot be rebuilt.
        </Alert>
        <Button variant="contained" onClick={onDismiss}>
          Play today&rsquo;s puzzle
        </Button>
      </Stack>
    );
  }

  // Spec §5: on either mismatch, show the replay with a clear notice rather
  // than silently displaying a different number. The word lists change which
  // words a day draws; the scorer changes what a given game is worth. Both can
  // move the total, so both are stamped and both are checked.
  const staleLists =
    game.wordListVersion !== WORD_LIST_VERSION.slice(0, game.wordListVersion.length);
  const staleScorer = game.scorerVersion !== SCORER_VERSION;

  const settings = {
    hardMode: game.hardMode,
    useHouseStarter: game.tookHouseStarter,
    confirmed: true,
  } as const;

  return (
    <Stack spacing={1.5} sx={{ p: 1.5, maxWidth: 520, mx: 'auto', width: '100%' }}>
      <Stack spacing={0.25} sx={{ textAlign: 'center' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Somebody&rsquo;s round
        </Typography>
        <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
          Puzzle {game.puzzleNumber}
        </Typography>
      </Stack>

      {(staleLists || staleScorer) && (
        <Alert severity="info" variant="outlined">
          {staleLists
            ? 'This was played against a different word list than yours, so the score below may not be the number they saw. Everything else is theirs.'
            : 'This was scored by a different version of Par, so the score below may not be the number they saw. The board and the guesses are theirs.'}
        </Alert>
      )}

      <Board rows={boardRows(rebuilt.session)} activeRow={-1} rejectionNonce={0} />

      {/*
        The outcome, which this screen used to leave out entirely. A round the
        sender lost showed six wrong guesses and never said what the word was,
        so the one board where the answer is not already on it was the one board
        that withheld it. Whoever is reading has come through the spoiler gate;
        they should see what the player saw.
      */}
      {rebuilt.session.status === 'lost' && (
        <Alert severity="info" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
          {OUTCOME.replay.lost(rebuilt.puzzle.answer)}
        </Alert>
      )}
      {rebuilt.session.status === 'won' && scoring === undefined && (
        <Alert severity="success" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
          {OUTCOME.replay.solved(rebuilt.words.length, MAX_GUESSES)}
        </Alert>
      )}

      <Results variant="replay" score={score} settings={settings} />

      {/*
        Forwarding a round you were sent. Re-encoded from the same guesses and
        flags, so the text and the link come out identical to the sender's —
        it is the same round, not a copy of it.

        Withheld on a version mismatch. Re-encoding stamps *this* build's word
        list and scorer, which would hand the next reader a link that looks
        current while carrying a board the notice above says cannot be trusted.
        Spec §5 wants that mismatch flagged, and forwarding it would launder it
        away.
      */}
      {score !== null && !staleLists && !staleScorer && (
        <ShareButton
          variant="replay"
          puzzleNumber={game.puzzleNumber}
          score={score}
          settings={settings}
          guesses={rebuilt.words}
        />
      )}

      <DefinitionLink word={rebuilt.puzzle.answer} variant="replay" />

      <Button size="small" variant="text" onClick={() => setExplaining(true)}>
        {RESULTS.explainerLink}
      </Button>
      {/*
        The sender's round, recomputed here, is what gets walked through. A link
        minted before this existed carries the same guesses and so explains
        itself the same way; one this build cannot score yet shows the general
        account and no walkthrough.
      */}
      <ScoringExplainer open={explaining} onClose={() => setExplaining(false)} score={score} />

      <Button variant="contained" onClick={onDismiss}>
        Play today&rsquo;s puzzle
      </Button>
    </Stack>
  );
}
