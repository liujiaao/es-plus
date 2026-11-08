# 三站点视觉与内容全量审计（2026-11-07）

> 审计对象：`es-plus-docs`（主站，Vue3 + Element Plus）、`es-pc`（Vue3 + Ant Design Vue）、`es-eui`（Vue2 + Element UI）
> 审计方式：源码静态审查（设计令牌、组件、文案、路由）+ 自动化浏览器实测（1440×900 / 390×844 双视口、计算样式、DOM 尺寸、对比度计算、控制台）
> 审计范围：设计 · 品牌与理念 · 组件功能与案例 · 文档与功能介绍 · 文案 · 排版布局 · 视觉美观与整体感受 · 与主流开发文档站的符合度
> 性质：只读审计，未修改任何生产代码；截图产物在 `audit/`（未跟踪）

---

## 0. 一句话结论

**文档内核已经是主流水平，外壳还停在三个不同的时代。**

主站组件文档（三栏布局、Stability 标记、代码分栏、搜索、暗色、i18n）是可直接对标 Ant Design / Element Plus 官方的合格品；但三个站点的首页与视觉外壳是三套互不相干的审美——主站是"扁平白 + 渐变字"的极简营销页、es-pc 是"白卡片纸 + 实心蓝"的企业风、es-eui 是"高饱和渐变 + 红绿对比卡"的 2018 年代营销落地页。三者共享同一套色板文件，却没有共享同一个设计系统。

主站首页的问题不是"不好看"，而是**信息层级倒置**：它把最大的字号（72px）给了品牌名 `ES-Plus`，把真正的价值主张塞成 20px 灰字；首屏 600px 高度里没有一张真实产品画面，唯一的"证据"是一个 11–12px 的可交互代码面板。用户第一眼看到的是"一个叫 ES-Plus 的东西"，而不是"这个东西能替我少写 90% 的 CRUD 代码"。

---

## 1. 评分卡

| 维度 | 主站 es-plus-docs | es-pc | es-eui | 说明 |
|---|---|---|---|---|
| 设计系统一致性 | 6.0 | 5.0 | 3.5 | 令牌存在但排版/间距维度未被消费（三站 spacing 令牌使用次数均为 **0**） |
| 品牌与理念传达 | 7.0 | 6.5 | 4.0 | 定位清晰，但三站口径不一致（76.5% vs 77%；151→90 vs 300+→50+） |
| 首页视觉美观 | **5.0** | 6.0 | 4.0 | 主站层级倒置、章节宽度跳动；es-eui 高饱和渐变已过时 |
| 组件功能与案例设计 | 8.0 | 6.5 | 6.0 | 能力覆盖强（表单 14 控件 / 表格 25 示例），但演示页过长、举证偏弱 |
| 文档结构与功能 | 8.5 | 6.0 | 5.5 | 主站达标；两子站缺搜索、暗色、语言切换 |
| 文案宣传 | 7.5 | 6.5 | 4.5 | 主站文案具体、有数字、英文译文质量高；es-eui 数字与主站冲突且自曝短板 |
| 排版布局 | 6.0 | 6.5 | 4.5 | 主站内容区 760px 合理，但 API 表描述列仅 104px |
| 移动端 | 7.0 | 5.5 | 4.0 | 主站无横向溢出；es-pc 演示表挤成 277px；es-eui 侧栏静态占 380px |
| 可访问性（对比度） | 5.5 | 6.5 | 4.0 | 青蓝 `#06b6d4` 白底 2.43:1、白字 2.43:1，多处不达 AA |
| **是否符合主流文档站** | **基本符合（文档）/ 不符合（首页）** | 部分符合 | 不符合 | 详见 §4.7 |

---

## 2. 全站量化底数

| 指标 | 主站 | es-pc | es-eui |
|---|---|---|---|
| 首页高度 @1440 | **8,935 px** | ~3,200 px | ~5,400 px |
| 首页 section 数 | **11** | 5 | 8 |
| 首页 section 宽度 | 1200 / 1440（full-bleed）/ 800 三种混用 | 单列白纸卡片 | 单列全宽 |
| 首页 H1 字号 | **72 px / 行高 108 px**，渐变文字 | 48 px，实心蓝 | 56 px，白色压在渐变上 |
| 文档 H1 / 正文 | 30 px / 15 px | 30 px / 15 px–27 line | 32 px / 15 px–25.5 line |
| 文档三栏 | 侧栏 260 + 正文 760 + 目录 220，header 64 | 侧栏 + 正文 ~847，**无右目录** | 侧栏 260，**无右目录**，header 60 |
| 最长文档页 | **18,095 px**（API 从 9,617 px 才开始） | ~12,000 px | **20,492 px 桌面 / 31,764 px 移动** |
| CSS 变量引用 / 硬编码 hex | 965 / **303** | 492 / **649** | 1,286 / **1,095** |
| `font-size` 声明 / 字号令牌引用 | 464 / **35** | 368 / **35** | 684 / **31** |
| `--es-space-*` 使用次数 | **0** | **0** | **0** |
| 演示数量 | 18 | 19 | **50** |
| 产物体积（dist） | **25 MB**（monaco 4.29M + ts.worker 7.05M + vxe 1.16M + element-plus 887K） | 8.5 MB | 7.9 MB |
| 搜索 / 暗色 / 语言切换 | ✅ / ✅ / ✅ | ❌ / ❌ / ❌ | ❌ / ❌ / ❌ |

> 令牌文件 `docs/tokens/design-tokens.css` 定义了 4–96px 的 `--es-space-1..9` 与 12–56px 的字号阶梯，三站源码对其引用次数为 0 / 0 / 0。**这意味着它不是设计系统，只是一份配色清单。**

---

## 3. 分维度结论

### 3.1 设计系统与视觉一致性

**结论：有令牌，无系统。**

1. **间距维度完全失效。** 三个站点的 `--es-space-*` 使用次数均为 0，全部靠手写 `padding: 72px 48px` / `margin-bottom: 56px` 散落在各视图里。这直接导致同一站内章节间距不统一（主站首页 section padding 在 48/64/72/96 之间游走）。
2. **字号维度近乎失效。** 主站 464 条 `font-size` 声明里只有 35 条走令牌（7.5%）；es-eui 684 条里 31 条（4.5%）。字号漂移的直接后果见 §3.7 的"18 / 20 / 22 三段灰字"。
3. **硬编码色值压倒变量。** es-pc 649 处、es-eui 1,095 处 hex 直写。改一次品牌色需要改上千处，实际上等于不可能改。
4. **三站三张脸。** 同一套 `--es-brand-primary:#3b82f6` 在三个站点长出了三种视觉语言：主站"白底 + 渐变字 + 圆角 16 卡片"、es-pc"灰底 + 白纸卡片 + 实心蓝"、es-eui"全屏渐变 hero + 红绿对比卡"。用户从主站跳到 es-eui 会觉得进了另一个产品。

### 3.2 品牌与理念宣传

**结论：定位是清楚的，口径是分裂的。**

- 单源 `docs/brand/slogan.json` 的定位是 **"中后台 CRUD 的配置层"**，三条承诺分别是「一份 JSON 配置 → 76.5% 字段一致」「跨渲染器」「AI 原生」。这句话是好的：它回答了"你和 Formily / Amis 有什么不同"。
- 但落到三个站点后：
  - 主站 / es-pc：`76.5%`、`151 → 90`、`115 → 27`
  - es-eui：**`77%`**、**"传统方式 300+ 行 vs ES-Plus 50+ 行"**
- es-eui 的对比数据自曝短板：其 Vue2 对比样本中位数为 **74 行**、**0/31 对**示例满足"≤10 行"，页面同时又写着"零成本切换"。这是审计中**最伤信任的一处**——用户只要多看一眼就会得出"你们自己都没迁完"的结论。
- 三个站点都没有把"配置层"这个最锋利的定位放进入口层。主站首页 H1 是品牌名，es-pc 首页 H1 是"企业级中后台组件库"，es-eui 是"Vue2 中后台解决方案"。**三个站点在讲三个不同的产品。**

### 3.3 主站首页（重点诊断）

主站首页 11 个 section、8,935px，顺序为：
`hero → 三条承诺 → L2 案例 → 代码对比 → 三渲染器 tabs → AI 实时演示 → 产品实拍 → 视频 → 特性 → 组件 → 快速开始`

**为什么"视觉美观感受较差"——九条可定位的成因：**

1. **层级倒置（最致命）。** `.hero-title` 72px / 800 weight / 108px 行高，内容是品牌名 `ES-Plus`；真正的价值主张 `一份 JSON 配置 · 三个渲染器 · 生成即编译` 是 `.hero-title-sub` **20px 灰色**，物理上嵌在 H1 里面。用户 3 秒扫视时读到的是"ES-Plus"，读不到"能干什么"。
2. **三段灰字堆叠。** 20px tagline、22px description、18px subtitle 三个相邻、同色系、同字重的文本块，没有任何分隔或节奏差异。视觉上像一段没排版的说明文，这也是"土"感的主要来源。
3. **首屏没有产品。** hero 右栏是 `HeroTriRender`——一个 11–12px 字号的代码/渲染面板，信息密度极高、可读性极低，无法承担"首图"职责。600px 高度的巨大版面里，最大的视觉对象是一段看不清的代码。
4. **渐变文字。** `linear-gradient(135deg, #3b82f6, #06b6d4)` + `background-clip:text`。在 72px 大字上，这是"AI 生成落地页"最强的视觉信号；且青色端 `#06b6d4` 在白底上对比度 **2.43:1**，大字 3:1 的门槛也够不到。
5. **章节宽度抽搐。** `.hero-section` max-width 1200、某些 section 全宽 1440、`.get-started-section` 800。左边缘在 **168px ↔ 288px** 之间来回跳 4 次，滚动时页面像在左右晃。
6. **组件区孤儿卡。** `.components-grid` 是 `repeat(3, 1fr)`，但只有 4 张卡 → 第二行一张孤零零的卡。视觉上读作"布局 bug"。es-form 文档页的特性卡同样 3+1。
7. **产品实拍默认 tab 是自己。** `docs/product/shots.json` 的第一个 tab `docs-home-light` 是"首页首屏"——即用户此刻正在看的这一页的截图。八个 tab 还会换行，末行孤零零一个 "Playground"。首屏自证首屏，是典型的"没有真实产品可秀"信号。
8. **AI 演示举证太弱。** `AiLiveDemo` 的预览表格所有单元格都是 `—`（空表），淡绿背景 + 绿色 CTA 与品牌蓝抢戏。AI 是这个产品的核心卖点，却用一张空表来证明。
9. **配色没有主次。** 品牌蓝、青色 accent、对比区的语义红/绿、AI 区的绿，四种强色在同一页争夺注意力，没有一种颜色承担"唯一强调"的角色。

**结论：** 问题不是"缺设计"，而是**把预算花在了错误的地方**——72px 字、渐变、11 个 section、8 张截图、3 段视频，全都在"量"上堆，而没有在"第一眼说清一句话 + 第一屏给一张真图"上做取舍。

### 3.4 组件功能与案例设计

**结论：能力覆盖是这次审计里最强的资产，但展示方式把资产浪费了。**

- 能力面确实厚：`EsForm` 14 类控件 / 18 个示例；`EsTable` 25 个示例；`EsCrudPage` 完整 CRUD；`useDialog`、`permissionValue` 字段级权限、`reactions` 联动、`cellDataOptions`、`triggerEvent`、条件必填、角色权限。
- 但**举证结构是"清单式"而非"任务式"**：用户看到的是 25 个孤立的表格示例，而不是"做一个带审批流的订单列表要怎么写"。主流做法（Ant Design Pro、Formily、Amis）都是**一个完整业务场景贯穿**，再拆解到各能力点。
- 演示页长度失控：主站 API 页 18,095px、es-eui 表格页 20,492px（移动端 31,764px），es-eui 有 **50 个"展开代码"折叠项**。折叠不是解决方案，它只是把长度藏起来。
- **案例可读性差**：cases 页的缩略图在卡片宽度下无法辨认内容，等于装饰而非证据。

### 3.5 文档与功能介绍

**结论：主站文档的结构是合格的，问题集中在"读起来累"和"子站缺能力"。**

做得对的部分（应当保留、并作为子站的标准）：
- 三栏（260 / 760 / 220）+ 面包屑 + `Stability` 标记 + 版本号 + API 更新日期；
- 代码块 Template/Script/Style 分栏（`CodePlayground.vue` + `code-block.js`，`TAB_LANG` 映射正确）、复制按钮、>20 行 / 480px 折叠；
- 搜索（Ctrl K）、暗色模式、中英切换；
- 每个组件页有可运行的 demo，而非纯静态代码。

必须修的部分：
1. **API 表描述列只有 104px（占 760px 正文宽的 13.7%），events 表只有 80px。** 中文在 104px 里每行只能放 3–6 个字，行高被撑到 96–120px，一张 Props 表能拉到 3,000px 以上。这是"文档很长"的最大单一成因，也最容易修。
2. **右侧目录不一致。** 组件页有 TOC，散文类页面（Why / 指南）却把目录塞进正文且没有右栏 TOC，滚动时无法定位。
3. **子站能力缺口。** es-pc / es-eui 无搜索、无暗色、无语言切换，且 es-pc 把版本号 `v1.4.0` 渲染成一个醒目的 `ant-btn-primary` 按钮——用户会以为那是主行动按钮。
4. **es-eui 常驻公告条** 高约 100px，持续占据首屏。

### 3.6 文案宣传

**结论：主站文案是这次审计的第二个亮点，es-eui 是最大短板。**

好的地方：
- 主站的中英文都具体、克制、有数字（`151 → 90`、`115 → 27`、`76.5%`），没有"赋能 / 一站式 / 极致体验"这类空词；英文译文质量接近母语（`The Configuration Layer for Admin CRUD`、`Write once, render everywhere.`）。
- 三条承诺的名字短、可记。

问题：
- **数字漂移**（76.5% / 77%；151→90 / 300+→50+）——同一事实三种说法，是信任成本最高的文案缺陷。
- **es-eui 的文案仍在用 2018 年的营销腔**：`300+ 行 → 50+ 行`、红绿对错卡、"零成本切换"，且与其自身对比数据矛盾。
- 三个站点的 H1 在讲三件不同的事（见 §3.2）。

### 3.7 排版布局

**结论：局部有功力，全局缺网格。**

- **主站 hero**：`.hero-section{grid-template-columns:minmax(0,.78fr) minmax(0,1.22fr); gap:56px; min-height:600px; padding:72px 48px; max-width:1200px}`。比例本身没问题，问题在内容分配——右侧信息密度过高、字号过小，左侧三块灰字没有节奏。
- **字号阶梯断裂**：18 / 20 / 22 / 36 / 72，中间缺 28–32 的过渡，导致 hero 与小标题之间是断崖。
- **章节宽度三种并存**（1200 / 1440 / 800），是全站"不整"的主要几何来源。
- **网格孤儿**：主站组件区 4 卡 / 3 列；es-form 特性卡 3+1；AI gallery 出现 1 张 / 2 张的参差行。
- **es-pc** 的"白纸卡片"思路本身是好的（明确的阅读容器），但正文宽度 ~847px 已超出舒适阅读上限（中文建议 640–760px），且没有右目录来平衡右半边。
- **es-eui** 桌面端正文 H1 32px / 正文 15px / 行高 25.5 是可读的，但页面被 50 个折叠项和 20,000px 长度摧毁。

### 3.8 移动端

| 站点 | 结论 | 关键证据 |
|---|---|---|
| 主站 | 合格 | 390×844 无横向溢出；响应式断点有效 |
| es-pc | 不合格 | 演示表格压缩到 **277px**，地址列一行一个字、邮箱每 4 字符换行 |
| es-eui | 严重不合格 | 公告条 ~100px；`.side-nav` 在移动端为 **static 375×380**，把正文整体推到首屏之外；表格页 31,764px |

移动端表格没有横向滚动容器、也没有卡片化降级，是三站共同的技术债（es-pc / es-eui 已爆发，主站暂未触发）。

### 3.9 可访问性 / 性能

**对比度（WCAG AA：正文 4.5:1，大字 3:1）**

| 组合 | 比值 | 判定 |
|---|---|---|
| 白字 on `#3b82f6` | **3.68:1** | 正文不合格；大字勉强 |
| 白字 on `#06b6d4` | **2.43:1** | 不合格 |
| `#06b6d4` 字 on 白底 | **2.43:1** | 不合格（主站 13px 承诺文案、es-eui hero 16px 白字压渐变青端均踩中） |
| 主站渐变 H1 青端 | ≈2.43:1 | 72px 大字也够不到 3:1 |

**性能**
- 主站 dist **25MB**，其中 `monaco 4.29MB` + `ts.worker 7.05MB` + `vxe 1.16MB` + `element-plus 887KB`。首屏不应加载 Monaco；Playground 必须懒加载（现在疑似随主包进入）。
- 唯一控制台报错是三站共有的 `gc.zgo.at/count.js` 超时（本地被墙），非站点缺陷。

---

## 4. 与主流开发文档站的符合度

| 主流惯例 | 主站 | es-pc | es-eui |
|---|---|---|---|
| 首页 H1 = 价值主张（不是品牌名） | ❌ 品牌名 72px | ⚠️ "企业级中后台组件库" | ⚠️ "Vue2 中后台解决方案" |
| 首屏有真实产品画面 | ❌ 代码面板 | ✅ CRUD 截图 | ❌ 渐变装饰 |
| 单一强调色 | ❌ 蓝/青/绿/红并存 | ✅ 蓝 | ❌ 蓝→青渐变 + 红绿 |
| 3–5 个 section | ❌ 11 个 / 8,935px | ✅ 5 个 | ⚠️ 8 个 |
| 统一内容网格 | ❌ 1200/1440/800 混用 | ✅ | ⚠️ |
| 三栏文档 + 右 TOC | ✅ | ⚠️ 无 TOC | ❌ 无 TOC |
| 搜索 | ✅ | ❌ | ❌ |
| 暗色模式 | ✅ | ❌ | ❌ |
| API 表可读 | ❌ 描述列 104px | ✅ | ✅ |
| 移动端表格降级 | ⚠️ 未触发 | ❌ | ❌ |
| 版本/稳定性元信息 | ✅ | ⚠️ 版本号做成按钮 | ⚠️ |
| 对比度 AA | ❌ | ⚠️ | ❌ |

**判定：** 主站的**文档页**符合主流；主站的**首页**不符合主流（属于"个人项目营销页"的形态）；es-pc 是"合格的旧式企业站"；es-eui 落后主流约 5–7 年。

---

## 5. 问题清单

### P0（直接影响可信度 / 转化）

| # | 问题 | 位置 | 证据 |
|---|---|---|---|
| P0-1 | 首页 H1 是品牌名而非价值主张，72px 渐变字与 20px 灰字倒置 | `es-plus-docs/src/views/Home.vue` `.hero-title` / `.hero-title-sub` | 72px/108px vs 20px |
| P0-2 | 首屏无真实产品画面，唯一"证据"是 11–12px 代码面板 | `Home.vue` → `HeroTriRender` | 截图 `audit/main-hero-1440.png` |
| P0-3 | 三站品牌数字口径冲突（76.5% / 77%；151→90 / 300+→50+），es-eui 数据自相矛盾 | `docs/brand/slogan.json` vs `es-eui/src/views/home/index.vue` | Vue2 中位 74 行、0/31 对 ≤10 行 |
| P0-4 | API 表描述列 104px（13.7%），events 80px，中文 3–6 字一行 | `docs/theme/docs-content.css` 及站点副本 | 页面 18,095px，API 始于 9,617px |
| P0-5 | 移动端表格无降级：es-pc 277px 列宽、es-eui 侧栏静态 380px | `es-pc` / `es-eui` 布局 | 390×844 截图 |
| P0-6 | 对比度不达 AA：`#06b6d4` 白底 2.43:1、白字压青 2.43:1 | 三站 | 计算值 |
| P0-7 | "产品实拍"默认 tab 是本页截图，自证循环 | `docs/product/shots.json` | 首个 tab `docs-home-light` |

### P1（体验 / 一致性）

| # | 问题 |
|---|---|
| P1-1 | 主站首页 11 section / 8,935px，超出首页应有密度 |
| P1-2 | 章节宽度 1200 / 1440 / 800 混用，左边缘跳 168↔288px |
| P1-3 | 网格孤儿：组件 4 卡 / 3 列；es-form 3+1；AI gallery 参差行 |
| P1-4 | es-pc / es-eui 缺搜索、暗色、语言切换 |
| P1-5 | 散文页无右侧目录（主站部分页、es-pc、es-eui 全站） |
| P1-6 | es-eui 常驻公告条 ~100px |
| P1-7 | es-pc 版本号渲染成 `ant-btn-primary` 主按钮 |
| P1-8 | 间距/字号令牌形同虚设（spacing 使用 0 次；字号令牌 4.5%–7.5%） |
| P1-9 | 主站 dist 25MB，Monaco / ts.worker 进入首包 |
| P1-10 | `AiLiveDemo` 空表 + 绿色 CTA 与品牌蓝冲突 |
| P1-11 | 演示页长度失控（es-eui 20,492px / 50 个折叠、主站 18,095px） |

### P2（打磨）

P2-1 案例缩略图不可辨；P2-2 三段灰字 18/20/22 无节奏；P2-3 字号阶梯缺 28–32 档；P2-4 tokens 定义 1440 max 但首页实际 1200；P2-5 中英文首页 section 数不一致（待复核）；P2-6 折叠项默认展开策略不统一。

---

## 6. 优化方案

### 6.1 P0：主站首页重构（收拢到 4–5 屏）

**目标：3 秒内说清"是什么 + 省多少 + 长什么样"，页面从 8,935px 收到 4,500px 左右。**

新 hero 线框：

```
┌──────────────────────────────────────────────────────────────┐
│  [配置层 · 三渲染器 · AI 原生]        ← 20px 胶囊，不是 72px 字 │
│                                                              │
│  少写 76.5% 的 CRUD 代码                ┌──────────────────┐ │
│  一份 JSON 配置，三个渲染器             │                  │ │
│  同一份配置编译成 Element Plus /        │  真实 CRUD 大图   │ │
│  Ant Design Vue / Element UI            │  （旗舰审批页）   │ │
│                                        │                  │ │
│  [快速开始]  [在线 Playground]          └──────────────────┘ │
│  151 字段 → 90 字段 · 115 文件 → 27                        │
└──────────────────────────────────────────────────────────────┘
```

具体动作：
1. **H1 换成价值主张**（56–64px，实心 `--es-text-primary`，不用渐变），品牌名降到导航栏 logo + 一个 20px 胶囊标签。删除 `background-clip:text`。
2. **首屏右栏换成旗舰产品截图**（`flagship` 1600×1000，`docs/product/shots.json` 里已有），代码面板降级到第二屏的"可交互示例"。
3. **合并三段灰字为两行**：一行 18px 说明 + 一行 14px 数字条（`151 → 90`、`115 → 27`、`76.5%`）。字号阶梯只用 14 / 18 / 56 三档。
4. **统一内容网格为 1200px 单列**，所有 section 共用；删除 full-bleed 1440 与 800 两种例外（快速开始并入 1200 的窄容器）。
5. **section 从 11 减到 5**：
   `hero（价值主张 + 真图）` → `一条视频/一段代码证明配置层` → `三渲染器切换` → `AI 生成演示（换成真实数据）` → `快速开始`
   把「三条承诺 / 产品实拍 / 视频 / 特性 / 组件 / 代码对比」合并进这 5 屏，或移到 `/why`、`/showcase` 子页。
6. **组件卡改 4 列**（或 2×2），消除孤儿；es-form 特性卡同步改 2×2。
7. **产品实拍默认 tab 改为 `flagship`**，并把 `docs-home-light` 从首屏移除（首页截图不该是首页的证据）；8 个 tab 分组为"组件 / CRUD / AI"三组或改成横向滚动。
8. **AI 演示填真实数据**（至少 3 行订单），CTA 回到品牌蓝。
9. **强调色收敛为一种**：品牌蓝承担所有 CTA 与强调；青色只允许出现在渐变装饰的**背景**（不承载文字），语义红/绿只出现在对比表内部。

### 6.2 P0：文档可读性

1. **API 表列宽策略**（收益最高、成本最低）：
   - `props` 表：`参数 22% / 说明 46% / 类型 16% / 默认值 16%`
   - `events` 表：`事件名 24% / 说明 52% / 参数 24%`
   - 描述列下限 `min-width: 320px`，配 `table-layout: fixed` + 移动端横向滚动容器。
   - 预期：API 页高度可从 18,000px 级降到 9,000px 级。
2. **所有散文页加右侧 TOC**，与组件页一致；移除正文内嵌目录。
3. **拆分超长演示页**：es-eui 表格页按"基础 / 列配置 / 编辑 / 大数据"拆 4 页，折叠默认收起改为"默认展开前 2 个"。
4. **移动端表格**：统一 `overflow-x:auto` + 单元格 `min-width`（120px），或对 es-pc 演示表启用卡片模式。
5. **es-eui 移动端**：`.side-nav` 改 `position: fixed` + 抽屉；公告条可关闭且不吸顶。

### 6.3 P1：三站统一（品牌层）

1. **单一事实源**：把 76.5% / 151→90 / 115→27 全部写入 `docs/brand/slogan.json` 的新字段（如 `claims: { fieldReduction, fileReduction, parity }`），三站通过构建脚本读取，**禁止手写数字**。eui 的 `77%` 与 `300+/50+` 必须替换或标注为"Vue2 样本，N=31，中位 74 行"。
2. **共享 docs chrome**：把主站的 header / 搜索 / 暗色 / i18n 抽成 `docs/theme/` 下的共享组件，es-pc 与 es-eui 直接复用（Vue2 版本可做薄适配层）。目标是三站头部长得一样。
3. **统一视觉语言**：三站共用「白/浅灰底 + 单一品牌蓝 + 中性灰阶 + 16/12/8 圆角」。删除 es-eui 的整屏渐变 hero，改成与主站同构的"价值主张 + 产品图"双栏。
4. **统一首页骨架**：三站首页都按 `hero（主张+真图）→ 证明 → 能力 → 开始` 四段组织，差异只体现在"渲染器 pill"与截图配色上——这正是产品本身的主张（同一份配置，三种外观），应该由站点自己示范。

### 6.4 P2：设计系统治理（防止回潮）

1. **令牌接入构建期校验**：新增 `check:design-tokens`，规则：
   - 站点源码中 `font-size` 只允许 `var(--es-text-*)`（白名单：装饰性 >48px）；
   - `padding` / `margin` / `gap` 只允许 `var(--es-space-*)`；
   - 新增 hex 字面量直接红（允许 `transparent` / `currentColor`）。
   先以 warn 上线，把存量按文件列进基线，再逐批收敛。
2. **视觉回归**：对 6 个关键页（三站首页 + 三站组件文档页）在 1440/390 两档跑截图 diff（Playwright + `toHaveScreenshot`），阈值 0.1%。
3. **对比度门禁**：对 `--es-brand-primary` / `--es-brand-accent` 与白/深底的组合做计算断言，AA 不达标直接红（`#06b6d4` 需压深到 `#0891b2` 左右才能承载白字）。
4. **首页结构守卫**：断言"主站首页 section 数 ≤ 6""H1 文本不等于品牌名""首屏存在 ≥1 张 ≥800px 宽的产品图"。这三条正好锁住本次审计的核心问题。
5. **性能预算**：主站首包 JS ≤ 800KB（gzip），Monaco / vxe 必须动态 import。

---

## 7. 落地排期

| 阶段 | 内容 | 预期收益 | 风险 |
|---|---|---|---|
| **S1（1–2 天）** | API 表列宽、移动端表格滚动、`#06b6d4` 压深、es-eui 公告条可关、es-pc 版本号去按钮化 | 文档可读性 + 对比度一次性达标 | 低，纯 CSS |
| **S2（3–5 天）** | 主站首页重构（§6.1 的 1/2/3/4/7/8/9），暂不删 section | "第一眼"问题解决 | 中，需重截旗舰图 |
| **S3（3–5 天）** | 首页 section 合并到 5 屏、组件卡 4 列、AI 演示真实数据 | 首页从 8,935 → ~4,500px | 中 |
| **S4（1 周）** | 三站共享 chrome（搜索/暗色/i18n）+ es-eui 视觉重做 | 三站变成一个产品 | 高（Vue2 适配） |
| **S5（持续）** | 令牌收敛 + 视觉回归 + 对比度/结构守卫 | 不复发 | 低 |

> 建议顺序：**S1 先做**（一天内可见、零争议），同时并行 S2。S4 的 Vue2 适配成本最高，放在 S1/S2 验证设计方向之后再做，避免"重做完再改方向"。

---

## 8. 验收标准

> 状态列是 2026-11-07 执行后的实测值（括号内为审计时的基线）。

- [x] 主站首页 H1 ≠ 品牌名，且首屏存在一张 ≥800px 宽的真实产品图
      —— H1「少写 76.5% CRUD 代码」；旗舰实拍 1600×1000（渲染 1102px）
- [x] 首页 section ≤ 6，总高 ≤ 5,000px @1440
      —— 5 屏 / **4,632px**（基线 11 屏 / 8,935px）
- [x] 三站所有页面出现同一组数字（来自 `slogan.json`），grep 不到第二套口径
      —— 三站均 76.5%；`grep -r "77%"` 为空；数字由构建脚本从源码实测
- [x] API 表描述列 ≥ 320px —— es-form 实测 **330px**（基线 104px）
- [x] 主站 API 页高度 ≤ 10,000px —— es-form **6,737px**（基线 18,095px，−63%）。
      做法是示例分组（IA 拆分）：示例较多的六页（es-form / es-table / es-crud-page /
      use-dialog / linkage / vxe-table）按主题折叠成 3–5 组，一次只挂载一组；
      深链 `#demo-<key>` 会自动切到所在分组（锚点、搜索索引、`cases.json` 全部不变）。
      `layout.spec.ts` 第 4–6 条守 ≤10,000px、每页有分组、深链切组
- [x] 三站 390×844 无横向溢出，表格可横向滚动 —— 三站溢出均为 0；
      演示表 `min-width:560px` + 容器 `overflow-x:auto`（runtime-e2e `layout.spec.ts` 守）
- [x] 所有承载文字的色组合 ≥ 4.5:1（大字 ≥ 3:1）—— `check:a11y` 全绿（含令牌反算）
- [x] 三站 header 具备搜索 —— 主站全量索引；es-pc / es-eui 为**路由词表**站内检索
      （⌘K / ↑↓ / Enter / Esc，面板外观只在共享主题一份）。暗色：主站 + es-pc 已具备
      （`check:dark-mode` 守），es-eui 仍 light-only；语言切换三站均未做，见 §9.8
- [x] `check:design-tokens` 与视觉回归进入 CI
      —— 两者都进了分组 runner（14 组 / 137 步）；版式回归用不变量断言，不是像素 diff

---

## 9. 执行状态（2026-11-07 落地）

### 9.1 P0 问题清单

| # | 状态 | 落地内容 / 实测 |
|---|---|---|
| P0-1 | ✅ | 主站 H1 改为价值主张「少写 76.5% CRUD 代码」，56px 实心 `--es-text-primary`，删除 `background-clip:text` 渐变字 |
| P0-2 | ✅ | 首屏改为通栏旗舰实拍（1600×1000，文案下方）；交互生成器 HeroTriRender 移到 `/cases` |
| P0-3 | ✅ | 三站数字统一 76.5% / 151→90 / 115→27，全部取品牌单源；`77%`、`300+/50+` 已无残留 |
| P0-4 | ✅ | 列宽契约：正文表 名称 120 / 说明 **320**；组件 API 表实测说明列 **330px**（基线 104px） |
| P0-5 | ✅ | 三站 390×844 溢出均为 0；演示表 `min-width:560px` + 容器横滑；es-eui 侧栏改固定 + 抽屉 |
| P0-6 | ✅ | `#06b6d4` 不再承载文字（仅作装饰背景）；文字链接用 `--es-link`（4.73:1），`check:a11y` 全绿 |
| P0-7 | ✅ | 产品图廊默认 tab 改 `flagship`，`docs-home-light`（自证本页）从首屏移除；图廊并入 `/cases` |

### 9.2 P1 问题清单

| # | 状态 | 落地内容 / 实测 |
|---|---|---|
| P1-1 | ✅ | 首页 11 屏 / 8,935px → **5 屏 / 4,632px** |
| P1-2 | ✅ | 三站首页 section 统一走 `--es-landing-max`（1200）单列网格；820 / 680 只保留作正文行宽，不再是第二套栅格 |
| P1-3 | ✅ | 组件卡固定 4 列（平板 2×2），无孤儿行 |
| P1-4 | ◐ | **搜索已具备**：主站全量索引；es-pc / es-eui 新增路由词表站内检索（⌘K / ↑↓ / Enter / Esc，面板外观只在共享主题一份）。**暗色**：主站 ✅、es-pc ✅（§9.8）、es-eui 明确 light-only（Element UI 2 主题在 SCSS 编译期）。**语言切换**三站均未做 —— 见 9.8 |
| P1-5 | ✅ | 散文页右栏 TOC：主站、es-pc、es-eui 三站齐备（`<1280px` 收起） |
| P1-6 | ✅ | es-eui 公告条回到文档流、可关闭，不再吸顶 |
| P1-7 | ✅ | es-pc 版本号改中性胶囊 + 等宽数字，不再与主 CTA 抢层级 |
| P1-8 | ✅ | 新建 `check:design-tokens` 回归基线（221 文件 / 4,057 处存量）；新代码不允许新增字面量 |
| P1-9 | ✅ | Monaco / vxe 都是独立 chunk、按路由加载；主站首屏 452.6 KB gz 里不含 Monaco（`check:bundle-budget` 可见） |
| P1-10 | ✅ | `AiLiveDemo` 填真实订单数据，CTA 回到品牌蓝（`type="primary"`） |
| P1-11 | ✅ | es-eui 表格页 20,492px → 12,610px，并拆出 3 个子页（5,189 / 4,539 / 5,209px）；主站示例分组后 es-form 13,954 → **6,737px**，es-table / es-crud-page / use-dialog / linkage / vxe-table 同步分组（§9.8） |

### 9.3 方案 §6.4 的治理项（防回潮）

| 守卫 | 内容 |
|---|---|
| `check:design-tokens`（新） | 站点源码里的 `font-size` / 间距 / hex 字面量按文件建基线，只判**回归**；单源与生成物豁免 |
| `check:header-parity`（新） | 三站顶栏都有搜索入口；另两站词表来自路由表；面板类名同构；外观只在共享主题一份 |
| `check:landing`（扩充） | 首屏必须是真的产品实拍（≥800px、i18n alt）；首页 section ≤ 6；三站 H1 不是品牌名 |
| `test:e2e:runtime` / `layout.spec.ts`（新） | 1440：首页 5–6 屏、≤5,000px、H1 ≠ 品牌、首屏图 ≥800px；390：无横向溢出；演示表可横滑 |

**没有照搬「像素截图 diff」（审计原文建议）**：中文走系统字体栈，同一张基线在 Windows 与 Linux CI 必然对不上，第一次进 CI 就会红、随后被 `--update` 洗白。改守跨字体稳定的**版式不变量**（高度 / 屏数 / 图尺寸 / 溢出 / 横滑能力），它们正好对应审计里被反复改坏的五件事。另外 `goto` 统一用 `domcontentloaded`：默认 `load` 会等第三方统计脚本，无外网 CI 上红的是网络而不是版式。

### 9.4 未完成项（附原因与后续批次）

> 2026-11-08 更新：条目 1 的**暗色腿**已在 es-pc 落地、条目 2 已完成，明细见 §9.8；
> i18n 与 es-eui 暗色仍按本文原因保持未做。

1. ~~**es-pc / es-eui 的暗色与语言切换**（P1-4 剩余两腿）。~~ 拆开后：
   - **es-pc 暗色 ✅**（§9.8）：字面色债先按令牌收敛，再接 `darkAlgorithm`。
   - **es-eui 暗色 ❌（不做）**：Element UI 2 的主题是编译期 SCSS（`theme-chalk` 变量 → 打包成独立 CSS），
     没有运行时暗色。要做只能整站编译两套产物 + 运行时换 `<link>`，与「同一份构建」的站点约定冲突；
     成本远超其余两站之和，收益是第三个站的深色。结论：保持 light-only，由 `check:dark-mode` 显式断言。
   - **i18n ❌（不做）**：两站文案全在 `.vue` 模板里，没有 locale 文件、没有翻译语料；
     加一个只能切到空白的语言开关，比没有更差（审计原话）。真要做需要先抽文案层，属独立批次。
2. ~~**主站单页长度**（验收 4 的差口）。~~ ✅ 示例分组已把 es-form 压到 6,737px，见 §9.8。

### 9.5 验证记录

```
npm run check:consistency        # 14 组 / 137 步全绿（含新增的 2 个守卫）
npm test                         # 37 文件 / 667 用例全绿
npx playwright test … layout     # 3 条版式回归全绿（586ms / 510ms / 1.1s）
npm run check:bundle-budget      # 主站 452.6 / pc 607.4 / eui 274.4 KB gz（均未破回归线）
npm run theme:sync && theme:check # 11 份主题资源三站逐字节一致
```

> 唯一一次全量 `npm test` 红是 `generated-runtime.spec.ts` 的弹窗用例在并行负载下撞 5s 默认超时（单文件跑 4.3s 绿）。已把该条预算放宽到 15s 并留下原因注释 —— 它测「弹窗能开」，不是测速度。

### 9.6 第二轮视觉迭代（2026-11-08，主站首页为主；其中第 3、4 条已被 §9.7 取代）

两轮反馈：先「主站整体视觉仍偏普通，尤其首页」，再「首页应大气简洁、突出重点、符合主流站点特色」。第一版补了氛围层与装饰（光晕 + 点阵 + 浏览器窗口 + 编号卡片），第二版按「大气简洁」全部收掉 —— 结论是**装饰不是层次**：主流产品首页（Stripe / Linear / Vercel）靠字号、留白和一张干净的产品图立住，不靠花纹、编号和假窗口。只动主站，不改三站共享的 `docs/theme/*`。

**首页 `Home.vue`（最终形态）**
1. 首屏改**居中**：眉标 → H1 → 一句副题 → 两个 CTA 依次落在中轴上，左右对称；左对齐时 1200 容器右半边全空，读起来像没写完。底部三格数字条同步居中。
2. 首屏只留**一层**很淡的品牌色径向雾面（无点阵、无第二重光晕），620px 高、底部渐隐；宽度 100vw、被 `overflow-x: clip` 收口。
3. 眉标回到「一行小字 + 一个品牌色圆点」，不套胶囊、不加底色 —— 首屏主角只有 H1 和产品实拍。
4. H1 的 `76.5%` 只换颜色（`--es-brand-strong`），去掉下划软垫与渐变裁切；副题压到 640px 宽，保证一行读完。
5. 产品实拍**去掉假浏览器外壳**（圆点 / 地址条全部删除），只留圆角、1px 描边与一层柔和投影；≥1201px 用 `aspect-ratio` + 负百分比 margin 裁到「角色切换 → 查询条 → 表格 → 分页」，1201 以下保持整图。首屏读成「产品正开着」，而不是「文档里贴了张文档」。
6. 首屏三段错峰浮现（0 / 90 / 170ms，只加 delay，不加新时长令牌）；补 `@media print` 兜底。
7. 证据屏：三张承诺**去掉卡片框、序号与 hover 装饰**，改为「一条顶部分隔线 + 标题 + 一段话」的三列；段落眉标也不再带短横线。
8. 组件卡 hover 只改描边与阴影（不再位移 / 图标反色）；三步安装仍收在浅色面板里。
9. 段间距从 `--es-landing-gap`（64）抬到 `--es-space-9`（96），给三屏之间留出呼吸；AI 屏顶部保留一层极淡品牌光晕，与浅色带区分而不引入第三种底色。

**AiCrud.vue / Playground.vue**（主站里最平的两页）：页头收进浅色卡（品牌雾面 + 圆角 + 描边），AiCrud 标题由「品牌蓝→强调色」渐变字改回纯色 `--es-text-primary`（28px 渐变字端点对比度不稳，也与三站其余标题不一致）。

**约束与度量**：新增颜色全部 rgba、装饰全走 `background`/`mask`/圆角，间距与字号全部 `--es-space-*` / `--es-text-*`；主站 Home.vue 违规字面量 20 → 16、AiCrud 26 → 20、Playground 17 → 15；动效只用令牌时长。验收：首页总高 **4,764px**（<5,000；其中约 1/4 是 96px 段间距）、首屏实拍渲染宽 1,100px、390 无横向溢出、暗色与英文版逐屏复核。

### 9.7 第三轮：首屏排版收敛（2026-11-08，用户指出眉标 + H1 不美观、不适合展示）

第三轮反馈是一张首屏截图（眉标 + H1 的特写）：「这个设计有待优化，不美观，也不适合展示」。拆开看是三个问题，全部在**文字排版**，不在装饰层：

1. **眉标是全大写 + 0.08em 字距的品牌名清单**。`Vue 3`、`Ant Design Vue` 本来就不是全大写写法，被 `text-transform: uppercase` 强转后变成 `VUE 3 / ANT DESIGN VUE`；中英混排时中文「三个渲染器」也跟着吃 0.08em 加宽字距，读成一张「技术规格贴纸」。现改为三个平台名一行、`--es-text-sm` / 500 / `--es-text-tertiary`、常规字距、不做大小写转换 —— 主流产品站（Stripe、Vercel、Linear）的同类行都是这个形态。
2. **H1 是促销句式 + 蓝色巨号数字**。「少写 76.5% CRUD 代码」把百分比当标题主词，视觉上同广告横幅；中文本身也不够顺（更自然的是「代码少写 76.5%」）。现改为**两行产品陈述**：「一份 JSON 配置 / 生成整页 CRUD」—— 说清产品是什么、生成什么，而不是喊一个降幅。
3. **数字重音重复**：76.5% 在 H1 里蓝一次、首屏底部统计条再蓝一次。现在 H1 回到纯深色（`--es-text-primary`），76.5% 只保留在副题那句自然句里（20px、常规字重、`--es-text-secondary`）与统计条各一次，首屏只剩一个视觉落点：产品图。
4. **行尾逗号**：中文标题不带句读；全角「，」挂在第一行末尾会多占一个字位，看上去像一句话被截断。**去掉**（英文版保留——`One JSON config, a full CRUD page.` 的逗号是语法连接，不是装饰）。
5. **字体本身**：Windows 上雅黑 700 在 56px 下笔画过粗、字面发闷，这是「字体不美观」的主因。主站 H1 改用**系统显示字体栈**（不进 design token、不引 Web Font）：Mac 走 SF + PingFang，Windows 的 CJK 回落到**等线 DengXian**（Win8 起自带，开口更大、笔画更轻），拉丁优先 Segoe UI Variable Display；缺字体时逐级退回雅黑。同字号下「一份 JSON 配置」实测 400px → 387px，观感更接近主流产品站。**不开 Web Font**：中文子集要新增构建步骤与字体资产，而 design-tokens 已明确「不引入 Web Font」；只为一个 H1 破例不划算。**也不把 H1 换成 `ES-Plus` 字标**：顶栏 logo 已经承担品牌，`check:landing` 明确禁「H1 = 品牌名」，且首屏唯一的一句话应该回答「它能替我做什么」。

**排版参数**：H1 700 字重（800 对中文过黑）、`letter-spacing: -0.02em`（-0.03em 会把词挤在一起）、行高 1.18（两行 display 字号需要比单行令牌 1.25 更密）。断行用两个 `.hero-title-line` span **显式控制**，不用 `text-wrap: balance` —— 实测 balance 会在中文里切出「…接管 / 管。」这种残句，而 CJK 允许任意字间断行，浏览器按贪心填满第一行。

**排版参数**：H1 700 字重（800 对中文过黑）、`letter-spacing: -0.02em`（-0.03em 会把词挤在一起）、行高 1.18（两行 display 字号需要比单行令牌 1.25 更密）。断行用两个 `.hero-title-line` span **显式控制**，不用 `text-wrap: balance` —— 实测 balance 会在中文里切出「…接管 / 管。」这种残句，而 CJK 允许任意字间断行，浏览器按贪心填满第一行。

**副题的孤字**：副题 20px、中文整句实测 730px，`max-width` 从 640 提到 780（留 50px 余量）后桌面保持一行；窄到手机宽度时自然折成两行，末行仍有 80% 以上填充，不会只剩「管。」两个字。

**度量**：首页总高 4,764 → **4,868px**（仍 <5,000）；1440 / 1280 / 1100 / 768 / 390 与 en、暗色逐屏复核；`check:consistency` 137/137（两轮均绿，121.9s / 115.6s）、`layout.spec.ts` 3/3、`check:design-tokens`（4045 处）与 `check:landing` / `check:site-claims` / `check:a11y` / `check:motion` / `check:mobile` / `check:page-meta` 全绿；`npm run build` 通过。截图：`audit/hero-before.png`（改前）、`hero-after-f.png`（1440，含逗号版）、`hero-dengxian-1440.png`（最终：等线 + 去逗号）、`hero-en-dengxian.png`、`hero-390-final.png`、`font-probe-40.png`（雅黑/等线/Noto 三体对照）。

### 9.8 第四轮：P2 打磨 + es-form 分组 + es-pc 暗色（2026-11-08）

#### P2 状态

| # | 状态 | 落地内容 |
|---|---|---|
| P2-3 | ✅ | 字号阶梯补 26 / 28 / 32 三档（`--es-text-26/28/32`）。此前页面标题只能在 24 与 30 之间写 `font-size: 26px` 这类字面量，三站逐页漂移；现已按令牌替换 30 个文件。档位注释写明只给「页面级标题 / 强调数字」用 |
| P2-4 | ✅ | 澄清**两种容器、不是两套栅格**：`--es-layout-max: 1440px` 是文档壳上限（侧栏 + 正文 + 右栏 TOC），营销页用 `--es-landing-max: 1200`。tokens 注释与站点用法对齐，不再读成「两套 max-width 打架」 |
| P2-1 / P2-2 / P2-5 / P2-6 | — | 本轮未涉及（前两个由 §9.6 的首页迭代与案例页图廊一并处理，P2-5 / P2-6 仍待复核） |

#### 示例分组（验收 4）

示例较多的六页按主题分组，一次只挂载一组；标签条只在两个以上分组时渲染，单示例组件（svg-icon / error-boundary）行为不变。

| 页面 | 分组 | 高度 |
|---|---|---|
| `/components/es-form` | 基础 3 / 联动与数据 6 / 控件扩展 4 / 上传与按钮 4 / 模式与组合 3 | 13,954 → **6,737px** |
| `/components/es-table` | 基础与列 4 / 交互与数据 7 / 结构与展示 5 / 查询与行操作 3 | **10,092px**（略高于 10k，长表演示页，不在验收线上） |
| `/components/es-crud-page` | 基础 3 / 弹窗 5 / 权限与操作列 2 | **8,346px** |
| `/advanced/use-dialog` | 基础 3 / 表单与表格 2 / 实例与定制 3 / 业务场景 4 | **4,095px** |
| `/advanced/linkage` | 查询与联动 5 / 表格与集成 7 / 表单流程 4 / 弹窗与流程 3 / 虚拟滚动 6 | **4,629px** |
| `/advanced/vxe-table` | 引擎与渲染 5 / 选择与工具 5 / 编辑与数据 5 | **8,920px** |

**为什么是数据字段而不是页面筛选**：`group` 写在 `component-doc.data.ts` / `advanced-doc.data.ts` 的 `examples[]` 上，与 `key` 同一份定义 —— 案例卡、搜索索引、锚点都从这份数据派生，分组只改变「同时渲染哪些」，不产生第二套 key。逻辑抽到 `composables/useExampleGroups.ts`，标签条抽到 `components/doc/ExampleGroupTabs.vue`，组件页与高级指南共用。

**第一版只做了组件页**，六个页面里只有一个会分组 —— 这是本轮修掉的真实回归：`layout.spec.ts` 现在把「哪些页必须分组」写成清单（第 5 条），新增长页时补一行，而不是靠人记得。

三个不能动的约束：① 每个示例的 `id="demo-<key>"` 与锚点不变（搜索索引、`cases.json`、站内外链全靠它）；② 深链进入时先根据 hash 选中所在分组，`nextTick` 之后才跑 `realignToHash`，否则目标元素还没挂载、滚动落空（组件页与高级指南各自实现，顺序一致）；③ 分组不产生新路由，hash 变化只切组 + 重定位。

#### es-pc 暗色

- 口径与主站逐字一致：首屏内联脚本（`localStorage 'theme'` 优先 → 跟随系统）+ `stores/theme.js` 同步 `classList` / `colorScheme` / `data-vxe-ui-theme`。
- Ant Design Vue 4 的暗色**不是 CSS 类**：`App.vue` 的 `ConfigProvider` 按 `isDark` 在 `darkAlgorithm` / `defaultAlgorithm` 之间切换，否则就是「外壳黑、a-* 全亮」。
- 换肤不是开关问题，是**字面色债**：先按令牌收敛 21 个文件的 `#fff / #fafafa / #f5f5f5 / #f6f8fa / #f5f7fa`，再补三处结构性漏点：
  1. **标题色**：22 处 `color: #1a1a2e` 写死在视图 scoped 样式里，深色下标题与背景同为近黑（`h1[data-v-*]` 特异性等于 `.es-doc-content h1`，后加载就赢）→ 全部换 `var(--es-doc-heading)`；
  2. **表头行**：`adapter-antdv` 把 `headerCellStyle` 交给 a-table 的 `customHeaderRow`，内联样式落在 **`<tr>`** 而不是 `<th>` —— 只压 `th` 的话，表头仍有一整条 `rgb(245,247,250)`。共享主题里补 `.dark .ant-table-thead > tr` 与 `th` 各一条（`!important` 是压内联的唯一手段），并给 th 补 `color` 令牌；
  3. **演示行底色**：`CellMerge` 的 `#f0f9eb / #fdf6ec` 改为状态色低透明度（同一个 rgba 在白底是浅绿、在深底是暗绿），另把 `ExpandRow` 的内联 `#f5f7fa / #909399 / #303133` 换令牌。
- 守卫：`check:dark-mode` 从「一个暗色站 + 两个 light-only 站」改成**站清单**，断言 es-pc 的首屏脚本 / store 规则 / `darkAlgorithm` / `initTheme()` 调用，以及「src 下至少有一个 `.vue` 真的调用 `toggleTheme`」（有深色规则没人能切 = 死配置，正是审计对旧版的判词）。es-eui 继续 light-only，理由见 §9.4。
- 复核：1440 下 `/ /cases /es-form /es-table /flagship-approval /ai-generated /guide /es-dialog /es-crud-page` 九个页面在暗色里**没有面积 >30k px² 的亮色块**；390×844 无横向溢出且同样无亮块；亮色回归（`theme=light`）body 仍是 `rgb(247,248,250)` / 深色文字。

**未做（明确不做的两件）**：es-eui 暗色、三站 i18n。原因见 §9.4，不做「半成品」是审计自己的结论。

#### 验证

```
node scripts/check-dark-mode.mjs     # es-plus-docs / es-pc 暗色口径一致，es-eui light-only
npm run check:consistency            # 137/137 全绿（110.0s）
npx playwright test tests/layout.spec.ts   # 6/6（新增第 4–6 条：es-form ≤10,000px + 深链切组、六页分组清单、高级指南深链）
npm run check:design-tokens -- --update    # 基线 4,057 → 3,917 处（221 文件）
es-plus-docs / es-pc / es-eui 三站构建  # 全绿（es-eui 用 --dest dist-verify，验完删除）
```

> 数字账：令牌基线从 4,057 降到 3,917（60 个文件减少、无文件增加）。`theme:sync` 之后 `check:raw-sources` 曾红一次 —— 是上一轮 es-eui 源码的 `font-size` 改动没有重新生成 raw sources（97 个文件），跑生成器即恢复；这是生成物按设计的行为，不是守卫误报。

### 9.9 第五轮：暗色全路由复核（2026-11-08）

§9.8 的暗色验收只覆盖了 es-pc 的 9 个路由、主站 0 个新路由，属于**抽样**。这轮把两站**全部**路由在 1440 / 390 两个宽度逐页扫了一遍（判据不变：可见、背景亮度 > 0.75、不透明、面积 >30k px²），发现三类漏点：

| 站 | 路由 | 症状 | 根因 | 修法 |
|---|---|---|---|---|
| es-plus-docs | `/advanced/vxe-table` | 4 张 vxe 表整块白（58 个亮块） | **vxe 在模块求值时无条件 `setTheme('light')`**（`vxe-pc-ui/packages/components.ts` 底部），把 `<html data-vxe-ui-theme>` 覆盖回 light。vxe 走懒加载，覆盖发生在 `initTheme` 之后 | `stores/theme.ts` 加 `onThemeApplied` 登记处，`utils/vxe-install.ts` 加载完登记 `VxeUI.setTheme()` 并立刻纠正一次 |
| es-pc | `/es-vxe-table`、`/ai-gallery/engine-lab` | 同上（16 张表） | 同上（两站同构的懒加载器，同病） | 同上 |
| es-pc | `/es-error-boundary`、`/advanced` | 2 + 1 个浅色卡片 | 视图里写死 `#fafcff / #f6ffed / #fff2f0` | 换 `--es-fill-light` / 状态色低透明度 rgba，文字换令牌 |

**为什么上一轮没抓到**：探针是抽样跑的几个页面，而 vxe 的覆盖只在「懒加载块求值之后」发生 —— 首页、表单页这些不加载 vxe 的页面完全正常，坏的是恰好用到 vxe 的长尾页面。这也解释了为什么 §9.8 里 es-pc 的 `/es-vxe-table` 没进抽样名单。

**修后复核**（探针留在 `audit/dark-probe-docs.mjs`、`audit/dark-probe-espc.mjs`，未跟踪）：

```
主站 30 条路由 × 1440 / 390    亮块 0 / 0
es-pc 22 条路由 × 1440 / 390   亮块 0 / 0
```

守卫补了一节 A2：两站的 `vxe-install` 必须同时出现 `onThemeApplied(` 与 `VxeUI.setTheme(`，store 必须真的 `appliedListeners.forEach` 通知回调 —— 做了变异测试（把 `VxeUI.setTheme(` 改成下标写法，守卫按预期变红）。

### 9.10 es-eui 代码块对比度（2026-11-08，用户报「代码示例看不清」）

`/guide/quickstart` 的代码示例是浅色文字色压在深色底上吗？不是 —— 是**深底深字**。实测 `code` 的 color 为 `rgb(36,41,46)`、最近不透明祖先是 `rgb(15,16,16)`，WCAG 对比度 **1.30:1**（正文门槛 4.5）。

根因不是配色选错，是**两套代码块契约撞在一起**：

- 共享 `docs-content.css` 的 `.es-doc-content pre code { color: var(--es-doc-code-block-text) }` 假设「代码块底色 = `--es-doc-code-block-bg`」（浅色主题下 `#f6f8fa`）；
- es-eui 自己的 `App.vue` 把裸 `pre` 写死成深色终端底（`#0f1010`），且 `.es-doc-content pre` 的 background 在共享文件里是注释掉的 —— 底色与文字色来自两套互不知情的规则。

受影响的 7 个路由：`/guide`、`/guide/quickstart`、`/guide/installation`、`/guide/configuration`、`/guide/developer-guide`、`/component/installation`、`/component/quickstart`。`/ai-tools` 是另一种形态：el-card 浅底，但全局深色 `pre` 压在卡片里，同样是 1.46:1。

修法（都保留原有视觉，只修可读性）：

- es-eui `App.vue`：新增 `pre:not(.code-block-wrapper pre) code { color: #dcdfe4 }`，特异性压过共享规则；`:not()` 把三站统一的 `.code-block-wrapper`（浅底）排除，它继续走 token；
- es-eui `ai-tools.vue`：`.code-block pre { background: transparent }`，让 el-card 提供浅底。

守卫：`check:a11y` 的 D 组新增一条 —— 若 `es-eui/src/App.vue` 的裸 `pre` 有深色字面底，必须有配套的代码文字色，且对比度 ≥ 4.5（变异测试把颜色改回深色文字，守卫报 `1.30:1`）。探针留在 `audit/contrast-probe-eui.mjs`：32 条路由逐条算 `pre code` 与其不透明祖先背景的比值，修前 8 条路由红、修后全绿。

### 9.11 第六轮：正文对比度按最终计算值收口（2026-11-08）

§9.10 的教训是**判据错位**：`check:a11y` 算的是 token 声明的配对，而页面坏在
「某条规则把 A 色文字压到 B 色底上」——token 全绿、渲染出来 1.30:1。
这一轮把判据从「声明的颜色」换成「浏览器里的最终计算值」：文字色对比最近的
不透明祖先底色，按 WCAG 2.1 判 4.5 / 3.0；跳过带 alpha 的文字（渐变字）、
祖先含 `background-image` 的（图案底算不出平均值）、禁用态与 `aria-hidden`。
探针收成 `audit/lib/contrast.mjs` 一份，两个暗色探针都改调它。

**测得的低对比主体不是「暗底上的亮字」，是「暗底上的浅色主题字」**。

| 站 | 低对比处 | 主体 | 处理 |
|---|---|---|---|
| es-pc | 848 → **618** | 40+ 个视图把浅色主题文字色写死（`#1f1f1f`/`#333`/`#595959`/`#666`/`#909399`），暗色实测 **1.01–2.91:1** | 全换 `--es-text-primary/regular/secondary/tertiary`；数值相同的亮色观感不变 |
| 主站 | 370 → **161**（`pre` 内 0） | 代码块注释 4.44:1、行内代码粉 3.03:1、es-table 单元格 el-tag 217 处「亮药丸 + 亮字」 | 注释提亮到 5.20:1；新增 `--es-doc-inline-code-text`（暗 5.02:1）；el-tag 用随主题翻转的 `!important` 压回状态 token |

顺带三处填充色：CodeDiff 的 diff 药丸（浅底 + 同色系字）、es-vxe/RowEdit 的绿按钮
（白字压 `#52c41a` 2.27:1，改深一档 success 实底 5.0:1，暗色翻浅底墨字）、
AiGallery 的状态胶囊（白字压亮色暗色 1.9–2.8:1）。

**残留债务（知道但不本轮修）**：剩下的 es-pc 配对全部 ≥3.22:1，且都来自
Ant Design Vue 自身暗色调色板（`#1668dc` 链接、白字压 `#dc4446`）；Element Plus
的填充色按钮/徽标（白字压 `#409eff` 2.78、白字压亮绿/橙 1.92–2.27）同理。
它们是库的取值，要修得覆盖组件库配色，属产品决策。主站 161 处里同理。

**守卫**：新增 `contrast.spec.ts`（Playwright，4 条路由），门槛分两段 ——
`pre` 内零容忍（§9.10 那一类），其余按可枚举的 `KNOWN_PAIRS` 基线，
新出现的低对比组合会红；修好一条无需改基线。`check:a11y` 的 token 数学保留，
两者互补：一个管「声明的颜色」，一个管「渲染的结果」。

**平板断点补测**（此前只扫 1440 / 390）：768 与 1024 两档，两站都是
**亮块 0 / `pre` 违规 0**。`layout.spec.ts` 同时补了 1440/1024/768/390 四档
无横向溢出，以及 **P2-5**：切 `language` 后中英首页 section 数必须相等、
`<html lang>` 跟着变 —— 结论是 section 数本来就一致，差异不在数量。

**P2-6**：es-eui 表格文档给前两个示例加了 `:default-expanded="i < 2"`，主站同位置
全部默认折叠，属两站口径不一致。去掉自动展开后
`/component/estable` **12,610 → 11,287px**（390 下 19,194px），三个子页
4,124 / 3,488 / 4,141px。

**仍未处理（下一批）**：`/components/es-table` 10,092px（验收线 10,000，差 92px）；
es-pc `/es-form` 12,961px、`/es-table` 17,910px 仍是手写 section + 锚点、没有分组。

**`headerCellStyle` 债务已根治（同日，选 A：不再注入缺省内联值）**：
三端 `es-table` 的 `defaultOptions`（含两个 vxe 引擎）不再下发
`{ background: '#f5f7fa' }`，生成器（schema / crud / structured / fragment / code）
同口径改为「用户给了才发」。底色改由主题提供 —— 新增
`--es-table-header-bg`（亮 `#f5f7fa` / 暗 `#2c2e31`），一条
`.table_component` 作用域规则覆盖 el-table / vxe / a-table。亮色观感与改前一致；
暗色不再需要为「内联 #f5f7fa」写 `!important` 抢救（只剩用户**显式**传值那一例，
需要压回 ADV 渲染在 `<tr>` 上的内联 background）。宿主可见的 schema 形状不变
（键仍可选），宿主不定义 token 时表头就是组件库自己的颜色。

---

## 附录 A：量化证据表

| 项 | 值 | 采集方式 |
|---|---|---|
| 主站首页高度 | 8,935 px | `document.body.scrollHeight` @1440 |
| 主站 hero | 600px min-height / 72px H1 / 108px line-height / grid 0.78:1.22 / gap 56 | `getComputedStyle` |
| 主站章节宽度 | 1200 / 1440 / 800 | 逐 section `getBoundingClientRect` |
| 主站正文文档 | 侧栏 260 / 正文 760 / TOC 220 / header 64 | DOM 尺寸 |
| 主站 API 表 | 220 / **220 / 120 / 104 / 96** px（描述列 104） | 表头枚举过滤 |
| 主站 API 页高 / API 起点 | 18,095 px / 9,617 px | scrollHeight + offsetTop |
| 主站 dist | 25 MB（monaco 4.29 / ts.worker 7.05 / vxe 1.16 / element-plus 0.887） | 产物目录 |
| es-pc 文档 | H1 30 / 正文 15 / 27 line / 内容 ~847 / 无 TOC | `getComputedStyle` |
| es-pc 演示表移动端 | 表格宽 277 px | 390×844 |
| es-eui 文档 | H1 32 / 正文 15 / 25.5 line / 侧栏 260×808 / header 60 / 无 TOC | `getComputedStyle` |
| es-eui 表格页 | 20,492 px 桌面 / 31,764 px 移动 | scrollHeight |
| es-eui 移动侧栏 | static 375×380 | `getBoundingClientRect` |
| 令牌使用 | 主站 964 var / 303 hex / 464 fs / 35 token / **0 spacing**；es-pc 492/649/368/35/**0**；es-eui 1286/1095/684/31/**0** | 正则统计 |
| 对比度 | 白/`#3b82f6` 3.68；白/`#06b6d4` 2.43；`#06b6d4`/白 2.43 | WCAG 公式 |
| 控制台错误 | 仅 `gc.zgo.at/count.js` 超时（本地网络） | Playwright console |

## 附录 B：截图索引（`audit/`，未跟踪）

- 主站首页：`main-home-1440.png`、`main-hero-1440.png`、`main-promises.png`、`main-compare.png`、`main-cross.png`、`main-ai-demo.png`、`main-shots.png`、`main-videos.png`、`main-components.png`、`main-getstarted.png`
- 主站文档：`main-doc-form.png`、`main-doc-form-demo.png`、`main-doc-code.png`、`main-doc-api.png`、`main-doc-why.png`、`main-ai-page.png`、`main-cases.png`、`main-flagship.png`、`main-ai-gallery.png`、`main-playground.png`
- 主站其他：`main-dark-hero.png`、`main-mobile-hero.png`、`main-mobile-doc.png`
- es-pc：`pc-home-1440.png`、`pc-hero-1440.png`、`pc-doc-table.png`、`pc-doc-code.png`、`pc-mobile-home.png`、`pc-mobile-home-390.png`、`pc-mobile-doc.png`
- es-eui：`eui-home-1440.png`、`eui-hero-1440.png`、`eui-compare.png`、`eui-cta.png`、`eui-final-cta.png`、`eui-doc-table.png`、`eui-doc-code.png`、`eui-mobile-home.png`、`eui-mobile-doc.png`
- 落地后（2026-11-07）：`search-pc-header.png`、`search-pc-panel.png`、`search-eui-header.png`、`search-eui-panel.png`（顶栏搜索入口与面板，两站同构）
- 第二轮（2026-11-08）：`new-home-*.png`（第一版：氛围层 + 浏览器窗口 + 编号卡片）、`min-home-hero.png`（最终版 1440 首屏）、`min-home-center2.png`、`min-home-proof.png`、`min-home-cross.png`、`min-home-ai.png`、`min-home-start.png`、`min-home-stats.png`、`min-home-mobile2.png`、`min-home-dark.png`、`min-home-en.png`、`new-ai-crud.png`、`new-playground.png`
- 第三轮（2026-11-08，首屏排版）：`hero-before.png`（改前）、`hero-after-f.png`（1440，含逗号版）、`hero-dengxian-1440.png`（最终）、`hero-1280.png`、`hero-1100.png`、`hero-768.png`、`hero-390.png` / `hero-390b.png` / `hero-390-final.png`、`hero-en.png` / `hero-en-dengxian.png`、`hero-dark-en.png`、`font-probe-40.png`（字体对照）

## 附录 C：关键文件

| 关注点 | 文件 |
|---|---|
| 设计令牌（唯一源） | `docs/tokens/design-tokens.css` |
| 品牌口径（唯一源，待补 claims） | `docs/brand/slogan.json` |
| 主站首页 / hero | `es-plus-docs/src/views/Home.vue` |
| 代码块 / Playground | `es-plus-docs/src/components/doc/CodePlayground.vue`、`es-plus-docs/src/utils/code-block.js` |
| 共享文档样式 | `docs/theme/docs-content.css`、`es-plus-docs/src/styles/docs-*.css` |
| 产品截图清单 | `docs/product/shots.json` |
| 视频清单 | `docs/product/videos.json` |
| es-pc 首页 / 布局 | `es-pc/src/views/Home.vue`、`es-pc/src/layouts/DocLayout.vue` |
| es-eui 首页 | `es-eui/src/views/home/index.vue` |
