# 路线图与版本策略

这一页回答两个问题：「接下来做什么」和「版本号怎么走」。原则只有一条 —— **写在这里的事要么有守卫脚本，要么有明确的验收口径**；没有验收口径的想法不进路线图，因为它无法被完成，只能被遗忘。

## 三条工作原则

1. **可验证优先。** 一个功能合入时如果没有任何脚本能判它「坏了」，那它下一次坏掉时也没人知道。仓库现在的守卫清单比功能清单长，这是刻意的。
2. **数字必须带口径。** 对外说的每个数字都要有来源文件、测量方法与日期。站点的数字由 `npm run check:site-claims` 与源码对账，不一致就红。
3. **没做完的部分要写出来。** 「首屏 650 KB，目标 300 KB，还差的就是 Element Plus 一笔全量注册」比「性能优异」有用。

## 已经落地的事（可逐项验证）

| 能力 | 验收它的是 | 说明 |
|---|---|---|
| 每个内容页一份静态 HTML | `npm run check:prerender` | 构建期生成 `/guide/x/`、`/components/x/`、`/advanced/x/`，深链 200，正文来自站点同一渲染器 |
| 每页 canonical + 结构化数据 | `npm run check:site-seo`、`npm run check:page-meta` | 文章类路径式地址与 sitemap / llms / JSON-LD 四处同口径 |
| AI 可读的文档 | `npm run check:llms` | 根目录 `llms.txt` 索引 + 每页 markdown 镜像，取自同一份源 |
| 首屏预算 | `npm run check:bundle-budget`、`npm run check:bundle-sources` | 前者对构建产物称重（含「`/guide/*` 闭包里不许出现 `vxe-*.js`」），后者在源码层挡「换一行 import 就多 300 KB」与「vxe 被引回入口」 |
| 三站一致的动效语言 | `npm run check:motion` | 120 / 180 / 240ms 三个 token，禁 `transition: all`、禁对布局属性做过渡 |
| 三站一致的页脚与导航 | `npm run check:site-nav`、`npm run check:nav-coverage` | 导航里的每一条都得落到真实路由，每个路由都得有入口 |
| 生态内容（本页所在的一组） | `npm run check:nav-coverage`、`npm run check:sitemap` | FAQ、对比、基准、路线图、Vue 2 周期、贡献指南 |

完整的守卫清单在仓库 `package.json` 的 `check:*` 脚本里 —— 九十余条，每一条的文件头都写了它守的是哪个已发生的缺陷。

## 正在做的事

### 1. 指南正文改成按 slug 惰性加载

全站搜索索引以 `doc-registry` 为数据源，而注册表是静态导入 —— 结果是**每一篇指南的正文都在每一个 `/guide/*` 的首屏里**。本轮新增六篇内容让这一块从 198.2 KB 涨到 216.0 KB（+17.8）。修法是把正文改成按 slug 惰性加载（示例注册表已经是这个形状），搜索索引改在第一次打开搜索时才建；因为它会改变文档页的渲染时机与搜索的首次可用时间，需要浏览器逐页核对，所以没有被顺手塞进内容批次。

### 2. 首屏按需引入（vxe 已落地，Element Plus 未完成）

现状约 650 KB gz（这批文档让它在 650–652 KB 之间浮动），目标 300 KB。vxe-table 那 344.2 KB 已经从首屏拿走：只有在 `/advanced/vxe-table` 与 `/ai-gallery/<id>` 才会注册，改的是「路由门前动态 import + 一份要和数据对得上的路由清单」。剩下的是 Element Plus（356.2 KB）全量注册，它的失败模式是**页面看起来正常、某个组件突然不渲染**，必须逐页在浏览器里核对 —— 所以它还没有为了数字好看先合进去。两笔都由 `npm run check:bundle-sources`（源码层）与 `npm run check:bundle-budget`（产物层）守着。口径见 [性能与准确率基准](/guide/benchmark)。

### 3. 渲染性能的测量装置

现在没有。要落到「基准」两个字上，先要有固定设备、固定浏览器、固定数据规模的装置（首帧耗时、千行表格滚动帧率）。在装置存在之前，这一项不会有数字。

### 4. 生成准确率的语料与尺子

准确率不是模型单方面的成绩，语料与判定口径决定一半。正在做的是让每条判据都能被复读：golden 的每个「没写」与「写了 false」都要有依据，尺子本身的缺陷要有回归测试。实时数字见 [片段拼装看板](/fragment-dashboard)。

## 明确不做的事

- **不做低代码平台**。没有可视化搭建器，没有服务端渲染引擎。JSON 描述 CRUD 页面，渲染在你自己的 Vue 工程里。与 amis 这类「整页 DSL + 平台」的边界见 [与其它方案对比](/guide/comparison)。
- **不引入第二套组件体系**。渲染端就是 Element Plus / Element UI / Ant Design Vue —— 这是「同一份配置三端可用」成立的前提，换掉它等于换掉产品。
- **不承诺未实测的性能数字**。文档里的每个性能说法都要能指向一条命令。
- **不接任意布局编排**。仪表盘、大屏不在 schema 的表达范围里，也不打算扩进去。

## 版本策略

版本与发布由 [changesets](https://github.com/changesets/changesets) 管理，规则写在 `RELEASE.md`。

### 谁和谁一起走

| 组 | 包 | 规则 |
|---|---|---|
| 联动（`linked`） | `@es-plus/shared`、`@es-plus/mcp-server`、`@es-plus/cli` | 任一包发版，三者自动同步到相同版本号；只有实际变更的包会被发布 |
| 独立版本 | `@es-plus/vue3`、`@es-plus/vue2`、`@es-plus/core`、`@es-plus/adapter-antdv` | 互不影响，各自演进 |
| 冻结 | `es-plus-ui`（`packages/es-plus-legacy`） | 已被 changesets 的 `ignore` 冻结：不再升版、不再发布 |

**三端渲染器的版本号不同不是 bug**：`@es-plus/vue3` 与 `@es-plus/vue2` 的活跃度本就不同，强行同步版本号只会让「这个版本号意味着什么」变得不可读。跨端契约的兼容性由 `packages/shared/src/contract.ts` 与 `npm run check:schema` 守，不由版本号暗示。

Vue 2 端的支持期限、代价与迁移时机单独成页：[Vue 2 支持周期](/guide/vue2-eol)。

### 版本号怎么定

| 变更 | 级别 | 示例 |
|---|---|---|
| 修 bug、文档更新 | `patch` | 1.0.0 → 1.0.1 |
| 新功能、新工具 | `minor` | 1.0.0 → 1.1.0 |
| 破坏性 API 变更 | `major` | 1.0.0 → 2.0.0 |

破坏性 **schema** 变更时，`@es-plus/vue3` 与 `@es-plus/adapter-antdv` 应同步升 major —— 两者共享同一份配置 schema。

### 发布流程

发布由 GitHub Actions 走 npm Trusted Publishing（OIDC）完成，**不在本地 `changeset publish`**（本地 token 的写操作被 registry 限制，必然 403）。流程是：`npx changeset` 记录变更 → `npx changeset version` 升版本并提交 → 在 Actions 里手动触发 Publish。工作流会拒绝「有未消费 changeset」的状态，避免 `changeset publish` 以「无可发布包」退出码 0 造成的假绿灯。细节见 `RELEASE.md`。

### 预发布

`npx changeset pre enter beta` 进入预发布模式，版本形如 `1.1.0-beta.0`；`npx changeset pre exit` 退出。适合需要真实项目先试一轮的改动。

## 怎么影响这份路线图

- 用 bug 报告推开队列前头：能复现的 issue 优先于任何新特性。入口见 [常见问题](/guide/faq) 里的链接。
- 想加一项：先在 issue 里写清**验收口径**（哪条命令、哪个断言、什么数字）。没有验收口径的条目会被挂起，这不是流程官僚 —— 它决定这件事会不会被真的做完。
- 想动手：先读 [贡献指南](/guide/contributing)，尤其是「提交前必须跑什么」那一节。
