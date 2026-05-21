import type { Page, Locator } from '@playwright/test';

/**
 * Page Object: Preview pane (markdown rendered output).
 */
export class PreviewPage {
  readonly page: Page;
  readonly container: Locator;
  readonly markdownBody: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container  = page.locator('.preview-pane');
    this.markdownBody = page.locator('.markdown-body');
  }

  /** Get all rendered list items (ul + ol) */
  listItems(): Locator {
    return this.markdownBody.locator('li');
  }

  /** Get all rendered checkboxes (task list) */
  checkboxes(): Locator {
    return this.markdownBody.locator('input[type="checkbox"]');
  }

  /** Get rendered paragraph elements */
  paragraphs(): Locator {
    return this.markdownBody.locator('p');
  }

  /** Get all <br> tags (soft newlines when breaks:true) */
  lineBreaks(): Locator {
    return this.markdownBody.locator('br');
  }

  /** Get bullet list (ul) */
  unorderedLists(): Locator {
    return this.markdownBody.locator('ul');
  }

  /** Get ordered list (ol) */
  orderedLists(): Locator {
    return this.markdownBody.locator('ol');
  }

  /** Wait until markdown body has some rendered content */
  async waitForContent() {
    await this.markdownBody.waitFor({ state: 'visible', timeout: 5000 });
  }
}
