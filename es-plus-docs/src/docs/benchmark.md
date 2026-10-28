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
| es-plus-docs（路由 `/guide/getting-started`） | **448.6 KB** | ≤ 300 KB | 470 KB |
| es-pc（入口） | **1027.9 KB** | ≤ 400 KB | 1100 KB |
| es-eui（入口） | **667.6 KB** | ≤ 400 KB | 720 KB |

主站这一格以前写「约」，因为**这一页的正文自己就在首屏里**：每改一次文档它就动零点几 KB。指南正文改成按 slug 惰性加载之后，这个依赖消失了 —— 基准页写多长都不再影响首屏，所以这里是一个数。

三站都还没达到目标。主站的构成（同一份产物里最大的几块）：

| 块 | gzip | 是什么 |
|---|---|---|
| `element-plus-*.js` | 275.4 KB | Element Plus 按需注册的 30 个组件 + `@es-plus/*` 内部直接 import 的那些 |
| `index-*.js` | 93.9 KB | `@es-plus/*` 库本体、vue-i18n / router |
| `Doc-*.js` | 52.9 KB | 指南路由 chunk（含 markdown 渲染器与代码块行为） |
| `DocMeta-*.js` | 24.2 KB | 右栏目录 / 上下篇 / 「最后更新」 |
| 其余（json-ld、doc-meta、preload helper） | 2.2 KB | 已按语言裁剪 |

vxe-table（344.2 KB）、Element Plus 的全量注册（80.8 KB）、指南正文与搜索索引（125.9 KB）都已经从首屏里拿掉了 —— 各自的加载时机见下面三节。

es-pc 的构成：antd 397.2 + vxe 344.2 + antd-icons 181.5 + index 64.4 + vue 40.6。es-eui 是 webpack 单 vendor：`chunk-vendors` 623.3 + `app` 44.4。这两站的 vxe / antd 仍是全量注册，属于同一个未完成项。

### 指南正文为什么曾经在首屏里

链路是：`AppHeader`（入口）→ `DocSearch.vue` → `utils/search-index.ts` → `docs/doc-registry.ts` → 18 篇中文 + 5 篇英文 markdown。**没有任何一行写着「导入指南正文」**，但顶栏的搜索框永远在，所以每一页都先读完整站正文。新增六篇生态内容时，这一块从 198.2 KB 涨到 216.0 KB（+17.8）—— 当时就发现：多写一篇文档，所有 `/guide/*` 的首屏都长一截。

现在分成两条按需路径：

- **正文**：`docs/doc-meta.ts` 只留标题（几百字节，常驻）；正文由 `docs/doc-content.ts` 用惰性 glob 一次取一篇 —— 打开「性能与准确率基准」只下载这一篇的 chunk，中英各一份、按当前语言取。
- **搜索**：`utils/search-engine.ts` 装着 fuse 与全部正文，只在第一次打开搜索（Ctrl K）时 `await import()`。搜索仍然能命中任意一篇指南的任意小节，代价是把 120 KB gz 从「每一页」挪到「第一次搜索」。

判据写在 `check:bundle-sources` 第 5 条：`doc-registry` / `search-index` / `fuse.js` 只允许 `search-engine.ts` 静态引用；`DocSearch.vue` 必须动态 import 它；`Doc.vue` 不许再碰注册表。另外，`doc-meta.ts`、`doc-registry.ts`、磁盘上的 `.md` **三处 slug 清单必须相等** —— 少了任何一处，页面会变成「侧栏有、正文空」而不是报错。装这个守卫时就抓到一个：`crud-page.md` 626 行，从来没接进任何注册表，属于一直没被发现的孤儿正文。

改动本身的失败模式是「异步来得不是时候」：正文晚到会让目录、示例挂载、滚动高亮都落在空容器上。所以落地时逐项在浏览器里走了一遍 —— 冷启动某篇（只下载这一篇的 chunk，中英按语言各取一份）、站内跳到另一篇（标题/目录/上下篇/滚动复位）、点目录锚点、打开搜索（此时才下载索引，组件条目在后台补齐后当前查询自动重跑）、切成英文站（只有译文页取英文 chunk，没译文的页显示提示横幅）。

### 这些数字是怎么降下来的（五笔都是源码级的错，没有一处调参）

2026-10-28 同一天：**1535.6 → 975.0 → 992.9 → 650.1 → 571.9 → 448.6 KB**。

1. **高亮器引的是 highlight.js 全集**（190 种语言，含 mathematica / isbl / sqf），而全部文档加起来只用 11 种。改成 `highlight.js/lib/core` + 逐个 `registerLanguage` 后，共享 chunk 从 311.4 KB 降到 24.2 KB。
2. **指南的示例注册表两个 glob 都是 `eager: true`**，于是每篇指南 —— 哪怕正文里一个 `<demo>` 都没有 —— 都下载 103 个示例组件（约 145 KB）与它们全部源码文本（115 KB）。改成惰性 `import.meta.glob` 后这笔消失。前两步合起来是 975.0。
3. **vxe-table 与 vxe-pc-ui 在 `main.ts` 顶层全量注册**（344.2 KB），而真正渲染 `engine: 'vxe'` 的只有 `/advanced/vxe-table` 与 `/ai-gallery/<id>`。改成「路由门前动态注册」（`utils/vxe-loader.ts`）后是 650.1。
4. **`app.use(ElementPlus)` 是全量注册**（356.2 KB），站点自己的模板只用得上三十来个标签。改成显式清单（`utils/install-app-plugins.ts` 的 `ELEMENT_PLUS_COMPONENTS`）后是 571.9。注意省下的只有 80.8 KB 而不是三百多：`@es-plus/*` 的组件内部是直接 `import { ElTable } from 'element-plus'` 的，它们用到的那部分天然就在首屏里，站点注册方式改变不了。
5. **全部指南正文跟着搜索索引进入口**（343 KB 原文 / 120 KB gz）。按 slug 惰性 + 搜索按需之后是 448.6 —— 这一笔也让「写文档」不再抬高首屏，[路线图](/guide/roadmap) 里那条结构性待办就此关掉。

随后追加的六篇指南把总数带回 992.9 KB（第 2 步之后、第 3 步之前）。**同一份产物在同一天有 975.0 与 992.9 两个数**，差的就是内容本身 —— 这也是为什么本页每个数字都要带日期与口径：没有日期的体积数字，第二天就会误导人。

### 按需加载踩到的那个坑：CSS 会把它拽回首屏

第一版的「vxe 按需」改完，产物一称——**994.6 KB，只少了 0.4 KB**，几乎等于没改。原因是 `main.ts` 里还留着两行 `import 'vxe-table/dist/style.css'`，而 `vite.config.ts` 的 `manualChunks` 按 id 里的 `vxe` 把**样式表也分进了 vxe 那个 chunk**。CSS 在哪个 chunk，浏览器就得先把那个 chunk 的 JS 拉下来才能应用它 —— 于是入口里出现了 `import "./vxe-*.js"`，344 KB 原样回到首屏。

修法是把 CSS 留在入口块（`manualChunks` 里对 vxe 的 `.css` 单独放行），JS 才真的按需。这个坑**在源码层完全看不出来**：源码里没有任何一行「导入 vxe 的 JS」，浏览器照样下载它。

所以判据分两层，缺一层都拦不住：

- **源码层**（`npm run check:bundle-sources`）：`main.ts` 不许值导入 vxe；除 `utils/vxe-install.ts` 外没有别的文件值导入；`vxe-loader.ts` 里的路由清单要和数据对得上（哪个示例目录写了 `engine: 'vxe'`、哪个案例 JSON 用了 vxe 引擎，就必须各自有入口）。
- **产物层**（`npm run check:bundle-budget`）：`/guide/*` 的首屏闭包里**不允许出现 `vxe-*.js`**。这条才是抓住上面那个坑的那一条 —— 我曾把它关掉重跑一遍确认它会红。

### 按需注册 Element Plus：失败模式是「页面看起来正常」

把 `app.use(ElementPlus)` 换成显式清单，代码本身是平淡的：一张三十来行的组件表，逐个 `app.component`。危险的是**漏一个**：那个组件不渲染，页面其余部分一切正常，只有恰好走到用了它的那条路由才看得出来 —— 而「少了，分割线」「少了，下拉箭头」这种差别，肉眼很难归因到注册表上。

两个具体的地方值得记下来：

- **默认尺寸原本是副产物**。`size: 'small'` 以前由 `app.use(ElementPlus, { size })` 顺带提供；全量注册去掉后它一起消失了，所有按钮悄悄变回 32px。现在由根组件的 `<ElConfigProvider size="small">` 提供 —— 它是 provide 而不是 DOM 包层，外壳结构不变。文档内嵌的示例子应用是**另一个 app**，不在主应用的 provide 链上，所以 `Doc.vue` 挂载时自己再包一层。
- **图标全量注册是白给的，删不掉**。曾试过把 293 个图标一起去掉，产物一个字节没变（886.24 kB / 282.55 kB gz 两次构建完全相同）—— 因为 `@es-plus/vue3` 自己 `import * as` 了整个图标包，站点注册不注册都一样重。删了只会让用**字符串**指定图标的地方变空白（顶栏的主题切换、高级用法数据里的 `feature.icon`），所以留着。

判据同样不能靠人：`check:bundle-sources` 扫全部 `.vue` 模板里的 `<el-xxx>` 标签，逐个映射成 PascalCase 去和清单对账，**有一个不在表里就红**；同时挡住退路 —— 谁把 `app.use(ElementPlus)` 写回来也红。核对方式是在浏览器里逐页走：23 条路由的渲染指纹（组件类名集合）改动前后完全一致，弹窗 / 日期选择 / 下拉 / 开关 / 空状态 / 进度条逐一实际打开过，深色模式单独看了一遍，控制台零告警。

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

主站现在最大的一块是 `element-plus` 275.4 KB，而且**站点侧已经改不动它**：`@es-plus/*` 的组件自己 `import { ElTable } from 'element-plus'`，那部分体量由库的用法决定，不取决于站点怎么注册。要再往下走，只有两条路 —— 换渲染端（不现实），或者让库对组件内部依赖也做成可选（那是库的架构改动，不是站点的性能批次）。

三站共有的还有一笔：es-pc 的 antd（397.2 KB）与 es-eui 的 Element UI（在 623.3 KB 的 `chunk-vendors` 里）都还是全量注册。它们的失败模式与上面 Element Plus 完全一样，做法可以直接照抄，只是 `@es-plus/*` 没有为这两个端准备等价的可选清单 —— 得先在各自站点里扫一遍模板用到的标签。

按需加载的代价是「哪些路由/哪一步需要什么」变成要维护的清单。四份清单（`vxe-loader.ts` 的路由清单、`ELEMENT_PLUS_COMPONENTS` 的组件清单、示例 glob 的 eager 策略，以及 `doc-meta.ts` 的 slug 清单）都由前门守卫钉住，加一个示例却忘了改清单会直接红 —— 这是让「按需」不退化回「全量」的唯一办法。

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
