# 三站文档深度审计报告

> 审计日期：2026-09-14
> 范围：`es-plus-docs`（Vue3 + Element Plus，≈3.19 万行）· `es-pc`（Ant Design Vue，≈1.47 万行）· `es-eui`（Vue2 + Element UI，≈4.08 万行）
> 方法：按站点 + 跨站/部署/单源同步四个维度并行静态审计，关键结论回读源码复核。
> 标注：`CONFIRMED` = 已在源码上坐实；`SUSPECTED` = 推断。

**修复状态图例**：⬜ 未修 · 🔧 修复中 · ✅ 已修 · ⏸ 待决策

---

## 修复进展（2026-09-14）

已在同一轮修复中处理，逐项状态：

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 三端对比快照从未生成 | ✅ | **按决策「移除空转」**：三站占位 UI 删除、`sync-tri-render` 改为只分发 schema 并在目标缺失时报错、README 说明「快照另立任务」。未做生成+CI（需 Playwright 截同一案例） |
| 2 | 指南互链全断 | ✅ | `es-plus-docs/src/utils/doc-links.js` + `Doc.vue` 渲染期把站内绝对链接改写为 `#/...`；17 个 md 的 60 条站内链接全部验证改写 |
| 3 | AI CRUD 默认失败 | ✅ | vite `/openai` dev 代理 + 默认 baseUrl `/openai/v1` + 页面显著提示「生产需自备 CORS 网关」 |
| 4 | 主站 schema 手写副本 | ✅ | 新增 `es-plus-docs/scripts/gen-doc-schemas.mjs`，从 `packages/shared/schemas` 生成 `src|public/schemas`，补全缺失字段；ajv 校验合法配置通过 |
| 5 | es-pc EP-only 属性 + TimePicker 映射 | ✅ | `clearable→allowClear`、`filterable→showSearch`、`autoUpload→beforeUpload`；**adapter 修复 TimePicker range**（见下「额外发现」） |
| 6 | 零测试 / 零 PR 构建门禁 | ✅ | `typecheck.yml` 新增 `docs-build` matrix job（PR/push 构建三站） |
| 7 | 分包 / 体积 | ✅ | es-pc index **3.88MB→128KB**；es-plus-docs index **2.8MB→482KB**（拆 element-plus/vxe/monaco） |
| 8 | es-eui 合并遗留债 | ◐ | 按决策「保守」：删除明确死文件（`utils/server/index.js`、`HelloWorld.vue`）；发布残留 / 孤儿业务代码 **另立任务** |
| 9 | es-eui 运行期 bug | ✅ | env 失配、死路由 `/theme/preview`、favicon 404 全修 |
| 10 | 死链 / 错链 / sitemap | ✅ | 三站死链修仓库地址；sitemap host 改规范域名 + 去重复根 + `basePath` |
| 11 | 单源门禁有洞 | ✅ | 6 个 sync 脚本的错误注释与静默跳过已修（目标缺失即报错）；新增 `check:site-nav` 校验三站 SITES 数组一致 |
| 12 | schema `$id` 旧域名 | ✅ | `packages/shared/schemas` 及文档站派生 schema 统一为 `https://liujiaao.github.io/es-plus/...` |
| 13 | 死代码 / 误导 | ✅ | 删除 `es-plus-docs/src/components/es-plus/`；`main.ts` 旧包名 import 改为 `@es-plus/style.css` |
| 14 | es-pc 依赖 / 文案 | ✅ | 显式声明 `dayjs`；版本号改为从 `packages/*/package.json` 读取；Element 术语改为 AntDV 术语 |
| 15 | 外网 mock 不可靠 | ✅ | es-pc 改用站内本地 mock（`fetchMockUsers/Posts/Albums`），断网不空白 |

**额外发现并修复的真实 bug（审计未列出）**：
- `packages/adapter-antdv`：ADV 4.x 的范围时间选择器是独立导出的 `TimeRangePicker`，`TimePicker.RangePicker`
  已不存在 —— 此前 TimePicker 的 range 模式**静默降级为单选**；同时补了 range 占位符映射。
- `es-pc/src/views/es-crud/CustomRender.vue`：`Upload/Button/Progress/message` **未 import**，弹窗渲染必崩。

**仍待决策 / 另立任务**：
- #1 三端快照的生成 + CI（Playwright 截「同一案例」）。**（已部分替代）** 三站现展示
  `pairs.json` 的实测证据：同名示例逐行比对（两侧完整源码 + 变更行高亮），
  见 `scripts/gen-tri-render-pairs.mjs`。快照补的是它覆盖不到的像素级一致。
- #3 生产环境的 AI CORS 网关方案（当前仅 dev 代理可用）。
- 文档站 schema 的 `$id` 与 `schema-setup.md` 已随本轮统一；Playground 运行时只 `JSON.parse`、不做
  schema validate（补全/hover 已随 schema 补齐而正确）。

### 追加处理（2026-09-18）

- #8 **已处理**（按「只清无引用的发布残留」决策）：删除 `package.lib.json`、`vue.lib.config.js`、
  `PUBLISH_GUIDE.md`、`LIBRARY_README.md`、`PAIN_POINT_ANALYSIS.md`、`README_DETAILED.md`、
  `plans/`、`scripts/*.bat`、`test-project/`、`.npmignore`（均 0 引用，且与 `private: true` 矛盾），
  以及跑不通的 `build:lib` 脚本（其目标 `src/components/es-eui/index.js` 不存在）。
  `/test/recharge-record` 已从路由表移除 —— 该能力有专用 CI 覆盖
  （`__tests__/e2e-runtime/tests/vue2-crud.spec.ts`）；页面本身保留为参考示例，
  移至 `src/examples/vue2-compat/`，其「数据源是外部公开 API」一事写进了文件头注释。
- 孤儿业务代码（`views/salesPolicy`、内网域名）在更早一轮已清除。

---

## 一、P0 — 真实缺陷，影响对外可信度

### 1. 核心卖点「同一份配置三端渲染」没有渲染证据（跨站）⬜

- `docs/tri-render/` 只有 `README.md` + `schema.json`，**三站 PNG 数量均为 0**（实测）。
- 三站 `TriRenderTabs` 用 `import.meta.glob('*/tri-render/*.png')` 取图 → 恒空 → **永远显示占位图**：
  `es-plus-docs/src/components/home/TriRenderTabs.vue:49`、`es-pc/src/components/TriRenderTabs.vue:44`、
  `es-eui/src/components/TriRenderTabs.vue:46-51`。
- 生成脚本 `scripts/gen-tri-render-snapshots.mjs` 依赖 Playwright（未列入 devDeps），
  **任何 workflow 都未调用**；设计文档 `docs/改造三端站点.md` 却写明「纳入 CI」。
- `scripts/sync-tri-render.mjs` 实际只分发 1 个文件 → 门禁恒绿（空转）。
- 脚本截取目标是各站**首页**而非「同一案例」的三端渲染，即便生成也证明不了同构。
- `es-pc/src/views/Home.vue:55` 默认 `active='vue3'`，AntDV 站点首屏展示的是别端占位图。

### 2. 主文档站指南互链全断 ⬜

- 路由是 hash 模式：`es-plus-docs/src/router/index.ts:53` `createWebHashHistory()`。
- 但 md 里写绝对路径链接，如 `es-plus-docs/src/docs/changelog.md:71`、`crud-page.md:568`、
  `getting-started.md`、`getting-started.en.md:8` 等大量 `](/guide/xxx)`、`](/components/xxx)`。
- `Doc.vue` 只重写 demo/标题、不重写链接 → 点击整页跳转 → 404 / 回首页。**影响所有指南互链。**

### 3. AI CRUD 默认必然失败 ⬜

- `es-plus-docs/src/views/AiCrud.vue:170-173` 默认 `baseUrl=https://api.openai.com/v1`；
  `mcp-flow.ts:204` 在浏览器里直接 `fetch`。
- `es-plus-docs/vite.config.ts` 无任何 `server.proxy`；OpenAI 不返回 CORS 头 →
  默认配置下 AI 生成路径对用户不可用。

### 4. 主站 schema 是第三/四份手写副本，不受单源门禁 ⬜

- `es-plus-docs/src/schemas/` 与 `es-plus-docs/public/schemas/` 各 3 个文件，
  **不在** `scripts/sync-schemas.mjs:26-30` 的 `TARGETS` 内。
- 相对权威 `packages/shared/schemas/form-item.schema.json` **缺十余个字段**
  （`props`/`required`/`rules`/`render`/`httpRequest`/`width`/`isInitRun`…），两份 es-form 彼此也不一致。
- Playground 用 src 副本校验（`es-plus-docs/src/views/Playground.vue:166-168`）
  → **合法配置被判非法**。

### 5. es-pc 示例用 Element-only 属性，静默失效 + 适配器缺口 ⬜

- `clearable: true`（`es-pc/src/views/es-vxe/ProxyConfig.vue:28,31`）：ADV Select 只认 `allowClear`。
- `filterable: true`（`es-pc/src/views/es-form/AsyncOptions.vue:48,113,171`、
  `es-pc/src/views/es-form/CustomRender.vue:94`）：ADV 只认 `showSearch` → 远程搜索示例不可用。
- `autoUpload: false`（`es-pc/src/views/es-advanced/CrudPage.vue:208`、
  `es-pc/src/views/es-crud/CustomRender.vue:57`）：ADV Upload 无此 prop → 选中即向 `action:'#'` 发请求。
- **适配器缺口**：`renderDatePicker` 做了 `start-placeholder/end-placeholder` 映射
  （`packages/adapter-antdv/src/composables/use-form-inputs.ts:572-586`），
  但 `renderTimePicker` 未做 → TimePicker range 占位符被当未知 attr 丢弃。

### 6. 三站零测试、零 PR 构建门禁 ⬜

- 三站均无 test 脚本；`check:consistency` 只校验文本漂移、不构建站点。
- 站点构建只出现在 `.github/workflows/deploy-docs.yml`（master 部署时）→
  路由/别名/配置回归只能在合入 master 后暴露。
- `es-eui` 被根 `eslint.config.mjs` 显式 ignore。

---

## 二、P1 — 真实缺陷，影响体验 / 维护

### 7. 无分包、体积失控 ⬜

- es-pc：`dist/assets/index-*.js` **3.88 MB**、CSS 593 KB；`es-pc/vite.config.js` 无 `manualChunks`，
  `es-pc/src/main.js:2,18` 全量 `app.use(Antd)`。
- es-plus-docs：dist 20 MB，`index` 2.8 MB（全量 Element Plus + 全部图标）、
  `Playground` 3.8 MB、monaco `ts.worker` 7 MB。

### 8. es-eui 合并遗留债 ⬜

- 旧「独立 npm 包」残留（与 `private:true` 现状矛盾）：`package.lib.json`（name `es-eui`、
  private:false、unpkg/jsDelivr）、`PUBLISH_GUIDE.md`、`vue.lib.config.js`、`scripts/publish*.bat`、
  `test-project/`（依赖 `es-eui@^1.0.0`、`file:../dist`）、`plans/`、`PAIN_POINT_ANALYSIS.md`、
  `LIBRARY_README.md`；`README.md`(1518 行) 与 `README_DETAILED.md`(1433 行) 重复。
- 孤儿业务代码：`es-eui/src/views/salesPolicy/*` 未被任何路由引用，硬编码内网域名
  `https://wdshop-be.szlanyou.com/...`（`salesPolicy/components/EditorToobar.vue:162,185`、
  `policyForm.vue:691`）；`es-eui/src/views/test/RechargeRecord.vue` 反被路由 `/test/recharge-record`
  暴露到公网（`src/router/index.js:130`）且含 TODO:237。
- 死文件 `es-eui/src/utils/server/index.js`（从未 import），含硬编码生产域
  `https://dfac-wx.dfwxfw.com`、错乱正则。

### 9. es-eui 运行期 bug ⬜

- **环境变量失配**：`es-eui/.env.development` 定义 `VUE_APP_BASE_API`，
  但 `es-eui/src/utils/server/request.js:8-10` 读 `process.env.BASE_API` / `VUE_APP_URL`
  → dev 下 `baseURL` 为 `undefined`。
- 死路由：`es-eui/src/views/theme/index.vue:17` → `/theme/preview`，router 未定义。
- favicon 404：`es-eui/public/index.html:7` 引用不存在的 `favicon.ico`。

### 10. 死链 / 错链 ⬜

- es-eui：`src/App.vue:59` → `https://github.com`；`src/views/guide/quickstart.vue:696`、
  `src/views/home/index.vue:520` → 已被并入的 `github.com/liujiaao/es-eui`。
- es-pc：`src/layouts/DocLayout.vue:26` → `https://github.com`；
  `src/views/EsVxeTable.vue:148`「vxe-table 文档」实际指向 es-plus 主站根。
- 主站 sitemap：`es-plus-docs/vite.config.ts:8` `SITE_HOSTNAME='https://es-plus.dev'`
  与实际 `liujiaao.github.io/es-plus/` 不符；`sitemapRoutes` 含 `'/'` 致根 URL 重复
  （本机 `dist/sitemap.xml` 已复现）。

### 11. 单源门禁有洞、注释失真 ⬜

- `sync-tokens.mjs:39-41`、`sync-brand.mjs:42-44`、`sync-cases.mjs:42-44`、`sync-ai.mjs:42-44`、
  `sync-theme.mjs:42-44`、`sync-tri-render.mjs:51-52` 注释「es-eui/ 被 .gitignore」——
  事实是 es-eui 已跟踪 177 文件、被构建部署。
- 这些脚本 `!existsSync(target) → continue`，导致「es-eui 目标被删」时**静默跳过校验**。
- 三站站点切换器 `SITES` 数组为**三份手写复本**（`es-plus-docs/src/components/layout/AppHeader.vue:81-84`、
  `es-pc/src/layouts/DocLayout.vue:138-141`、`es-eui/src/App.vue:137-140`），无 sync、无 check。

### 12. schema `$id` 旧域名 ⬜

- `packages/shared/schemas/*.schema.json:3` 全为 `https://es-plus-ui.github.io/schemas/...`，
  随 `sync-schemas.mjs` 分发到 vue3 / adapter-antdv / mcp-server。

### 13. 死代码 / 误导 ⬜

- 主站 `es-plus-docs/src/components/es-plus/`（2023 年旧组件源码副本，约 28 文件）**全库 0 引用**。
- `es-plus-docs/src/main.ts:19` import 旧包名 `es-plus-ui/dist/style.css`
  （源码模式下被 alias 到空文件，纯误导）。
- `es-plus-docs/src/utils/shared-browser.ts` facade 相对 `packages/shared/src` 漏了一批导出
  （`createSchemaValidator`/`validateConfig`/`listAvailableSchemas`/`buildNlToConfigSystemPrompt` 等）。

### 14. es-pc 依赖 / 文案问题 ⬜

- `dayjs` **未声明**，但 `es-pc/src/main.js:5` 直接 `import 'dayjs/locale/zh-cn'`；
  靠 ant-design-vue 提升侥幸可用，`npm ci` 若嵌套即挂。
- 首页版本号硬编码过期：`es-pc/src/views/Home.vue:187` adapter 标 `1.0.0`（实际 1.1.0）、
  `:188` core 标 `1.0.1`（实际 1.1.0）；`es-pc/src/layouts/DocLayout.vue:29` 固定 `v1.0.0`。
- 文案仍写 Element 术语：`es-pc/src/views/EsVxeTable.vue:178-179`（el-table / el-table-v2）、
  `es-advanced/AutoFitHeight.vue:27`、`ConditionalBtns.vue:13`、`CrossPageSelect.vue:23`。
- `es-pc/src/views/es-form/FileUpload.vue:137` 注释称「无 el-upload 的 limit/onExceed」，
  但适配器已支持 `limit→maxCount`。

### 15. 外网 mock 不可靠 ⬜

- `es-pc/src/views/es-form/AsyncOptions.vue:52,118,176`、`es-table/Pagination.vue:25,58`
  直连 `jsonplaceholder.typicode.com`，断网/被墙时静默空，无本地兜底。
- `es-pc/src/views/es-table/Custom.vue:32-35` 头像用 `cube.elemecdn.com`。

---

## 三、P2 — 设计取舍 / 低危

- 三站各自独立 `node_modules` / `package-lock.json`（根 + 3 站共 4 份），版本轻微漂移
  （vue 3.5.29 vs 3.5.38）；仅主站有 sitemap；GitHub Pages + 腾讯云双部署，CI 只管 GH Pages。
- es-eui：186 处 `console.*`；`es-eui/src/main.js:120-123` 吞掉所有 `unhandledrejection`；
  `transpileDependencies:false` / `parallel:false` / `devtool:false` 牺牲 DX；
  `PUBLIC_PATH` 本地根路径 vs CI 子路径。
- `es-eui/src/examples/raw-sources.generated.js`（≈300 KB + 时间戳）入库，
  每次 build 弄脏工作树并把全部示例源码塞进 bundle。
- `es-plus-docs/src/views/Playground.vue:316` 用 `new Function(...)` 求值用户输入（自输自跑，风险低）。

---

## 四、单源同步覆盖现状

| 脚本 | 源 | 目标 |
|---|---|---|
| `sync-docs` | `docs/*.md`（重叠文件，当前 2 个） | es-plus-docs/src/docs |
| `sync-tokens` / `sync-brand` / `sync-cases` / `sync-ai` | 根对应源 | 三站 `src/{styles,assets,brand,cases,ai}` |
| `sync-theme` | 根 theme | es-plus-docs/es-pc styles、es-eui assets |
| `sync-tri-render` | `docs/tri-render/` | 三站 `src/tri-render`（实际只 schema.json） |
| `sync-schemas` | `packages/shared/schemas` | vue3 / adapter-antdv / mcp-server（**不含文档站**） |

**不在同步范围、各站手写（漂移高发区）**：三站全部 views/components/router/locales、
`SITES` 数组、主站除 2 个重叠文件外的全部 `.md`、es-pc 全部文档页、es-eui 整套示例与首页文案、
sitemap/robots、README、package 版本；以及主站的 `src|public/schemas`（问题 #4）。

---

## 五、修复优先级建议

1. **用户必撞**：#2 指南互链 · #3 AI CRUD · #4 Playground schema · #5 es-pc 属性 + TimePicker 映射。
2. **最小门禁**：#6 PR 构建三站 · #1 tri-render 生成纳入 CI 并改成「同一案例」。
3. **单源收口**：#4/#12 schema · #10 sitemap host · #11 SITES 数组与 sync 脚本注释/静默跳过。
4. **清债**：#13 主站死副本 · #8/#9 es-eui 发布残留 / 孤儿代码 / 运行期 bug · #14 es-pc 依赖与文案。
5. **性能**：#7 `manualChunks` + 按需引入。
