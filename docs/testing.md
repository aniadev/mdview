# Playwright Testing — mdview

Quy trình test tự động cho mdview UI sử dụng Playwright 1.60.

---

## Cấu trúc thư mục

```
playwright.config.ts              # Playwright config → http://localhost:1420
tests/
├── e2e/
│   ├── fixtures/
│   │   └── app.ts               # Custom fixture: navigate + wait for mount
│   ├── pages/
│   │   ├── AppPage.ts           # POM: layout shell, sidebar, activity row
│   │   └── PreviewPage.ts       # POM: markdown-body, checkboxes, lists
│   ├── app-shell.spec.ts        # Smoke tests: layout, sidebar navigation
│   ├── preview.spec.ts          # Tests: markdown rendering (S-BF1, S-BF2)
│   └── settings.spec.ts         # Tests: settings modal open/close
└── fixtures/
    └── sample.md                # Markdown fixture: lists, checkboxes, newlines
.vscode/
└── mcp.json                     # Playwright MCP server config
```

---

## Chạy tests

### Yêu cầu: dev server phải đang chạy

```bash
pnpm dev        # Terminal 1 — khởi động Vite tại http://localhost:1420
```

### Các lệnh test

```bash
# Terminal 2 — chạy tests
pnpm test:e2e            # Headless (CI mode)
pnpm test:e2e:headed     # Có browser hiện ra
pnpm test:e2e:ui         # Playwright UI mode (tương tác, debug)
pnpm test:e2e:report     # Mở HTML report sau khi chạy
```

---

## Playwright MCP (AI Agent Testing)

Playwright MCP cho phép AI agent kiểm tra UI bằng ngôn ngữ tự nhiên.

### Kích hoạt

File `.vscode/mcp.json` đã được cấu hình. Khởi động lại VS Code / Cursor để MCP server được load.

### Ví dụ sử dụng với AI agent

Với `pnpm dev` đang chạy, trong chat của IDE:

```
Navigate to http://localhost:1420 and take a screenshot
→ AI chụp màn hình app và mô tả

Click on the search button in the sidebar
→ AI click nút Search

Take a snapshot of the accessibility tree
→ AI trả về cây accessibility để phân tích

Check if there are any visible error messages on the page
→ AI báo cáo lỗi (nếu có)
```

---

## Giới hạn quan trọng

> **Tauri `invoke()` không hoạt động trong Playwright**
>
> Playwright kết nối với Vite dev server thuần (không có Tauri runtime). Các command gọi Rust backend sẽ bị reject. Tests được thiết kế để:
> 1. Skip gracefully nếu cần workspace/file để hoạt động
> 2. Inject content qua Pinia store thay vì mở file thật
> 3. Chỉ test phần UI thuần (layout, CSS, component visibility)

---

## Thêm tests mới

### Pattern cơ bản

```typescript
// tests/e2e/my-feature.spec.ts
import { test, expect } from './fixtures/app';

test.describe('My Feature', () => {
  test('does something', async ({ appPage }) => {
    // appPage đã navigate đến http://localhost:1420 và mount xong
    const el = appPage.locator('.my-selector');
    await expect(el).toBeVisible();
  });
});
```

### Thêm Page Object

```typescript
// tests/e2e/pages/MyPage.ts
import type { Page, Locator } from '@playwright/test';

export class MyPage {
  readonly page: Page;
  readonly myElement: Locator;

  constructor(page: Page) {
    this.page = page;
    this.myElement = page.locator('.my-element');
  }
}
```
