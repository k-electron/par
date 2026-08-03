// Deliberately illegal. The UI reaches scoring through app/scoring only, so
// that the search's argmin is never in reach of a component.
import { rankGuesses } from '../../engine/search/policy';

export const leaked = rankGuesses;
