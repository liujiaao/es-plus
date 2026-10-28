---
title: 'Vue 2 支持周期'
route: '/guide/vue2-eol'
canonical: 'https://liujiaao.github.io/es-plus/guide/vue2-eol/'
source: 'es-plus-docs/src/docs/vue2-eol.md'
type: 'guide'
---
# Vue 2 支持周期

Vue 2 已于 2023-12-31 停止官方维护。这是一个既定事实，它决定的是「新项目该不该从 Vue 2 起步」，不决定「存量项目能不能继续用 ES-Plus 的 Vue 2 渲染端」。这一页把两件事分开说清：仓库现在**实际**支持什么（可验证），以及为什么仍然这么做（代价也写出来）。

## 官方时间线

| 事件 | 时间 | 意味着什么 |
|---|---|---|
| Vue 2 最后一个 minor（2.7）发布 | 2022-07 | 组合式 API 进入 Vue 2 本体，不再需要 `@vue/composition-api` 插件 |
| Vue 2 进入维护期 | 2023-01 起 | 只修安全与严重缺陷，不再有新特性 |
| Vue 2 **停止维护**（EOL） | **2023-12-31** | 不再有官方补丁，包括安全修复 |

Vue 3 是唯一继续演进的版本线。这不代表跑在 Vue 2 上的系统第二天就坏了，而是说：此后发现的任何框架级问题，都不会有人来修。

## 仓库现在实际支持什么

这些是可以从 `packages/vue2/package.json` 直接读出来的事实：

| 项 | 值 |
|---|---|
| 包名 | `@es-plus/vue2` |
| Vue peer 范围 | `^2.6.14 \|\| ^2.7.0` |
| Element UI peer | `^2.15.0` |
| 组合式 API | `@vue/composition-api ^1.7.0`（Vue 2.6 需要；Vue 2.7 不需要） |
| vxe-table | `>=3.5.0 <4.0.0`（可选 peer，只有 `engine: 'vxe'` 用到） |
| 与 Vue 3 端的关系 | 同一份配置 schema，跨端契约由 `packages/shared/src/contract.ts` 与 `npm run check:schema` 守住 |
| 测试覆盖 | `npm run test:e2e` 的三端矩阵包含 vue2（schema 与 sfc 两种模式） |

第三端 Ant Design Vue 的文档站不依赖 Vue 2，但主站的 Vue 2 文档站（`es-eui`，Vue 2.6 + Element UI）本身就跑在 Vue 2 上 —— 如果 Vue 2 渲染端坏到不能用，那个站会先露馅。

## Vue 2.7 与 2.6 的差别（最容易踩的一处）

- **Vue 2.7**：组合式 API 内置。升级到 `@es-plus/vue2` 1.1.0+ 之后，**删掉** `main.js` 里的 `Vue.use(VueCompositionAPI)` —— 保留它会在 Vue 2.7 上触发 `setup()` 双跑警告。
- **Vue 2.6**：必须装 `@vue/composition-api`（它是 peer 依赖，不装则组件的组合式逻辑无从运行）。

两条都在 [安装](/guide/installation) 的 Vue 2 一节里，与 peer 版本范围写在同一个地方。

## 仍然支持 Vue 2 的理由与代价

**理由**：存量系统大量停留在 Vue 2 + Element UI（政企内网、审批流、运维后台）。对这些项目，「升级框架」不是一次技术选型，而是一轮没人批准的重写。让它们在**不换框架**的前提下拿到配置驱动的收益，是 `@es-plus/vue2` 存在的全部意义。

**代价，写在这里**：

- 修复只能落在本库这一层。Vue 2 或 Element UI 自身出的问题，没有上游可依赖。
- 同一个 bug 要修两遍（Vue 3 端与 Vue 2 端），跨端契约能保证「配置语义一致」，保证不了「实现只有一份」。
- 生态在收缩：新工具的 Vue 2 支持会越来越少，未来某个依赖先掉队是必然的。

## 什么时候该迁到 Vue 3

不是「现在」，而是出现下面任意一条的时候：

1. 你依赖的某个库停止支持 Vue 2，且没有替代品；
2. 你需要在 Vue 2 里修一个上游缺陷，而上游已经不收补丁；
3. 你的团队有新项目要起在同一个代码库里，而新项目没有理由从 Vue 2 开始。

迁移路径是**换渲染端而不是改页面**：`@es-plus/vue3` 与 `@es-plus/vue2` 吃同一份配置，字段、列、弹窗、权限的写法不变；要改的是组件库（Element UI → Element Plus）与周边（路由、状态、构建）。包名与 API 的迁移见 [迁移指南](/guide/migration)，Vue 2 端的用法与限制见 [Vue 2 指南](/guide/vue2)。

## 承诺的边界

- 不承诺 `@es-plus/vue2` 与 Vue 2 一起退役的具体日期 —— 没有谁能替使用方决定那一天。
- 不承诺 Vue 2 端会获得**只有 Vue 3 才有**的新能力。新特性先落在 Vue 3 端与共享契约层，Vue 2 端跟进的是「配置语义」那部分。
- 承诺的是：Vue 2 端存在期间，`npm test` 与三端 e2e 矩阵包含它 —— 它不会在没有测试的情况下悄悄坏掉。版本节奏见 [路线图与版本策略](/guide/roadmap)。

## 继续读

- [Vue 2 指南](/guide/vue2) —— 渲染层差异与完整示例
- [迁移指南](/guide/migration) —— 包名、API 与 Element UI → Element Plus
- [常见问题](/guide/faq) —— 「Vue 2 还能用吗」的简短回答
