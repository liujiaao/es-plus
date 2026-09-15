# @es-plus/cli

## 1.4.0

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

- Updated dependencies [2d748f6]
- Updated dependencies
  - @es-plus/shared@1.4.0

## 1.3.0

### Minor Changes

- 9869180: 新增 NL→Config AI 生成能力与 antdv 渲染器支持；加固生成器健壮性（覆盖保护/未知 target/写盘事务/顶层兜底）。

### Patch Changes

- Updated dependencies [9869180]
  - @es-plus/shared@1.3.0

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
