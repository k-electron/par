// Deliberately illegal. The engine receives word lists through the injected
// Lexicon port, never by importing src/data directly.
import { GUESS_LIST } from '../../data/guesses';

export const leaked = GUESS_LIST;
