# @es-plus/cli

## 1.2.0 — Vue 2 generation actually compiles

This release fixes two bugs in the @es-plus/shared code generator (which
this cli delegates to) that prevented the produced code from actually
building in real projects. Both bugs were caught by the new end-to-end
test matrix in the monorepo (`__tests__/e2e/`).

### Fixed

- **Dialog SFC generation now declares `<script setup lang="jsx">`** when
  the body uses JSX (`render: (h, { registerRef }) => <EsForm ... />`).
  Without `lang="jsx"`, esbuild's plain-JS loader rejected the JSX syntax
  and `vite build` failed. Affected: `--mode sfc` for any prompt that
  produces a dialog (i.e. anything with add/edit actions).
- **Vue 2 `<script setup>` → `defineComponent` rewrite no longer moves
  `import` statements inside the `setup()` function body**, where they are
  illegal JS. Imports now stay at the top of `<script>` as required; the
  setup function body contains only non-import code. Affected:
  `--target vue2 --mode sfc`.

### Added

- **End-to-end test harness** (in the monorepo root, not shipped to npm):
  generates code via the cli for each (target, mode) combination, installs
  packed `@es-plus/{shared,vue3,vue2,cli}` tarballs into a fresh Vite +
  Vue project, and runs `vite build`. Any future regression in the cli, the
  generator, or the runtime component packages fails CI.

### Notes

The cli's `--target vue3|vue2` and `--mode schema|sfc` flags already existed
in 1.1.x; this release makes them actually produce code that compiles end-
to-end in both targets. No new commands or flags.
