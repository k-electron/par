// Deliberately illegal. Linted as if it sat in src/engine/ by
// tests/boundaries.test.ts, and ignored by every ordinary lint run.
import { theme } from '../../app/theme/theme';

export const leaked = theme;
