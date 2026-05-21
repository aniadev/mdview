import { defineConfig, devices } from '@playwright/test';

/**
 * mdview Playwright config
 *
 * Prerequisites:
 *   pnpm dev   →  starts Vite frontend at http://localhost:1420
 *
 * Commands:
 *   pnpm test:e2e           – run all tests (headless)
 *   pnpm test:e2e:headed    – run with visible browser
 *   pnpm test:e2e:ui        – interactive Playwright UI mode
 *   pnpm test:e2e:report    – open last HTML report
 *
 * Note: Tauri invoke() calls will NOT work in Playwright because there is
 * no Tauri runtime. Tests that rely on file-system operations must be
 * skipped or mocked via page.route() / waitForResponse().
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // sequential — one app instance
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Viewport matching typical desktop editor size
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Dev server must be started manually before running tests.
  // Uncomment below to let Playwright auto-spawn (slower cold-start):
  //
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:1420',
  //   reuseExistingServer: true,
  //   timeout: 30_000,
  // },
});
