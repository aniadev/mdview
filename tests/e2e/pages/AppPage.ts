import type { Page, Locator } from '@playwright/test';

/**
 * Page Object: mdview root app shell.
 *
 * Wraps top-level layout selectors so tests don't hardcode class names.
 * Update selectors here if component structure changes.
 */
export class AppPage {
  readonly page: Page;

  // Layout regions
  readonly sidebar: Locator;
  readonly mainArea: Locator;
  readonly tabBar: Locator;
  readonly bottomPanel: Locator;

  // Sidebar activity buttons (icon buttons in .sidebar-activity-row)
  readonly explorerBtn: Locator;
  readonly outlineBtn: Locator;
  readonly searchBtn: Locator;
  readonly terminalBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    this.sidebar    = page.locator('.sidebar');
    this.mainArea   = page.locator('.main-area, [class*="main"]').first();
    this.tabBar     = page.locator('.tab-bar');
    this.bottomPanel = page.locator('.bottom-panel');

    // Activity row buttons by title attribute (i18n-safe)
    this.explorerBtn = page.locator('[title*="Explorer"], [title*="explorer"], .activity-btn').nth(0);
    this.outlineBtn  = page.locator('[title*="Outline"], [title*="outline"], .activity-btn').nth(1);
    this.searchBtn   = page.locator('[title*="Search"], [title*="search"], .activity-btn').nth(2);
    this.terminalBtn = page.locator('[title*="Terminal"], [title*="terminal"], .activity-btn').nth(3);
  }

  async openExplorer() {
    await this.explorerBtn.click();
  }

  async openSearch() {
    await this.searchBtn.click();
  }

  async openOutline() {
    await this.outlineBtn.click();
  }

  async toggleTerminal() {
    await this.terminalBtn.click();
  }

  /** Returns true when the empty-workspace state is shown */
  async isWorkspaceEmpty(): Promise<boolean> {
    return this.page.locator('.sidebar-body, [class*="sidebar"]')
      .getByText(/no folder|open folder|chưa mở|chọn thư mục/i)
      .isVisible()
      .catch(() => false);
  }
}
