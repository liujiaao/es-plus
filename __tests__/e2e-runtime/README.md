# Tier 2 运行时 E2E（Playwright）

在 es-plus 的分层 E2E 模型里，本目录是 **Tier 2**：用真实浏览器（Chromium）渲染真实 Element UI + 真实
`@es-plus/vue2` 构建产物，驱动 CRUD 全链路。

| 层级 | 位置 | 手段 | 覆盖 |
| --- | --- | --- | --- |
| Tier 0 | `__tests__/e2e/` | pack tarball → install → `es-plus create` → `vite build` | 生成代码能编译（无运行时/浏览器） |
| Tier 1 | `packages/{vue3,adapter-antdv}/__tests__/crud-runtime.spec.ts` | vitest + happy-dom 挂载真实组件 + 内存后端 | 增删改查全链路（vue3 / antdv） |
| **Tier 2** | **本目录** | **Playwright + 真实 Chromium + vite dev fixture** | **增删改查全链路（vue2）** |

## 为什么 vue2 用 Tier 2 而不是 Tier 1

element-ui 的编译期 CJS `_interopRequireDefault(require('vue'))` 在 vitest 的 module runner 下
`.default` 解析为 `undefined`（dual-package Vue-build interop 冒险），
`element-ui/lib/utils/types.js:39` 抛 `Cannot read properties of undefined (reading 'prototype')`。
多种别名/inline/interop 方案均无法在 vitest+happy-dom 下绕过。真实浏览器 + 真实打包器（vite）没有该问题，
故 vue2 的运行时验证下沉到 Tier 2。

## 结构

```
__tests__/e2e-runtime/
  playwright.config.ts     # webServer 自动起 vue2/ 的 vite dev；单 chromium project
  vue2/                    # 真实 vite vue2 应用（fixture）
    vite.config.ts         # 关键：alias vue→Vue 2.7（根 node_modules/vue 是 Vue 3！）+ 显式 Vue2 compiler-sfc
    src/{main.ts,App.vue,schema.ts,backend.ts}
  tests/vue2-crud.spec.ts  # 列表加载 → 新增 → 编辑 → 删除
```

- **消费产物**：fixture 经 workspace 软链消费 `@es-plus/vue2` 的 `dist/es-plus-vue2.js`（发布产物）与
  `@es-plus/core` 的 `build/index.js`。跑测前需保证 `packages/vue2` 已 `vite build`。
- **注入缝**：内存后端（`src/backend.ts`，与 Tier 1 同构）通过 `EsCrudPage` 的 `:http-request` prop 注入，
  按 url 路由 `/api/list|create|update|delete`，列表返回 `{records, rows}`。挂到 `window.__backend` 供 spec 断言计数。
- **Vue 版本冲突**：本 monorepo 根 `node_modules/vue` 是 **Vue 3**（从 vue3 包提升）。fixture 的 `vite.config.ts`
  必须把 `vue` 精确别名到 `packages/vue2/node_modules/vue` 的 2.7 runtime-esm，并把 Vue 2.7 的 `vue/compiler-sfc`
  显式传给 `@vitejs/plugin-vue2`（否则插件会误用根的 Vue 3 编译器）。

## 本地运行

```bash
# 1) 确保 vue2 dist 新鲜
(cd packages/vue2 && npx vite build)

# 2) 首次安装浏览器（数十~上百 MB 下载）
npx playwright install chromium

# 3) 跑 Tier 2
npm run test:e2e:runtime
# 或： npx playwright test -c __tests__/e2e-runtime/playwright.config.ts
```

失败排查：`npx playwright test -c __tests__/e2e-runtime/playwright.config.ts --trace on` 后
`npx playwright show-report`。

## 注意

- 本层**不并入** `test:e2e` 与默认 CI 流水（浏览器下载成本）；作为独立可选步骤执行。
- 目前仅 vue2；vue3/antdv 已由 Tier 1 覆盖。结构预留，将来可在 `e2e-runtime/` 下加同构 fixture 复用本 harness。
