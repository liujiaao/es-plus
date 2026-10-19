# @es-plus/mcp-server — 全场景（四场景）覆盖方案 · 执行面

> **本文扩展，不覆盖** [AI-FULLSCENE-PLAN.md](./AI-FULLSCENE-PLAN.md)（后者在其自身范围内——CRUD 配置路径——经复核**正确**）。
> 本文补的是它**缺失的那条轴**：**场景覆盖**。
>
> 立项依据：2026-10-15 全量深度复核（四路独立源码审计 + 逐条抽验）。所有断言落源码行；与既有结论冲突处标 **❌ 更正**。

---

## 0. 一句话结论

> **「全场景 ≥95% + 编译 100%」当前不是「没做到」，而是「不可证」——你点名的四个场景里，只有第四个（CRUD 组合）有测量装置，另外三个（独立 es-table / es-form / useDialog）零度量。**
> 所以顺序必须是：**先让四场景同等可测（W1）→ 再守契约（W2）→ 再接线（W3）→ 再对齐独立场景表达力（W4/W5）**。

---

## 1. 复核实测（证据链）

### 1.1 硬指标的真实边界

> **⚠️ 本节初稿有四处事实错误，已按 Wave 0 落地前的逐条复核更正。** 初稿读的是 develop 工作区里那份快照，误把「分支分叉」当成「夜间断供」。教训本身即是方法论：**产物类结论必须指明读的是哪个 ref**。

| 指标 | 实测 | 依据（ref 已注明） |
|---|---|---|
| `compileRate` | `1` | `__tests__/golden/last-accuracy.json`（develop，2026-10-12）。**⚠️ 语义澄清**：产物里的 `compiles` 实为「`generateFromConfig(config')` **没抛异常**」（`eval-llm.mjs:22/215`），**不是** vite build 通过——真正的构建保证在 Tier 0 e2e。读 `compileRate: 1` 时不可当成「三端可编译」 |
| `definition95`（∨） | **0.40**（72/180，k=3） | **最新**：`origin/master:__tests__/golden/last-accuracy.json`（`4d0fabf`，2026-10-15T09:23:38Z，186 例真实测量）。旧值 0.7391 是 develop 快照（23 例口径），**不可跨口径比较** |
| `attributeAccuracy` | **0.9403** | 同上（旧值 0.9305 为 23 例口径） |
| **公开徽章** | **39.4% / 37.8%（双红，但为真实数字）** | `origin/master:…last-accuracy-badge{,-scoped}.json` @ `4d0fabf`；**伪造的 0.0% 已清除** |
| 夜间调度 | **未断供**：10-10 → 10-14 每夜都有提交 | `git log origin/master -- __tests__/golden/last-accuracy.json` |
| 语料规模 | **186**（master 与 develop 现已一致） | `git ls-tree -r --name-only origin/{master,develop} -- __tests__/golden/cases`（均 186） |
| **❌ 初稿说「双红 30.4%/60.9%、断供 3 天」** | **错**：夜间一直在跑（见 §1.1.1）；30.4% 既出现在 develop 快照、也是 **10-12 的真实 master 成绩**；当前 master 公开徽章是**伪造的 0.0%**（10-13/10-14 的 403） | — |

**（历史）master 上的公开徽章曾不是「陈旧」，是「伪造的零」**（见 F6）——**已于 2026-10-15 手动跑批修复**：
现为真实数字 39.4%/37.8%。

#### 1.1.2 首测维度表（`4d0fabf`，186 例真实测量）

**100% 通过**：`tableBtns` `operationColumn` `permissions` `apiParams` `i18n` `formLayout` `virtualScroll` `configTableOut` `mergeConfig` `extPoints`
**明显缺口**：

| 维度 | 通过率 | 性质判定 |
|---|---|---|
| `reactions` | **26.7%**（4/15） | 高级特性，疑似真模型缺口 |
| `expandConfig` | **25.0%**（4/16） | 同上 |
| `columns` | 38.2%（13/34） | 同上 |
| `editConfig` | 40.0%（6/15） | 同上 |
| **`mode`（sfc/schema）** | **39.1%**（18/46） | **F9：度量构造缺陷**（NL 不说 mode） |
| **`target`（vue2/antdv）** | **45.8%**（38/83） | **F9：度量构造缺陷**（NL 不说 target） |
| **`membership`** | **48.3%**（87/180） | **已知语料缺陷**（`inQuery` 默认 true 陷阱），非模型缺口 |
| `isHidden` | 62.5%（15/24） | 待判 |
| `dialogs` | 72.7%（8/11） | 待判 |
| `dataOptions` | 88.8%（79/89） | 接近达标 |
| `formtype` | 88.9%（160/180） | 接近达标 |

**关键读法**：`target`/`mode`/`membership` 三维合计约 **32%** 的失分**不是模型能力问题**（F9 + inQuery 陷阱）。
真正需要工程投入的是 `reactions`/`expandConfig`/`columns`/`editConfig` 这组高级特性。

> ⚠️ **口径提醒（2026-10-15 更正）**：上表是 `byCapability`（即 `exactIntentFull` 的分维），**含** `target`/`mode`/`membership`。
> 但**门禁指标 `exactIntentCore` 只含 prop/attr/actions/tableBtns 四维**（`scorers.mjs:469`），**不含**这三者。
> 所以本表 **不能**用来解释徽章 39.4%；它解释的是 `exactIntentFull` 与 **`definition95`**（用户拍板的 95% 定义）。
> 详见下方 F9「要害澄清」。

#### 1.1.1 徽章史（**2026-10-15 逐夜取 Actions 日志坐实**，取代任何推测）

| 日期 | 真实测量？ | 当夜成绩 | 判据（Actions 日志原文） |
|---|---|---|---|
| 10-10 | ✅ | **5.3%** | 逐例 `propF1/attr/actF1/compiles` 齐全，29 例耗时 ~2 min |
| 10-11 | ✅ | **0.0%** | 同上（逐例分不低，0.0% 出在门禁维度）；当夜日志**无 `scoped=`** → 门禁仍是 `exactIntentCore` |
| 10-12 | ✅ | **30.4%** | 逐例出现 `scoped=ok`/`scoped=X`（∨ 指标已上线），真实调用 |
| 10-13 | ❌ **403** | （伪造 0.0%） | **58 行全为 `ERROR — 403 not enough member budget`** |
| 10-14 | ❌ **403** | （伪造 0.0%） | 同上；**29 例 35 秒跑完** |

**结论**：① 额度耗尽发生在 **10-12 与 10-13 之间**；② 10-12 的 **30.4% 是真实成绩、且真实出现在 master 上**（§1.1 初稿把它整段归给 develop，不准确）；③ 关键判据是**时长**——真实跑批每例耗时 5–12 s（几分钟起步），403 夜**每例 ~1 s、全批 <1 min**。本判据已可直接用于判读 10-15 手动跑批（见 §1.1.2）。

### 1.2 四场景 × 测量装置矩阵（**本审计核心**）

| 宣称场景 | eval-llm? | golden 语料? | vite build? | 运行时? | 实际被谁验证 | **本轮后（Wave 1.1+1.2）** |
|---|---|---|---|---|---|---|
| 独立 `es-table`（`generate_table`） | ✅ **→ 观测（AI-45）** | ❌ **0 → ✅ 3**（3 端） | ❌ **→ ✅ 6（AI-42）** | ❌ **→ ✅ 三端（AI-43 vue3/antdv · AI-44 vue2）** | 字符串断言 + `vite build` + **真组件挂载**（`packages/{vue3,adapter-antdv}/__tests__/fragment-runtime.spec.ts`）+ 真实浏览器（`__tests__/e2e-runtime/tests/vue2-fragments.spec.ts`） | **✅ 语料 3 条 + `check:scene-coverage` 编译断言 + 运行时回环（拉数→行渲染 / configTableOut 映射 / formatter）+ 准确率记分卡（AI-45，仅观测）** |
| 独立 `es-form`（`generate_form`） | ✅ **→ 观测（AI-45）** | ❌ **0 → ✅ 3**（3 端） | ❌ **→ ✅ 6（AI-42）** | ❌ **→ ✅ 三端（AI-43 vue3/antdv · AI-44 vue2）** | 同上 | **✅ 语料 3 条 + 编译 + 运行时（字段/按钮渲染、输入回写、formLayProps 到 prop）+ 准确率记分卡（仅观测）** |
| 独立 `useDialog`（`generate_dialog`） | ✅ **→ 观测（AI-45）** | ❌ **0 → ✅ 3**（3 端） | ❌ **→ ✅ 6（AI-42）** | ❌ **→ ✅ 三端（AI-43 vue3/antdv · AI-44 vue2）** | 同上 | **✅ 语料 3 条 + 编译 + 运行时（component 形态 `open()` 开窗、composable 形态 `useXxxDialog().open()`）+ 准确率记分卡（仅观测）** |
| CRUD 组合 | ✅ 后端 `generateFromConfig` + **前门腿**（模型产出经真 `generate_crud`，含强制 no-table 覆盖） | ✅ 186 | ✅ | ✅ vue3/antdv（Tier 1 vitest `crud-runtime.spec.ts`）+ vue2（Tier 2 playwright `e2e-runtime`） | config→code 断言 + vite build + 真实浏览器挂载 | ✅ **1.3 已落地（2026-10-19，AI-40）**：eval 每条模型产出都过前门；no-table 分支靠人为清空 table 面强制覆盖（语料天然到不了） |

> **本轮把「有语料」这一格从 0 抬起来了**，但**只到「覆盖 + 编译」**：18 条片段语料（`frag-{table,form,dialog}-0{1,2}-{vue3,vue2,antdv}.json`）保证每个场景每条端每个形态都有用例、且产物真能被 `generate*Block` 跑出来并解析通过；**AI-42（2026-10-19）把同一批语料接进了 golden:e2e 的真 `vite build`**（此前运行器 `.filter(isCrudCase)` 静默跳过片段）。
> **AI-43（2026-10-19）把「运行时」这一格在 vue3 / antdv 抬起**：同一批 golden 语料经生成器落盘、运行时动态 import 并挂载真实组件，断言走**数据回环**而非 DOM 类名 —— 表格经全局 `httpRequest` 拉数并回写 `data-source`、表单渲染与输入回写、`formLayProps` 到 prop、component 形态弹窗 `open()` 开窗且默认插槽表单渲染、composable 形态 `useDialog` 创建实例。**这一轮当场咬出并修复了两个静默缺陷**：① `EsDialog` 的 vue3/vue2 版主体只有 `render` 分支、**默认插槽被静默丢弃**（antdv 一直有回退）；② 三端 `EsTable` 只认注入的 `$esPlusTable.$httpRequest`，**看不见 core 权威的顶层 `httpRequest`**（与 EsForm、自由 `httpRequest()` 不一致，独立 es-table 按文档配置即报 "no httpRequest configured"）。
> **AI-44（2026-10-19）补齐 vue2 运行时腿**：Tier 2 Playwright fixture 新增 `fragments.html` + `scripts/gen-fragments.mjs`（从同一批 golden 语料生成六份 vue2 片段，含 composable `.tsx` 经 `@vitejs/plugin-vue2-jsx` 真编译），真实 Chromium 驱动：表格拉数（顶层 `httpRequest` 兜底）、`configTableOut` 形态映射、`formatter` 扩展点、行操作按钮派生、表单字段/输入回写、`formLayout.labelWidth` 到 DOM、component 形态弹窗（默认插槽表单体、宽度/拖拽/关闭叉、必填拦截、PUT 提交）、composable 形态弹窗（`useXxxDialog().open()`、必填拦截、POST 提交）。
> **AI-45（2026-10-19）把「准确率」这一格从 0 抬起（只观测、不门禁）**：`scripts/eval/fragment-scorers.mjs` 按场景把 `(gold, pred)` 拆成 applicable-only 维度（`propSet` / `formtype` / `fieldRequired` / `dataOptions` / `fieldAttrs` / `fieldLayout` / `extPoints` / `target` + 表格 `tableOptions.*`·`pagination.*` / 表单 `context`·`buttons`·`formLayout.*` / 弹窗 `mode`·`options.*`·`dialogMaskNonClosing`），并**归一化库默认值**（生成器无条件发射的 `border/stripe/highlightCurrentRow/rowkey` 与 `context='form'`、`buttons='none'`、`mode='composable'`、`pageSize=10`）——否则「省略」会被误罚，即 inQuery 默认陷阱的同构。`scripts/eval/fragment-prompt.mjs` 直接**自省运行时捕获的真实工具注册**（`scripts/lib/fragment-shapes.mjs`，esbuild 现打包 `shared/src`）生成 system prompt，不手写第二份键清单；`eval-llm.mjs` 对 18 条片段一例一次调用，校验器就是宿主 `tools/call` 用的同一份 zod3 shape，产物再喂真生成器做编译见证，结果落在产物 `fragments` 块（core / scoped(pinnedDims) / full / byScene / byDim）。两条无 key 的 meta 守卫进 `check:consistency`：`check:fragment-scorers`（gold-vs-gold 满分、每维扰动必咬、pins 真在收窄）与 `check:fragment-prompts`（prompt 覆盖每个注册键与 `.describe()` 文案）。片段可单独探针：`eval-llm --fragments`（不写产物、不参与门禁；`--limit` 按语料顺序切片永远切不到片段，故需专用开关）。
> **仍未做**：片段进 `definition95` 分母 / 门禁。95% 定义是用户对 **CRUD 组合页**语料拍的板；把片段混进同一分母会让两套能力的回归信号都变钝。片段数字当前只观测（`eval-llm` 报告与产物 `fragments`），非零未测到行会显式报出并从分母排除。

> **❌ 初稿更正**：本节初稿把三个独立场景的验证写成「**仅** `compile-smoke` esbuild 语法解析」。**错**——
> 它们是**有单测的**（`fragment-generator.spec.ts` 等）。但那类断言全是 `toContain` **字符串比对**：
> 证明「源码里有这串字」，**不**证明「能编译」、更**不**证明「能运行」——与 esbuild 语法解析同属**形态冒烟**，
> 不是可达性见证。**实质缺口不变**：三独立场景**零 golden 语料、零 LLM eval**，即 P7 要求的那种同口径测量缺席。

**证据**：`eval-llm.mjs` 只 import/call `generateFromConfig`（`:39` / `:215`）；186 例 golden 全是 `StructuredCrudConfig`；
`scripts/compile-smoke.mjs`（唯一编译级片段门）**不在 `check:consistency`**（`package.json` 的 `check:consistency` 串里无该项）；
运行时三层的分层见 `__tests__/e2e-runtime/README.md`（Tier 0 编译 / Tier 1 vitest / Tier 2 playwright）。**AI-44 后**：Tier 0 覆盖 CRUD + 全部片段；Tier 1 覆盖 CRUD（vue3/antdv）与片段（vue3/antdv，`fragment-runtime.spec.ts`）；Tier 2 覆盖 vue2 **CRUD + 全部片段形态**（`vue2-fragments.spec.ts`）。

### 1.3 既有规划复核

| 结论 | 判定 |
|---|---|
| AI-01~AI-34 的源码断言 | ✅ 逐条抽验**几乎全部成立**（含 `formLayout.span` 死键、`hasCustomRender` 不可删、AI-34 前提落空） |
| 整套 Wave 0–3 地图 | ⚠️ **只画了一条路**（CRUD 配置）：AI-06/07/08/09/21/22/23/25/26/27/30/31/32/33/34 全属此路；独立 useDialog 仅 AI-28 一条且「未落地」；独立 es-table/es-form **零条目** |
| `config.permissions` = 死键 | **❌ 更正（推翻）**：其消费者是**生成器**——`structured-generator.ts:512/516/520`、`:1285/1289/1293` 把 `permissions.add/edit/delete/...` 物化为按钮 `permissionValue`，后者真被运行时消费（三端 `esPlus.permission(code)`）。**它不是死键**；真死键只有 `formLayout.span` |

### 1.4 方法论：**「本地红」≠「CI 绿」**（2026-10-15 实证）

一个守卫在本地红，**不能**推出它坏了；同样，一个守卫在本地绿，**也不能**推出 CI 上跑过它。本轮实证：

`check:consistency` 是 `&&` 链，第 10 步 `check:generator-targets` 在 **Linux CI 上同样红**（esbuild `__require` shim，与平台无关），于是其后 **29 项从未在 CI 执行过**。此处曾据此把 `check:generator-escaping` 的本地红误判为「Windows-only 假阳性、留给 CI」——**错**：它只是被前一步短路遮蔽，CI 上从未跑到。修完 `git` 可见的根因后它立刻在上游也红。

**判据（必须执行）**：断定一项是「环境假阳性」之前，拉 CI 日志确认**该步骤真的执行过**（出现在日志里、且是它自己红的），而不是被 `&&` 链短路跳过。同时：
- 断「假阳性」要有**逐字节证据**（如 `og:check`：LF 归一后哈希与 meta 逐字相等；`one-config:check`：TARGET 逐字内嵌样例的 LF 形态），而不是「我这机器上红」这种自陈；
- 长 `&&` 链本身就是缺陷源 → 新门禁**往链前段插**（本轮 `check:scene-coverage` / `fragment:smoke` 即插在 `check:generator` 之前），避免再被后端失败遮蔽。

---

## 2. 结构性发现（每项附证据）

### F1 · 被测集合 ⊊ 宣称集合
见 §1.2。附带：`generate_crud_page` / `generate_crud_schema` / `list_form_types` **零测试零守卫**，且前两者是 NL→config 的陈旧重复实现。

### F2 · 片段路径无任何契约/可达性守卫
`check-fragment-contract.mjs` 是**名字陷阱**——只锁 `SurfaceField` ↔ zod3 镜像的词表（`_fragment-shapes.ts:47-114`），**从不运行** `fragment-generator.ts`。
→ 后果：**任何新加进 `FieldConfig` 的能力，静默不到达独立 es-table/es-form/useDialog**——正是 `check-entry-contract.mjs` 自称在守的那条轴。

### F3 · 双模式无告警静默丢弃（违反本项目 P2「mark-never-drop」）

| 键 | schema | sfc | 告警 |
|---|---|---|---|
| `height`（无 `virtual`） | 发 `structured-generator.ts:218` | 丢（门 `:577` `if(tOpts.virtual)`） | **无** |
| `estimatedRowHeight`/`overscanCount`/`rowClassName` | 发 `:223-225` | 丢 | **无** |
| 自定义 `headerCellStyle` | 尊重用户 `:213` | 硬编码 `#f5f7fa` `:572` | **无** |
| 顶层 `formLayout` | 发 `:259-261` | 从不读 | **无** |
| `pagination.pageSizes` | 丢 `:304` | 发 `:494` | **无** |

> **F3 补证（2026-10-15 逐行复核片段路径）**：`headerCellStyle` 的硬编码**不止 SFC**——
> 片段生成器 `fragment-generator.ts:257` 同样写死 `{ background: '#f5f7fa' }`，
> 且 `tableOptions` 根本无处可传用户值。→ 该偏差**两模式同病、系统性**，不是单模式失手。
>
> **F3 已修（2026-10-19，AI-37）**：SFC `headerCellStyle` 尊重用户值、顶层 `formLayout` 映射为
> `layoutFormProps` 并绑定；片段 `TableBlockInput.tableOptions.headerCellStyle` 与
> `generate_table` 的 zod 面同步打通。`check:threeway` 新增**轴①d 值级等价**（探针 `#ffffff` /
> `labelWidth:'100px'` / `minFoldRows:2`），「键在、值被写死」与「键在、配置没接上」都会当场红。

对照：`dialogs`/`tableBtns`/`toolbarBtns`/`operationColumn` 在 SFC 下**有**集中告警（`:389-410`）。即"有告警的都在，没告警的反而静默丢"。

### F4 · dialog 契约三向漂移 + 独立 useDialog 三端不等价
- 运行时 `CrudDialogConfig` **13 键** vs AI `DialogConfigSchema` **9 键**（**闭合对象 → 静默剥**）。
- antdv `useDialog` 曾**没有 `cacheKey`/TTL**（vue3/vue2 有），并登记在 `MEMBER_DEVIATIONS`。
  **已修（2026-10-19，AI-38）**：antdv 的 hook 补上与 vue3 同构的实例缓存（基线 props 覆盖、
  `onClosed` 重包装、关闭后 10 分钟 TTL 回收、`destroy(cacheKey?)`），偏差登记行已删除
  （`check-type-exports` 的过期登记检查反向咬住）；`scripts/check-exports` 的「已登记缺项」
  从 3 处降到 2 处（剩 `PaginationConfig.layout` 与 `DialogOptions.loading`）。

### F5 · emits 契约无人守望（逐条复验）

| 组件 | 偏差 | 性质 |
|---|---|---|
| es-form `confirm`/`reset` | vue3 声明+定义（`es-form.vue:507-508`）但**无按钮绑定**；vue2/antdv 连声明都无 | **惰性声明**（宿主写 `@confirm` 得到静默） |
| es-dialog `open` | vue3/vue2 有；**antdv `defineEmits` 只有 `update:visible`/`closed`**（`component.vue:179-182`） | 真跨端差异 |
| es-table `update:dataSource` | vue2 **已移除**（代码注释 `component.vue:1013` 自述） | **有意为之**，但只在散文注释里、无机器守卫 |

任何 `check-*.mjs` 都**不校验 emits**。

**F5 已修（2026-10-19，AI-37）**：新增 `EMIT_CONTRACT`（`scripts/renderer-contract.mjs`）与
`check-renderer-parity` 第 7 块四断言（缺事件 / 未收录事件 / 陈旧登记 / 声明⇄调用点）。三处裁决：
es-form 的 `confirm`/`reset` 是**死声明**（零调用点）→ 从 vue3/antdv **删除**（不新增向外事件）；
antdv es-dialog **补 `open`**（watch + onMounted 两条路径）；vue2 `update:dataSource` 缺席**登记为
deviation**（reason 非空），生成器同步改发单向绑定（见 F7）。

### F6 · 度量管道无法区分「测量未发生」与「模型得 0 分」（**Wave 0 复核时新发现，最紧急**）

**现象**：`origin/master` 的公开徽章现为 **0.0% 红**，夜间 10-13、10-14 连续两晚写入全零产物
（`compileRate: 0`，且**每个维度 `applicable: 0`**）。

**根因（2026-10-15 从 Actions 日志查实，非推测）**：真实错误是 **`403 not enough member budget`** ——
PPIO 中继**账户/成员额度耗尽**。**key 有效**，是余额问题，**不是凭据失效**。
（我最初的假设是 memory 里的「非 PPIO key → 全 401」；`SERVED_MODELS` 证明「模型一次都没应答」这一层是对的，但具体成因是 403 额度而非 401 鉴权。）

**为何产物里查不到**：错误只 `console.log` 进 Actions 日志，**不入产物**——所以提交回仓库的那份东西只剩一个 0.0%，
事后**无法诊断**。（已在 0.2 的修法里一并固化 `sampleErrors`。）

**根因链**（逐行核实）：
1. 逐 case 失败也照常入行：`eval-llm.mjs` catch 分支推 `{…, compiles:false, byCapability:{}, error}`。
2. 聚合后 `applicable` 全零 → 门禁 `gateExact = 0` → 徽章按阈值算成 `red` / `"0.0%"` → **照常写入**。
3. workflow 的 commit-back 是 **`always()`**（含红跑）→ 伪造的 0.0% 被提交回 master。

**为何必然发生**：`--require-key` 只防**缺 key**（`eval-llm.mjs:92`），不防**无效 key**。中继 key 失效 → 逐 case 401 → 全零。
对照 memory `ppio-eval-relay-config`：「GitHub secret 必须是 PPIO key，否则**全 401**」。

**为何危险**：`applicable: 0` 意味着**没有任何 gold 走到打分器**——这是一次**基础设施故障**，
却被公开发布成「模型得 0 分」。它看起来完全像一次真实的灾难性回归，**因此天然不可察觉**。
这正是本项目最想消灭的失效模式：**一个不会被任何人怀疑的假信号**。

**已修（Wave 0.2）**：在聚合之后、写产物之前加**健康门**——`propSet/formtype/membership/actions`
四维恒 `applicable: () => true`（`scorers.mjs:267-270`），故任一**成功打分**的行必给 applicable 累加 ≥4。
于是「所有维度 applicable 合计为 0」⟺ 测量根本没发生 ⟹ **拒绝发布百分比**，改写 `measurement: "failed"`
记录 + 灰度 `measurement failed` 徽章 + `exit 1`。已用 **master 10-14 真实故障产物**回放验证：对故障产物触发、对健康产物不触发。

### F7 · 片段路径声明了 vue2 不存在的双向方向（F5 同族，2026-10-15 复核新发现）

`generateTableBlock` 对 vue2 发 `:data-source.sync="tableData"`（`fragment-generator.ts:203`），
但 vue2 es-table **从不 `emit('update:dataSource')`**（`packages/vue2/…/es-table/component.vue:1013` 自述「已移除」）。

| 端 | `update:dataSource` |
|---|---|
| vue3 | ✅ 声明 + emit（`component.vue:180` / `:659`） |
| antdv | ✅ 声明 + emit（`component.vue:231` / `:1135`） |
| **vue2** | ❌ **无声明、无 emit** |

**今日无害**（无 `apiUrl` 时父→子方向仍生效，有 `apiUrl` 时表格内部取数自渲染；片段里没人读 `tableData`），
**但 `.sync` 承诺了一个永不触发的子→父方向**——正是 P6 要消灭的那种「声明 ≠ 存在」。
→ 归入 Wave 5 逐条「修 or 登记」。（与 F5 的 es-table 行同源，可合并处理。）

**F7 已修（2026-10-19，AI-37）**：三条 vue2 生成路径（片段 / SFC / legacy `crud-engine`）一律发
**单向** `:data-source`；`pagination` 保持 `.sync`（该事件真的会 emit）。`target.ts#rewriteVModelSync`
在统一改写入口收口 legacy 路径。mcp prompt、vue2 `es-crud-page` 头注/模板、`es-plus-docs` zh/en 与
`docs/internal` 适配分析同步更正（不再教 `.sync`）。vue2 例外在 `EMIT_CONTRACT.deviation` 里带原因登记，
`check-renderer-parity` 第 7 块守护。

### F8 · heldout 被未登记的 few-shot 派生用例污染 → 成绩虚高（**2026-10-15 新发现；2026-10-15 已按语义补全登记**）

`NL_TO_CONFIG_FEWSHOT`（`shared/src/ai-nl-to-config-prompt.ts:29`）现有 **22 条**，而 `eval-llm.mjs` 的
`FEWSHOT_DERIVED` 原先**只登记 6 个** case 文件。→ 其余 few-shot 若在语料里有对应 case，
会被当作 **heldout** 计分，而模型刚在 system prompt 里逐字看过同一段 NL——**测的是复述，不是泛化**。

#### 方法学结论（比数字更重要）：文本相似度是不可靠判据

反证就在**原先已登记的 6 例**里——`03-order-tablebtns.json` 与 few#3 的 NL 相似度仅 **0.45**、
`09-audit-readonly.json` 与 few#5 仅 **0.30**：它们是人工判定为「**变体**」才登记进来的，
**真同源可以低相似**。故相似度既不能证有、也不能证无。

**正确判据是「配置是否是 few-shot 配置的改写」**，三条证据（按强度）：
① **字段名集合存活**（prop Jaccard 高——改写只换 NL 措辞与列语义，`prop` 名会留下）；
② **同一教学点的字面取值复用**（如 `configTableOut:{tableData:'list',total:'totalCount'}`、
`tableBtns` 的「位置/类型/dialogKey」组合、`editConfig:{engine:'vxe',mode:'cell'}`）；
③ **NOT** 仅「特征集相同而字段名与取值全换」——那属独立撰写的特性覆盖。

> **这条判据纠正了纯文本相似度的两个误指**：相似度指向 `102-budget-desc-edit-vue3-sfc` 为 few#22 的同源
> （0.32），但结构比对显示 few#22 的真正同源是 **`92-sku-price-edit-vue3`**（同域「SKU 单价」、复用
> `skuName/price` 字段名与 vxe 行内编辑教学点）；而 `102/99/105/106` 字段名与 few#22 **无一相同** → 不登记。

#### 裁定结果：22 条 few-shot ↔ **22 例**登记（heldout 180 → **164**）

| few# | 派生 case | 判据 |
|---|---|---|
| 1 | `01-user-manage` | 逐字相同（原先已登记） |
| 2 | `02-product-remote-select` | 逐字相同（原先已登记） |
| 3 | `03-order-tablebtns`、**`24-position-tablebtns`** | 03＝左右互换变体；24＝换域改写——字段名全换但 `tableBtns` 逐项同形（批量导出/left/export + 新增X/primary/right/dialogKey:add）且 actions 相同 |
| 4 | `07-vue2-task-manage` | 变体（原先已登记） |
| 5 | `09-audit-readonly`、**`21-audit-readonly-sfc`** | 09＝列名改写；21＝同域 sfc 变体（prop 0.80、actions 同为 `view`） |
| 6 | `16-dept-permissions` | 变体（原先已登记） |
| 13 | **`149-ticket-status-render`** | 去掉 operationColumn 半边的改写（4 个 prop 名全同 + 「状态列彩色标签」教学点同） |
| 15 | **`31-inventory-response-map`** | 字段名全换，但 `configTableOut` 键值**逐字相同**（`{tableData:'list',total:'totalCount'}`）且 NL 同样给出该映射提示 |
| 17 | **`122-province-city-select-vue3`**、**`135-city-multi-rule-vue3`** | 122＝prop 1.00 / NL 0.83；135＝加一列「客户名称」的改写（prop 0.75），联动教学点同 |
| 19 | **`63-order-expand-detail`** | prop 1.00 / NL **0.89**（相似度最高的旗舰证据） |
| 20 | **`77-dept-tree-vue3`** | 去掉两列的改写（NL 0.58、treeConfig 教学点同） |
| 21 | **`172`/`181`/`173`/`177`/`176`/`185`/`179`（7 例）** | 整族都复用 `dept/team/name` 三元字段名；同族的 `180-city-sku-merge` 字段名全换 → **不登记** |
| 22 | **`92-sku-price-edit-vue3`** | 同域「SKU 单价」改写，复用 `skuName/price` 与 vxe `editConfig` 教学点 |
| 7–12, 14, 16, 18, 22 的其余族 | （无） | 最高候选 prop ≤ 0.17 → 独立撰写的特性覆盖（如 isHidden 族 40–46、response-map 族 32/33/34/38 各用**不同**映射键） |

**合计 6（原）→ 22（现），heldout 180 → 164。** 登记表抽到 `scripts/eval/fewshot-derived.mjs`
（含逐条语义裁定与判据说明）；同一份表被 `eval-llm.mjs` 与守卫共用。

#### 守卫：让「登记缺失」这一类缺陷不再复发

语义裁定不可机械化，但**一个保守下界可以**——`scripts/check-fewshot-registration.mjs`（进 `check:consistency`）：

> 机械候选 ⟺ （**prop Jaccard ≥ 0.6** ∨ **NL Jaccard ≥ 0.35**）∧ **actions 完全相同**

三条断言：① 机械候选 **⊆** 登记表；② 登记的每个文件真实存在（防改名/删除后留死条目）；
③ heldout 非空且占多数（防「把语料全登记成 few-shot」洗白）。

**已实测其咬合**：把登记表换回 F8 之前的 6 条，该守卫会报 **12 例未登记**并发红
（24/21/31/122/135/63/77/173/177/179/181/185）——即 16 条新登记中 12 条可机检捕获。
另 6 条（`07/09/149/172/176/92`）因 actions 有差异或相似度过低而下界抓不到，
属**人工判定覆盖**，守卫将其列为「额外登记」供复核、不作为失败条件。

**后果**：此前（含 4d0fabf 那次 186 例测量）**heldout 数字偏乐观**（分子里混着 few-shot recall）。
本项**已修**——下一次性跑批的 `heldoutCases` 将从 180 变 **164**，与旧口径**不可直接比较**。


### F9 · `target`/`mode` 是被**扣留的宿主输入** → 已拍板的「95%」在算术上不可达（**2026-10-15 首次真实测量后确证；2026-10-15 已实施**）

**现象**：首次真实测量（186 例，2026-10-15）`target` 维 **45.8%**（38/83）、`mode` 维 **39.1%**（18/46）。

**根因（逐行核实）**：schema 里 `mode` 默认 `'schema'`、`target` 默认 `'vue3'`
（`structured-config.schema.ts:522-523`），而**前门 `crudShape` 把二者作为显式入参**
（`generate-crud.ts:64` / `:68`）——**生产流程中它们是宿主输入**：`target` 由 `detect_project_target`
识别后传入，`mode` 由宿主按用户意愿选定。`INSTRUCTIONS` 亦明说「**Detect the target FIRST**, then call
the generator」。**从不由模型从 NL 推断**。

**但 `eval-llm.mjs` 只喂 `nl`（+ `fixedFields`）**（原 `buildInitialMessages`，`:130-137`），
却要求模型产出含 `target`/`mode` 的完整 config → 模型只能回落到 schema 默认值 → 必错。

#### 要害澄清：**被锁的是哪条指标**（此条先前记错，2026-10-15 逐行复核后更正）

`scorers.mjs:469` 的 `exactIntentCore` **只含四维** —— `propF1 ∧ attrAcc ∧ actionsF1 ∧ tableBtnsMatch`，
**`target`/`mode` 不在其中**。而门禁/徽章/`inSchemaIntentZeroEdit` 正取自它
（`eval-llm.mjs:270` `exact = meanAll(r => r.exactIntentCore)`；`:377` `gateExact = exactHeldout ?? exact`）。
故：

| 指标 | 是否含 target/mode | 受 F9 扣留影响 |
|---|---|---|
| `exactIntentCore`（**门禁**、徽章、`inSchemaIntentZeroEdit`） | ❌ 不含 | **不直接受** |
| `exactIntentFull`（`:472`，所有 applicable 维度 AND） | ✅ 含 | **受**（仅观测、不门禁） |
| `exactIntentScoped` → **`definition95`**（`:476`，按 `pinnedDims`） | ✅ 含（75 例 pin `target`、41 例 pin `mode`） | **受** |

> 结论修正：**39.4% 徽章是模型在四维上的真实缺口，没有被 66% 天花板压住**——
> 该上限只压在 `exactIntentFull`（观测）与**用户已拍板的「95% = scoped zero-edit ∨ ≤K 轮收敛」**上。
> 换言之：F9 不是徽章的解释，而是**「95% 定义」的解释**。

#### 定义级证据（非文本相似度猜测）：`pinnedDims` 自己断言了 target/mode，而 NL 无任何信号

语料在 `pinnedDims` 里**显式把 `target`/`mode` 列为「NL 真正锁定、须考核」的维度**
（`scorers.mjs:429-430` 的口径），可 NL 全文没有任何平台/形态线索——
**该 pin 无从证伪**。这类例不可能由模型命中，**与模型强弱无关**。

**量化（F8 补登记后的 heldout = **164** 例；括号内为 F8 前的 180 口径）**：

| 口径 | 判据 | 死例 | 剩余上限 |
|---|---|---|---|
| A：`gold.target≠vue3` ∩ NL 无信号 ∪ `gold.mode=sfc` ∩ NL 无信号 | 维度 applicable 即考核 | **60（36.6%）**〔33.3%〕 | **63.4%** |
| B：`pinnedDims` 断言 target/mode ∩ NL 无信号 | 语料自证的 pin | **58（35.4%）**〔32.2%〕 | **64.6%** |

两法独立收敛到 **≈1/3**（缺 target 44–45、缺 mode 25–28，有重叠）。**F8 补登记使分母 180→164
而两个死集不变**（16 条新登记例与新死集无交集）→ **上限反而更低**：F9 与 F8 是**互相加重**的两条缺陷。
**并且 58 例的第二条腿也是断的**：`refinements` 语料全库仅 **5/164**（3.0%），这 58 例**无一例**带 refinements
→ turn-0 scoped 恒假 **且** 无收敛语料可救 → **`definition95` 上限 = 64.6%**。

> **结论：即便模型做完其余全部工作，已拍板的「≥95%」在 `definition95` 口径上数学不可达（上限 64.6%）。**
> 首测 `definition95` = **0.40**（72/180）。**注意该分数本身也偏乐观**（F8 未修时分子含 few-shot recall），
> 故「距上限还有多少是模型可进步区间」需下一次性跑批（heldout=164、givenInputs 已置）重测后才有干净读数。

**这是 F1「被测 ⊊ 宣称」在度量内部的又一次显现**——eval 测的是一条**生产上从不发生**的流程。

#### 修法（非模型工程）——**2026-10-15 已实施**

把 `target`/`mode` 作为**给定输入**喂进 prompt（仿既有 `fixedFields` 机制），与生产一致：宿主先
`detect_project_target`、选定 mode，再生成。落点（全部为**非模型工程**的度量修正）：

| 文件 | 改动 |
|---|---|
| `scripts/eval/prompt.mjs`（新） | 抽出 `buildInitialMessages(nl, fixedFields, given)` + `buildGivenLine`；纯函数、无 SDK，头注记全 F9 依据 |
| `scripts/eval-llm.mjs:42` | 改为 import；调用点传 `{ target: gold.target, mode: gold.mode }`（Zod 已应用默认值，恒有值） |
| `scripts/eval-llm.mjs` record | 新增 `givenInputs: ['target','mode']`——**口径自明**：非空 ⟹ 该准确率是「给定平台/形态下」的，不是「猜出来的」。旧产物无此字段 = 未修的旧口径 |
| `scripts/eval/prompt.test.mjs`（新）+ `check:eval-prompt` | 进 `check:consistency`。钉三条：①给定则明示含「勿推断/勿覆盖」；②**未给定时逐字节等于旧 prompt**（防静默改写语料口径）；③**不给 scorer 放水**——`target`/`mode` 维度仍比对 gold vs pred，「给了却不照抄」照旧翻红 |

**为什么这不是放水**：给定的是**宿主本该给的输入**，考核点从「读心」变为「回抄保真度 + 其余全部推断」；
四维门禁与所有其它维度**一字未动**。已用确定性断言（无 LLM 调用、零成本）验证：186 例 372 个语言行的
prompt 均正确注入，`fixedFields` 老路径逐字节不变。

**同族已知缺陷（一并列此，皆为语料/门禁构造问题，非模型缺口）**：
① `inQuery/inTable/inForm` 默认 `true` 陷阱 → `membership` **48.3%**（87/180）——见 [[golden-inquery-default-true-trap]]；
② 本条 `target`/`mode` 扣留 → `definition95` 上限 **64.6%**（**已修**）；
③ F8 的 few-shot 登记不全 → heldout 虚高（**待修**）。
**三者修完之前，任何「准确率」数字都不可用于判定模型能力，更不可用于门禁。**


---

## 3. 设计公理（沿用 P1–P5，新增两条）

| # | 公理 | 由来 |
|---|---|---|
| P1–P5 | 一份 JSON 三端可运行 / mark-never-drop / 度量先行 / 守卫先行 / 四档可达性 | 既有 |
| **P6** | **「全场景适配」四腿判据**：任一能力只当 ①权威 schema 声明 ②**双模式**发射 ③**三端**消费 ④**三端**被测（golden + 运行时）**同时成立**才算达标 | 本审计 |
| **P7** | **每个生成场景必须由同一语料格式测量，且必须进 `check:consistency`**；不允许任何场景停留在「syntax-smoke only」 | 本审计 |

---

## 4. 执行计划（Wave 0–6，依赖驱动）

### Wave 0 · 止血 ✅ **已落地（2026-10-15）**

| # | 动作 | 状态 / 核对结论 |
|---|---|---|
| 0.1 | ~~双徽章回灰 `pending nightly`~~ → **❌ 取消，前提被复核推翻** | 初稿以为徽章「陈旧」。实测：master 夜间**未断供**（10-10→10-14 每夜提交），徽章是**新鲜的 0.0%**。回灰会抹掉一次**真实测量**——比错误更糟。**真问题在管道，不在徽章**，见 F6 |
| 0.2 | **修度量管道健康门**（F6） | ✅ 已加：`applicable` 全零 ⟹ 拒绝发布百分比，写 `measurement:"failed"` + 灰度徽章 + `exit 1`。真实故障产物回放验证通过 |
| 0.3 | 更正过期工具名（AI 面向 + 公开文案） | ✅ 见下 |
| 0.4 | 本文件落盘 + §1.1 事实更正 + F6 记录 | ✅ |

#### 0.3 明细（复核后范围比初稿更大）

初稿只写了「更正 `ai-tools` 里的过期名」。复核发现更严重的两处：

1. **`packages/mcp-server/src/index.ts:26-27`** —— 这是**直接喂给 LLM 的 server instructions**，
   它让 AI 去调 `generate_from_config`，而**该工具不存在**（实名 `generate_crud_from_config`），
   且该行的工具清单**漏了 5 个**（含前门 `generate_crud`）。同行 `:70`/`:109` 反倒是正确的。
2. **`docs/why-es-plus.md` 把 `generate_crud_schema` 标为「主路径：由宿主 LLM 语义推理生成」** ——
   源码显示它是 `generateCrudSchema(description)` → `generateCrudConfig()`，
   即 `crud-engine.ts` 里的**中文关键词/正则解析**（`/状态|启用|禁用/`…），**零 LLM 调用**。
   而 `index.ts:130` 明说主路径是前门 `generate_crud`。→ 该行**同时错了两件事**。

已修：`index.ts`（工具清单补全 + 改名）、`docs/ai/ai-tools.{json,md}`（flow 改为前门链路，`ai:sync` 分发三站）、
`docs/why-es-plus.md` + `.en.md`（工具表重写 + 工作流改为前门 5 步 + 顺带修正 en 版 formtype 数 13→**14**，真源 `contract.ts`）、
`docs/promo/{blog-juejin,twitter-thread}.md`。

**验证**：`ai:check` / `docs:check` / `check:site-claims` / `check:docs-layout` / `check:api` / `check:readme` / `check:contract` 全绿；mcp-server `tsc --noEmit` 通过；全仓 `generate_from_config` 零残留。
（`packages/mcp-server/CHANGELOG.md:180` 与 `*/dist`、`build/` 为历史/生成物，**不改**。）


### Wave 1 · 让「全场景」可测（**最高杠杆，先于一切修复**）

> **进度**：1.0 / 1.0b ✅（F9 / F8，已推送）· **1.1 / 1.2 ✅ 已实施（2026-10-15）** · **1.3 ✅ 已实施（2026-10-19，AI-40）** · 1.4 由 AI-33 收口（门禁迁 ∨ / 地板 / 棘轮已落地）

| # | 动作 | 验收（变异 → 红） |
|---|---|---|
| 1.1 | ✅ **已实施（2026-10-15）**：**场景分类法** —— 单源 `scripts/eval/scenes.mjs`（`SCENES` / `SCENE_TOOL` / `sceneOf` / `modesOf` / `cellOf`）。语料统一为 `{scene, config, target, mode?}`：**`scene` 可选、缺省即 `'crud'`**（186 条既有用例一字未改），片段场景的 `target` 在**用例顶层**（片段输入本身不含 target）。新增 9 条片段语料（3 场景 × 3 端，同场景三条 config 逐字节相同、只差 target —— 这正是「一份配置 → 三端」的语料表达） | 新场景无语料 → 红 |
| 1.2 | ✅ **已实施（2026-10-15）**：`compile-smoke` 升格为门禁（`fragment:smoke` 进 `check:consistency`）+ 新增 **`check:scene-coverage`**：①覆盖无空格（断每场景 × 每端 × 每模式，**缺格点名**）；②四个场景工具仍在 MCP 注册表（静态断言 `index.ts` 注册调用 + 工具文件里的 `server.tool("<name>")`）；③**片段语料真能编译**（每条真跑 `generate*Block`，用与 `compile-smoke` 同一把尺子 `scripts/lib/compile-check.mjs`） | 删任一场景覆盖 → 红（**实测**：删 `frag-table-01-vue3.json` → 报「缺格：table × vue3 无用例」并发红；漏标 `scene` → `check:scorers` 的 Zod 解析响亮抛错 + 覆盖门禁报缺格） |
| 1.3 | ✅ **已实施（2026-10-19，AI-40）**：**前门进 eval** —— 每条模型产出经真 `generate_crud`（含 no-table 分支强制覆盖）；共享原语抽到 `scripts/lib/front-door.mjs`，分类/聚合在 `scripts/eval/front-door-leg.mjs` | **前门回归 → 红**：eval 的 `passed`/exit code 读 `frontDoorStats.ok`（编译失败 ∨ 未覆盖 no-table ∨ 零路由）；`check:front-door-leg` 脚本化钉住分类 |
| 1.4 | AI-33 原 8 条（门禁迁 ∨ + core 地板 + per-dim ratchet + 徽章与门禁同源 + 补 6 维 COVERAGE + heldout ≥60 + 防删难例） | 篡改 ∨ / 维度退步 / 删语料 → 红 |
| **1.0** | ✅ **已实施（F9）**：`target`/`mode` 作**给定输入**喂入 prompt（`scripts/eval/prompt.mjs`，仿 `fixedFields`）。**不做这条，「95% 定义」就在惩罚模型猜不到的宿主输入**（`definition95` 上限 64.6%） | 58 例不可推断例改为「给定 target/mode」；`check:eval-prompt` 钉住旧路径逐字节不变 + 维度不放水 → 篡改即红 |
| **1.0b** | ✅ **已实施（F8）**：`FEWSHOT_DERIVED` 按语义裁定补全 **6 → 22**（剔 16 例未登记同源），抽到 `scripts/eval/fewshot-derived.mjs`；heldout **180 → 164** | 新增 `check:fewshot-registration`：机械下界（prop ≥0.6 ∨ NL ≥0.35，且 actions 同）⊆ 登记表 + 登记条目须真实存在 + heldout 不得被洗白。**实测**：换回旧 6 条登记表该守卫报 12 例 → 红 |

> **反噬警告（F8 已完成，转为守卫约束）**：补 COVERAGE 会迫使加 few-shot，而每加一条 few-shot 都可能
> 在语料里带出同源 case，必须同步登记进 `FEWSHOT_DERIVED`（`scripts/eval/fewshot-derived.mjs`）。
> 该表已由 **6 → 22**（剔 16 例未登记同源），heldout **180 → 164**（单例噪声 0.61pp），
> 「先扩语料」与「按语义补全登记」两个前提**均已满足**；
> 且 `check:fewshot-registration` 守卫已进 `check:consistency`（机械下界 ⊆ 登记表）——
> 今后新增同源 case 忘记登记会**直接红**（实测：换回旧 6 条登记表该守卫报 12 例）。

### Wave 2 · 契约守卫补齐（守卫先行）

| # | 动作 |
|---|---|
| 2.1 | **AI-26 + AI-32**：dialog 契约双份全等 + `readReachability` 下潜 `dialogs` + MCP resource 第三份对齐 |
| 2.2 | **AI-29**：`vxeFirstClass` 降档 + B 档「第二腿」（断「声明的键真能经 from_config 发射」） |
| 2.3 | **S4 · emits parity 守卫**：三端 `emits` 键集 diff 进 `check:renderer-parity`；F5 三条 + **F7** 逐条「修 or 登记 + 原因非空」 |
| 2.4 | **S5 · 跨模式差异台账**：F3 五键进登记表，**要么补齐、要么发告警** |

### Wave 3 · 接线修复

| # | 动作 |
|---|---|
| 3.1 | **AI-27** dialog 配置面收敛 + 消除 `openDialog` 硬编码 9 键转发 |
| 3.2 | **AI-30** SFC/schema 对齐（含 F3） |
| 3.3 | **AI-31** 表单 `render`/`on`/`httpRequest`/`isInitRun` 接线 + `formLayout.span` 死键裁决 |
| 3.4 | **AI-34** 三向一致性扫描 |
| 3.5 | **AI-21 余项** + **AI-28**（useDialog 骨架 + options 块） |

每条带 **golden + 运行时见证**。

### Wave 4 · 独立组件场景对齐（**新增——「最贴合 es-plus」的关键**）

**问题**：**字段级**词汇三工具共用且已很宽（`surfaceFieldSchema`，`_fragment-shapes.ts:47-114`，含 `isHidden`/`reactions`/`permissionValue`/`render`/`formatter`/`apiParams`）；
真正的窄在**容器级**——`generate_table` 顶层 7 键且 `tableOptions` 仅 5 个布尔（`fragment-generator.ts:163-169`）、`generate_form` 顶层 6 键且只有 `context`(query|form) + `buttons`(none|query|submit)、`generate_dialog` 顶层 7 键且 **`width:'560px'`、底部按钮、查看模式判别（字面量 `title === '查看'`）全部硬编码**（`fragment-generator.ts:360/369/378-396`），传不进任何 `DialogOptions`。
而 CRUD 侧同族词汇已有 `FieldConfig` 24 / `TableColumn` 15 / `TableOptions` 26 键 → **文档站 demo 能做的独立表格/表单/弹窗选项，AI 生成不出来**。

**方案**：新增 `EsTableConfig` / `EsFormConfig` / `EsDialogConfig`（**严格复用** `FieldConfig` / `TableColumn` / `TableOptions` / `DialogOptions` 的**数据子集**），三个片段工具 + `validate_config` 一并接受。

**收益**：① P1「一份 JSON」字面成立；② 既有守卫**部分**自动覆盖（见下，须补一步）；③ 语料格式统一，度量成本低。**风险**：纯 AI 契约层扩展，**不动组件源码**。

> **收益②须精确化（2026-10-15 核对守卫实现后）**：`check-entry-contract.mjs` 的 `readReachability()`
> **硬编码只切四块源码**——`crudShape`（`generate-crud.ts`）/ `StructuredCrudConfigSchema` / `SurfaceField` / `FieldConfigSchema`
> （`scripts/lib/entry-keys.mjs:144-152`）。因此：
> - **字段级**：自动覆盖 ✅——只要新 `EsXxxConfig` 继续复用 `surfaceFieldSchema`，断言 1（`SurfaceField ⊆ FieldConfig`）即生效；
> - **容器级**：**不自动覆盖** ❌——新增 `EsTableConfig`/`EsDialogConfig` 是**新工具形状**，守卫不认识它。
>   必须把 `readReachability` 从「单个 `crudShape`」泛化为「遍历所有生成工具形状」，否则 W4 反而**新开一条无守卫入口**。
>
> 幸运的是 `tableOptionsKeys` **已被抽取**（`:153-158`）——`片段 tableOptions ⊆ 权威 tableOptions` 这条断言只差接线。

**✅ 已落地（2026-10-19，AI-40）**

| 项 | 落地 | 硬指标如何被强制 |
|---|---|---|
| `EsTableConfig` | `TableBlockOptions` **26 键**（= 权威 AI `tableOptions` 全等镜像）+ `EsTablePagination {pageSize,pageSizes}`；发射由 `TABLE_BLOCK_ALWAYS` / `TABLE_BLOCK_OPTION_ORDER` / `PAGINATION_KEYS` 三个冻结数组驱动 | `check-fragment-contract` ⑥：接口 ≡ zod3 镜像 ⊆ core `TableOptions`，且键集 **恰等于** 两个发射枚举（不重叠）；⑦：接口 ≡ 发射枚举 ≡ zod3；⑧：生成器必须 `of <冻结数组>`（逐键手写即红） |
| `EsFormConfig` | 新增 `formLayout {labelWidth,minFoldRows}` → `layoutFormProps.formLayProps`；`buttons:'none'` 时 `minFoldRows` **显式告警**（运行时不可见）；vue2 同步进 `setup()` 的 return | `check-fragment-contract` ⑦（`EsFormLayout` ≡ `FORM_LAYOUT_KEYS` ≡ zod `formLayoutSchema`）+ vitest 5 例（含「未给 formLayout 时产物逐字节不变」） |
| `EsDialogConfig` | 类型出口（形状即已有 `DialogBlockInput`，无新增键） | — |
| `validate_config` | 新增 `es-table-config` / `es-form-config` / `es-dialog-config` 三类型，**直接复用**三个工具的 Zod 形状（不抄第三份字段清单）；zod3 `invalid_enum_value/options` → zod4 `invalid_value/values` 归一 | `check-entry-contract` ⑦：路由数组必须列全三个常量、`fragmentSchemaFor` 每个都有 `case`、且从三个工具模块 import 形状（实测：从路由数组摘掉一项，修前全绿 → 修后红） |
| 守卫泛化 | `readReachability()` 从「单个 `crudShape`」泛化为**遍历 `FRAGMENT_TOOL_SRC`**（table/form/dialog），并新增权威 `formLayoutKeys`/`paginationKeys` 抽取（顶层与 `DialogConfigSchema` 内同名块缩进相同，用 `lastIndexOf` 定位） | `check-entry-contract` ⑤：三个片段形状顶层键 ⊆ schema 顶层键 ∪ `FRAGMENT_TOOL_ONLY`（7 行，原因非空、只减不增 + 陈旧检查）；⑥：容器级三组键集**全等**（子集不够 —— 子集允许权威加键、片段悄悄收窄） |
| 前门静默丢弃 | `generate_crud` 无表分支此前收了顶层 `formLayout` 却不传给 `generateFormBlock` —— 已转发（AI-40 顺带修） | 前门 `crudShape` 与片段形状同受 ⑤⑥ 约束 |
| 语料 | `frag-table-02-{vue3,vue2,antdv}`（21 个条件发射键 + 分页播种）、`frag-form-02-*`（labelWidth/minFoldRows） | `check:scene-coverage` 编译 18/18 可解析 |

**变异验证（逐项实跑咬红）**：往 `TableBlockOptions` 加未发射键 → ⑥/⑦ 三红；从 zod3 镜像删 `showHeader` → ⑥ + entry ⑥ 双红；`formShape` 加 schema 未知键 → entry ⑤ 红；`EsFormLayout.minFoldRows` 改名 → ⑦ 三红；`validate_config` 路由数组摘掉 `ES_FORM_TYPE` → entry ⑦ 红。**未动组件源码**，与「纯加法」风险约束一致。


### Wave 5 · 三端组件偏差裁决（**新增**）

逐条「修 or 登记」，禁止「声明了等于承诺不存在的能力」：

| 偏差 | 裁决与落地 |
|---|---|
| antdv `useDialog` 无 `cacheKey`/TTL | ✅ **已修（2026-10-19，AI-38）**：补齐与 vue3 同构的实例缓存 + TTL；`MEMBER_DEVIATIONS` 登记行删除（过期登记会被 `check-type-exports` 咬红）；教学面（`conventions.ts` / `get-component-api.ts` / `crud-page-schema.ts` fallback）同步改为「三端均生效」 |
| antdv `ColorPicker` 降级原生 input | ✅ **登记 + 教学已落地**：守卫在 `FORM_RENDER_CONTRACT`（含 `deviation`），教学在 `conventions.ts` 的 formtype 段与 `get-component-api.ts` 的 `formtype` 注释（antdv 分支） |
| `engine:'virtual'` 真引擎 vue3-only | ✅ **源码复核后更正**：并非 vue3-only —— vue2 忽略并告警（已登记/教学），antdv 4 原生 `a-table :virtual` 真生效（`component.vue:72/351`）。教学与 `check-type-exports` 注释里的旧表述已更正 |
| vue2 es-table 无 `update:dataSource` | ✅ **已修（AI-37）**：机器登记进 `EMIT_CONTRACT.deviation`，片段/SFC/legacy 生成器统一发单向 `:data-source` |

### Wave 6 · 准确率工程（与 W1 并行收口）

- ✅ `formLayout.span` 死键：已按 (b) 从 schema/文档删除（AI-31），`scorers.test.mjs` 的
  「给死键记分」fixture 同步改活键。
- ✅ **零覆盖工具已补齐测试（2026-10-19，AI-39）**：`list_form_types` / `generate_crud_page` /
  `generate_crud_schema` 此前**无任何测试**。新增 `__tests__/legacy-tools.spec.ts`（8 例）钉住
  MCP 面路由：formtype 枚举与 `FORM_TYPES` 单源一致、schema/sfc 模式分支、三端包名、schema JSON
  与目标无关（三端逐值相同）、vue2 SFC 不发 `:data-source.sync`（F7 回归）。同时修正
  `list_form_types` 把 formtype 说成 `@es-plus/vue3` 专属的过期文案（三端共用同一枚举）。

---

## 5. 硬指标如何被强制（可验收）

```
前置（Wave 0 已落地）: 测量未发生 ⟹ 不发布百分比（健康门，见 F6）
                      ——「没有数字」必须长得和「数字是 0」不一样
覆盖         := check:scene-coverage ✅ 已落地（W1.2）：每个场景每格都有语料，
                缺格**点名**（「table × vue3 无用例」）；四场景工具仍在 MCP 注册表（静态断言）。
                另断言「片段语料真能被 generate*Block 跑出产物并解析」——一条没人编译的语料是死用例。
                ⚠️ 覆盖 ≠ 准确率：本门禁只保证「测了」，不保证「测对了」。
                   准确率由 AI-45 的片段记分卡**观测**（不进门禁，见 §1.2）。
编译率 100%  := 真实矩阵的**全部**语料通过编译闸
                真实矩阵 = crud: 3 端 × 2 模式 ＋ dialog: 3 端 × 2 形态 ＋ table|form: 3 端 × 1
                ⚠️ 原文「四场景 × 三端 × **两模式**」在算术上不成立：CRUD 的 schema/sfc 两模式
                   只覆盖 CRUD；dialog 另有 composable/component 两种**产物形态**（AI-28，
                   `generate_dialog` 形状确有 `mode`）；table/form 无此轴。
                   前门 no-table 分支从不传 mode。理由见 `scripts/eval/scenes.mjs` 头注。
                口径分两段：
                  · crud（188 例）→ **vite build**（真构建，golden:e2e 驱动）
                  · 片段（18 例）→ **语法解析 + 真 vite build**：
                    `fragment:smoke` + `check:scene-coverage`（esbuild 语法，已进 check:consistency）
                    + `golden:e2e`（真构建，AI-42 起同一运行器覆盖片段；`check:scene-coverage`
                      的 (c) 段断言「片段没被运行器过滤掉」，加回 `.filter(isCrudCase)` 即红）
                    + **运行时**（AI-43）：vue3 / antdv 的 `fragment-runtime.spec.ts`
                      把同一批语料挂载到真实组件，断言数据回环（vue2 见 §1.2 注）
                （W1.2 已落地：编译门禁覆盖到四场景的**每一格都有语料且产物可解析**）
准确率 ≥95%  := 各场景 heldout 上 definition95 = scoped zero-edit ∨ ≤K=3 收敛 ≥ 95%
                + per-dimension ratchet + core 非回归地板 + 防「删难例洗分」守卫
                【前置·F9】✅ 已实施：target/mode 作**给定输入**喂入；否则 definition95 上限仅 64.6%，95% 不可达
                          （注：锁的是 definition95 的 scoped 腿，**不是** exactIntentCore——后者只含四维）
                【前置·F8】✅ 已实施：FEWSHOT_DERIVED 按语义补全 6→22，heldout 180→164；
                          并有 check:fewshot-registration 守卫（机械下界 ⊆ 登记表）
                【前置·同族】inQuery 默认 true 陷阱修完（membership 现 48.3%，多为语料缺陷非模型缺口）
门禁         := definition95 进 exit code；exactIntentCore 降为并列诊断
```

**稳定性前提**：scoped 与 convergence 均为**确定性打分**（scripted refinements）→ 可复现；
语料已扩至 **186 例 → heldout 164**（单例 = **0.61pp**），「heldout < 60 时门禁落在噪声上」的前提**已解除**；
✅ `FEWSHOT_DERIVED` 已按语义补全（F8：6→22 例，剔 16 例未登记同源，守卫已进 `check:consistency`）。

---

## 6. 风险与回退

| 风险 | 回退 |
|---|---|
| 付费 eval（PPIO 中继，真实费用）是 W1 唯一外部依赖 | 额度受限时先跑子集，**必须标 `subset:N`**（master 已于 2026-10-15 合并 develop → 两支同为 **186** 例；历史口径 29 例不再存在，**即便同日不同 SHA 也会口径断层，故必须标**） |
| Wave 4 扩 AI 契约面 | 纯加法、组件零改动；某键三端不等价 → 降 `knownGaps` 登记，**绝不静默** |
| 其余全为确定性本地工作 | 无回退风险 |

---

## 7. 与既有文档的对应

| 本文 | 既有 |
|---|---|
| §1.3 复核结论 | [ROADMAP.md](./ROADMAP.md) · [AI-FULLSCENE-PLAN.md](./AI-FULLSCENE-PLAN.md) |
| Wave 1.4 | AI-33 |
| Wave 2.1 / 2.2 | AI-26 + AI-32 / AI-29 |
| Wave 3 | AI-27 / AI-30 / AI-31 / AI-34 / AI-21 / AI-28 |
| Wave 0 / 1.1–1.3 / 2.3–2.4 / 4 / 5 / 6 | **本文新增（既有文档无对应条目）** |
