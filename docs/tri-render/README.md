# 三端渲染（tri-render）

本目录是「三端通用」元叙事的**单一真源**，当前只承载一样东西：

1. **`schema.json`** —— 「同一份配置」的 JSON Schema（三端通用）。被三站 `TriRenderTabs` 组件读取，
   作为「换一行 import 即切换」的证据源码展示。由 [`scripts/sync-tri-render.mjs`](../../scripts/sync-tri-render.mjs)
   分发到 `es-plus-docs` / `es-pc` / `es-eui` 的 `src/tri-render/`，各站副本禁止手改。

## 三端渲染快照：尚未落地（独立任务）

> **现状**：本目录**没有任何 `*.png` 快照**，三站也**不再展示快照占位图**。

此前的设计是「同一份 Schema 源码 + 三端渲染快照」（原因见 [`docs/改造三端站点.md` §6.3](../../改造三端站点.md)：
Element UI / Vue2 是 Vue2-only，无法挂进 Vue3 应用，单页三端活体切换不可行）。但该机制**从未真正落地**：

- 生成脚本 [`scripts/gen-tri-render-snapshots.mjs`](../../scripts/gen-tri-render-snapshots.mjs) 依赖 Playwright，
  **未接入任何 CI**，也从未产出过快照；
- 三站的快照占位 UI 会造成「有三端对比」的假象，**已移除**（`TriRenderTabs` 现在只展示 schema 源码与各端导入方式）；
- `sync-tri-render` 此前声称分发「schema + 快照」，实际只有 1 个文件 → 门禁恒绿，现已改为**只分发 schema.json**
  并在目标缺失时报错。

**待办（独立任务）**：若仍要做渲染证据，需要
① 用 Playwright 分别起三站、对**同一个案例**（而非各站首页）截图；
② 把生成纳入 CI 与 deploy；
③ 恢复三站的快照展示（届时再让 `sync-tri-render` 分发 PNG）。
在那之前，`tri-render:check` 只保证 schema 单源一致，**不代表存在渲染对比**。

## 命名约定（待快照落地后启用）

| 文件 | 来源站点 | 渲染器 |
|---|---|---|
| `vue3.png` | es-plus-docs | Vue 3 + Element Plus |
| `vue2.png` | es-eui | Vue 2 + Element UI |
| `antdv.png` | es-pc | Vue 3 + Ant Design Vue |

## 命令

```bash
npm run tri-render:sync    # 分发 schema.json 到三站 src/tri-render/
npm run tri-render:check   # CI 一致性校验（schema 单源）
npm run tri-render:gen     # 生成快照（需 Playwright；当前未接入 CI，见上「待办」）
```
