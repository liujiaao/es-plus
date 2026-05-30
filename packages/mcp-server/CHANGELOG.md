# @es-plus/mcp-server

## 1.2.0 — Dual-target awareness + protocol clarity

This release closes the vue3-only blind spot in the MCP surface. Resources
and tools are now target-aware end-to-end, with a new `detect_project_target`
tool that lets AI clients pick the right target before generating anything.

### Added

- **`detect_project_target`** tool — reads a project's `package.json` content
  (as a string the client provides) and returns
  `{ target, confidence, reasoning, signals }`. AI-aware clients
  (Claude Code / Cursor / Continue) should call this FIRST, then pass the
  returned `target` to every subsequent generator. Covers explicit
  `@es-plus/{vue3,vue2}` deps, legacy `es-plus-ui`, Vue major + Element layer
  inference, semver range parsing, and degenerate / malformed input.
- **Server-level `instructions`** field — initialized via the MCP SDK so
  every client sees up-front guidance to "detect target first, then
  generate" + the resource URI naming convention.
- **`target` parameter on `get_component_api`** — emits Vue 3 vs Vue 2
  import / `v-model:*` vs `:*.sync` / `<script setup>` vs `defineComponent`
  appropriately. Default remains `vue3` for backward compat.
- **Vue 2 resource variants** for every existing resource. URIs follow a
  consistent suffix pattern; the bare URI continues to default to vue3:
  - `esplus://conventions` / `esplus://conventions/vue3` / `esplus://conventions/vue2`
  - `esplus://examples` / `esplus://examples/vue3` / `esplus://examples/vue2`
  - `esplus://types` / `esplus://types/vue3` / `esplus://types/vue2`
  - `esplus://crud-page-schema` / `esplus://crud-page-schema/vue3` / `esplus://crud-page-schema/vue2`
- **First unit-test coverage** in `__tests__/detect-project-target.spec.ts`
  (21 cases — tier 1 / tier 2 / semver edges / malformed input / output
  shape).
- **Vue 2 bundled types** as a separate fallback file
  (`bundled/types-vue2.d.ts`) so `esplus://types/vue2` works even when the
  monorepo source isn't on disk.

### Changed

- `bundle-types` script now reads from the renamed `packages/vue3/`
  directory and additionally bundles `packages/vue2/src/types/index.ts`.
- `loadTypesFromSource` in the types resource accepts a target argument and
  resolves the correct monorepo path per target.

### Fixed

- (Internal, no user-facing impact) Hardcoded `packages/es-plus/...` paths in
  the types and crud-page-schema resources updated to the renamed
  `packages/vue3/...` layout.

### Migration

No breaking changes for existing AI clients — every URI and tool retained
its prior signature. To take advantage of vue2-aware generation:

1. Have the AI call `detect_project_target` with the project's
   `package.json` content.
2. Pass the returned `target` to `generate_crud_page` /
   `generate_crud_schema` / `generate_from_config` / `get_component_api`.
3. (Optional) Read the matching `esplus://conventions/<target>` resource for
   Vue 2 syntax deltas.

## 1.1.x

(Earlier versions had only vue3 support — see git history for details.)
