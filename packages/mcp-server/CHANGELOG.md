# @es-plus/mcp-server

## 1.4.0

### Minor Changes

- 修复三端同构中的「静默失效」类缺陷 —— 这些问题的共同点是**不报错、只是行为悄悄不对**，
  是同一份配置在某一端"没反应"时最难排查的一类。同时收敛若干跨端 API 差异。

  **`@es-plus/adapter-antdv`**

  - **EP 专有属性不再被静默吞掉**：`clearable` / `filterable` / `show-word-limit` / `collapse-tags`
    此前被原样透传给不认识它们的 Ant Design Vue 组件而失效（`grep allowClear` 曾为 0 命中）。
    现按 formtype 限定作用域映射为 `allowClear` / `showSearch` / `showCount` / `maxTagCount`；
    `collapse-tags-tooltip` 无等价物，改为**开发期一次性告警后丢弃**，不再无声消失。
  - **修复插件重复注册**：`install()` 补回 `isPlugin && Plugin` 守卫（vue3 早有针对该场景的守卫，
    本端遗漏且注释写着"完全对齐 vue3"），消除 dev 环境的
    `Component "EsForm" has already been registered` 告警。
  - **`useDialog` 返回值对齐三端的 `DialogResult`**：由裸 vNode 改为
    `{ instance, close, destroy }`，使 `const { close, instance } = dialog({...})` 这种
    在 vue3/vue2 与官方示例中通用的写法在本端也能工作。callable 上的 `.close()` / `.destroy()`
    保留不变，属纯增量变更。
  - **默认列对齐收敛为 `center`**：此前仅在显式配置时才设置 align，落到 a-table 默认的 `left`，
    造成"同一份配置三端三种对齐"，且与本包 vxe 引擎（center）自相矛盾。
  - **列 key 兜底改为确定性**：既无 `key` 又无 `prop` 的列此前用 `Math.random()` 生成身份，
    每次 computed 重算都产生新 key，破坏 a-table 的列状态（排序/筛选/列宽）并让快照失稳。
  - 自动 span 计算改回调用 `@es-plus/core` 的 `applyAutoSpan`，消除内联重写。

  **`@es-plus/vue2`**

  - **`validateField` 由 `void` 桥接为 Promise**：element-ui 的 `validateField` 是纯 callback 式，
    而 vue3(Element Plus) / antdv 返回 Promise。此前本端直接透传，导致
    `await form.validateField('name')` **立刻返回、完全不等待校验** —— 三端里唯独 vue2
    无法用 await 拦截字段级校验。现按 EP/ADV 语义桥接（通过 resolve、不通过 reject），
    并对"未匹配到字段"的情况直接放行，避免 Promise 永不 settle 造成调用方挂起。
  - `isFold` / `getBtnColSpan` / isFold 标注改回调用 core 的同名函数（逐行等价，纯去重）。

  **`@es-plus/shared` / `@es-plus/mcp-server`**

  - **`tableBtns` 接受 `position` 并归一化为 `code`**：schema 此前只声明 `code`，而 Zod 默认
    strip 未知键 —— 宿主 LLM 按 `esplus://crud-page-schema` 示例写 `position: 'right'` 时会被
    **静默改写成 `code: 1`（左侧）**：解析成功、零告警，按钮落到错误的一侧。
    现接受 `position`（渲染器契约里的推荐字段，三端 `BtnConfig` 均把 `code` 标为 deprecated）
    并通过 `.transform()` 归一化出与之一致的 `code`，保证下游读 `code` 的路径（生成物 JSON、
    golden 评分器）始终正确。
  - `toolbarBtns` 同样接受 `position`，不再被 strip。
  - **统一 `position` / `code` 的口径**：`esplus://conventions` 资源此前写着
    "Do NOT use a `position` field"，理由为"vue2 会忽略它"——**该理由不成立**（vue2 的
    `es-table/src/table-btns.vue` 与 `es-crud-page.vue` 都经由 core 的 `getButtonPosition`
    优先读取 `position`，已在源码上核实）。
    该错误口径与 `esplus://types`（标注 `code` 已 deprecated）、`esplus://crud-page-schema`
    （示例通篇用 `position`）三方互相矛盾，会把宿主 LLM 推向已废弃字段。三处口径现已统一。
  - NL→ 配置的 system prompt 同步修正按钮定位指引。

  > `tableBtns` 的 `position` 归一化同时被 `scripts/check-schema-contract.mjs` 守卫，
  > 并新增 golden 用例 `24-position-tablebtns.json` 覆盖该路径。

### Patch Changes

- Updated dependencies [2d748f6]
- Updated dependencies
  - @es-plus/shared@1.4.0

## 1.3.0

### Minor Changes

- 9869180: 新增 NL→Config AI 层、SFC 模式、InputNumber、antdv 渲染器与全局 httpRequest 支持。

### Patch Changes

- Updated dependencies [9869180]
  - @es-plus/shared@1.3.0

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
