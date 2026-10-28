# 常见问题

按主题分组的实际提问，答案都指向仓库里可验证的地方：出问题的源码、跑得起来的命令、写死在代码里的边界。每一条都写明「为什么会这样」，而不是只给一个能糊过去的办法。

## 安装与依赖

### 安装时为什么需要 `--legacy-peer-deps`？

本仓库自己是 monorepo，根 `package.json` 里同时存在 `element-ui`（Vue 2）与 `element-plus`（Vue 3）两条 peer 链，npm 7+ 的严格 peer 解析会直接拒绝，因此仓库的安装命令是 `npm install --legacy-peer-deps`（见 `CONTRIBUTING.md`）。作为使用方，一个前端项目只装一个渲染端 —— `@es-plus/vue3` 配 `element-plus`，或 `@es-plus/vue2` 配 `element-ui` —— 就不会触发同类冲突。

### `es-plus-ui` 和 `@es-plus/vue3` 是什么关系？

`es-plus-ui` 是 1.4.0 之前的旧包名。从 1.4.0 起改名为 `@es-plus/vue3`，`es-plus-ui@1.4.0` 只保留一个 stub（再导出 `@es-plus/vue3`）并且已经被 `npm deprecate`。新项目直接装 `@es-plus/vue3`；老项目按 [迁移指南](/guide/migration) 改 import。

### 必须装 vxe-table 吗？

不必须。`vxe-table` 是可选 peer 依赖：Vue 3 端要求 `>=4.5.0 <5.0.0`，Vue 2 端要求 `>=3.5.0 <4.0.0`，两端的 `peerDependenciesMeta` 都把 `vxe-table` 标为 `optional`。只有给 EsTable 配了 `engine: 'vxe'` 才会用到它；没有注册时表格会渲染一个明确的提示框，而不是白屏或报错。用法见 [高性能 vxe-table 表格](/advanced/vxe-table)。

### Element Plus / Element UI 需要哪个版本？

`@es-plus/vue3` 的 peer 是 `vue ^3.2.0`、`element-plus ^2.2.0`；`@es-plus/vue2` 的 peer 是 `vue ^2.6.14 || ^2.7.0`、`element-ui ^2.15.0`、`@vue/composition-api ^1.7.0`。版本范围写在各自的 `packages/*/package.json` 里，不在文档里另立一份。

## 用法与配置

### 完全不想写模板，只给一份 JSON 能做到吗？

能，那是这个库的定义。`EsCrudPage` 收一份配置（查询字段、表格列、弹窗字段、操作按钮）直接出整页；`EsForm` / `EsTable` 可以单独用，按同一套字段与列的写法。三种接入模式（全量注册、自动按需导入、手动按需）见 [使用](/guide/usage)。

### 字段联动为什么没生效？

联动是 `reactions` 的活，它是**纯 JSON 规则数组**，不是回调：`dependencies` 声明触发重算的 model 路径，`when` 门控，`fulfill` 写 `dataOptions` / `required` / `disabled` / `value`。两个常见错因：一，`fulfill.value` 存在时 `dependencies` 必填，漏写会让任何 model 变更都重算并覆盖用户手改；二，`reactions` 是**表单作用域**（查询表单与新增/编辑弹窗），不作用于表格列 —— 想让列里的值变化，得走弹窗表单。见 [高级联动组合](/advanced/linkage)。

### 弹窗怎么打开？必须写 `el-dialog` 吗？

不必。`useDialog` 是编程式的：传 `title`、`formItems`、`configBtn` 就得到一个带表单的弹窗，`click` 回调里拿到 `close` 等方法。原来手写的 `visible` 状态、`@close` 重置、按钮 loading 都由它承担。见 [useDialog 弹窗](/advanced/use-dialog)。

### 表格列里的码值怎么显示中文？

用列的 `dataOptions` 映射，而不是在模板里写 `v-if` 链：`{ prop: 'status', label: '状态', dataOptions: [{ label: '启用', value: 1 }] }`。空值另有占位口径，不需要每个单元格再兜一次。

## 权限与国际化

### 按钮权限怎么配？

安装时传 `permission` 函数（收权限标识，返回布尔），然后在按钮上写 `permissionValue`：`{ name: '删除', permissionValue: 'user:delete', click: handleDelete }`。`permission` 返回 false 时按钮自动隐藏，不用手写 `v-if`。覆盖位置有四处：EsForm 的 `configBtn`、EsTable 的 `options.configBtn`、表格 `columns[].btns`、useDialog 的 `configBtn`。见 [权限与国际化](/guide/permission-i18n)。

### 没传 `permission` 会怎样？

所有按钮默认显示，`permissionValue` 被忽略 —— 这是刻意的向后兼容行为，不是漏判。所以「配了权限却全都可见」的第一件事是确认 `app.use(ESPlus, { permission })` 真的传进去了。

### 权限改了要刷新页面吗？

不要。`permission` 函数在每次渲染时调用，把权限集合做成响应式（`reactive(new Set(...))`）之后增删会自动生效。

### 文案怎么国际化？

同样走配置：字段的 `label` 可以给 i18n key，列头同理，渲染时用站点自己的 `$t` 解析；不接 vue-i18n 时按原文输出。回退规则与不接入的写法见 [权限与国际化](/guide/permission-i18n)。

## AI 生成

### AI 生成的配置编译不过怎么办？

三条生成路径的可靠性不同，先确认走的是哪条：`--from-config`（结构化配置 → 确定性生成器，能否编译由构造保证）> `--ai`（LLM 推理 + Zod 校验 + 最多 2 次自修复）> 内置关键词生成器（兜底，仅够原型）。`--ai` 路径下 SDK 未装、key 缺失或调用失败会**自动降级**到内置生成器并打印实际走了哪条路，绝不中断。见 [CLI 工具](/guide/cli)。

### AI 生成的结果和我说的话对不上，是模型太笨吗？

先排除尺子的问题再怪模型：自然语言里说「只查询这几项」，模型理解成其余字段仍出现在表格/表单里，是最常见的偏差来源；把范围写完整（哪些字段在查询、哪些在表格、哪些在弹窗）比形容「做得好看点」有用得多。确定性校验层会把非法配置挡在生成前门并给出逐条原因，见 [片段拼装看板](/fragment-dashboard)。

### 能把生成接进 CI 吗？

可以。生成器的产物是可编译的 Vue 文件或 JSON，`es-plus create --from-config ./page.config.json -o ./src/views/x` 是确定性的，同一份配置每次产出相同结果 —— 适合放进流水线。自然语言那条腿要 LLM，成本与延迟都在调用方，不建议放在每次构建里。

## Vue 2 与三端

### Vue 2 项目还能用吗？

能。`@es-plus/vue2` 是同一份 schema 的第二渲染端，peer 支持 `vue ^2.6.14 || ^2.7.0`。官方 Vue 2 已于 2023-12-31 停止维护，这决定的是「新项目该不该从 Vue 2 起步」，不决定「存量项目能不能继续用」。支持策略与风险边界见 [Vue 2 支持周期](/guide/vue2-eol)，用法与差异见 [Vue 2 指南](/guide/vue2)。

### 同一份 schema 在三个渲染端表现完全一致吗？

字段、列、弹窗、权限、i18n 的**语义**一致，这是仓库用跨渲染器契约（`packages/shared/src/contract.ts`）守住的东西；**外观**不可能一致，因为它按各端组件库（Element Plus / Element UI / Ant Design Vue）自己的设计语言渲染。Ant Design Vue 端的差异与限制见 [Ant Design Vue 适配器](/guide/adapter-antdv)。

## 文档与站点

### 同一页为什么有两个地址？

`/guide/x/` 是构建期生成的静态阅读页（无脚本，正文与站点同一渲染器产出，是 canonical 地址）；`/#/guide/x` 是交互版（示例、搜索、目录高亮）。站点用 hash 路由，所以后者才是应用地址，前者保证抓取器与 AI 工具能拿到正文。见 [快速开始](/guide/getting-started)。

### 文档有英文版吗？

部分有：快速开始、为什么是 ES-Plus、MCP Server、Vue 2、迁移指南。其余页面在英文界面下会显示「未翻译」提示并保留中文正文 —— 明确提示比静默回退诚实。

### 遇到 bug 或想提需求去哪？

GitHub Issues：<https://github.com/liujiaao/es-plus/issues>。带上版本号、渲染端（`@es-plus/vue3` / `@es-plus/vue2` / `@es-plus/adapter-antdv`）与最小配置片段，能直接复现的问题通常一轮就定位。发布节奏与版本策略见 [路线图与版本策略](/guide/roadmap)。

### 想贡献代码怎么开始？

克隆、安装、构建、跑测试的命令，以及每个站点自己的构建方式，见 [贡献指南](/guide/contributing)。提交前跑 `npm test` 与 `npm run test:e2e`；对外承诺的数字由守卫脚本守着，改文案前先看 [性能与准确率基准](/guide/benchmark) 的口径。
