// Deliberately illegal. A re-export is the same dependency as an import, and
// is the quieter way a boundary erodes, so it gets its own case.
export { theme } from '../../app/theme/theme';
