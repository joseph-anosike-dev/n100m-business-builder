import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so the production build config is untouched.
// The environment is plain Node: the code under test so far is pure logic and
// needs no DOM. Switch a single file to a DOM with a `// @vitest-environment`
// comment if a future test needs one (that would also need `jsdom` installed).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
