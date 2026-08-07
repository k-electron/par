import Link from '@mui/material/Link';

import { DEFINITION, definitionSearch, type RoundVariant } from '../copy/results';

export interface DefinitionLinkProps {
  /** The day's answer. Only shown once the round is over on either surface. */
  readonly word: string;
  readonly variant?: RoundVariant;
}

/**
 * An offer to go and find out what the word actually meant.
 *
 * Half the pleasure of a hard answer is discovering it was a real word after
 * all, and the game has nothing to say about meaning — so this hands the player
 * off rather than pretending to be a dictionary.
 *
 * One component for both surfaces so the destination is built once. The label
 * does not name the word; the address necessarily does, which is why this only
 * ever renders on a finished round, behind the spoiler gate on a replay.
 */
export function DefinitionLink({ word, variant = 'own' }: DefinitionLinkProps) {
  return (
    <Link
      href={definitionSearch(word)}
      // Opens away from the game, so the board is still there on the way back.
      // `noopener` keeps the new tab from reaching back through `window.opener`.
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{ fontSize: '0.8125rem', textAlign: 'center', py: 0.5 }}
    >
      {DEFINITION[variant]}
    </Link>
  );
}
