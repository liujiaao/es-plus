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

| 宣称场景 | eval-llm? | golden 语料? | vite build? | 运行时? | 实际被谁验证 |
|---|---|---|---|---|---|
| 独立 `es-table`（`generate_table`） | ❌ | ❌ **0** | ❌ | ❌ | **字符串断言**：`shared/__tests__/fragment-generator.spec.ts`（`toContain`，181 行）+ `mcp-server/__tests__/generate-tools-and-prompts.spec.ts` + `scripts/compile-smoke.mjs`（esbuild 语法解析，**不在 `check:consistency`**） |
| 独立 `es-form`（`generate_form`） | ❌ | ❌ **0** | ❌ | ❌ | 同上 |
| 独立 `useDialog`（`generate_dialog`） | ❌ | ❌ **0** | ❌ | ❌ | 同上 |
| CRUD 组合 | ⚠️ 仅 `generateFromConfig`（**后端**），**从不调前门 `generate_crud`** | ✅ 186 | ✅ | ✅ vue3/antdv（Tier 1 vitest `crud-runtime.spec.ts`）+ vue2（Tier 2 playwright `e2e-runtime`） | config→code 断言 + vite build + 真实浏览器挂载 |

> **❌ 初稿更正**：本节初稿把三个独立场景的验证写成「**仅** `compile-smoke` esbuild 语法解析」。**错**——
> 它们是**有单测的**（`fragment-generator.spec.ts` 等）。但那类断言全是 `toContain` **字符串比对**：
> 证明「源码里有这串字」，**不**证明「能编译」、更**不**证明「能运行」——与 esbuild 语法解析同属**形态冒烟**，
> 不是可达性见证。**实质缺口不变**：三独立场景**零 golden 语料、零 LLM eval**，即 P7 要求的那种同口径测量缺席。

**证据**：`eval-llm.mjs` 只 import/call `generateFromConfig`（`:39` / `:215`）；186 例 golden 全是 `StructuredCrudConfig`；
`scripts/compile-smoke.mjs`（唯一编译级片段门）**不在 `check:consistency`**（`package.json` 的 `check:consistency` 串里无该项）；
运行时三层的分层见 `__tests__/e2e-runtime/README.md`（Tier 0 编译 / Tier 1 vitest / Tier 2 playwright），**三层都只驱动 CRUD 链**。

### 1.3 既有规划复核

| 结论 | 判定 |
|---|---|
| AI-01~AI-34 的源码断言 | ✅ 逐条抽验**几乎全部成立**（含 `formLayout.span` 死键、`hasCustomRender` 不可删、AI-34 前提落空） |
| 整套 Wave 0–3 地图 | ⚠️ **只画了一条路**（CRUD 配置）：AI-06/07/08/09/21/22/23/25/26/27/30/31/32/33/34 全属此路；独立 useDialog 仅 AI-28 一条且「未落地」；独立 es-table/es-form **零条目** |
| `config.permissions` = 死键 | **❌ 更正（推翻）**：其消费者是**生成器**——`structured-generator.ts:512/516/520`、`:1285/1289/1293` 把 `permissions.add/edit/delete/...` 物化为按钮 `permissionValue`，后者真被运行时消费（三端 `esPlus.permission(code)`）。**它不是死键**；真死键只有 `formLayout.span` |

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

对照：`dialogs`/`tableBtns`/`toolbarBtns`/`operationColumn` 在 SFC 下**有**集中告警（`:389-410`）。即"有告警的都在，没告警的反而静默丢"。

### F4 · dialog 契约三向漂移 + 独立 useDialog 三端不等价
- 运行时 `CrudDialogConfig` **13 键** vs AI `DialogConfigSchema` **9 键**（**闭合对象 → 静默剥**）。
- antdv `useDialog` **完全没有 `cacheKey`/TTL**（vue3/vue2 有）；已登记 `MEMBER_DEVIATIONS`（`check-type-exports.mjs:103`）。

### F5 · emits 契约无人守望（逐条复验）

| 组件 | 偏差 | 性质 |
|---|---|---|
| es-form `confirm`/`reset` | vue3 声明+定义（`es-form.vue:507-508`）但**无按钮绑定**；vue2/antdv 连声明都无 | **惰性声明**（宿主写 `@confirm` 得到静默） |
| es-dialog `open` | vue3/vue2 有；**antdv `defineEmits` 只有 `update:visible`/`closed`**（`component.vue:179-182`） | 真跨端差异 |
| es-table `update:dataSource` | vue2 **已移除**（代码注释 `component.vue:1013` 自述） | **有意为之**，但只在散文注释里、无机器守卫 |

任何 `check-*.mjs` 都**不校验 emits**。

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

| # | 动作 | 验收（变异 → 红） |
|---|---|---|
| 1.1 | **场景分类法**：语料统一为 `{scene, config, target, mode}`，`scene ∈ {crud, table, form, dialog}` | 新场景无语料 → 红 |
| 1.2 | **片段路径进 `check:consistency`**：`compile-smoke` 升格为门禁 + 新增 `check-scene-coverage`（断「四场景 × 三端 × 两模式」无空格） | 删任一场景覆盖 → 红 |
| 1.3 | **前门进 eval**：对 `generate_crud`（含 no-table 分支）至少跑一遍 | 前门回归 → 红 |
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

### Wave 5 · 三端组件偏差裁决（**新增**）

逐条「修 or 登记」，禁止「声明了等于承诺不存在的能力」：

| 偏差 | 建议 |
|---|---|
| antdv `useDialog` 无 `cacheKey`/TTL | **修**（对齐 vue3/vue2） |
| antdv `ColorPicker` 降级原生 input | 登记（已有 `FORM_RENDER_CONTRACT:27`）+ AI 教学告知 |
| `engine:'virtual'` 真引擎 vue3-only | 登记 + AI 侧明确「三端安全子集」 |
| vue2 es-table 无 `update:dataSource` | 从注释升格为**机器登记**；**并修片段生成器**（F7：vue2 分支不该发 `.sync`，或改为单向 `:data-source`） |

### Wave 6 · 准确率工程（与 W1 并行收口）

- `formLayout.span` 死键：core 落地为「未配字段默认 span」**或**从 schema/文档删除（二选一）；同步修 `scorers.test.mjs:40` 的「给死键记分」
- 清理零覆盖工具（`list_form_types` / `generate_crud_page` / `generate_crud_schema`）：**删或补测试**，不许悬空

---

## 5. 硬指标如何被强制（可验收）

```
前置（Wave 0 已落地）: 测量未发生 ⟹ 不发布百分比（健康门，见 F6）
                      ——「没有数字」必须长得和「数字是 0」不一样
编译率 100%  := 四场景 × 三端 × 两模式 的**全部**语料 vite build 通过
                （今天只对 CRUD schema 路径成立；W1.2/1.3 后才四场景成立）
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
