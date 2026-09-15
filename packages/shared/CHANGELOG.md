# @es-plus/shared

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

- 2d748f6: 修复源码审计（`docs/source-audit-report.md`）中的 5 条「立即」级缺陷。

  **C1 请求 Promise 永久挂起（core + 三端）**

  - `queryTableListMethod` 此前仅在响应为非空对象/数组时调用 `success`，而非对象响应（204 空响应、
    拦截器 `return undefined`、原始值）既不触发 `success` 也不触发 `fail`，导致
    `httpRequestFormInstance` 的 Promise 永不 settle，`getEveryFormQueryField` 的 `Promise.all`
    整体挂起（远端下拉选项加载不出来且无报错）。现非对象响应归一为 `{}` 后仍调用 `success`。
  - **同类缺陷同时存在于三端表格组件的本地请求函数**：`isObject(res) && Object.keys(res).length`
    守卫会跳过空响应与数组响应，而 `httpRequestInstance` 的 Promise 只在 success/fail 中 settle
    → 表格加载永久挂起。三端一并修复。
    **行为变化**：空 / 非对象响应（如 204、拦截器 `return undefined`）现在会 settle 并被视为空列表
    （清空行、`total` 归 0），此前是 Promise 挂起；数组响应也会 settle，但表格本地映射不含数组直传分支，
    会渲染为空表（如需支持裸数组列表响应，是独立的后续需求）。

  **C2 antdv 代码生成不可编译（shared）**

  - `schema-generator` 的 Vue3/antdv 共用 `<script setup>` 分支此前漏调 `rewriteElementUsage`：
    import 已被映射为 `Modal` / `message`，代码体却仍引用 `ElMessageBox` / `ElMessage`。
    现该分支的删除确认块复用 `buildDeleteConfirmBlock`（antdv 走 `Modal.confirm` 对象式），
    并在返回前统一改写 UI 库命名；`summary` 的 target 文案同步修正（antdv 不再误标 Element Plus）。

  **C3 顶层快捷字段静默丢弃（core + 三端）**

  - `FormItemOption.placeholder` / `clearable` / `disabled` 文档承诺自动注入 `attrs`，但
    `normalizeFormItem` 除 core 自身外零调用，三端全部静默丢弃。现三端 `es-form` 的
    `formItemListFilter` 统一接入 `normalizeFormItem`。
  - `normalizeFormItem` / `normalizeFormItemList` 改为泛型，只约束真正使用的字段
    （新增 `FormItemShortcutSource`）—— 三端各自特化的 `render` / `isHidden` 签名与 core 的
    `FormItemOption` 不兼容，直接收完整类型会导致 antdv / vue2 编译失败。

  **C4 跨页选择列不渲染（shared）**

  - `crud-engine` 自然语言解析误写 `options.selection`（非法键），三端只识别 `options.multiSelect`。
    现改为 `multiSelect`，提示文案同步。

  **C8 CLI 路径穿越（cli + shared）**

  - `name` 此前只约束 `min(1)`，`toPascalCase` 不剥离分隔符，`--from-config` 载入不可信配置时
    可通过 `name: "../../evil"` 把产物写出输出目录。现：契约层对 `StructuredCrudConfigSchema.name`
    增加 refine 拒绝路径分隔符 / `.` / `..` / 盘符；CLI 侧新增 `isSafePathSegment` / `isPathInside`
    守卫（`create` 的 `[name]`、`--from-config` 两条路径，以及 `scaffold` 的 `[name]`），
    并在拼出文件路径后做输出目录越界兜底。

  **测试**

  - 全部修复均补回归测试，并逐条反向验证（临时拆掉修复后测试确实变红）：
    C1（core）、C2、C3（三端）、C4、C8（含 create / scaffold 接线级测试）、三端表格 settle。
  - 新增 `packages/vue2/__tests__/es-table.spec.ts`（此前 vue2 无表格挂载测试）。
  - 全量：core 244 / shared 277 / cli 42 / vue3 450 / vue2 285 / adapter-antdv 499 / mcp-server 59；
    7 包 typecheck 全过；lint 0 error；`check:consistency` 全绿。

## 1.3.0

### Minor Changes

- 9869180: 新增 NL→Config AI 层、SFC 模式回归防护、InputNumber 支持；修复 codegen 增删改查失败提示。

## 1.1.0 — Codegen lang="jsx" + Vue 2 import extraction

This release fixes two long-standing code-generator bugs that produced
syntactically incorrect output. Both surfaced when the new e2e harness
attempted to run `vite build` on generator output for the first time.

### Fixed

- **`crud-engine.ts` now emits `<script setup lang="jsx">`** instead of
  `<script setup>` for SFCs that include JSX inside dialog `render`
  functions. Previously the JSX would be routed through esbuild's plain-JS
  loader and reject syntax like `<EsForm>` at build time. Affects every
  prompt producing a CRUD page with add/edit actions in vue3 sfc mode.
- **`transformScriptSetupBlock` in `code-generator.ts` now extracts
  top-level `import` statements** from the setup body and emits them at the
  top of the rewritten `<script>` block, where they belong. The previous
  behavior moved imports inside the `setup()` function body, producing JS
  that throws `Unexpected "{"` at parse time. Affects every prompt in
  vue2 sfc mode.
- The regex matching `<script setup>` blocks now accepts `lang="jsx"` and
  `lang="tsx"` in addition to `lang="ts"`, so the Vue 2 rewrite path
  preserves the lang attribute correctly.

### Tests

- New `__tests__/code-generator-vue2.spec.ts` (48 cases): snapshot every
  PRESET_EXAMPLE for vue2 target + contract assertions that Vue 2 output
  uses `defineComponent` not `<script setup>`, `@es-plus/vue2` not vue3,
  and never emits `v-model:*`.
- New `__tests__/structured-config-schema.spec.ts` (9 cases): snapshot the
  zod schema shape so accidental field renames or required-ness changes
  break tests before they hit production consumers.
- Refreshed existing snapshots that drifted during the
  `es-plus-ui` → `@es-plus/vue3` rename and the JSX lang attribute addition.

### Notes

The exported function signatures are unchanged. Consumers (`@es-plus/cli`,
`@es-plus/mcp-server`, the docs site AiCrud page) get the bug fixes
automatically by upgrading.

## 1.0.x

(See git history for earlier releases.)
