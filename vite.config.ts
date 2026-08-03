import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Boundary fixtures are deliberately illegal source. They are never
    // executed; tests/boundaries.test.ts lints them as text instead.
    exclude: ['tests/fixtures/**'],
  },
});
