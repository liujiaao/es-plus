---
title: '更新日志'
route: '/guide/changelog'
canonical: 'https://liujiaao.github.io/es-plus/#/guide/changelog'
source: 'es-plus-docs/src/docs/changelog.md'
type: 'guide'
---
# 更新日志

> 本页由 `npm run changelog:gen` 从各包的 `CHANGELOG.md` 生成，**请勿手改**；完整历史见 [GitHub Releases](https://github.com/liujiaao/es-plus/releases)。

## 当前版本

| 包 | 版本 | 说明 |
|---|---:|---|
| `@es-plus/core` | 1.3.0 | 框架无关核心（类型 / 布局 / 校验） |
| `@es-plus/vue3` | 1.7.0 | Vue 3 + Element Plus 渲染端 |
| `@es-plus/vue2` | 1.4.0 | Vue 2 + Element UI 渲染端 |
| `@es-plus/adapter-antdv` | 1.3.0 | Vue 3 + Ant Design Vue 适配器 |
| `@es-plus/shared` | 1.4.1 | 配置 schema / 生成器 / 修复环 |
| `@es-plus/cli` | 1.4.0 | 命令行工具 |
| `@es-plus/mcp-server` | 1.4.1 | MCP Server（AI 工具面） |

## 升级前请先读

- **Minor Changes**（@es-plus/core、@es-plus/vue3、@es-plus/vue2、@es-plus/adapter-antdv、@es-plus/shared、@es-plus/mcp-server）：移除 `DialogOptions.onSubmit` —— 该选项从未生效，请改用 `configBtn[].click`。

> 完整迁移代码见下方对应条目。

## 最近一次发布

> 每个包只取 CHANGELOG 的最新一段；同一个 changeset 打在多个包上时合并为一条。

### Minor Changes

- 移除 `DialogOptions.onSubmit` —— 该选项从未生效，请改用 `configBtn[].click`。

  **这不是「删功能」，是承认该 API 不存在。** 三端没有任何一个 dialog 组件 emit `submit`：
  vue3 声明了事件并写了一个**零引用**的 `handleConfirm`（唯一会 emit `submit` 的地方）；vue2 把
  `'submit'` 列进了 `emits` 却从不 emit；antdv 连声明都没有。而三端 `useDialog` 合计 17 处在包装
  `onSubmit`、4 个类型文件声明了它 —— 除最后一步外整条链都接好了，唯独没有触发点。

  因此升级后：

  - **运行时行为完全不变** —— 传 `onSubmit` 的代码本来就不会被调用（弹窗底部按钮只在 `configBtn`
    非空时渲染，写了 `onSubmit` 的调用其实一个按钮都没有）；
  - **类型上会看到错误** —— `DialogOptions` 不再有该字段，这是本次唯一的破坏性变更，故记 minor。

  迁移方式（把确认逻辑挂到按钮自己的 `click` 上）：

  ```ts
  dialog({
    render: (h) =>
      h(EsForm, {
        /* … */
      }),
    configBtn: [
      { name: "取消", click: (_, { close }) => close() },
      {
        name: "确定",
        type: "primary",
        click: (_, { close, getRefs }) => {
          getRefs("form")
            ?.validate()
            .then(() => close());
        },
      },
    ],
  });
  ```

  一并删除：三端 `useDialog` 里的 17 处包装、vue3 的 `submit` 事件声明与死代码 `handleConfirm`、
  vue2 `emits` 里的 `'submit'`、`dialog-options.schema.json` 里的 `onSubmit`（已同步三份副本）、
  `get_component_api` 中「exposed by the type but the runtime never wires it up」那条说明。

  文档站的 4 处示例与 API 表已迁移到上述写法（迁移前这些「点击确定」的示例其实点不动，因为压根
  没有按钮）。

  <sub>影响：@es-plus/core / @es-plus/vue3 / @es-plus/vue2 / @es-plus/adapter-antdv / @es-plus/shared / @es-plus/mcp-server</sub>

### Patch Changes

- 修复源码审计（`docs/source-audit-report.md`）中的 5 条「立即」级缺陷。

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

  <sub>影响：@es-plus/cli</sub>

## 更早的版本

按包查看完整历史：

- `@es-plus/core`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/core/CHANGELOG.md)
- `@es-plus/vue3`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/vue3/CHANGELOG.md)
- `@es-plus/vue2`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/vue2/CHANGELOG.md)
- `@es-plus/adapter-antdv`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/adapter-antdv/CHANGELOG.md)
- `@es-plus/shared`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/shared/CHANGELOG.md)
- `@es-plus/cli`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/cli/CHANGELOG.md)
- `@es-plus/mcp-server`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/mcp-server/CHANGELOG.md)
