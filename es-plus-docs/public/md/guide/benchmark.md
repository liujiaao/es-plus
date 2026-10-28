---
title: '性能与准确率基准'
route: '/guide/benchmark'
canonical: 'https://liujiaao.github.io/es-plus/guide/benchmark/'
source: 'es-plus-docs/src/docs/benchmark.md'
type: 'guide'
---
# 性能与准确率基准

这一页只放**能被复现的数字**：每个数字后面都写口径、写命令、写日期。没有测过的项目单独列出来说「没测」——把「没测」写成「很快」是这个行业最常见的假话。

> 全部数字的实测日期：2026-10-28，实测环境为本仓库工作区与本机 Node。换一台机器，绝对数字会变，**口径与相对关系不会变**。

## 包体积（首屏 JS）

### 口径

「首屏」= `index.html` 里 `<script type="module">` 与全部 `<link rel="modulepreload">` 指向的 JS，加上该路由 chunk 的**静态 import 闭包**。动态 `import()` 不计入 —— 那正是懒加载的意义，算进去会让「改成懒加载」永远不生效。

- 单位：gzip（level 9），只数 JS，不数 CSS。CSS 有自己的体积问题，混进 JS 预算只会让数字失去意义。
- 文档站按路由称（`/guide/getting-started`）；es-pc / es-eui 不切路由，按入口称。
- 目标线来自设计审计；**回归线**是「这一版可以接受多重」的人为决定，写在脚本里，超过即红。

### 实测

| 站点 | 首屏 JS（gzip） | 目标 | 回归线 |
|---|---|---|---|
| es-plus-docs（路由 `/guide/getting-started`） | **≈993 KB** | ≤ 300 KB | 1040 KB |
| es-pc（入口） | **1027.9 KB** | ≤ 400 KB | 1100 KB |
| es-eui（入口） | **667.6 KB** | ≤ 400 KB | 720 KB |

主站的数字写成「约」，是因为**这一页的正文自己也在首屏里**（见下节）：每改一次文档，它就动零点几 KB —— 这个差别小到本页每一句话的长度都能影响它。写这段话时实测在 993–994 KB 之间。

三站都还没达到目标。主站的构成（同一份产物里最大的几块）：

| 块 | gzip | 是什么 |
|---|---|---|
| `element-plus-*.js` | 356.2 KB | Element Plus 全量注册 |
| `vxe-*.js` | 344.2 KB | vxe-table 全量注册 |
| `index-*.js` | 216.0 KB | 库本体、vue-i18n / router、fuse 搜索索引，以及**全部指南正文**（见下） |
| `Doc-*.js` | 51.7 KB | 指南路由 chunk |
| 其余（高亮器共享 chunk 等） | 24.7 KB | 已按语言裁剪 |

es-pc 的构成：antd 397.2 + vxe 344.2 + antd-icons 181.5 + index 64.4 + vue 40.6。es-eui 是 webpack 单 vendor：`chunk-vendors` 623.3 + `app` 44.4。

### 那 216 KB 里为什么有全部指南正文

全站搜索索引（`utils/search-index.ts`）以 `doc-registry` 为数据源，而注册表是 `?raw` 静态导入的 —— 于是**每多一篇指南，所有 `/guide/*` 的首屏都长一截**。本轮新增六篇生态内容让这个块从 198.2 涨到 216.0（+17.8 KB）。

这是结构问题，不是这六篇写得太长。真正的修法是把正文改成按 slug 惰性加载（示例注册表已经是这个形状），搜索索引改在第一次打开搜索时才建；那会改变文档页的渲染时机与搜索的首次可用时间，需要浏览器逐页核对，因此没有混进内容批次。它列在 [路线图](/guide/roadmap) 的「正在做的事」里。

### 这个数字是怎么降下来的（两笔都是源码级的错）

2026-10-28 同一天从 **1535.6 KB 降到 975.0 KB（−36.5%）**，没有一处调参：

1. **高亮器引的是 highlight.js 全集**（190 种语言，含 mathematica / isbl / sqf），而全部文档加起来只用 11 种。改成 `highlight.js/lib/core` + 逐个 `registerLanguage` 后，共享 chunk 从 311.4 KB 降到 24.2 KB。
2. **指南的示例注册表两个 glob 都是 `eager: true`**，于是每篇指南 —— 哪怕正文里一个 `<demo>` 都没有 —— 都下载 103 个示例组件（约 145 KB）与它们全部源码文本（115 KB）。改成惰性 `import.meta.glob` 后这笔消失。

随后追加的六篇指南把总数带回 992.9 KB。**同一份产物在同一天有 975.0 与 992.9 两个数**，差的就是内容本身 —— 这也是为什么本页每个数字都要带日期与口径：没有日期的体积数字，第二天就会误导人。

这两条现在由**源码层守卫**（`npm run check:bundle-sources`）在合入前挡：断言注册语言数 ≤ 40、每一条 fence 语言都点得亮、注册表里不出现 `eager: true`。产物层由 `npm run check:bundle-budget` 称重。只称产物是事后才发现，只看源码量不出「哪一块变重了」，两条都要。

### 复现

```bash
npm run build:libs
cd es-plus-docs && npm run build && cd ..
cd es-pc && npm run build && cd ..
cd es-eui && npm run build && cd ..   # dist 被开发服务器占用时：npx vue-cli-service build --dest dist-verify，再以 BUDGET_DIST=dist-verify 称重
node scripts/check-bundle-budget.mjs --verbose
```

`--verbose` 会打印首屏里最大的几块。不带它时只打总数 —— 而「一共多少」几乎从不是你想知道的那件事。

### 还没做完的部分

剩下 700 KB 是 Element Plus 与 vxe-table 各一笔全量注册。要再往下走必须改成按需引入，而它的失败模式是**页面看起来正常、某个组件突然不渲染**，必须逐页在浏览器里核对。这一项被刻意留在队列里，没有为了数字好看先合进去。

## 生成准确率

### 口径

`npm run eval:llm` 是本仓库的 Layer-2 LLM 准确率评分器。对每一条 golden 语料，驱动**真实的** NL → 配置路径（与 MCP host、CLI `--ai` 同一套 steering prompt 与 few-shot），再与手写的 golden 配置比对：

- 字段集合（prop-set F1）——「有没有找对字段」；
- 命中字段上的属性准确率（`formtype` / `inQuery` / `inTable` / `inForm`）；
- 操作集合（actions F1）、工具栏按钮的 code 多重集；
- `exactIntent`：字段集合 + 全部属性 + 操作 + 按钮 code 全对才算 1；
- `compiles`：生成器 `generateFromConfig` 能否不抛错地产出页面。

**测量完整性**：未测到的行（连接失败、被截断）不是「答错」，但也不算成绩 —— 评分器把它们按 0 计入分母，并且用 `MAX_ERRORED_ROWS = 0` 把「有未测行」直接判为**这次不构成测量**。部分失败比全灭更隐蔽：曾经一次运行算术上是 47.0%，露馅的地方是 `compileRate` 只有 71.5% —— 分母里有一堆根本没跑到。

### 为什么这一页不写一个百分比

因为它会过期，而且它是**语料决定的**，不是模型决定的：换一批语料、改一处判定口径，同一个模型能差出几十个百分点。把某一晚的数字刻在营销页上，读者第二天就会拿它当承诺。

实时数字看 [片段拼装看板](/fragment-dashboard)：那里的每一行都由 nightly 产物生成，带语料口径与运行日期。复现需要 LLM key 与费用：

```bash
npm run eval:llm -- --limit 5     # 先跑 5 条探针，确认 key / 中继可用
npm run eval:llm                  # 全量
```

### 没证明什么

- **只覆盖 heldout 语料**，不覆盖任意自然语言。语料外的描述能生成到什么程度，没有度量。
- **只在一条模型 + 一套 prompt 上测**。换模型或换 steering，数字不迁移。
- **准确率是「与 golden 一致」，不是「业务正确」**。golden 本身是人写的，它的偏差会原样进入成绩（这个仓库修过两次这类尺子缺陷）。

## 代码行数与事件绑定的缩减

这是审计里唯一**双向可信**的口径：同一功能范围写两遍，逐行数。实测见 [与其它方案对比](/guide/comparison)：查询 + 表格 + 分页场景 123 → 77 行、事件绑定 7 → 1、`v-if` 2 → 0；但码值列小场景 36 → 43 行（配置比手写长）。

复现：

```bash
npm run cases:metrics          # 从 docs/examples/{native,es}/*.vue 实测
npm run one-config:gen         # 模板 + 胶水 / 整页 两种口径
```

## 渲染性能：没测

这一页**没有任何渲染耗时或滚动帧率的数字**，因为本仓库目前没有测它的装置。要测得有意义，需要固定设备、固定浏览器版本、固定数据规模（比如 100 / 1000 / 10000 行表格的首帧与滚动帧率），否则数字只反映跑它的那台机器。

没有测不等于不慢：vxe-table 的虚拟滚动是真实优势，但本仓库没有一帧一帧地验证过它。要落到「基准」两个字上，先得有装置；在那之前，这一节保持为空。

## 继续读

- [与其它方案对比](/guide/comparison) —— 行数与事件绑定的完整口径
- [路线图与版本策略](/guide/roadmap) —— 上面这些「还没做完」的项在队列里的位置
- [片段拼装看板](/fragment-dashboard) —— 准确率的实时数字
- [贡献指南](/guide/contributing) —— 改这些守卫与尺子之前需要知道的事
