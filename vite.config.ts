/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// base './' keeps all asset paths relative — required for uploading builds
// to portals like Poki/CrazyGames, which serve games from arbitrary subpaths.
export default defineConfig({
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
