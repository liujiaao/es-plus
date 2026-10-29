# 三站文档「设计 · 内容 · 增长」深度审计与统一规范

> 审计日期：2026-10-27
> 范围：`es-plus-docs`（Vue 3 + Element Plus，主站）· `es-pc`（Vue 3 + Ant Design Vue）· `es-eui`（Vue 2 + Element UI）
> 方法：源码全量静态审计 + 三站构建产物运行时复核（1440×900 / 390×844）+ 线上 GitHub Pages 实测
> 标注：**[实测]** = 在本机或线上实际验证；**[源码]** = 从仓库源码确认；**[推断]** = 基于公开惯例的判断，未在本仓库验证
> 性质：只读审计。本文只给结论、规范与路线图，**未修改任何站点代码**。

---

## 0. 一页结论

### 0.1 五个判断

1. **三站不是“一套设计系统 × 三个渲染端”，而是三个各自生长的后台站点。** 颜色 token 是共享的，但导航模型、页面模板、阅读宽度、字号、深色模式、搜索、代码块、SEO 全部各做各的；同一批内容（案例 / AI 证据页）被实现三遍，且已经出现文案漂移。
2. **主站是“内容最可信”的一站，但不是“体验最好”的一站。** 它拥有唯一的搜索、TOC、上下篇、深色模式与代码沙箱；然而最常用的指南正文里，**代码块渲染是坏的**（见 P0-1），线上每个代码块都把 “bash / 复制” 当作代码正文显示，并留下 300–1000px 的空白。
3. **三站都缺少“产品证据”。** 全仓库站点侧只有 favicon、OG 图和一个 Vue2 旧 logo，**0 张真实产品截图、0 张架构图、0 段演示视频**。首屏靠文字 + 代码 + CSS 渐变，用户看不到“配置出来的 CRUD 长什么样”。
4. **可发现性被结构性掐死。** 三站都用 hash 路由、无预渲染；主站 sitemap 里 19 个 URL 抽查三类（指南/工具/案例）**全部 404**，其余同构 URL 也没有对应文件；主站只有 3/17 个路由有独立标题；三站最强的 AI 证据页大多不在导航里；搜索只索引 12 篇指南，索引不到组件、案例与 103 个示例。
5. **“普通”的根因不是颜色不够炫，而是缺少视觉系统。** 只有颜色 token，没有字号 / 行高 / 间距 / 动效 / 断点 / 内容宽度 token；间距 token 在三站源码中**使用次数为 0**；logo 是三站各自用 CSS 文字拼的 “ES”；所有区块同一张卡片、同一圆角、同一阴影，没有大小与密度对比。

### 0.2 关键数字

| 指标 | 主站 | AntDV 站 | Vue2 站 |
|---|---:|---:|---:|
| 路由声明 / 可访问页面 | 17 / 17 | 23 / 22 | 34 / ≈32 |
| 示例文件 | 103 | 103 | 97（95 个在跑） |
| 视图代码量 | ≈7.0k 行 | ≈6.2k 行 | ≈19k 行 |
| 阅读宽度 | 860px | ≈1136px | 1400px / 无上限 |
| 硬编码颜色（约） | 620 | 730 | 1460 |
| 独立页面标题 | 3/17 | 0 | 0 |
| 搜索 | 有（仅 12 篇指南） | 无 | 无 |
| TOC / 上下篇 | 有 | 无 | 无 |
| 深色模式 | 有 | 无（token 是死代码） | 无（主题页教错 token） |
| 390px 可用 | 是 | **否（正文仅 76px 宽）** | **否（导航被裁切）** |
| 初始预加载 JS（原始） | element-plus 1.14MB + vxe 1.16MB + monaco 4.31MB | antd 1.33MB + icons 1.14MB + vxe 1.16MB | vendor 2.34MB |
| 线上 OG 图 | **损坏**（PNG 头为 `EF BF BD 50 4E 47`） | 复用主站损坏图 | 复用主站损坏图 |

### 0.3 一句话回答“为什么很普通”

> 因为站点把“文档写完了”，但没有把“产品被看见”设计进去：没有真实界面图、没有强字号层级、没有统一页面骨架、没有可交互的首屏证明、没有一套跨站的设计系统。用户看到的是一组排版尚可的后台页面，而不是一个“配置即页面”的产品。

---

## 1. 审计方法与全量覆盖

### 1.1 覆盖范围

- **页面**：三站共 74 条路由声明（约 71 个可访问页面），逐条登记页面类型、导航入口、是否有独立标题/描述、是否有 TOC/上下篇、是否响应式（见附录 A）。
- **内容**：主站 18 个 markdown 源文件（7,519 行）、Vue2 站 7 篇指南 + 10 篇组件文档（12,970 行）、AntDV 站 1 篇指南 + 7 篇组件文档；三站 303 个示例文件。
- **样式**：`docs/tokens/design-tokens.css`、`docs/theme/docs-content.css`、三站全局样式与页面 scoped 样式；统计字号、宽度、颜色、间距 token 使用。
- **功能**：搜索、主题、国际化、版本、代码块、导航、404、SEO、构建产物。
- **线上**：`https://liujiaao.github.io/es-plus/` 及两个子站，实际请求 sitemap 与深链。

### 1.2 复核方式

| 维度 | 方法 |
|---|---|
| 布局 | 在 1440×900 与 390×844 下读取 `getBoundingClientRect()`、`scrollWidth`，并截图 |
| 代码块 | 读取 DOM 结构与 computed style，对照 markdown-it fence 渲染实现 |
| SEO | `curl` 线上 URL；解析 `<title>`、`meta`、`sitemap.xml`、PNG 文件头 |
| 令牌 | 统计 `var(--es-*)` 使用次数与十六进制字面量数量 |
| 可访问性 | 统计 skip link / focus-visible / prefers-reduced-motion / aria-label；计算 WCAG 对比度 |
| 性能 | 读取构建产物 `dist/index.html` 的 modulepreload 与 chunk 体积 |

### 1.3 结论可信度

本文的 P0 级结论全部为 [实测] 或 [源码]。P1/P2 中涉及“主流站点怎么做”的部分为 [推断]，用于给出方向，不当作本仓库事实。

---

## 2. 三站全景

### 2.1 角色与规模

| | 主站 `es-plus-docs` | AntDV 站 `es-pc` | Vue2 站 `es-eui` |
|---|---|---|---|
| 自我定位 | 产品主站 + 完整文档 | “Ant Design Vue 端”渲染器文档 | “Vue 2 + Element UI 端”渲染器文档 |
| 技术栈 | Vue 3 + Element Plus + Vite | Vue 3 + Ant Design Vue + Vite | Vue 2.6 + Element UI + vue-cli |
| 路由 | hash，17 条 | hash，22 条 | hash，33 条 |
| 首页 H1 | `ES-Plus` | `中后台 CRUD 的配置层` | `ES-Plus` |
| 导航模型 | 顶部 5 项 + 左侧 6 组 | 仅左侧分组 | 顶部 7 项（指南/组件页内再分栏） |
| 文档骨架 | 左栏 + 正文 + 右 TOC | 左栏 + 正文（无 TOC） | 顶部 + 正文（多数页无左栏） |
| 内容深度 | 18 篇 md，7.5k 行 | 指南 288 行 + 手写 API 表 | 17 篇长文，12.9k 行 |
| 示例 | 103 个，5 个组件页 + 3 个高级页 | 103 个，7 个组件页 + 2 个高级页 | 97 个，10 个组件页 |
| 构建体积 | 21MB（含 monaco 4.3MB + worker 7MB） | 5.7MB | 2.3MB |
| 初始预加载 | element-plus + vxe + monaco | antd + icons + vxe + vue | 全量 vendor |

**判断**：三站规模相近，但“主站是 canonical”只体现在文案与链接上，没有体现在内容深度、页面完整度或体验上。Vue2 站反而承载了最多的长文（12.9k 行），AntDV 站最薄（指南 288 行）。

### 2.2 信息架构对照

| 内容 | 主站入口 | AntDV 入口 | Vue2 入口 |
|---|---|---|---|
| 首页 | 顶栏 + 侧栏 | 侧栏 | 顶栏 |
| 30 秒上手 | 侧栏 | **无（孤儿路由）** | 顶栏 + 侧栏 |
| 快速开始 | 侧栏 | 侧栏 | 顶栏 / 组件页 |
| 核心案例 | 侧栏 | 侧栏 | 顶栏 |
| 旗舰案例 | 侧栏 | 侧栏 | **无** |
| AI 生成页 | 侧栏 | 侧栏 | **无** |
| AI 画廊 | **无** | **无** | **无** |
| 组合画廊 | **无** | **无** | **无** |
| 工具工作流 | **无** | **无** | **无** |
| 片段仪表盘 | **无** | **无** | **无** |
| 原生 vs AI | **无** | **无** | **无** |
| 组件 API | 侧栏 5 项 | 侧栏 6 项 | 顶栏 → 组件页 10 项 |
| 高级 / vxe | 侧栏 3 项 | 侧栏 2 项 | 组件页 |
| Playground | 顶栏 + 侧栏 | 无 | 无 |
| AI CRUD | 侧栏 | 无（外链主站） | 无 |
| 更新日志 | 侧栏 | 无 | 无 |
| 主题 | 顶栏切换 | 无 | 顶栏 |
| 搜索 | 顶栏 | 无 | 无 |
| 语言 | 顶栏 | 无 | 无 |

**三个结构性问题**：

1. **最强证据被藏起来。** AI 画廊、组合画廊、工作流、片段仪表盘、原生 vs AI 是产品差异化的核心证据，却在三站都没有稳定入口；AntDV 站只有 `/cases` 一条路可达，Vue2 站连 `/cases` 都只是顶栏一项。
2. **同一意图有多个入口。** 主站同时有 `/quickstart`（30 秒上手）与 `/guide/getting-started`（快速开始）；Vue2 站同时有 `/quickstart`、`/guide/quickstart`、`/component/quickstart`，安装页也有 `/guide/installation` 与 `/component/installation` 两份近 900 行的近似内容。
3. **没有“生态”层。** 三站都没有 FAQ、路线图、贡献指南、版本策略、支持渠道、Vue 2 EOL 说明、与 vue-element-admin / Formily / amis 的对比。对“要不要采用”的决策者，这是比组件 API 更关键的内容。

### 2.3 页面类型对照

| 页面类型 | 主站 | AntDV | Vue2 | 应有骨架 |
|---|---|---|---|---|
| 产品首页 | 有（分栏 hero + 代码窗） | 有（居中文字 hero） | 有（全屏动效 hero） | 价值主张 + 产品实拍 + 主 CTA + 证据条 |
| 指南 | 有（12 篇） | 1 篇聚合 | 7 篇 | 面包屑 + 正文 + TOC + 上下篇 |
| 组件 API | 5 篇（含 103 demo） | 7 篇（含 103 demo） | 10 篇（含 95 demo） | 描述 + 实时示例 + Props/Events/Slots + 主题 + 可访问性 |
| 案例 | 1 聚合 + 1 旗舰 | 同左 | 同左 | 背景 → 截图/实时 → 配置 → 结果 → 成本 |
| AI 证据 | 5 篇 | 5 篇 | 5 篇 | 主张 → 方法 → 产物 → 可复现命令 → 边界 |
| 工具 | Playground / AI CRUD | 无 | 无 | 全宽工具页，无正文栏 |
| 更新日志 | 有（严重过期） | 无 | 无 | 版本 + 日期 + 变更类型 + 迁移提示 |
| 404 | 有 | 有 | 有 | 品牌化 + 搜索 + 热门链接 |

### 2.4 布局与阅读体验

| 站点 | 外壳 | 侧栏 | 正文 | TOC | 断点 |
|---|---|---|---|---|---|
| 主站 | 1400px | 260px | 860px | 240px | 992 / 768 |
| AntDV | 1200px（未居中） | 260px，固定 | ≈1136px | 无 | 仅 5 处 @media，布局无 |
| Vue2 | 1200 / 1350px | 260px，固定 | 1400px 或 `calc(100% - 260px)` | 无 | 768（仅首页/卡片） |

- 主站 860px / 15.5px 对中文约 55 字/行，略宽但可接受；AntDV 约 70 字/行；Vue2 文档页 1400px 约 90 字/行，明显超出舒适阅读区间。
- AntDV 的 `.content-wrapper` 设了 `max-width:1200px` 但**没有 `margin:0 auto`**，1920px 屏上内容靠左，右侧约 400px 死灰。
- 只有主站有完整移动端抽屉；AntDV 在 390px 下侧栏仍占 260px，正文只剩 **76px** [实测]；Vue2 顶部 9 个导航项在 390px 下被裁切、横幅与内容重叠 [实测/screenshot]。
- 只有主站有右栏 TOC 与上下篇；三站的 TOC 覆盖率是 1/3。

### 2.5 功能矩阵

| 功能 | 主站 | AntDV | Vue2 | 主流文档站 |
|---|---|---|---|---|
| 站内搜索 | 有，仅 12 篇指南 | 无 | 无 | 全站索引 |
| 深色模式 | 有 | 无（token 死代码） | 无（主题页教错） | 有 |
| 国际化 | 部分（UI + 6 篇 en） | 无 | 无 | 通常有 |
| 版本选择 | 无 | 静态徽章（不可点） | 无 | 有 |
| 代码高亮 | 有（但渲染坏） | 无 | 部分 | 有 |
| 代码复制 | 有（按钮失效） | 无 | 有 | 有 |
| 代码沙箱 | 有 | 无 | 无 | 常见 |
| TOC | 有 | 无 | 无 | 有 |
| 上下篇 | 有 | 无 | 无 | 有 |
| 编辑此页 / 反馈 | 无 | 无 | 无 | 有 |
| 面包屑 | 有 | 无 | 部分 | 有 |
| 404 | 有 | 有（无 H1） | 有 | 有 |
| 站点地图 | 有但全 404 | 无 | 无 | 有 |
| 分析统计 | 无 | 无 | 无 | 通常有 |

## 3. 问题清单

### 3.1 P0 — 阻断可信度或基本可用性

#### P0-1 主站指南的代码块渲染是坏的 [实测]

- **现象**：线上 `/guide/getting-started` 每个代码块顶部把 `bash`、`复制` 当作代码正文显示，随后是 200–900px 的空白，真正的代码被推到很下面；复制按钮不是按钮，只是文本。
- **实测数据**：线上该页 `.code-block-wrapper` 数量为 **0**；四个 `<pre>` 高度分别为 299px、563px、563px、1042px；`<pre><code>` 的 `textContent` 以 `" bash 复制 npm install ..."` 开头。本机构建产物上还出现同一段代码的“坏副本 + 好副本”并存（`wrappers=18`，同时存在多个裸 `<pre>`），页面被拉长一倍以上。
- **根因**：[`es-plus-docs/src/views/Doc.vue:106`](es-plus-docs/src/views/Doc.vue#L106) 的 markdown-it `highlight` 回调返回的是完整的 `<div class="code-block-wrapper">…</div>`。markdown-it 的 fence 规则会把这个返回值再包进 `<pre><code>`；随后 `onMounted` 里的 `hljs.highlightElement` 又对 `<pre><code>` 重新高亮，把内部 HTML 当成文本转义，于是 header 变成可见代码。
- **影响**：主站所有指南页的第一屏观感被破坏；用户无法复制示例；“文档质量”这一核心资产被直接质疑。它也是“站点显得普通”的最大单点原因之一。
- **修法**：不要用 `highlight` 返回块级 HTML；改为注册 `md.renderer.rules.fence`，在 fence 层输出 wrapper + `<pre><code>`，`highlight` 只返回高亮后的行内 HTML；删除挂载后的二次 `highlightElement`；给代码块加 DOM 断言守卫（wrapper 数 = fence 数、无 `复制` 文本节点、copy 按钮可点击）。

#### P0-2 深链、sitemap、社交卡片在线上是坏的 [实测]

- 三站全部使用 hash 路由（主站 `createWebHashHistory`、AntDV/Vue2 同类）。真实地址是 `/#/guide/getting-started`。
- 主站 sitemap 由 `vite-plugin-sitemap` 生成，写的是 **19 个无 `#` 的路径**；线上实测：
  - `/es-plus/guide/getting-started` → **404**
  - `/es-plus/playground` → **404**
  - `/es-plus/cases` → 301 到 `/cases/` → **404**
- 构建产物没有 `404.html`，GitHub Pages 不会把深链回退到 SPA。
- 主站只有 3/17 个路由（Home、`/guide/:name`、`/components/:name`）设置了 `useHead`；`/advanced/:name`、案例、AI、Playground、AI CRUD 全是同一个通用标题。AntDV/Vue2 站是**全站一个静态标题**，`meta.title` 写了但从未消费。
- `canonical` 与 `og:url` 在所有子页都指向站点根；子站 canonical 指向自己。
- **OG 图是损坏的 PNG**：线上 `/og-image.png` 前 8 字节为 `EF BF BD 50 4E 47`，不是合法的 `89 50 4E 47`；三站都引用它。`sync-brand` 用 UTF-8 读写二进制导致，三个 brand 守卫都检查不出来（详见 P0-5）。
- **影响**：搜索引擎拿不到可索引页面；分享链接只有裸标题；社媒卡片全坏。这是“访问量上不去”的第一结构原因，不是内容原因。

#### P0-3 最强的 AI 证据被藏在导航外，搜索也搜不到 [实测/源码]

- 主站顶部导航只有：首页 / 指南 / 组件 / 高级 / Playground；侧栏 6 组里 AI 组只有 MCP、CLI、AI CRUD。
- `/ai-gallery`、`/ai-gallery/composition`、`/ai-gallery/workflows`、`/fragment-dashboard`、`/native-vs-ai`、`/ai-gallery/:id` **均不在任何导航**；只能从 `/cases` 的 CTA 进入。
- AntDV 站同样缺这 6 个入口；Vue2 站连旗舰案例、AI 生成页都不在顶部导航。
- 主站搜索 `DocSearch.vue` 的索引只遍历 `docsData`（12 篇指南），**不含 5 个组件页、3 个高级页、10 个案例/AI 页，也不含 103 个示例**。AntDV/Vue2 无搜索。
- **影响**：用户找不到差异化证据，搜索引擎也找不到；内容投入没有转化为可发现性。

#### P0-4 三站里两站在手机上不可用 [实测]

- **AntDV 站**：390px 视口下固定 260px 侧栏仍占据左侧，正文容器实测宽 **76px**、高 83,875px；首页/案例仍是 3–4 列固定栅格。布局层没有任何断点，`@media` 全站只有 5 处，且都不在布局/首页/组件页。
- **Vue2 站**：390px 下 9 个顶部导航项被裁切，升级横幅与内容重叠，卡片文字挤压（实测时截图留证，未随仓库保存）。
- **主站**：390px 下侧栏正确变为抽屉，正文 382px，可用。
- **影响**：移动端是文档站的重要入口（搜索、社媒、微信分享），两站直接丢客；也是 Lighthouse/质量信号的硬伤。

#### P0-5 “可验证数字”的信任链已经出现裂缝 [实测/源码]

- **同一页两个口径**：主站首页对比区展示 `oneConfig.breakdown.native.totalLines` / `esplus.totalLines` = **151 → 90**，但同页说明与 locale 写的是 **136 → 81**。`one-config-diff.json` 里 `templateLines + glueLines = 115/27`，而 `totalLines = 151/90`，三者互相对不上。
- **77% vs 76.5%**：`zh-CN.json:128`、`en-US.json:128` 的 `feature1Desc` 写“减少 77%”；品牌单源与首页统计写 76.5%。Vue2 站首页统计也写 77%。
- **更新日志严重过期**：`changelog.md` 只有 `@es-plus/vue2 v1.1.0/v1.1.1`；当前 vue3 1.7.0、vue2 1.4.0、adapter 1.3.0、core 1.3.0、mcp 1.4.1、cli 1.4.0。
- **Vue2 主题文档教错 token**：`es-eui/src/views/guide/theme.vue` 教 `--es-primary-color: #409eff` 与 `[data-theme="dark"]`；真实系统是 `--es-brand-primary: #3b82f6` 与 `.dark`。
- **Vue2 站版本停在 v1.0.2**（`guide/introduction.vue`），页脚仍自称“组件库”。
- **README 的“200+ 行 → 30 行”**没有生成产物，也不在 `check-site-claims` 的锚点集合内。
- **OG 图二进制损坏**：`docs/brand/og-image.png` 合法（226,802 字节，头 `89 50 4E 47`），`es-plus-docs/public/og-image.png` 为 407,665 字节，头 `EF BF BD 50 4E 47`；`sync-brand` 以文本方式读写 PNG，`check-brand-assets` 只判存在，`og:check` 只比对输入哈希，三者全绿。
- **影响**：项目最大的卖点是“数字可核对”，一旦访客发现同页两个数字，信任成本极高。

#### P0-6 品牌不是一个品牌 [实测/源码]

| 项 | 主站 | AntDV | Vue2 |
|---|---|---|---|
| H1 | `ES-Plus` | `中后台 CRUD 的配置层` | `ES-Plus` |
| 自称 | 配置层 | 开发文档 | **组件库** |
| 页脚 | 仅首页有 | `ES-Plus ©2026 Created by 刘加傲` | `基于 Vue 2.0 和 Element UI 的组件库` |
| 英文 slogan | 未使用 | 首屏使用 | 未使用 |
| Logo | CSS 文字 “ES” 方块 | CSS 文字 “ES” 方块 | CSS 文字 “ES” 方块 |

- 英文 slogan “Write once, render everywhere.” 只在 AntDV 站出现；主站与 Vue2 站都没用。
- 三站都没有真正的 wordmark/SVG logo，favicon 与站内标记不是同一套资产。
- **影响**：同一产品三种自我介绍，用户无法形成品牌记忆；也不利于跨站互链与搜索实体识别。

### 3.2 P1 — 设计系统与阅读体验

#### P1-1 只有颜色 token，没有设计系统 [源码/实测]

- `docs/tokens/design-tokens.css` 有 81 个自定义属性：品牌 3、文字 3、边框 3、背景 4、状态 4、圆角 2、间距 6、阴影 2、代码 1，以及 Element UI/Element Plus 桥接变量。
- **缺失**：字体栈、字号阶梯、行高、字重、动效时长/缓动、z-index、断点、内容宽度、焦点环、状态色（hover/active/selected/disabled）、三级以上阴影。
- **间距 token 使用次数 = 0**；`--es-radius-*` 25 次、`--es-shadow-*` 9 次，且集中在 `docs-content.css`。三站页面仍以字面量为主：主站约 620 个十六进制颜色、AntDV 约 730、Vue2 约 1460。
- 结果：改品牌色不会改文档正文（`docs-content.css` 另有一套 `--es-doc-*`）；改间距没有入口；三站无法“换肤”。

#### P1-2 三套外壳、三种阅读宽度 [源码/实测]

- 主站：1400 外壳 / 260 侧栏 / 860 正文 / 240 TOC / 992+768 断点。
- AntDV：1200 外壳（**未居中**）/ 260 侧栏 / ≈1136 正文 / 无 TOC / 布局无断点。
- Vue2：1200–1350 外壳 / 260 侧栏 / 1400 或 `calc(100% - 260px)` 正文 / 无 TOC / 仅 768 一处。
- 中文舒适阅读约 30–45 字/行；860px/15.5px 约 55 字/行（略宽），1136px 约 70 字/行，1400px 约 90 字/行（明显过宽）。
- AntDV 1920px 下内容靠左，右侧约 400px 空白；Vue2 文档页在宽屏上几乎横贯全屏。

#### P1-3 字号没有阶梯，层级靠“每页各自发挥” [源码]

- 主站 H1 出现 23 / 24 / 26 / 32 / 34 / 72px；H2 出现 16 / 19 / 22 / 25 / 32px；正文 13 / 14 / 15.5 / 16 / 18px。
- AntDV H1 26 / 30 / 32 / 34 / 40；Vue2 首页 72、文档 34、组件 32、AI 23/24。
- 没有 display / body / mono 的字体配对；没有统一行高；代码字号 12/13/13.5/14 混用。
- 结果：从首页进入文档像换了产品；AI 页面的标题比文档标题还小，证据页天然“低一级”。

#### P1-4 文档 chrome 覆盖不全 [实测]

- 搜索：1/3；TOC：1/3；上下篇：1/3；面包屑：1/3；编辑此页/反馈/最后更新：0/3；版本选择：0/3（AntDV 有一个不可点的静态徽章）。
- 主站页脚只在首页；AntDV/Vue2 的页脚信息与文档无关。
- 组件页没有 `/components` 总览索引；EsDialog 作为包内组件没有独立 API 页（只在 `useDialog` 高级页出现）。
- 结果：文档站的基础“可导航性”不完整，用户只能靠侧栏硬找。

#### P1-5 代码块与示例卡片的完成度不一致 [实测]

- 主站：代码块坏（P0-1）；CodePlayground 有复制/刷新/沙箱/高亮，但被坏渲染覆盖。
- AntDV：`CodeDemo.vue` 只有“查看代码”开关 + 裸 `<pre>`；无高亮、无复制、无语言标签、无文件名、无行号；直接把整份 SFC 源码塞进去。
- Vue2：CodePlayground 有复制，但无高亮；AI 页多为裸 `<pre>`。
- 三站代码块没有统一的 header/语言/文件名/复制/展开/高亮行规范。

#### P1-6 深色模式“一半是死的” [源码]

- 主站：有切换与 EP dark CSS，但 9 个营销/AI 页面没有 `.dark` 覆盖，硬编码 `#fff`/`#f9fafb`/`#fffbeb`；主题在 `onMounted` 才应用，首屏会闪白。
- AntDV：token 里有 `.dark`，但没有触发入口，布局与 demo 全硬编码浅色；今天打开 `.dark` 会得到“半黑半白”。
- Vue2：没有全局深色；主题页用 `[data-theme="dark"]`，与系统的 `.dark` 冲突。
- 结果：深色模式不是“有/没有”，而是“有的站半坏、有的站没有”。

#### P1-7 可访问性没有基线 [实测/源码]

- 对比度（WCAG，普通文本需 ≥4.5:1）：
  - `#3b82f6` on `#fff` = **3.68:1**（链接、按钮）
  - `#3b82f6` on `#f7f8fa` = 3.46:1
  - `#8a919f` on `#fff` = **3.17:1**（次要文字）
  - `#999` on `#fff` = 2.85:1（页脚）
  - `#d97706` = 3.19:1，`#16a34a` = 3.30:1（状态文字）
  - 通过：`#4b5563` 7.56:1、`#5b6472` 5.98:1、`#1f2329` 15.78:1。
- 三站合计：`prefers-reduced-motion` **0** 处、`focus-visible` **0** 处、skip link **0** 处、`aria-label` 仅 **5** 处。
- 首页标题层级 h1 → h3 → h2 跳级；点击卡片多为 `a-card @click`，键盘不可达；AntDV 首页多处可点击卡片是鼠标专用。
- 结果：低视力、键盘、动效敏感用户都被排除；也是搜索质量与 Lighthouse 的扣分项。

#### P1-8 视觉资产为零 [实测]

- 全仓库站点侧只有：`docs/brand/favicon.svg`、`docs/brand/og-image.png`、`es-eui/src/assets/logo.png`。**没有一张产品截图、GIF、架构图或信息图。**
- 首页/案例页 `<img>` 数量为 0；所有“产品证明”都是文字、代码块、CSS 画的小图形。
- 结果：用户无法在 5 秒内看到“配置出来的页面长什么样”，这是“没有感官冲击”的直接原因。

#### P1-9 动效语言不一致 [源码]

- 主站：基本静止；仅 hover 位移与渐变。
- AntDV：基本静止；卡片 hover 统一 `translateY`。
- Vue2：20 个粒子、3 个 blur orb、shimmer、打字机、数字滚动、pulse/blink；无 `prefers-reduced-motion`，在低端机上明显掉帧。
- 结果：一个站像营销页，两个站像后台；不是“高级感”，而是“三套审美”。

#### P1-10 文案与图标的“工程味” [实测]

- 标题带 emoji：`🎯 核心案例`、`⚡ 30 秒上手`、`🚀 两套渲染引擎`、`✨ 核心特性` 等，三站都有。
- 图标混用 Element Plus 图标、Ant Design 图标、Element UI 字体图标、裸 SVG、emoji 五套体系。
- Logo 是三站各自 CSS 拼的文字 `ES`，不是可复用的 SVG 资产。
- 内部术语直接上屏：`L1–L5`、`claim/execute/compile`、`S2/S3`、`A8/A9`、`manifest`、`drift`，没有面向用户的解释层。

### 3.3 P2 — 内容、性能与增长

#### P2-1 内容深度倒挂，主站不是最完整的一站 [源码]

- 主站路由内指南 ≈5.1k 行（18 个 md 共 7,519 行，含未路由内容）；Vue2 站指南/组件文档 12,970 行；AntDV 站指南仅 288 行。
- `crud-page.md` **626 行未注册、未路由、不可搜索**，内容与 `/components/es-crud-page` 重复。
- 主站有 5 个组件页，AntDV 6 个，Vue2 10 个；`/components` 没有总览页。
- 结论：作为 canonical 的主站，内容覆盖不是最广；用户去子站反而能看到更多长文。

#### P2-2 上手路径重复且互相竞争 [源码]

- 主站：`/quickstart`（30 秒上手，3 张静态代码卡）与 `/guide/getting-started`（快速开始，含安装/注册）并存；`/guide/installation` 再讲一遍安装。
- Vue2：`/quickstart`、`/guide/quickstart`、`/component/quickstart` 三个入口；安装页两份近 900 行。
- AntDV：`/quickstart` 是孤儿路由，导航里没有。
- 结果：用户不知道“从哪开始”，搜索也会出现多个近似结果。

#### P2-3 生态内容缺失 [源码]

- 三站都没有：FAQ、路线图、贡献指南、版本策略、支持渠道、Vue 2 EOL 说明、与 vue-element-admin / Formily / amis / TypeChat 的对比、性能基准方法。
- 对“是否采用”的决策者，这些比组件 Props 更关键；也是长尾搜索的主要入口。

#### P2-4 国际化是半成品 [源码]

- 主站 12 篇指南只有 5 篇英文；9 个营销/AI 页面全中文；切到英文后 `<html lang>` 仍是 `zh-CN`。
- AntDV/Vue2 无国际化入口。
- 结果：英文切换是一个“承诺了但没兑现”的功能，反而损伤信任。

#### P2-5 性能预算缺失 [实测]

- 主站 `dist/index.html` 预加载：element-plus 1.14MB + vxe 1.16MB + monaco 4.31MB（另有 ts.worker 7MB）；文字文档页也要为 Playground 的编辑器买单。
- AntDV：antd 1.33MB + icons 1.14MB + vxe 1.16MB 全部 modulepreload；gzip 后初始仍约 1.1MB。
- Vue2：全量 Element UI vendor 2.34MB。
- 没有 LCP/CLS/初始 JS 预算，也没有按路由裁剪。

#### P2-6 增长基础设施为零 [实测]

- 三站都没有分析统计（无 GA/Plausible/Umami/百度统计）。
- 没有 `llms.txt`、每页 `.md` 镜像、RSS、JSON-LD、`hreflang`。
- 没有外部分发入口：仓库里的掘金/知乎/Twitter 草稿没有在站点露出；npm 包页、GitHub Discussions、MCP 注册表都没有互链。
- 没有“复制为 Markdown / 在 ChatGPT 中打开 / 用 MCP 读文档”这类 AI 时代文档站新惯例——对一个 AI-native 产品尤其可惜。

#### P2-7 三份实现导致漂移 [源码]

- 10 个案例/AI 页面在三站各实现一遍：`Cases.vue` 496/466/522 行、`AiGallery.vue` 336/335/357 行、`FlagshipApproval.vue` 225/216/243 行，文件哈希均不同；`NativeVsAi.vue` 主站与 AntDV 完全同哈希，说明至少有一处是复制同步。
- 同一文案（77%）、同一 API（`$httpRequest` vs 全局 `httpRequest`）、同一版本（vxe `^4.6` vs `^4.20.9`）已经漂移。
- 结果：每次内容改动要改三遍；守卫只校验文本副本，不校验渲染结果。

#### P2-8 内部文档过期，误导后续维护 [源码]

- `docs/internal/site-structure.md` 仍称“三站 H1 统一”“AntDV/Vue2 缺核心案例”“生态缺失”，其中前两条已被现状推翻。
- 旧审计报告里“三端快照在 CI”与 `docs/tri-render/README.md` 的“未生成、无 CI”矛盾。
- `scripts/feature-coverage.data.mjs` 写 97 个 demo，实际 103。
- 结果：后续维护者按文档做判断会走错方向。

---

## 4. 与主流开发文档站的结构差异

> 下表“主流”列是公开惯例的归纳 [推断]，不是对具体版本的逐项核验；ES-Plus 列均为 [源码/实测]。

| # | 维度 | ES-Plus 现状 | VitePress / Element Plus / Ant Design / Arco / Naive / shadcn 的常见做法 |
|---|---|---|---|
| 1 | 渲染方式 | 纯 SPA + hash；HTML 只有 `<div id="app">` | SSG/SSR 预渲染；每页是独立 HTML |
| 2 | URL | `/#/guide/x`，深链不可分享 | `/guide/x`，可分享、可被索引 |
| 3 | 页面元数据 | 3/17 有独立标题；canonical/OG 全站根 | 每页 title/description/canonical/OG |
| 4 | sitemap | 19 条 URL 抽查三类全 404（其余同构无对应文件）；子站无 | 构建时生成，URL 可访问 |
| 5 | 文档骨架 | 主站有 TOC/上下篇；另两站无 | 左导航 + 正文 + 右 TOC + 上下篇 + 面包屑 |
| 6 | 搜索 | 仅 12 篇指南；子站无 | 全站索引、快捷键、结果分组 |
| 7 | 代码块 | 主站渲染坏；AntDV 纯文本；Vue2 无高亮 | 语言标签、文件名、复制、行高亮、折叠、沙箱 |
| 8 | 版本 | 无版本选择；更新日志停在 1.1.x | 版本文档 + 版本选择器 + 迁移说明 |
| 9 | 深色模式 | 1/3 可用，且不完整 | 全站 token 化深色，首屏不闪 |
| 10 | 国际化 | 主站半量；子站无 | 完整 locale + 语言切换 + hreflang |
| 11 | 设计 token | 只有颜色/圆角/阴影；间距 0 使用 | 字体、字号、行高、间距、动效、断点、z-index 全套 |
| 12 | 字号系统 | 13 种字号，H1 23–72px | 模块化阶梯（如 12/14/16/20/24/30/36/48） |
| 13 | 内容宽度 | 860 / 1136 / 1400 三种 | 统一阅读宽度（约 65–80ch 或 30–45 汉字） |
| 14 | 组件 API | 手写表格，三站各一份 | 从类型/源码生成，带 since/version |
| 15 | 示例 | 有实时 demo，但无截图/沙箱 | 实时 demo + 源码 + 复制 + 沙箱 + 截图/GIF |
| 16 | 导航完整性 | 6 个 AI 证据页无入口 | 每个页面都有稳定入口，无孤儿 |
| 17 | 生态内容 | 无 FAQ/路线图/贡献/对比 | 常见 FAQ、Roadmap、Contributing、迁移、对比 |
| 18 | 反馈闭环 | 无编辑/反馈/最后更新 | 编辑此页、反馈、最后更新时间 |
| 19 | 可访问性 | 0 skip/focus/reduced-motion；对比度不达标 | AA 基线、键盘可达、减少动效 |
| 20 | 性能 | 首屏 2–6MB 原始 JS，无预算 | 路由级拆分、LCP/CLS 预算 |
| 21 | AI 可读性 | 无 llms.txt / 每页 md / MCP 文档端 | 越来越多站点提供 `llms.txt`、`.md`、MCP |

### 4.1 五个结构性差异（比“好不好看”更根本）

1. **没有“文档引擎”，只有三个手写 SPA。** 主流文档站把导航、TOC、搜索、代码块、版本、SEO 做成框架能力；ES-Plus 每站手写一遍，能力自然不齐。
2. **没有“页面模板”，只有“页面”。** 主流站点按页面类型（Landing / Guide / Reference / Tutorial / Changelog）复用模板；ES-Plus 每个页面独立写样式，导致 7 种内容宽度、13 种字号。
3. **没有“内容流水线”。** 主流站点从类型生成 API、从 git 取最后更新时间、从 release 生成 changelog；ES-Plus 手写 API 表、手写 changelog，必然过期。
4. **没有“设计系统”，只有“品牌色”。** 主流站点的间距、字号、动效、深色、断点都是 token；ES-Plus 的 token 只覆盖颜色，页面仍靠字面量。
5. **没有“可发现性设计”。** 主流站点默认每页可索引、可分享、可搜索；ES-Plus 默认每页不可索引、不可分享、搜不到。

### 4.2 是否应该迁移到 VitePress？

**建议：不整体重写。** 理由：

- 三站的核心资产是 **303 个可运行示例**（其中 Vue2 的 95 个、AntDV 的 103 个），VitePress 只能原生跑 Vue 3 组件；Vue2 示例必须 iframe 或降级为静态代码，会损失“真渲染”的证据。
- 现有页面（案例、AI 画廊、片段仪表盘）是数据驱动 + 自定义宿主，迁移成本高于收益。
- 更划算的路径：**保留三套运行时，抽出共享的“文档套件”（tokens + layout CSS + 页面模板 + 内容数据），给每站加预渲染与统一 chrome**。当内容团队扩大、或 Vue2 站退役时，再评估把主站迁到 VitePress/Astro。

---

## 5. 为什么三站“缺少感官冲击、显得很普通”

“普通”不是审美偏好，它有可拆解的机制。人打开一个页面，前 50ms 判断的是对比、秩序、质感；前 5 秒判断的是“这里有没有我想看的东西”；前 30 秒判断的是“我能不能上手”。三站分别在这三层失分。

### 5.1 首屏没有“产品证据”

- 首页是文字 + 代码 + CSS 渐变；**0 张真实界面截图**。用户看不到“配置出来的 CRUD 页面”。
- 主站首屏代码窗只有 11px 字、7 行代码，既不可读也不震撼；AntDV 首屏是居中文字；Vue2 首屏是 100vh 渐变 + 粒子，但没有产品。
- 主流产品的首屏通常是“真实界面 + 一句话价值 + 一个主 CTA + 一个可交互演示”。三站缺的是前两者和第四者。

### 5.2 没有视觉层级，所有东西一样重

- 所有区块都是白卡片 + 8/12/16px 圆角 + 同一档阴影；promise 三卡、案例卡、AI 卡、统计卡视觉权重相同。
- 字号没有阶梯：H1 从 23 到 72px，H2 从 16 到 32px；AI 证据页的 H1 比文档 H1 还小。
- 没有“大数字 / 大留白 / 大图”的节奏，只有均匀的栅格。均匀 = 没有重点 = 普通。

### 5.3 没有品牌资产，只有品牌色

- Logo 是三站各自 CSS 拼的文字 “ES”；没有 SVG wordmark、没有图形符号、没有品牌插画。
- 颜色只有一个蓝 + 一个青；AI 页面又各自发明紫/琥珀/天蓝，案例页用 Element 的红/绿。
- 没有 favicon 之外的品牌延展（社交卡、GitHub social preview、PPT 模板、贴纸）。品牌无法被记住。

### 5.4 动效不是“高级”，而是“不一致”

- 主站/AntDV 站几乎静止；Vue2 站有 20 个粒子、3 个 orb、shimmer、打字机、数字滚动。
- 三站没有共享的时长/缓动 token；没有 `prefers-reduced-motion`。
- 用户感知到的不是“精致”，而是“这三个站不是一家”。

### 5.5 没有“可交互的证明”

- 产品卖点是“改一份 JSON，三端同时变”；但首屏不能改，demo 藏在二级页，Playground 只在主站。
- 对比是静态代码 diff（而且还渲染坏了），不是“左边改配置、右边三端实时变”。
- 主流 docs 的“wow”来自可操作：改一个 prop 看效果、点一个按钮看代码、拖一个滑块看主题。三站把最强的能力做成了静态说明。

### 5.6 信息架构把“证据”埋了

- 6 个 AI 证据页不在导航；搜索只覆盖 12 篇指南；案例页用 5 个 CTA 卡把用户分流到站外/别处。
- 用户要先“相信”再“看见”，而主流是“先看见”再“相信”。

### 5.7 文案是“工程审计”，不是“用户任务”

- 页面标题与正文大量使用内部术语：`claim / execute / compile`、`L1–L5`、`S2/S3`、`A8/A9`、`manifest`、`drift`、`scorable`。
- 对作者这些是精确的；对第一次来的用户，这些词不构成“我能得到什么”。
- 主流写法：先给任务结果（“60 秒生成一个可编译的审批页”），再把方法学放进“为什么可信”折叠区。

### 5.8 统一的设计系统缺位

- 只有颜色 token；间距 token 0 使用；字体/行高/动效/断点/内容宽度都没有。
- 结果不是“某一页不好看”，而是“每一页都各自成立，但放在一起不像一个产品”。

### 5.9 感官设计的六个杠杆（按投入产出排序）

| 杠杆 | 现状 | 最小改法 | 预期感知 |
|---|---|---|---|
| 产品实拍 | 0 张 | 每个核心页面 1 张 2x 截图 + 1 张暗色图 | 立刻“这是真产品” |
| 字号阶梯 | 13 种 | 固定 8 级阶梯 + 3 种行高 | 立刻“专业” |
| 首屏可交互 | 无 | 首页嵌一个“改 JSON → 三端预览”小部件 | 立刻“有记忆点” |
| 统一骨架 | 3 套 | 760 正文 + 260 侧栏 + 220 TOC | 立刻“像文档站” |
| 动效克制 | 不一致 | 150–240ms、只用于状态变化、支持 reduced-motion | 细节质感 |
| 品牌资产 | 文字 logo | SVG wordmark + 图形符号 + 社交卡模板 | 长期记忆 |

---

## 6. 统一规范 v1.0（三站共用）

> 这一节是“目标规范”，不是现状描述。所有数值可直接落成 token/CSS；落地顺序见第 7 节。

### 6.0 设计理念（五条）

1. **证据优先于形容词。** 每个卖点旁边放可核对的产物：截图、JSON、命令、实测数字、失败边界。没有证据的形容词不上首屏。
2. **配置即产品。** 用户不是来“读组件文档”的，是来“用一份配置生成页面”的；首屏就要能改配置、看三端变化。
3. **三端同构，不是三站同抄。** 同一内容只有一个 canonical；子站只讲差异。视觉骨架、术语、数字必须同源。
4. **克制即高级。** 一个强调色、一套图标、一套字号、少量动效；用留白、层级、真实截图制造质感，而不是渐变、emoji、粒子。
5. **默认可访问、可索引、可分享。** 键盘可用、对比度达标、每页有标题/描述/OG、深链可打开；这些是底线，不是加分项。

### 6.1 站点角色与内容分工

| 站点 | 角色 | 应承载 | 不应承载 |
|---|---|---|---|
| `es-plus-docs` | **Canonical 产品站 + 完整文档** | 全部指南、组件 API、案例、AI 证据、Playground、更新日志、路线图、FAQ、对比、博客 | 渲染器专属的安装细节（链接到子站） |
| `es-pc` | **Ant Design Vue 渲染器门户** | AntDV 安装/差异/迁移、AntDV 专属示例、指向 canonical 的导读 | 与主站重复的完整指南/案例（避免重复内容） |
| `es-eui` | **Vue 2 + Element UI 渲染器门户** | Vue2 安装/兼容/迁移/EOL、Vue2 专属示例、Options API 写法 | 与主站重复的完整指南/案例 |

**内容规则**：

- 同一主题只有一个 canonical 页面；子站只写“差异 + 链接”，不复制全文。
- 子站与主站重复的页面加 `rel=canonical` 指向主站，或 `noindex,follow`；渲染器专属页面才允许独立索引。
- 三站共享：品牌文案（`docs/brand/slogan.json`）、案例数据（`docs/cases/**`）、AI 数据（`docs/ai/**`）、tokens、内容排版 CSS、术语表。
- 三站不共享：页面框架实现（Vue2/Vue3 语法不同），但**页面骨架、类名、间距、字号必须一致**。

### 6.2 信息架构与导航模型

**顶部导航（三站一致，最多 6 项）**

```
首页 · 指南 · 组件 · 案例 · AI · 生态        [搜索] [主题] [语言] [版本] [GitHub]
```

- `指南`：快速开始、安装、核心概念、进阶、迁移。
- `组件`：EsForm / EsTable / EsDialog / EsCrudPage / EsErrorBoundary / SvgIcon / VxeTable。
- `案例`：案例总览、旗舰案例、行业场景。
- `AI`：AI 总览（hub）、一句话生成、案例画廊、组合画廊、工作流、片段拼装、原生 vs AI、Playground、AI CRUD。
- `生态`：Vue2 / AntDV 门户、MCP、CLI、更新日志、路线图、FAQ、对比、贡献指南。

**侧栏分组（文档页）**

1. 开始使用（快速开始、安装、第一个页面、从 0 到 1）
2. 核心概念（Schema、字段、列、弹窗、联动、权限、国际化）
3. 组件 API（按组件）
4. 案例（总览、旗舰、场景）
5. AI 能力（Hub、画廊、组合、工作流、片段、对照）
6. 引擎与适配（vxe、Vue2、AntDV）
7. 生态与关于（迁移、更新日志、路线图、FAQ、贡献）

**硬规则**

- 每个路由必须属于且仅属于一个侧栏组；不允许孤儿页面。
- 每个页面至少被 3 个站内链接指向（侧栏/正文/相关阅读）。
- 同一意图只能有一个入口；`/quickstart` 与 `/guide/getting-started` 合并，`/component/quickstart` 301 到 `/guide/quickstart`。
- 组件页必须有 `/components` 总览；EsDialog 必须有独立 API 页。
- 详情页（`/ai-gallery/:id`）不在侧栏，但列表页必须提供筛选/搜索。

### 6.3 页面模板（六类）

#### T1 Landing（首页）

```
[Header 64]
[Hero: 左 价值主张 + 主 CTA + 次 CTA + 3 个可核对指标 | 右 真实产品截图/可交互预览]
[Logo/信任条: 三端标识 + npm/GitHub 数据]
[问题 → 方案: 原生写法 vs 配置写法（可切换、可复制）]
[三端一致: 同一 schema 的三张截图 + 同步滚动]
[AI 原生: 一句话 → 页面 的 30 秒录屏/交互]
[案例: 3 张卡片，带截图]
[证据条: 实测数字 + 方法链接]
[页脚 CTA: 5 分钟上手 / 打开 Playground]
```

规则：Landing 不用文档侧栏；首屏必须在 1 屏内出现“产品实拍 + 主 CTA”；最多 2 个主 CTA（主色 + 次色），其余降级为文字链接。

#### T2 Guide（指南/教程）

```
面包屑
H1（页面名，不含 emoji）
Lead（2–3 句：是什么、为什么、读完能做什么）
[可选：前置条件 / 预计阅读时间]
正文（H2/H3，代码块，提示块，图）
[上下篇]
[最后更新 · 编辑此页 · 反馈]
右栏 TOC（H2/H3）
```

#### T3 Reference（组件 API）

```
H1 + 状态徽章（Stable/Beta/Legacy）+ since 版本
一句话描述 + 关键特性 3 条
[实时示例：预览 / 代码 / 复制 / 沙箱]
Props 表（名称、类型、默认值、说明、since）
Events 表
Slots 表
Expose 表
主题变量表
可访问性说明
相关组件
```

API 表优先从类型/源码生成；手写表必须带 `since` 与最后核对日期。

#### T4 Case（案例）

```
H1 + 一句话业务背景
[截图/GIF 或实时 demo]
问题（原生写法/痛点）
配置（JSON 片段，可复制）
结果（截图 + 关键指标）
成本（行数/时间，注明口径）
边界（没解决什么）
[打开 Playground / 下载 JSON]
```

#### T5 AI Evidence（AI 证据）

```
H1（用户任务，不是内部代号）
一句话结论
[30 秒演示 / GIF]
方法（三步内讲清）
产物（可下载 JSON / 可运行命令）
实测数据（口径 + 来源 + 日期）
边界与不承诺
[复现命令]
```

内部术语（claim/execute/compile、S2/S3、A8/A9）放进“术语”折叠区，不放在 H1/H2。

#### T6 Tool（Playground / AI CRUD）

```
全宽工具区（无正文栏）
顶部：一句话说明 + 预设示例下拉 + 运行/重置
左：配置编辑器；右：三端预览/产物
底部：错误面板 + 复制/下载
```

### 6.4 布局与栅格

| Token | 值 | 说明 |
|---|---|---|
| `--es-layout-max` | 1440px | 外壳最大宽度 |
| `--es-header-height` | 64px | 顶部 |
| `--es-sidebar-width` | 260px | 左栏 |
| `--es-content-width` | 760px | 正文（中文 35–45 字/行） |
| `--es-content-wide` | 960px | 宽表/API 表 |
| `--es-toc-width` | 220px | 右栏 |
| `--es-gutter` | 32px | 栏间距 |
| `--es-radius-*` | 4/8/12/16/999 | 圆角 |
| 断点 | 640 / 768 / 1024 / 1280 / 1440 | sm/md/lg/xl/2xl |

规则：

- `shell = 260px + minmax(0, 760px) + 220px`，整体居中，最大 1440。
- `<1280px` 隐藏 TOC；`<1024px` 侧栏变抽屉；`<768px` 单列，正文 padding 16px。
- 表格/代码块可突破到 960px，但页面不出现横向滚动。
- 移动端正文最小宽度 ≥ 320px；任何页面在 390px 下 `scrollWidth <= innerWidth`。
- Landing 使用 `max-width: 1200px` 的内容容器，但 hero 背景可全宽。

### 6.5 排版系统

**字体栈**

```css
--es-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
  "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
--es-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas,
  "Liberation Mono", monospace;
```

正文使用 `--es-font-sans`；代码、配置、终端统一 `--es-font-mono`；不引入需要额外下载的 Web Font（中文子集成本高，首屏收益低）。

**字号阶梯（8 级 + 2 个展示级）**

| Token | px | 用途 |
|---|---:|---|
| `--es-text-xs` | 12 | 标签、脚注、代码行号 |
| `--es-text-sm` | 13 | 辅助说明、表格 |
| `--es-text-base` | 14 | 密集 UI |
| `--es-text-md` | 16 | 正文 |
| `--es-text-lg` | 18 | Lead、H4 |
| `--es-text-xl` | 20 | H3 |
| `--es-text-2xl` | 24 | H2 |
| `--es-text-3xl` | 30 | H1（文档） |
| `--es-text-4xl` | 36 | 页面大标题 |
| `--es-display` | 56（桌面）/ 40（移动） | Landing H1 |

**文档排版**

```css
--es-leading-tight: 1.25;   /* 标题 */
--es-leading-snug: 1.4;     /* 小标题 */
--es-leading-normal: 1.6;   /* UI */
--es-leading-relaxed: 1.75; /* 正文 */
```

- 正文 `16px / 1.75`；H1 36/1.25；H2 24/1.35；H3 18/1.45；H4 16/1.5。
- 段落间距 `1em`；H2 上 48px / 下 16px；H3 上 32px / 下 12px。
- 中文正文最大 760px（约 35–45 字/行）；英文可放宽到 800px。
- 代码 `13.5px / 1.7`；表格 `13px / 1.5`。
- 不用全大写英文标题；不用 letter-spacing 大法制造“高级感”。

### 6.6 主题风格与色彩系统

**主题风格**：克制的技术蓝 + 大量白/浅灰留白 + 真实产品截图 + 少量青绿作为“AI/成功”强调。浅色是默认；深色是同构的另一套 token，不是反色滤镜。禁止彩虹徽章、彩色渐变卡片、emoji 装饰、无限 shimmer。品牌感来自“同一套骨架 + 同一套字体 + 同一套截图风格”，不是来自更多颜色。

**品牌与语义**

```css
/* 品牌（填充、装饰、大字号） */
--es-brand-primary: #3b82f6;
--es-brand-primary-strong: #2563eb; /* 链接/按钮文字，AA 5.17:1 */
--es-brand-accent: #06b6d4;
--es-brand-tint: #eff6ff;

/* 文字 */
--es-text-primary: #1f2329;   /* 15.78:1 */
--es-text-secondary: #5b6472; /* 5.98:1 */
--es-text-tertiary: #6b7280;  /* 4.83:1 */
--es-text-disabled: #9ca3af;  /* 仅用于禁用态，不用于正文 */

/* 语义文字（AA） */
--es-link: #2563eb;
--es-link-hover: #1d4ed8;
--es-success-text: #15803d; /* 5.02:1 */
--es-warning-text: #b45309; /* 5.02:1 */
--es-danger-text: #b91c1c;  /* 6.47:1 */
--es-info-text: #2563eb;

/* 背景/边框 */
--es-bg-page: #ffffff;
--es-bg-subtle: #f7f8fa;
--es-bg-code: #f6f8fa;
--es-border: #e5e7eb;
--es-border-strong: #d1d5db;

/* 焦点 */
--es-focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.35);
```

**使用规则**

- `#3b82f6` 只用于填充、图标、大字（≥24px 或 ≥18.66px bold）；正文链接与按钮文字用 `#2563eb`。
- 状态色只用于文字/图标/左边框，不用大面积背景；浅底用 `*-tint`（如 `#ecfdf5`）。
- 一个页面最多一个强调色；AI 相关页面用品牌青作为强调，不再新增紫/琥珀/彩虹。
- 深色模式（`.dark`）：
  - `--es-bg-page: #0b1220`；`--es-bg-subtle: #111827`；`--es-bg-code: #0f172a`
  - `--es-text-primary: #e5e7eb`；`--es-text-secondary: #9ca3af`；`--es-border: #1f2937`
  - `--es-link: #60a5fa`；品牌填充仍用 `#3b82f6`
- 对比度验收：所有正文/链接/按钮文字 ≥ 4.5:1；大字号 ≥ 3:1；禁用态除外。

### 6.7 间距、圆角、阴影、动效、层级

**间距（4px 基准）**

```css
--es-space-1: 4px;  --es-space-2: 8px;  --es-space-3: 12px;
--es-space-4: 16px; --es-space-5: 24px; --es-space-6: 32px;
--es-space-7: 48px; --es-space-8: 64px; --es-space-9: 96px;
```

规则：组件内 4/8/12；区块间 24/32；页面段间 48/64；Landing 段落 96。禁止 5/7/10/15px 这类非阶梯值（图表微调除外）。

**圆角**

`--es-radius-xs: 4px`（徽章/标签）、`sm: 8px`（按钮/输入）、`md: 12px`（卡片）、`lg: 16px`（大面板）、`full: 999px`（胶囊）。

**阴影（3 级）**

```css
--es-shadow-sm: 0 1px 3px rgba(15, 23, 42, .06);
--es-shadow-md: 0 6px 20px rgba(15, 23, 42, .08);
--es-shadow-lg: 0 16px 40px rgba(15, 23, 42, .12);
```

卡片默认 `sm`；hover 升到 `md`；浮层/弹窗 `lg`。不要每个卡片都加阴影。

**动效**

```css
--es-duration-fast: 120ms;
--es-duration-base: 180ms;
--es-duration-slow: 240ms;
--es-ease: cubic-bezier(.2, 0, 0, 1);
```

规则：

- 只对 `opacity / transform / color / background-color` 做动画；不对 `height/width/all` 做。
- 进入 180ms、退出 120ms；hover 120ms；页面切换 240ms。
- 禁止无限循环的 shimmer/pulse（除非是 loading 指示）。
- 必须提供：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**z-index**

```css
--es-z-sticky: 10; --es-z-header: 100; --es-z-overlay: 1000;
--es-z-modal: 1100; --es-z-toast: 1200;
```

### 6.8 组件规范

#### Header

- 高 64px，sticky，白底/深色底，底部 1px 边框（不要阴影）。
- 左：SVG logo（mark + wordmark），点击回首页。
- 中：最多 6 个一级导航；当前项用 2px 下划线 + 主色，不用背景块。
- 右：搜索（Ctrl/⌘K）、主题、语言、版本、GitHub；移动端折叠为汉堡 + 搜索图标。
- 所有图标按钮必须有 `aria-label`；焦点可见。

#### Sidebar

- 宽 260px，sticky，独立滚动；分组标题 12px 大写/字重 600/次要色。
- 当前项：左侧 3px 主色条 + 主色文字 + 浅底；hover 只变文字色。
- 分组可折叠；默认展开当前组；记住滚动位置。
- 移动端为抽屉，遮罩点击关闭，Esc 关闭，焦点陷阱。

#### TOC

- 宽 220px，sticky；只收 H2/H3；当前项主色 + 左边框。
- 滚动高亮用 `IntersectionObserver`；点击平滑滚动，偏移 80px。
- `<1280px` 隐藏；移动端可折叠到正文顶部。

#### 代码块

```
┌──────────────────────────────────────────────┐
│ ts  src/main.ts                    [复制] [▾] │
├──────────────────────────────────────────────┤
│ 1  import { createApp } from 'vue'           │
│ 2  ...                                       │
└──────────────────────────────────────────────┘
```

- header：语言标签 + 文件名 + 复制 + 折叠；语言标签小写。
- 行号可选（默认开，移动端关）；高亮行用浅黄底 + 左侧 2px 主色。
- 最大高度 480px，超出滚动；展开后不限。
- 复制成功有 1.5s 的“已复制”反馈；失败降级到 `execCommand`。
- 代码内容必须来自源码单源，不手抄；示例必须能跑。

#### Demo 卡片

- 结构：标题 + 描述 + 预览区 + 工具栏（预览/代码切换、复制、在 Playground 打开）。
- 预览区 padding 24，白底（深色下 `--es-bg-subtle`），移动端 16。
- 代码区与代码块规范一致；切换不重新挂载预览。
- 每个 demo 有稳定锚点 `#demo-<name>`，可被搜索与跨站链接命中。

#### 提示块

- 四种：info（蓝）、tip（绿）、warning（琥珀）、danger（红）。
- 结构：图标 + 标题（可选）+ 正文；左侧 3px 边框 + 浅底。
- 不用 emoji 当图标；不用大面积饱和底色。

#### 表格

- 表头 sticky、浅底、13px/600；行高 44；斑马纹可选。
- 第一列可固定；宽表横向滚动，不撑破正文。
- 每个表有 caption 或前置说明；API 表必须含“默认值”和“since”。

#### 页脚

- 四列：产品（组件/案例/AI）、文档（指南/API/更新日志）、生态（Vue2/AntDV/MCP/CLI）、社区（GitHub/Discussions/贡献）。
- 底部：版权（动态年份）+ 许可证 + 最后构建时间。
- 子站页脚必须链回主站 canonical。

#### 搜索

- 构建时索引：指南 + 组件 API + 高级 + 案例 + AI 页 + 每个 demo 的标题/描述。
- 快捷键 Ctrl/⌘K；上下键选择、Enter 跳转、Esc 关闭。
- 结果分组（指南/组件/案例/AI）；显示命中片段高亮；空结果给热门链接。
- 搜索索引随构建更新，不做运行时全量抓取。

#### 版本与状态

- Header 版本徽章可点，打开版本列表 + 更新日志。
- 每个组件页有状态：`Stable` / `Beta` / `Deprecated` / `Legacy`；`Legacy` 必须写迁移路径。

#### 404

- 品牌化插图/图形 + “页面不存在” + 搜索框 + 5 个热门链接 + 返回首页。
- 不能只显示 “404”。

### 6.9 内容规范

#### 页面元信息

- 每页一个 H1；H1 不含 emoji、不含序号、不重复站点名。
- 标题公式：`页面名 · ES-Plus`；子站：`页面名 · Ant Design Vue 端 · ES-Plus`。
- Description 80–120 字：这是什么、解决什么问题、读完能做什么；不堆关键词。
- 每页有 `canonical`、`og:title`、`og:description`、`og:image`、`og:url`。
- 语言：`<html lang>` 随 locale 切换；英文页用 `hreflang` 互指。

#### 页面结构

- Lead：2–3 句，回答“是什么/为什么/读完能做什么”。
- 正文最多到 H3；H4 只用于 API 表分组。
- 每 2–3 屏有一个“可扫读锚点”：表格、代码、图、清单、提示块。
- 长文（>2000 字）必须有 TOC 与“本文目录”摘要。
- 每个概念页结尾给“下一步”链接；每个 API 页结尾给“相关组件”。

#### 写作语气

- 直接、技术、第二人称；不用“神器/炸裂/真的能/超强”等营销词。
- 不用 emoji 做标题或正文装饰；需要图标时用 SVG。
- 中文用全角标点；中英文之间加空格；专有名词保留官方大小写（Vue 3、Element Plus、Ant Design Vue）。
- 一句话不超过 60 个汉字；一段不超过 4 行。
- 先给结论，再给原因；先给可运行示例，再给原理。

#### 数字与主张

- 每个数字必须有：口径（统计什么）、来源（文件/脚本）、日期。
- 同一数字只允许一个源（如 `one-config-diff.json`），页面只读不写。
- 对比必须同范围：同一页面、同一功能、同一数据；不能拿“模板行数”对比“整页行数”。
- 无法测量的数字（如“200+ 行 → 30 行”）要么补测量脚本，要么删除。
- 页面明确写“没证明什么”（现有 NativeVsAi 已做得很好，应推广）。

#### 术语表（三站共用）

| 术语 | 定义 | 不要写成 |
|---|---|---|
| 渲染端 / 渲染器 | 同一 schema 的具体 UI 实现（Vue3+EP / Vue2+EUI / Vue3+AntDV） | “四个框架”“三端框架” |
| 配置层 | 用 JSON schema 描述页面，由渲染器生成 UI | “组件库”（仅指包本身时可用） |
| Schema | 页面/表单/表格的 JSON 描述 | “配置代码”混用 |
| 片段（fragment） | 可独立生成/编译的局部 UI 单元 | “组件” |
| 收敛（convergence） | 通过有限轮修复让产物通过编译/校验 | “自动修复”夸大 |
| 旗舰案例 | 端到端、可运行的完整业务页 | “Demo” |

#### 双语策略

- 中文是 canonical；英文优先覆盖：Landing、Getting Started、Why、MCP、Vue2、AntDV、Migration。
- 语言切换器只对已翻译页面显示；未翻译页面给明确提示，不静默回退。
- 英文页的代码注释、标题、按钮全部英文；不出现中英混排。
- 英文内容不是逐字翻译：保留技术细节，重写语气与例子。

#### 新鲜度

- 更新日志从 GitHub Releases 生成；每次发版必须更新。
- 每个 API 表有 `since` 与“最后核对版本”。
- 页面底部显示“最后更新：YYYY-MM-DD”（从 git 取）。
- 过期内容（>6 个月未核对）加“可能已过时”提示，或直接删除。

#### 内容清单（补齐）

- FAQ（安装、样式、权限、i18n、Vue2、AntDV、AI 生成失败）。
- 迁移：Vue2 → Vue3、Element UI → Element Plus、es-eui → @es-plus/vue2、v1.4 包名。
- 对比：vs 原生、vs vue-element-admin、vs Formily、vs amis、vs TypeChat。
- 基准：渲染性能、包体积、生成准确率（口径 + 复现命令）。
- 路线图 + 版本策略 + Vue2 EOL。
- 贡献指南 + 本地开发 + 发布流程。
- 设计语言页（颜色、字号、间距、组件状态），让“规范”本身可被引用。

### 6.10 视觉资产规范

| 资产 | 规范 |
|---|---|
| Logo | SVG：mark（方形/图形）+ wordmark（ES-Plus）；最小 24px；深浅两版；不得用 CSS 文字代替 |
| Favicon | 16/32/180/512 多尺寸；与 mark 一致 |
| 产品截图 | 2x PNG/WebP；1440×900 或 1280×800；浅色 + 深色各一；不含浏览器 chrome；关键区域可标注 |
| 演示 GIF/视频 | GIF ≤ 3MB，宽 ≤ 960；MP4/H.264 优先；≤ 30s；首帧即结果 |
| 架构图 | SVG；统一线宽/圆角/字号；不嵌位图文字 |
| OG 图 | 1200×630；每类页面一张模板（Landing/Guide/API/Case/AI）；标题 ≤ 12 字 |
| 社交卡 | GitHub social preview 1280×640；与 OG 同源 |
| 图标 | 只用一套（推荐 Lucide/Element Plus 图标二选一）；尺寸 16/20/24；不混 emoji |
| Alt 文本 | 所有内容图必须有；装饰图 `alt=""` |

规则：图片必须来自真实产品（截图/录屏），不用 stock 图；截图更新随 UI 发版；所有资产进 `docs/brand/` 或 `public/` 并纳入校验。

### 6.11 功能规范

| 功能 | 规范 |
|---|---|
| 搜索 | 全站索引；Ctrl/⌘K；分组结果；空态建议；索引构建时生成 |
| 主题 | 全站 `.dark`；首屏前内联脚本应用；无闪白；所有页面有覆盖 |
| 国际化 | 语言切换只显示可用语言；`<html lang>` 同步；`hreflang` |
| 版本 | Header 版本徽章可点；版本页 + 更新日志 + 迁移链接 |
| 代码 | 高亮/复制/文件名/语言/折叠/沙箱；移动端可横向滚动 |
| 反馈 | 每页“编辑此页 / 报告问题 / 这页有帮助吗”；结果进 issue 或分析 |
| 导航 | 无孤儿；当前项高亮；移动端抽屉；键盘可达 |
| 404 | 品牌化 + 搜索 + 热门链接 |
| 分析 | 隐私友好的 pageview + 关键事件（复制、运行、下载、跳 npm） |
| 性能 | 每路由 JS 预算；图片懒加载；字体 `font-display: swap` |

### 6.12 SEO 与增长规范

**技术层**

- 使用 history 路由 + 构建时预渲染（每路由生成独立 HTML）；无法预渲染时至少生成 `404.html` SPA fallback。
- sitemap 只列最终可访问 URL；构建后跑 HTTP 200 校验。
- 每页独立 title/description/canonical/OG；子站重复页 canonical 到主站或 `noindex,follow`。
- JSON-LD：`SoftwareApplication`（首页）、`TechArticle`（指南/API）、`BreadcrumbList`（内页）、`FAQPage`（FAQ）。
- `llms.txt` + 每页 `.md` 镜像 + MCP 文档端点：让 AI 工具能读、能引用。
- RSS/Atom：更新日志与博客。
- 内链：每页 ≥3 个入链；相关阅读 3 条；面包屑。
- 外链：npm、GitHub Releases、Discussions、掘金/知乎/Dev.to 的 canonical 回链。

**内容层（长尾入口）**

- 教程：30 分钟做一个审批流、从 Element Plus 迁移、Vue2 项目接入。
- 对比：ES-Plus vs 原生 / Formily / amis / vue-element-admin / TypeChat。
- 基准：包体积、首屏、生成准确率、编译通过率（公开方法）。
- 迁移：Vue2 EOL、包名 v1.4、Element UI → Element Plus。
- 故障排查：样式冲突、权限不生效、i18n 不切换、AI 生成编译失败。
- 更新日志：每版一篇，可被搜索。

**度量层**

- 漏斗：搜索曝光 → 访问 → 文档阅读 → Playground 运行 → npm 安装 → GitHub star。
- 事件：`copy_code`、`run_demo`、`open_playground`、`download_schema`、`click_npm`、`switch_lang`、`search_no_result`。
- 每季度复盘：Top 20 落地页、跳出率、搜索无结果词、404 来源。

### 6.13 品牌推广规范

**信息层级（只允许一套）**

```
名称：ES-Plus
定位：中后台 CRUD 的配置层
英文主张：Write once, render everywhere.
中文副标题：一份 JSON 配置 · 三个渲染器 · 生成即编译
三条承诺：一份配置 / 三端通用 / AI 原生
```

- H1 要么用定位语，要么用 `ES-Plus` + 定位副标题；三站一致，不再出现“组件库”。
- 英文主张只在英文页面/英文物料使用；中文页面不混排。
- 所有数字（76.5%、3 端、14 控件、编译通过率）来自单源，带口径与日期。

**渠道与物料**

| 渠道 | 物料 | 规则 |
|---|---|---|
| GitHub | README、social preview、Releases、Discussions | README 首屏 = 定位 + GIF + 安装 + 三端截图 |
| npm | 包 README、keywords、repository | 与主站同一套文案与图 |
| 掘金 / 知乎 | 教程、对比、迁移 | 文末 canonical 回链主站；不重复全文 |
| Dev.to / Medium | 英文教程 | 同上 |
| MCP 注册表 | server 描述、工具示例 | 用“配置即页面”的用例，不用“AI 编码”泛词 |
| 视频/GIF | 60s 产品演示、3 段 15s 功能 | 首帧即结果；竖版适配社媒 |

**可信度资产**

- 一句话 + 一张图 + 一个可复现命令，是每个渠道的最小单元。
- 公开“没证明什么”（现有 NativeVsAi 的做法）比隐藏边界更能建立信任。
- 不买量、不刷 star；用可复现的基准、迁移案例、真实截图换口碑。

---

## 7. 落地路线图

> 估算按 1 名熟悉仓库的前端 + 0.5 名设计/内容；不含翻译与大规模截图制作。先做“可信与可用”，再做“好看”，最后做“增长”。

### Wave 0 — 止血（3–5 人日，必须先做）

| # | 任务 | 关键文件 | 验收 |
|---|---|---|---|
| 0.1 | 修复主站代码块渲染 | `es-plus-docs/src/views/Doc.vue` | 每个 fence 恰好 1 个 wrapper；无 “bash/复制” 文本节点；复制可用；线上抽查 3 页 |
| 0.2 | 修复 OG 二进制同步 | `scripts/lib/text-sync.mjs`、`scripts/sync-brand.mjs`、`scripts/check-brand-assets.mjs` | `cmp` 源与目标一致；PNG 头 `89 50 4E 47`；三站 OG 可预览 |
| 0.3 | 数字统一 | `one-config-diff.json`、`zh-CN.json`、`en-US.json`、Vue2 首页、README | 151/90 与 136/81 二选一，全站一致；77%→76.5%；200+/30 删除或补测量 |
| 0.4 | 更新日志重建 | `es-plus-docs/src/docs/changelog.md` | 覆盖 vue3 1.7.0 / vue2 1.4.0 / adapter 1.3.0 / core 1.3.0 / mcp 1.4.1 / cli 1.4.0；含迁移提示 |
| 0.5 | 逐页标题/描述 | 主站其余 13 个视图（含 9 个营销/AI 页）；AntDV/Vue2 `router.afterEach` | 每个路由有唯一 title/description；子站至少 document.title |
| 0.6 | sitemap 止血 | `es-plus-docs/vite.config.ts`、`public/404.html` | 预渲染前：sitemap 只列真实可访问 URL 或暂时移除；深链有 404 回退 |
| 0.7 | 移动端止血 | `es-pc/src/layouts/DocLayout.vue`、`es-eui/src/App.vue` | 390px 下正文 ≥320px；无横向滚动；导航可开合 |
| 0.8 | 导航补齐 | `AppSidebar.vue`、`AppHeader.vue`、`DocLayout.vue`、`es-eui/App.vue` | AI 6 页有入口；无孤儿；当前项随路由更新 |
| 0.9 | 搜索扩容 | `es-plus-docs/src/components/doc/DocSearch.vue` | 组件/高级/案例/AI/demo 均可搜；空态有建议 |
| 0.10 | Vue2 主题页纠正 | `es-eui/src/views/guide/theme.vue` | 使用 `--es-brand-primary` 与 `.dark`；版本/页脚与品牌一致 |
| 0.11 | 品牌统一 | 三站 Home/App/DocLayout | H1 统一为定位语（或 ES-Plus + 定位副标题）；去掉“组件库”；页脚统一 |

### Wave 1 — 统一（1–2 周）

| # | 任务 | 验收 |
|---|---|---|
| 1.1 | `design-tokens.css` v2：字体/字号/行高/间距/圆角/阴影/动效/z/断点/宽度/焦点 | 新 token 全量存在；老别名不破坏 |
| 1.2 | 新增 `docs/theme/docs-layout.css`，三站引入 | 760/260/220/1440 一致；三站壳层同构 |
| 1.3 | 三站页面套用统一排版 | 组件/高级/AI/案例页不再各自定 H1/H2 字号 |
| 1.4 | 文档 chrome：TOC、上下篇、面包屑、编辑此页、反馈、最后更新 | 三站文档页 100% 覆盖 |
| 1.5 | 深色模式补全或明确关闭 | 全部页面深色可用且无闪白；或删除死 token 并标注 light-only |
| 1.6 | 代码块统一 | 语言/文件名/复制/折叠/行高亮；三站一致 |
| 1.7 | 可访问性基线 | skip link、focus-visible、reduced-motion、AA 对比度、键盘可达 |
| 1.8 | 页脚/404 统一 | 三站四列页脚；品牌化 404 + 搜索 |

### Wave 2 — 好看（2–3 周）

| # | 任务 | 验收 |
|---|---|---|
| 2.1 | Landing 模板重构 | 首屏 = 价值 + 主 CTA + 产品实拍/可交互；1 屏内出现证据 |
| 2.2 | 产品资产 | 核心 8 个页面各 2 张截图（浅/深）+ 3 段 ≤30s 录屏/GIF |
| 2.3 | 首屏“改 JSON → 三端变”组件 | 可改 3 个字段；三端预览同步；可重置；移动端可用 |
| 2.4 | 组件 API 模板 | 实时示例 + Props/Events/Slots/Expose + 主题 + a11y + since |
| 2.5 | 案例模板 | 背景 → 截图 → 配置 → 结果 → 成本 → 边界 |
| 2.6 | AI 证据页重构 | 用户任务标题；30s 演示；方法/产物/数据/边界；术语折叠 |
| 2.7 | 视觉系统 | 一套图标、一个强调色、统一卡片/徽章/图表；无 emoji 标题 |
| 2.8 | 动效 | 150–240ms；只用于状态；reduced-motion；无无限 shimmer |

### Wave 3 — 可发现（2–4 周）

| # | 任务 | 验收 |
|---|---|---|
| 3.1 | history 路由 + 预渲染/SSG | 每个内容页独立 HTML；深链 200；`<title>` 静态可见 |
| 3.2 | 每页 SEO/OG/JSON-LD | 100% 路由有 title/desc/canonical/OG；首页 SoftwareApplication；文章 TechArticle；FAQ FAQPage |
| 3.3 | sitemap/robots 重建 | 构建后 URL 全部 200；三站各自 sitemap；子站重复页 canonical/noindex |
| 3.4 | `llms.txt` + 每页 `.md` + MCP 文档端 | AI 工具可读；`/llms.txt` 200；每页 `.md` 200 |
| 3.5 | 分析 | pageview + 8 个关键事件；无 Cookie 同意负担 |
| 3.6 | 性能预算 | 主站文档路由首屏 JS ≤ 300KB gzip（monaco 懒加载）；AntDV ≤ 400KB；Vue2 ≤ 400KB |
| 3.7 | 内容增长 | FAQ、对比、迁移、基准、路线图、Vue2 EOL 上线；每篇有 canonical 与内链 |
| 3.8 | 外部分发 | npm README、GitHub social preview、掘金/知乎/Dev.to 回链、MCP 注册表 |

### Wave 4 — 治理（持续）

- 每季度一次“三站一致性审计”（本报告的附录 A 作为清单）。
- 每个 PR 跑：构建三站 + 链接检查 + Lighthouse + axe + 截图 diff + 文案守卫。
- 内容负责人制：每篇有 owner、最后核对日期、下次复核日期。
- 设计系统变更走 RFC：先改 token/规范，再改页面。

### 7.1 优先级矩阵

| 影响 \ 成本 | 低 | 中 | 高 |
|---|---|---|---|
| **高** | 代码块修复、OG 修复、数字统一、导航补齐、移动端止血 | 搜索扩容、统一排版、TOC/上下篇、深色补全 | 预渲染/SSG、Landing 重构、产品资产 |
| **中** | 更新日志、版本徽章、404、页脚 | 代码块统一、a11y、组件 API 模板 | 设计系统 v2、内容增长 |
| **低** | emoji 清理、图标统一 | 分析、llms.txt | 迁移 VitePress |

---

## 8. 验收与度量

### 8.1 基线 vs 目标

| 指标 | 基线（2026-10-27） | 目标（Wave 3 后） |
|---|---|---|
| 390px 可用站点 | 1/3 | 3/3 |
| 每页独立 title/description | 主站 3/17；子站 0 | 100% |
| 搜索覆盖 | 12 篇指南 | 100% 内容页 + demo |
| TOC / 上下篇 | 1/3 | 3/3 文档页 |
| 深色模式 | 1/3（且不完整） | 3/3（或明确 light-only） |
| 代码块 chrome | 1/3（且坏） | 3/3 |
| sitemap 有效 URL | 抽查 3/19 全 404（其余同构） | 100% |
| OG 可用 | 0/3 | 3/3 |
| AA 对比度 | 多处失败 | 0 失败 |
| skip/focus/reduced-motion | 0/0/0 | 3/3/3 |
| 初始 JS（gzip 估） | 主站 ≥1.5MB；AntDV ≈1.1MB；Vue2 ≈0.7MB | 主站 ≤300KB（文档路由）；子站 ≤400KB |
| 产品截图/录屏 | 0 | ≥8 张 + ≥3 段 |
| 孤儿页面 | ≥6 | 0 |
| 文案数字不一致 | ≥3 处 | 0 |

### 8.2 建议新增的守卫

| 守卫 | 检查 |
|---|---|
| `check:code-fence` | 每个 fence 一个 wrapper；无 header 文本进入 `<code>`；copy 按钮存在 |
| `check:binary-sync` | 源/目标二进制一致（`Buffer.equals`），PNG/JPG 校验魔数 |
| `check:page-meta` | 每个路由有 title/description/canonical/OG；长度在范围内 |
| `check:nav-route-parity` | 路由集合 = 导航可达集合；无孤儿 |
| `check:search-index` | 索引覆盖所有内容路由；demo 可搜 |
| `check:contrast` | 关键文字/按钮组合 ≥4.5:1（大字号 ≥3:1） |
| `check:a11y` | skip link、focus-visible、reduced-motion、h1 唯一、图片 alt |
| `check:mobile` | 390px 无横向滚动；正文 ≥320px；导航可开合 |
| `check:mobile-nav` | 抽屉可聚焦、Esc 关闭 |
| `check:claims` | 数字来自单源；禁止在页面硬编码；口径一致 |
| `check:changelog` | 最新包版本都出现在 changelog |
| `check:sitemap-urls` | 构建后 sitemap URL 全部 200 |
| `check:perf-budget` | 路由级 JS/CSS 体积上限 |
| `check:assets` | 图片尺寸/格式/alt；OG 1200×630；logo 为 SVG |
| `check:heading` | 每页一个 H1；无 emoji；层级不跳级 |

> 现有 `check-site-nav` / `check-site-claims` / `check-brand-assets` / `check-theme-bridge` / `check-docs-layout` 保留，但需要补“渲染后”的断言，不能只比对文本副本。

---

## 9. 附录

### A. 全量页面清单

#### A.1 主站 `es-plus-docs`（17 条路由）

| # | 路由 | 页面 / 内容 | 类型 | 导航入口 | 独立 meta | 主要问题 |
|---:|---|---|---|---|---|---|
| 1 | `/` | Home（1,232 行） | Landing | 顶栏 + 侧栏 | 是 | H1 是品牌名；151/90 vs 136/81；0 截图 |
| 2 | `/quickstart` | 30 秒上手（233 行） | 上手 | 侧栏 | **否** | 3 张静态代码卡；与 getting-started 重复 |
| 3 | `/cases` | 核心案例（496 行） | 案例 hub | 侧栏 | **否** | 5 个 CTA 卡；15 个文字卡；emoji H1 |
| 4 | `/flagship-approval` | 合同审批工作台（225 行） | 旗舰案例 | 侧栏 | **否** | 无 TOC/截图 |
| 5 | `/ai-generated` | 一句话生成（201 行） | AI 证据 | 侧栏 | **否** | 无 TOC/截图 |
| 6 | `/ai-gallery` | AI 画廊（336 行） | 案例列表 | **无** | **否** | 孤儿；无筛选/搜索 |
| 7 | `/ai-gallery/composition` | 组合画廊（519 行） | AI 证据 | **无** | **否** | 孤儿；自有浅色配色 |
| 8 | `/ai-gallery/workflows` | 工具工作流（259 行） | AI 证据 | **无** | **否** | 孤儿 |
| 9 | `/fragment-dashboard` | 片段仪表盘（503 行） | AI 证据 | **无** | **否** | 孤儿；硬编码浅色 |
| 10 | `/native-vs-ai` | 原生 vs AI（404 行） | AI 证据 | **无** | **否** | 孤儿；H1 23px |
| 11 | `/ai-gallery/:id` | 画廊详情（复用） | 详情 | **无** | **否** | 10 个案例；无独立标题 |
| 12 | `/guide/:name` | 12 篇指南（≈5.1k 行） | 指南 | 侧栏 | 是 | 代码块坏；5/12 有英文；`crud-page.md` 孤儿 |
| 13 | `/components/:name` | 5 个组件页（51 demo） | API | 侧栏 | 是 | 无 `/components` 索引；无 EsDialog 页 |
| 14 | `/advanced/:name` | 3 个高级页（52 demo） | 指南/API | 侧栏 | **否** | `/advanced` 用 `.doc-content` 但无 head |
| 15 | `/playground` | Playground（608 行） | 工具 | 顶栏 + 侧栏 | **否** | 预加载 monaco 4.3MB |
| 16 | `/ai-crud` | AI CRUD（555 行） | 工具 | 侧栏 | **否** | 无独立 meta |
| 17 | `*` | 404（53 行） | 404 | — | 否 | 无面包屑/搜索 |

> “12 篇指南”包含 `why-es-plus`、`getting-started`、`installation`、`usage`、`vue2`、`adapter-antdv`、`mcp-server`、`cli`、`permission-i18n`、`schema-setup`、`migration`、`changelog`；`crud-page.md` 未注册。

#### A.2 AntDV 站 `es-pc`（22 个页面）

| # | 路由 | 页面 / 内容 | 类型 | 导航入口 | 独立 meta | 主要问题 |
|---:|---|---|---|---|---|---|
| 1 | `/` | Home（473 行） | Landing | 侧栏 | 否 | 居中文字 hero；无截图；Element Plus 示例 |
| 2 | `/quickstart` | 快速开始（171 行） | 上手 | **无** | 否 | 孤儿；无跳转入口 |
| 3 | `/cases` | 核心案例（466 行） | 案例 hub | 侧栏 | 否 | 唯一 AI 发现路径 |
| 4 | `/flagship-approval` | 旗舰案例（216 行） | 案例 | 侧栏 | 否 | — |
| 5 | `/ai-generated` | AI 生成（203 行） | AI 证据 | 侧栏 | 否 | — |
| 6 | `/fragment-dashboard` | 片段仪表盘（503 行） | AI 证据 | **无** | 否 | 孤儿；claim 与 compile 冲突 |
| 7 | `/native-vs-ai` | 三栏对照（404 行） | AI 证据 | **无** | 否 | 孤儿 |
| 8 | `/ai-gallery` | 画廊（335 行） | 证据列表 | **无** | 否 | 孤儿 |
| 9 | `/ai-gallery/composition` | 组合画廊（519 行） | 证据 | **无** | 否 | 孤儿 |
| 10 | `/ai-gallery/workflows` | 工作流（259 行） | 证据 | **无** | 否 | 孤儿 |
| 11 | `/ai-gallery/:id` | 详情（复用） | 详情 | **无** | 否 | 10 个案例 |
| 12 | `/guide` | 指南（288 行） | 上手 | 侧栏 | 否 | 仅 288 行；与 QuickStart 重复 |
| 13 | `/es-form` | EsForm（392 行，19 demo） | API | 侧栏 | 否 | 残留 Element 术语 |
| 14 | `/es-table` | EsTable（458 行，19 demo） | API | 侧栏 | 否 | API key 缺 55 |
| 15 | `/es-dialog` | EsDialog（288 行，12 demo） | API | 侧栏 | 否 | — |
| 16 | `/es-crud-page` | EsCrudPage（349 行，10 demo） | API | 侧栏 | 否 | — |
| 17 | `/es-error-boundary` | 错误边界（105 行） | API | 侧栏 | 否 | 单 demo |
| 18 | `/svg-icon` | SvgIcon（69 行） | API | 侧栏 | 否 | 单 demo |
| 19 | `/advanced` | 高级联动（363 行，25 demo） | 示例 | 侧栏 | 否 | 无 API 表 |
| 20 | `/es-vxe-table` | vxe（217 行，17 demo） | API | 侧栏 | 否 | 无 API 表；版本漂移 |
| 21 | `/ai-tools` | AI 工具链（67 行） | 指南 | 侧栏 | 否 | 极薄；外链主站 |
| 22 | `*` | 404（44 行） | 404 | — | 否 | 无 H1 |

#### A.3 Vue2 站 `es-eui`（32 个页面）

| # | 路由 | 页面 / 内容 | 类型 | 导航入口 | 独立 meta | 主要问题 |
|---:|---|---|---|---|---|---|
| 1 | `/` | Home（1,955 行） | Landing | 顶栏 | 否 | 100vh 动效 hero；77%；无截图 |
| 2 | `/guide` | 介绍（1,353 行） | 指南 | 顶栏 | 否 | v1.0.2；自称组件库 |
| 3 | `/guide/installation` | 安装（958 行） | 指南 | 侧栏 | 否 | 与组件安装重复 |
| 4 | `/guide/quickstart` | 快速开始（1,584 行） | 教程 | 侧栏 | 否 | 与 `/quickstart`、`/component/quickstart` 重复 |
| 5 | `/guide/configuration` | 配置（1,153 行） | 指南 | 侧栏 | 否 | 遗留 API |
| 6 | `/guide/theme` | 主题（928 行） | 指南 | 侧栏 | 否 | **教错 token**；`$copyText` 缺依赖 |
| 7 | `/guide/i18n` | 国际化（1,186 行） | 指南 | 侧栏 | 否 | 只讲库，不讲站点 |
| 8 | `/guide/developer-guide` | 开发者指南（1,546 行） | 参考 | 侧栏 | 否 | 与组件 API 重复 |
| 9 | `/component` | 组件布局（88 行） | 索引 | 顶栏 | 否 | **默认子路由缺失 → 空白页** |
| 10 | `/component/installation` | 安装（899 行） | 指南 | 侧栏 | 否 | 与 guide 安装重复 |
| 11 | `/component/quickstart` | 复用 guide/quickstart | 教程 | 侧栏 | 否 | 重复 URL |
| 12 | `/component/estable` | EsTable（986 行，25 demo） | API | 侧栏 | 否 | 手写 API；1400px |
| 13 | `/component/vxetable` | Vxe（371 行，15 demo） | API | 侧栏 | 否 | 仅 options |
| 14 | `/component/esform` | EsForm（749 行，16 demo） | API | 侧栏 | 否 | 缺 Events/Slots |
| 15 | `/component/esdialog` | EsDialog（650 行，17 demo） | API | 侧栏 | 否 | 无声明式 API |
| 16 | `/component/escrudpage` | EsCrudPage（699 行，2 demo） | API | 侧栏 | 否 | demo 少 |
| 17 | `/component/eserrorboundary` | 错误边界（197 行） | API | 侧栏 | 否 | 单 demo |
| 18 | `/component/svgicon` | SvgIcon（144 行） | API | 侧栏 | 否 | 单 demo |
| 19 | `/component/combination` | 组合（395 行，18 demo） | 模式 | 侧栏 | 否 | 非 API |
| 20 | `/quickstart` | 30 秒上手（189 行） | 上手 | 顶栏 | 否 | 与两个 quickstart 重复 |
| 21 | `/cases` | 核心案例（522 行） | 案例 hub | 顶栏 | 否 | 5 个 CTA 先于内容；emoji H1 |
| 22 | `/flagship-approval` | 旗舰（243 行） | 案例 | **无** | 否 | 孤儿 |
| 23 | `/ai-generated` | AI 生成（243 行） | AI 证据 | **无** | 否 | 孤儿 |
| 24 | `/fragment-dashboard` | 片段（304 行） | AI 证据 | **无** | 否 | 孤儿；仅编译 |
| 25 | `/native-vs-ai` | 对照（410 行） | AI 证据 | **无** | 否 | 孤儿 |
| 26 | `/ai-gallery` | 画廊（357 行） | 证据列表 | **无** | 否 | 孤儿 |
| 27 | `/ai-gallery/composition` | 组合（545 行） | 证据 | **无** | 否 | 孤儿 |
| 28 | `/ai-gallery/workflows` | 工作流（270 行） | 证据 | **无** | 否 | 孤儿 |
| 29 | `/ai-gallery/:id` | 详情（复用） | 详情 | **无** | 否 | 10 个案例 |
| 30 | `/theme` | 主题预览（154 行） | 演示 | 顶栏 | 否 | SCSS `#409eff`，与 token 冲突 |
| 31 | `/ai-tools` | AI 工具链（108 行） | 指南 | 顶栏 | 否 | 裸 pre；无高亮/复制 |
| 32 | `*` | 404（63 行） | 404 | — | 否 | — |

### B. 关键证据索引

| 主题 | 文件 |
|---|---|
| 代码块渲染 | `es-plus-docs/src/views/Doc.vue:106`（highlight 返回 wrapper）；`docs/theme/docs-content.css:203`（pre 背景被注释）；`docs-content.css:218-297`（wrapper 样式） |
| Sitemap/SEO | `es-plus-docs/vite.config.ts:10-36`；`es-plus-docs/index.html`；`es-plus-docs/public/robots.txt`；线上 `/sitemap.xml` |
| 标题注入 | `es-plus-docs/src/views/Home.vue:341`、`Doc.vue:136`、`ComponentDoc.vue:167`；其余视图无 `useHead` |
| 搜索范围 | `es-plus-docs/src/components/doc/DocSearch.vue:172-214` |
| 导航/孤儿 | `es-plus-docs/src/components/layout/AppSidebar.vue:44-100`；`es-pc/src/layouts/DocLayout.vue:49-122`；`es-eui/src/App.vue:15-84` |
| 移动端 | `es-pc/src/layouts/DocLayout.vue:259-263`；`es-eui/src/App.vue:455-463,500-504,1296-1344` |
| Tokens | `docs/tokens/design-tokens.css:18-60,108-166`；`docs/theme/docs-content.css:13-28,45-54,174-177,203,450-476` |
| 排版宽度 | `es-plus-docs/src/views/Doc.vue:357-422`；`es-pc/src/layouts/DocLayout.vue:285-291`；`es-eui/src/App.vue:443,504` |
| 品牌/文案 | `docs/brand/slogan.json`；`es-plus-docs/src/brand/one-config-diff.json`；`es-plus-docs/src/locales/zh-CN.json:128`；`es-eui/src/views/guide/theme.vue:194-215` |
| OG 损坏 | `docs/brand/og-image.png` vs `es-plus-docs/public/og-image.png`；`scripts/sync-brand.mjs`；`scripts/lib/text-sync.mjs:25-35` |
| 代码块 chrome | `es-pc/src/components/CodeDemo.vue:11-16`；`es-eui/src/components/CodePlayground.vue` |
| 图表/截图 | `es-eui/src/views/fragment-dashboard.vue`（唯一 SVG 图）；其余 0 张内容图 |
| 构建体积 | `es-plus-docs/dist/index.html`、`es-pc/dist/index.html`、`es-eui/dist/js/chunk-vendors.*.js` |
| 既有审计 | `docs/internal/three-sites-audit-report.md`（2026-09-14，缺陷视角）；`docs/internal/site-structure.md`（部分过期） |

### C. 术语与口径

- **渲染端 / 渲染器**：同一 schema 的具体 UI 实现，共三个：Vue 3 + Element Plus、Vue 2 + Element UI、Vue 3 + Ant Design Vue。
- **主站 / 子站**：主站 `es-plus-docs` 是 canonical；`es-pc`、`es-eui` 是渲染器门户。
- **scoped / whole-file**：`115 → 27` 是“模板 + 事件胶水”口径；`136 → 81` 是“整页非空行”口径。两者不能混用。`151 → 90` 当前与两者都不一致，需先修数据源。
- **实测 / 推断**：本文 `[实测]` 指本机或线上验证；`[推断]` 指按主流惯例判断，未在仓库验证。
- **P0/P1/P2**：P0 阻断可信度或基本可用性；P1 影响专业度与阅读体验；P2 影响增长与长期维护。

---

## 10. 最终建议（如果只能做五件事）

1. **修代码块**：主站指南的代码块现在是坏的；这是“看起来不专业”的最大单点。
2. **修可发现性**：history + 预渲染、逐页 meta、有效 sitemap、把 6 个 AI 证据页放进导航与搜索。
3. **修移动端**：AntDV 与 Vue2 的 390px 不可用，等于放弃移动流量。
4. **建一套真正共享的设计系统**：字体/字号/行高/间距/动效/断点/宽度 token + 统一文档骨架；不是只共享颜色。
5. **给产品拍照片**：8 张真实界面截图 + 3 段 30 秒录屏 + 首屏“改 JSON → 三端变”的可交互证明。没有产品证据，再好的文档也只能显得“普通”。

> 现有内容资产（303 个可运行示例、10 个 AI 案例、18 个组合、12 次工具调用、实测数字）已经强于大多数同类项目。缺的不是“再写更多”，而是**把已有的证据包装成可发现、可理解、可相信的产品体验**。

