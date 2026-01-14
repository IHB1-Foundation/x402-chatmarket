import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for SoulForge web app.
 *
 * Prerequisites:
 * 1. Run infra: `cd infra && docker compose up -d`
 * 2. Run API in mock mode: `X402_MOCK_MODE=true LLM_PROVIDER=mock pnpm --filter api dev`
 * 3. Run web: `pnpm --filter web dev`
 *
 * Then run tests: `pnpm --filter web test:e2e`
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Web server configuration for local testing
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120000,
      },
});
