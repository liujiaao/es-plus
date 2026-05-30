# @es-plus/vue3

## 1.4.1 — Virtual table horizontal scroll fix

### Fixed

- **`EsTable` with `options.virtual: true` now horizontally scrolls when the
  column total exceeds the viewport.** Previously the underlying `el-table-v2`
  was instantiated without the (mis-named) `fixed` prop, which gates Element
  Plus's `bodyWidth = max(columnsTotalWidth, viewport)` computation —
  without it, `bodyWidth` was hard-pinned to viewport width and horizontal
  overflow could never occur, regardless of how wide the columns were
  configured. Affected every virtual-table demo in the docs site and every
  user-side virtual table with `fixed: 'right'` columns (the right-anchored
  column would render detached from the table body at viewport sizes
  smaller than the column total).

- **Horizontal scrollbar is now always visible when overflow exists** via
  `:scrollbar-always-on="true"` on `el-table-v2`. Previously the scrollbar
  auto-hid behind a CSS `opacity: 0` rule, with the `.always-on` class
  needed to make it visible — and even when scrollable, mouse wheel doesn't
  drive horizontal scroll, so users had no discoverable way to scroll.

### Notes

This is a pure bug fix — no API change. Users on `^1.4.0` get the fix
automatically. The combined behavior shift is:

- BEFORE: virtual tables silently couldn't horizontally scroll; fixed-right
  columns visually detached on overflow.
- AFTER:  virtual tables horizontally scroll when overflow exists; fixed
  columns anchor correctly; scrollbar is always discoverable.

No source changes outside `components/es-table/src/engines/virtual-engine.vue`.
