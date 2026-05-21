import { test as base, expect, Page } from '@playwright/test';

/**
 * Custom fixture: waits for the mdview app shell to be fully mounted.
 *
 * The app is ready when #app has at least one visible child element
 * (the layout shell is rendered by Vue).
 *
 * Tauri-specific: because there is no Tauri runtime, invoke() calls will
 * reject. We intercept the console to avoid noise, not to suppress errors.
 */

export type AppFixtures = {
  /** Page already navigated to the app root and waited for hydration */
  appPage: Page;
};

export const test = base.extend<AppFixtures>({
  appPage: async ({ page }, use) => {
    // Silence expected Tauri invoke errors in non-Tauri context
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('invoke')) return;
    });

    await page.goto('/');

    // Wait until Vue has mounted the app shell
    await page.waitForSelector('#app > *', { state: 'attached', timeout: 10_000 });

    // Small settle: let reactive stores initialize
    await page.waitForTimeout(300);

    await use(page);
  },
});

export { expect };
