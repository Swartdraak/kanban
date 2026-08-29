import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for the Kanban Task Board.
 *
 * The full E2E suite is authored in Sprint 3. For now we ship a minimal
 * smoke spec (tests/e2e/example.spec.ts) that boots the app and asserts the
 * four columns are visible — enough to prove the test harness is wired up.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        // Keep the default bundled Chromium; browsers install in Sprint 3.
        browserName: 'chromium',
      },
    },
  ],
  // `vite preview` serves the production build; `npm run dev` works too.
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
