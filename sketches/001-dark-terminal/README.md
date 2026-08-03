# Variant: Dark Terminal (A)

## Design stance

The landing page *is* the app. Same VSCode-inspired dark chrome (#1e1e1e), same accent blue (#0078d4), same mono type — a visitor who clicks through feels like they've already used mdview.

## Key choices

- **Layout:** split hero — pitch left, live app window mock right (file tree + editor + GFM preview + status bar)
- **Typography:** Inter for UI, JetBrains Mono for code/keys/tree — mirrors app's SF Mono stack
- **Color:** exact app tokens — `--bg:#1e1e1e`, `--accent:#0078d4`, `--bg-code:#0d1117`, danger `#f48771`, link `#4daafc`
- **Interaction:** clickable window tabs (3 mock files: getting-started / AGENTS.md / daily note), animated SVG force-graph with dashed highlight edges, scroll-reveal sections
- **Animation:** restrained — caret blink, graph dash drift, hover lift. Terminal-flavored but calm

## Trade-offs

- Strong at: credibility, developer audience, honest representation of the product
- Weak at: standing out in a crowded dev-tool space; dark-only first impression

## Best for

A dev-focused launch: HN/ProductHunt crowd, the "familiar = trustworthy" play. Lowest risk, highest fidelity to the product.
