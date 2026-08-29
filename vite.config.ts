import { defineConfig } from 'vite';

// Vite config for the Kanban Task Board
// - Dev server: http://localhost:5173
// - Build output: dist/
// - Unit tests (Vitest) are picked up automatically from tests/unit/**/*.test.ts
export default defineConfig({
  root: '.',
  // Playwright webServer assumes `vite preview` serves from `dist/`.
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    // Keep source maps off for a clean production bundle
    sourcemap: false,
  },
  test: {
    // Vitest config lives here so `vitest` is wired up next to Vite.
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
