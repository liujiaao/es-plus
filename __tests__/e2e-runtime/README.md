# Tier 2 运行时 E2E（Playwright）

在 es-plus 的分层 E2E 模型里，本目录是 **Tier 2**：用真实浏览器（Chromium）渲染真实组件库 + 真实
`@es-plus/*` 构建产物，驱动 **CRUD 全链路**、**六份 golden 片段产物**，以及 **vue3 / antdv 的表格交互**
（排序 / 选择 / 分页 / 导出 / 行内编辑）。

| 层级 | 位置 | 手段 | 覆盖 |
| --- | --- | --- | --- |
| Tier 0 | `__tests__/e2e/` | pack tarball → install → `es-plus create` → `vite build` | 生成代码能编译（无运行时/浏览器） |
| Tier 1 | `packages/{vue3,adapter-antdv}/__tests__/{crud-runtime,fragment-runtime}.spec.ts` | vitest + happy-dom 挂载真实组件 + 内存后端 | 增删改查全链路 + golden 片段（vue3 / antdv） |
| **Tier 2** | **本目录** | **Playwright + 真实 Chromium + vite dev fixture** | **增删改查 / 片段（vue2）+ 表格交互（vue3 / antdv）** |

## 为什么 vue2 用 Tier 2 而不是 Tier 1

element-ui 的编译期 CJS `_interopRequireDefault(require('vue'))` 在 vitest 的 module runner 下
`.default` 解析为 `undefined`（dual-package Vue-build interop 冒险），
`element-ui/lib/utils/types.js:39` 抛 `Cannot read properties of undefined (reading 'prototype')`。
多种别名/inline/interop 方案均无法在 vitest+happy-dom 下绕过。真实浏览器 + 真实打包器（vite）没有该问题，
故 vue2 的运行时验证下沉到 Tier 2。

## 结构

```
__tests__/e2e-runtime/
  playwright.config.ts     # webServer 先 gen-fragments 再起 vue2/ 的 vite dev；单 chromium project
  vue2/                    # 真实 vite vue2 应用（fixture）
    vite.config.ts         # 关键：alias vue→Vue 2.7（根 node_modules/vue 是 Vue 3！）+ 显式 Vue2 compiler-sfc + @vitejs/plugin-vue2-jsx
    fragments.html         # 片段 fixture 入口（CRUD 走 index.html）
    scripts/gen-fragments.mjs  # 从 golden 语料现生成六份 vue2 片段到 src/fragments/（gitignore）
    src/{main.ts,App.vue,schema.ts,backend.ts}          # CRUD fixture
    src/{fragments-main.ts,FragmentsApp.vue,fragments-backend.ts}  # 片段 fixture
  tests/vue2-crud.spec.ts  # 列表加载 → 新增 → 编辑 → 删除
  tests/vue2-fragments.spec.ts  # 6 份生成片段：表格拉数/映射/formatter、表单、两种弹窗形态
  table/                   # 表格交互 fixture（W4）：一台 dev server 服务两条腿
    vite.config.ts         # 默认解析（根 node_modules 的 vue 本来就是 Vue 3）
    src/main.ts            # ?lib=vue3|antdv 动态换库；?rows / ?local=0 / ?vxe=1
    src/{TableApp.vue,AntdvTableApp.vue}  # 同构的两份页面
    src/data.ts            # amount 递减，升序排序后首行会变（断言只看首行）
  tests/table-vue3.spec.ts   # 排序 / 选择 / 分页 / 导出 / vxe 行内编辑
  tests/table-antdv.spec.ts  # 同五条；排序腿只断言事件 + 指示器（a-table 的 sorter 是服务端语义）
```

- **消费产物**：fixture 经 workspace 软链消费 `@es-plus/vue2` 的 `dist/es-plus-vue2.js`（发布产物）与
  `@es-plus/core` 的 `build/index.js`。跑测前需保证 `packages/vue2` 已 `vite build`。
- **注入缝**：内存后端（`src/backend.ts`，与 Tier 1 同构）通过 `EsCrudPage` 的 `:http-request` prop 注入，
  按 url 路由 `/api/list|create|update|delete`，列表返回 `{records, rows}`。挂到 `window.__backend` 供 spec 断言计数。
- **片段 fixture（AI-44）**：入口 `src/fragments-main.ts` **只**用 `Vue.use(ESPlus, { httpRequest })` 配顶层请求函数
  ——生成出来的片段自身没有 `:http-request` prop，因此这同时是全局 `httpRequest` 兜底（AI-43）的运行时见证。
  六份片段由 `scripts/gen-fragments.mjs` 在 dev server 启动前现生成（build 缺失 / 语料非法 / fence 不符 → 逐条报错并 exit 1，
  不做兜底）；产物目录 `src/fragments/` 已进 `.gitignore`；`fragments-backend.ts` 按 URL 分流，未知 URL **抛错**。
- **Vue 2 JSX**：dialog composable 片段是 `.tsx`，由 `@vitejs/plugin-vue2-jsx` 编译。该插件 peer 依赖 Vue **2**，
  放进根 devDependencies 会因根 hoist 的 Vue 3 触发 ERESOLVE，故声明在 `packages/vue2/package.json`，
  `vite.config.ts` 用 `createRequire(packages/vue2/package.json)` 解析。
- **Vue 版本冲突**：本 monorepo 根 `node_modules/vue` 是 **Vue 3**（从 vue3 包提升）。fixture 的 `vite.config.ts`
  必须把 `vue` 精确别名到 `packages/vue2/node_modules/vue` 的 2.7 runtime-esm，并把 Vue 2.7 的 `vue/compiler-sfc`
  显式传给 `@vitejs/plugin-vue2`（否则插件会误用根的 Vue 3 编译器）。

## 本地运行

```bash
# 1) 构建 fixture 消费的三个 dist（pretest:e2e:runtime 也会做，这里只是说明依赖关系）
npm run build --workspace @es-plus/vue2
npm run build --workspace @es-plus/vue3
npm run build --workspace @es-plus/adapter-antdv

# 2) 首次安装浏览器（数十~上百 MB 下载）
npx playwright install chromium

# 3) 跑 Tier 2（webServer 会自动先跑 gen-fragments.mjs，无需手动生成片段）
npm run test:e2e:runtime
# 只跑某一条腿： `--project=vue2` / `vue3-table` / `antdv-table` / `ai-gallery-docs` / `mobile-docs`
npm run test:e2e:runtime -- --project=vue3-table
```

失败排查：`npx playwright test -c __tests__/e2e-runtime/playwright.config.ts --trace on` 后
`npx playwright show-report`。

## 表格性能基准（W4，不做门禁）

```bash
npm run bench:table              # 1k / 5k / 20k 行 × vue3 / antdv
npm run bench:table -- --rows 1000 --libs vue3   # 单格
```

产物写到 `docs/internal/bench-table-<YYYY-MM-DD>.json`：每格记录**首行渲染墙钟**与
**程序化滚动期间的 rAF 间隔 p50/p95**。它**不是红线**——同一台机器上 dev server 的绝对值
噪声很大，只在「同机、同 fixture、改前改后各跑一次」时可比。`timedOut: true` 表示该格在
5 分钟内没渲染出首行（对没有虚拟滚动的引擎，这个结果本身就是结论）。

fixture 用 `?local=0` 关掉内建分页让全部行都进 DOM；`?vxe=1` 额外挂一张能行内编辑的 vxe 表格。

## 注意

- 本层**不并入** `test:e2e` 与默认 CI 流水（浏览器下载成本）；作为独立可选步骤执行。
- 覆盖：vue2（CRUD + 片段）、vue3 / antdv（表格五条交互）、docs 站（AI 画廊 / AI CRUD / 版式 / 窄屏）。
- vue3 / antdv 的**行内编辑**腿需要 `vxe-pc-ui` + `vxe-table`，两者声明在 `packages/vue3` 的
  devDependencies（随 hoist 落到根 `node_modules`），fixture 直接 `import` 即可，不依赖站点目录的副本。
