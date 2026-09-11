---
"@es-plus/core": patch
"@es-plus/shared": patch
"@es-plus/vue3": patch
"@es-plus/vue2": patch
"@es-plus/adapter-antdv": patch
"@es-plus/cli": patch
---

修复源码审计（`docs/source-audit-report.md`）中的 5 条「立即」级缺陷。

**C1 请求 Promise 永久挂起（core + 三端）**
- `queryTableListMethod` 此前仅在响应为非空对象/数组时调用 `success`，而非对象响应（204 空响应、
  拦截器 `return undefined`、原始值）既不触发 `success` 也不触发 `fail`，导致
  `httpRequestFormInstance` 的 Promise 永不 settle，`getEveryFormQueryField` 的 `Promise.all`
  整体挂起（远端下拉选项加载不出来且无报错）。现非对象响应归一为 `{}` 后仍调用 `success`。
- **同类缺陷同时存在于三端表格组件的本地请求函数**：`isObject(res) && Object.keys(res).length`
  守卫会跳过空响应与数组响应，而 `httpRequestInstance` 的 Promise 只在 success/fail 中 settle
  → 表格加载永久挂起。三端一并修复（数组响应交给 `formatConfigOut` 的直传路径）。

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
