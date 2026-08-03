// Legal. A negative control: without it, a rule that rejected everything would
// pass the illegal cases and look correct.
import { patternFor } from '../words/pattern';

export const allowed = patternFor;
