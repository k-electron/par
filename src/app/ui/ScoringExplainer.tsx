import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * The honest, short account of why the number is what it is.
 *
 * Two constraints shape this. It has to leave someone who has never heard of
 * information theory understanding why a probe can beat a guess — and it must
 * never reveal best play. The worked example below is invented for teaching:
 * the position it describes cannot be a real Par position, because Par draws
 * one answer a day and this asks you to imagine three at once. It also never
 * appears on screen beside a live game.
 */
export function ScoringExplainer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>How this is scored</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">
            Ordinary word games score how few guesses you took, which is mostly a question of
            whether your opener happened to land near the answer. Par scores what each guess was
            worth <em>before</em> the tiles turned over, and then pays out the luck separately.
          </Typography>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Why a word that cannot win can be the best play</Typography>
            <Typography variant="body2">
              Suppose you have it narrowed to three possibilities that differ only in their first
              letter &mdash; something like BATCH, CATCH and HATCH. Guess one of them and you have a
              one-in-three shot; miss, and you still have two left and have burned a turn. Now
              imagine a word that contains B, C and H somewhere else entirely. It cannot possibly be
              the answer, so it can never win on the spot &mdash; but whatever comes back, it tells
              you which of the three is right, and you finish on the very next turn.
            </Typography>
            <Typography variant="body2">
              Counting it out: the gamble finishes in two guesses a third of the time and three
              guesses the rest, so about 2.7 on average. The word that cannot win finishes in
              exactly two, every time. It is the better play, and Par says so.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Skill</Typography>
            <Typography variant="body2">
              Every guess from your second onward is compared against the best that was available
              in that exact position, and turned into a percentage. Because it only ever looks at
              what was knowable beforehand, getting lucky cannot raise it and getting unlucky
              cannot lower it. A guess made when three hundred words were still alive counts for
              much more than one made when only two were.
            </Typography>
            <Typography variant="body2">
              Your opening guess is never scored. Whatever you open with, good or wild, expresses
              itself through the position it leaves you &mdash; and that is priced by par instead.
              It is why a lucky opener is a legitimate win here rather than a loophole.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Par</Typography>
            <Typography variant="body2">
              Par is what a strong player averages, not what a typical player averages, so being
              over it is the normal state of affairs rather than a telling-off. Every guess under
              par is worth the same number of points as every other, which is deliberate: it means
              a gamble can win you a day but never a season. Finishing fast earns a badge, never
              extra points.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Luck</Typography>
            <Typography variant="body2">
              The luck column says how the feedback broke compared with what your guess could
              reasonably expect. Positive means the tiles were kind. It is there to talk about and
              counts for nothing.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">The house starter</Typography>
            <Typography variant="body2">
              Everyone who takes it plays the same opener, chosen before you could see it, and
              earns a small bonus for taking that bet blind. That is the whole reason your choice
              locks for the day: a bet you could withdraw after peeking would not be one.
            </Typography>
          </Stack>

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Par will never show you the word you should have played. Knowing it would not make you
            better at reading a position, and memorising it is the opposite of the point.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
