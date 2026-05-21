# mdview — Test Fixture: Markdown Sample
#
# This file is used by preview.spec.ts to verify markdown rendering.
# It covers all the common render bugs targeted in v1.7.0 (S-BF1, S-BF2).

## Soft newlines (breaks: true test)

Line one
Line two (should render with <br> between these two lines)
Line three

## Unordered list

- Item Alpha
- Item Beta
- Item Gamma
  - Nested item 1
  - Nested item 2

## Ordered list

1. First
2. Second
3. Third

## Task list (checkboxes)

- [ ] Unchecked task
- [x] Checked task
- [ ] Another unchecked item

## Mixed content

Some **bold text**, _italic text_, and `inline code`.

> A blockquote paragraph

---

## Table

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
