# 三端渲染（tri-render）

本目录是「三端通用」元叙事的**单一真源**，当前承载两样东西：

1. **`schema.json`** —— 「同一份配置」的**示例实例**（EsForm + EsTable 的同一份 JSON）。
   注意它是配置实例，**不是 JSON Schema** —— 此前文件头部的 `$schema` 指向了它自己
   （拿实例当 schema），已改为 `$comment` 说明。它的各组成部分由
   [`packages/shared/schemas`](../../packages/shared/schemas) 下的
   form-item / table-column / table-options / btn-config 约束。
   被三站 `TriRenderTabs` 组件读取，作为「换一行 import 即切换」的证据源码展示。
2. **`pairs.json`** —— 同名示例配对的**实测**结果（由
   [`scripts/gen-tri-render-pairs.mjs`](../../scripts/gen-tri-render-pairs.mjs) 从三端真实示例文件
   逐行比对得出：配对对数、差异中位数、以及差异最小的那一对的两侧完整源码）。
   三站据此展示「同一份配置，只差一行 import」的真实证据。

两者都由 [`scripts/sync-tri-render.mjs`](../../scripts/sync-tri-render.mjs)
分发到 `es-plus-docs` / `es-pc` / `es-eui` 的 `src/tri-render/`，各站副本禁止手改。

## 三端渲染快照：尚未落地（独立任务）

> **现状**：本目录**没有任何 `*.png` 快照**，三站也**不再展示快照占位图**。

此前的设计是「同一份 Schema 源码 + 三端渲染快照」（原因见 [`docs/改造三端站点.md` §6.3](../../改造三端站点.md)：
Element UI / Vue2 是 Vue2-only，无法挂进 Vue3 应用，单页三端活体切换不可行）。但该机制**从未真正落地**：

- 生成脚本 [`scripts/gen-tri-render-snapshots.mjs`](../../scripts/gen-tri-render-snapshots.mjs) 依赖 Playwright，
  **未接入任何 CI**，也从未产出过快照；
- 三站的快照占位 UI 会造成「有三端对比」的假象，**已移除**；
- `sync-tri-render` 此前声称分发「schema + 快照」，实际只有 1 个文件 → 门禁恒绿，现已改为**显式清单
  分发 `schema.json` + `pairs.json`** 并在目标缺失时报错。

作为快照的替代，`TriRenderTabs` 现在展示的是**可核对的实测证据**：三端同名示例逐行比对的
配对统计 + 差异最小的那一对（两侧完整源码、变更行高亮）。它证明的是「同一份配置，
两端只差一行 import/组件名」，证据来自仓库里的真实示例文件（`pairs.json` 由脚本实测生成，
改示例即改数字）。快照能提供的额外价值只剩「像素级一致」，这仍是有待落地的独立任务。

**待办（独立任务）**：若仍要**像素级**的渲染证据，需要
① 用 Playwright 分别起三站、对**同一个案例**（而非各站首页）截图；
② 把生成纳入 CI 与 deploy；
③ 恢复三站的快照展示（届时再让 `sync-tri-render` 分发 PNG）。

注意 `tri-render:check` 只保证「分发副本 == 单源」，它**不代表存在渲染对比** ——
渲染对比的证据当前由 `pairs.json`（同名示例逐行实测）承担，快照补的是它覆盖不到的那部分
（像素级一致、样式差异）。

## 命名约定（待快照落地后启用）

| 文件 | 来源站点 | 渲染器 |
|---|---|---|
| `vue3.png` | es-plus-docs | Vue 3 + Element Plus |
| `vue2.png` | es-eui | Vue 2 + Element UI |
| `antdv.png` | es-pc | Vue 3 + Ant Design Vue |

## 命令

```bash
npm run tri-render:sync          # 分发 schema.json + pairs.json 到三站 src/tri-render/
npm run tri-render:pairs         # 从三端示例实测生成 pairs.json
npm run tri-render:pairs:check   # CI：pairs.json 是否与示例实况一致
npm run tri-render:check         # CI 一致性校验（分发副本 vs 单源）
npm run tri-render:gen           # 生成快照（需 Playwright；当前未接入 CI，见上「待办」）
```
