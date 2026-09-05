# 三端渲染快照（tri-render）

本目录是「三端通用」元叙事的**单一真源**，承载两样东西：

1. **`schema.json`** —— 「同一份配置」的 JSON Schema（三端通用）。被 `TriRenderTabs` 组件读取，作为「换一行 import 即切换」的证据源码展示。
2. **`*.png`** —— 各渲染器的渲染快照，由 [`scripts/gen-tri-render-snapshots.mjs`](../../scripts/gen-tri-render-snapshots.mjs) 构建期生成。

## 为什么用快照而非活体渲染

见 [`docs/改造三端站点.md` §6.3](../../改造三端站点.md)：Element UI / Vue2 是 Vue2-only，无法挂进 Vue3 应用，单页三端活体切换不可行。唯一稳妥方案是「同一份 Schema 源码 + 三端渲染快照」。

## 快照命名约定

| 文件 | 来源站点 | 渲染器 |
|---|---|---|
| `vue3.png` | es-plus-docs | Vue 3 + Element Plus |
| `vue2.png` | es-eui | Vue 2 + Element UI |
| `antdv.png` | es-pc | Vue 3 + Ant Design Vue |

## 生成与分发

```bash
# 1. 生成快照（需 Playwright：npm i -D playwright && npx playwright install chromium）
npm run tri-render:gen

# 2. 分发 schema.json + 快照到三站 src/tri-render/
npm run tri-render:sync

# 3. CI 一致性校验
npm run tri-render:check
```

> 快照缺失时，`TriRenderTabs` 组件会优雅降级为占位图，不阻塞三站构建。
