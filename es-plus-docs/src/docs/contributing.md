# 贡献指南

这份页面是 `CONTRIBUTING.md` 的站点版：本地开发、提交前必须跑什么、加一篇文档要改哪几处。仓库根目录那份是权威版本，两者冲突时以它为准。

## 环境与首次安装

```bash
git clone https://github.com/liujiaao/es-plus.git
cd es-plus
npm install --legacy-peer-deps
npm run build:packages
npm test
```

`--legacy-peer-deps` 不是可选项：monorepo 根同时存在 element-ui（Vue 2）与 element-plus（Vue 3）两条 peer 链，npm 7+ 的严格解析会直接拒绝。

`npm run build:packages` 按依赖拓扑构建全部可发布包：`schemas:sync → core → shared → vue3 → vue2 → adapter-antdv → cli → mcp-server`。

> 消费包（vue2 / vue3 / adapter-antdv / cli / mcp-server）通过 `pretest` / `pretypecheck` / `prebuild` 钩子自动构建 `@es-plus/core` 与 `@es-plus/shared`。但有些脚本直接读**构建产物** `packages/*/build/`（例如 `npm run eval:llm`、三端 e2e），改了 core / shared 的源码之后先跑 `npm run build:libs`。新增消费包时三个 `pre*` 钩子都要接上 —— 曾因漏接 `prebuild` 让 CI 的 e2e 全挂。

## 跑测试与守卫

| 命令 | 跑什么 | 什么时候跑 |
|---|---|---|
| `npm test` | 全部包的单元测试 | 任何改动 |
| `npm run test:e2e` | vue2 / vue3 / antdv × schema / sfc 的 e2e 矩阵 | 动了渲染层、schema 或生成器 |
| `npm run check:consistency` | 九十余条守卫串联（契约、生成器、站点声明、SEO、导航…） | 提交前；整条跑一遍约十分钟 |
| `npm run check:prerender` | 内容页静态 HTML 是否与数据源一致 | **构建之后**，改了任何文档或注册表 |
| `npm run check:bundle-budget` | 三站首屏 JS 的实际重量 | **构建之后**，动了依赖或入口 |

后两条需要构建产物，不在 `check:consistency` 链里 —— 这是刻意的：consistency 要能在没有 dist 的干净检出上跑完。

守卫失败时先读它的文件头：每条 `scripts/check-*.mjs` 的第一段都写着它守的是哪个**已发生的**缺陷。修法是修那个缺陷，不是放宽断言；确实要放宽，就在同一个文件里写清理由（多数守卫的阈值旁边就有先例）。

## 三个文档站

三个站点都不在根 `workspaces` 内，各有独立的 `node_modules` 与 lock，通过 `file:` 依赖 + 构建器 alias 指向本地包：

| 站点 | 技术栈 | 构建 |
|---|---|---|
| `es-plus-docs` | Vue 3 + Vite + Element Plus | `cd es-plus-docs && npm run build`（含预渲染） |
| `es-pc` | Vue 3 + Vite + Ant Design Vue | `cd es-pc && npm run build` |
| `es-eui` | Vue 2.6 + vue-cli / webpack + Element UI | `cd es-eui && npm run build` |

站点构建必须 `cd` 进目录再跑 —— 在仓库根执行不会构建站点。`es-eui` 的 `dist` 有时被本地开发服务器占着句柄，那时用 `npx vue-cli-service build --dest dist-verify`，称重时加 `BUDGET_DIST=dist-verify`，用完删掉。

## 加一篇指南要改哪几处

指南的正文与它的入口住在五个地方，漏掉任何一处都会以「静默错误」的形式出现（页面能开，但搜索搜不到、或者侧栏没入口、或者上下篇跳错）：

1. **正文**：`es-plus-docs/src/docs/<slug>.md`，H1 是标题，第一段会成为描述（`llms.txt`、预渲染页的 `description`、搜索摘要都用它）。
2. **注册表**：`es-plus-docs/src/docs/doc-registry.ts` —— `import` 原文加 `docsData` 里的条目。这里才是「可访问的 `/guide/:slug`」的唯一来源。
3. **侧栏**：`es-plus-docs/src/components/layout/AppSidebar.vue` 的分组里加 `{ path, labelKey, icon }`。
4. **两份词条**：`src/locales/zh-CN.json` 与 `en-US.json` 的 `sidebar.*`。只加一份，另一种语言下会出现裸 key；`npm run check:nav-coverage` 会红。
5. **上下篇顺序**：`es-plus-docs/src/views/Doc.vue` 的 `NAV_ORDER`，与侧栏阅读顺序一致。

然后重新生成站点产物并校验：

```bash
npm run sitemap:gen && npm run site-seo:gen && npm run llms:gen
cd es-plus-docs && npm run build && cd ..
npm run check:nav-coverage && npm run check:sitemap && npm run check:llms
npm run check:site-seo && npm run check:prerender
```

文档里的数字会被 `npm run check:site-claims` 与源码对账（例如「N 种控件」必须等于 `VALID_FORM_TYPES` 的实际长度）。写一个漂亮的数字之前，先确认它是从代码里数出来的。

## 提交规范

[Conventional Commits](https://www.conventionalcommits.org/)，中文描述为主。type 用 `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `release`；scope 限定为包名（`core` / `shared` / `vue2` / `vue3` / `antdv` / `legacy` / `cli` / `mcp-server` / `docs` / `e2e` / `ci` / `deps`）。

```text
fix(vue2): inline @vue/composition-api into dist to fix UNRESOLVED_IMPORT
feat(mcp-server): add --diagnose subcommand for self-check
docs(vue2): clarify auto polyfill management since 1.1.0
```

**按主题分批提交**：一个提交只做一件事。修守卫顺带改了三处文案，评审时就没法只回退其中一处。

## PR 准入

必须满足：

- CI 全绿（typecheck、e2e、consistency 校验）。
- 改动有对应测试：bug 修复配回归测试，新功能配行为测试。
- 破坏性变更在 PR 描述里显式标 `BREAKING CHANGE:` 并写迁移路径。
- 涉及发布的改动同步 changeset（`npx changeset`）。
- 对外 API 改动同步 `es-plus-docs` 的文档。

评审重点关注：类型契约（`@es-plus/core/types` 影响三个渲染层）、包体积（vue2 / vue3 / adapter-antdv 的 dist 增长超过 10% 需要解释，超过 30% 视同 `minor`）、跨包 peer 依赖范围的一致性。

## 写新代码时的四条约定

1. 新功能优先放 `core`，让三个渲染层自动获得。
2. 渲染层差异走 adapter 模式，各端实现统一接口。
3. 配置 schema 里不放只有单一渲染器才有的字段 —— 除非有明确的 fallback。
4. 破坏性变更至少经过一个 minor 版本的 deprecation。

## 发布与版本

changesets 管理版本，GitHub Actions 走 OIDC 发布（本地 `changeset publish` 必然 403）。联动与独立版本的划分、预发布流程、版本号规则，见 [路线图与版本策略](/guide/roadmap) 与仓库的 `RELEASE.md`。

## 报 bug 与提需求

GitHub Issues：<https://github.com/liujiaao/es-plus/issues>。Bug 报告请带：版本号、渲染端、最小配置片段。首响应 72 小时（工作日）；安全漏洞走 `SECURITY.md`，24 小时首响应。

提交 PR 即表示同意贡献内容以 MIT 许可发布。

## 继续读

- [路线图与版本策略](/guide/roadmap) —— 队列里在做什么、为什么那个顺序
- [性能与准确率基准](/guide/benchmark) —— 动体积或准确率之前，先知道数字怎么来的
- [常见问题](/guide/faq) —— 使用侧的问题，不是开发侧
