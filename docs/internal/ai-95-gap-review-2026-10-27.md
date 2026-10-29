# AI 原生全场景：95% 准确率 / 100% 编译的复核与可行方案（2026-10-27）

> 状态：**复核报告（只读）+ 方案（待拍板）**。今日实测复算的部分标注「今日复算」，其余引用既有产物的标注 ref。
> 上游：[accuracy-95-ruler-v3-design.md](./accuracy-95-ruler-v3-design.md)（R2 裁决已定、P0 已落地）·
> [AI-SCENE-COVERAGE-PLAN.md](../../packages/mcp-server/AI-SCENE-COVERAGE-PLAN.md) · [AI-FULLSCENE-PLAN.md](../../packages/mcp-server/AI-FULLSCENE-PLAN.md) ·
> [wave-2-production-trust-design.md](./wave-2-production-trust-design.md) · [ROADMAP.md](../../packages/mcp-server/ROADMAP.md)。
> **本文不重复上述文档的论证**，只做三件事：把现状数字钉死、把「还差什么」逐条归因、给出可验收的实施顺序。

---

## 0. 一句话结论

| 硬指标 | 现状 | 判定 |
|---|---|---|
| **编译率 100%** | `216/216`（zh CRUD）· `63/63`（片段）· `22/22`（PRD），Tier A 真编译且**进门禁** | ✅ **已达**。缺口在**覆盖面**（en 腿不进分母、typecheck 只抽样 30），不在数字 |
| **准确率 ≥95%** | `definition95 = 22.7%（44/194）`；zero-edit 腿 `19.6%（38/194）` | ❌ 未达，且**当前这个 22.7% 里有一大半不是模型能力问题**；更要紧的是**语料 + 尺子自己把上限压到 83.5%**（32 个 heldout 行钉了 NL 没说也推不出的值，§9 D15）。**0a 已落地**（装饰键投影，§11.1）：尺子侧上限抬回 **94.8%**，只剩 10 行 `membership` 不可推断（由 0b 修） |
| **全场景** | 四场景语料+编译齐了，但**准确率只有 CRUD 腿进门禁**；片段腿 55.6%，其中 **28 行失败全部由 `propSet` 决定**（`core == scoped == stated == propSet == 35/63`） | ⚠️ 可测 ≠ 测对了：片段腿不是"模型不会"，是**同一把尺子的同一个缺陷**（D6） |

**根因排序（今日复算 + 既有日志，可复现）**

1. **尺子**：字段身份按 `prop` 精确判等，而 `prop` 在 NL 里**只出现 2.1%**（22/1041 严格匹配；忽略大小写才 40/1041 = 3.8%），`label` 出现 **98.4%**（1024/1041）⟹ 零编辑腿被**结构性封顶**。**片段腿用的是同一把尺子**（`fragment-scorers.mjs:93` 同样以 `prop` 建索引），而片段腿的 28 行失败**全部**由 `propSet` 决定（`scoped == stated == core == byDim.propSet == 35/63`，见 D6）——两条腿是**同一个根因**，不是两个缺陷。
2. **掩码**：`25` 个用例把 `membership` 钉进 `pinnedDims`，而这 **25 条的 NL 里没有一处查询措辞**；`pinnedDims ⊆ nlStatedDims` 这条不变量片段腿/弹窗腿都有（`fragment-scorers.test.mjs:390`、`dialog-scorers.test.mjs:96`），**CRUD 腿没有** ⟹ 钉了一个模型推不出来的意图（见 D2）。同源的更广谱现象是 gold 全语料写了 **468** 个 `inQuery:false`，其中 **215** 个落在**没有穷举查询列举**的用例里。
3. **教学**：`tableBtns`（自定义文案/位置）与 `dialogs` 这两类**NL 明说、gold 也声明**的内容，模型整组不写（3/13、3/15）。

---

## 1. 口径先把齐（否则一切数字不可比）

| 指标 | 定义（源码位置） | 当前值 | 分母 | 门禁？ |
|---|---|---|---|---|
| `definition95`（∨） | `exactIntentScoped ∨ firstTurn ≤ K`（`scripts/eval/scorers.mjs:716`） | **22.7%**（44/194） | heldout 194 | ✅ 门禁 + 徽章 |
| scoped zero-edit | 只 AND `pinnedDims` 的 token（`scorers.mjs:640-641`） | **19.6%**（38/194） | heldout 194 | 观测（scoped 徽章） |
| `exactIntentCore` | prop + 4 属性 + actions + tableBtns | **15.5%**（30/194） | heldout 194 | 观测 |
| `compileRate` | Tier A 真编译（`scripts/eval/compile-leg.mjs`） | **100%**（216/216） | **zh** CRUD 有产物行 | ✅ 门禁 |
| 片段 scoped | 同 scoped，按 `pinnedDims` | **55.6%**（35/63） | 片段 63 | 观测 + 地板红（77.8%） |
| PRD membership | 成员资格三分量 | **95.3%**（181/190） | 22 例 | 观测 |
| typecheck（Tier B） | 每端抽 10 例 | **100%**（30/30） | 抽样 30 | 观测 |

**95% 的硬算术（决定一切排期的那个数）**

`194 heldout = 164 普通 + 30 收敛`。要 95% 需 **185** 例。

- 收敛腿今天贡献 **6** 例（16 within-K − 10 turn-0），理论上限 **20** 例；
- 即使收敛腿打满 20，普通用例仍需 **155/164 = 94.5%** 零编辑；
- 今天普通用例零编辑 ≈ **28/164 = 17.1%**。

⟹ **95% 的主战场是零编辑腿，收敛腿最多兜 10pp。** 这也是为什么必须先把尺子修对：现有封顶让任何 prompt/能力改进都测不出来。

---

## 2. 现状分布（`__tests__/golden/last-accuracy.json`，2026-10-22，heldout 194）

| 维度 | 通过 | 性质（本轮判定） |
|---|---|---|
| `actions` | 96.9% | 基本达标 |
| `formtype` | 88.7% | 接近达标 |
| `permissions` / `i18n` / `target` / `mode` / `virtualScroll` / `operationColumn` | 100% | 达标 |
| `treeConfig` / `mergeConfig` | 92.9% / 87.5% | 接近 |
| **`membership`** | **63.4%** | 混合：一部分是**掩码不可推断**（25 个 pin；D2）、一部分是**gold 与 NL 正面矛盾**（6 例；D11） |
| `extPoints` / `apiParams` | 69.6% / 75% | 待归因 |
| **`dataOptions`** | **42.3%**（47/111） | 被 `prop` 键查找放大（D1） |
| **`propSet`** | **36.1%**（70/194） | **尺子**（D1） |
| `fieldSpan` / `editConfig` | 42.9% / 42.9% | 被 D1 遮蔽，待复算 |
| **`dialogs` / `tableBtns`** | **20.0% / 23.1%** | **教学缺口**（D3） |
| **`isHidden` / `columns` / `expandConfig` / `reactions`** | **18.5% / 12.5% / 13.3% / 7.7%** | 被 D1 遮蔽（这些维度全部以 `prop` 为键） |

> **读法**：上表**不能**直接当「模型能力」排行榜。`columns`/`isHidden`/`reactions`/`dialogs`/`dataOptions`/`fieldSpan` 的判据是
> 「按 `prop` 找到 pred 字段再比」，`prop` 一改名就整维判负（`scorers.mjs:47` 的 `fieldMap`）。**必须先修尺子再归因。**

---

## 3. 缺陷清单（逐条：证据 → 性质 → 影响 → 修法）

### D1 · 【尺子·HIGH】字段身份按 `prop` 判等，而 `prop` 不可推断

- **证据（今日复算）**：全语料 1041 个字段，`prop` 字面出现在 NL 的 **22（2.1%）**——忽略大小写才是 **40（3.8%）**，附录命令 №1 复现的是 22（见 §9 C14）；`label` **1024（98.4%）**；同一 case 内 `label` **0 重复**（可单射）。
- **证据（既有日志）**：`accuracy-95-ruler-v3-design.md:107-125` —— `propF1 < 1` 的 **129/210 行 scoped 通过率 0.0%**，其中 **125 行 gold label 全在 NL 里**；这 129 行被 `columns/isHidden/expandConfig/dialogs/tableBtns/extPoints/editConfig/reactions` 挡住，而这些维度**全部以 prop 为键**。
- **性质**：尺子缺陷（R2 已裁决：`label` 作身份 + `prop` 降为观测量），**不是放水**——仓库里 PRD 腿、AN-19、AI-46 早已这么判，只有 CRUD 主腿没对齐。
- **影响**：零编辑腿封顶；`propSet` 36.1%；连带 8 个 prop-keyed 维度大面积假负。
- **修法**：`scripts/eval/align.mjs`（`alignFields` 单射 + `normalizePredForCompare` 白名单重写）+ **`scorers.mjs` 与 `fragment-scorers.mjs` 两条腿**全部维度改走对齐结果 + 新增观测量 `propNameMatch`。测试矩阵见 ruler 文档 §8.4（12 条）。**不喂 gold、不动 AN-01、不改语料。**
- **三条边界（复核补，见 D14/§8）**：① **`en` 腿保持 prop 身份**（gold label 是中文，label 身份在 en 上结构性 0 命中）；② 归一化实测**同 case 内 0 冲突**（1041 字段），不需要模糊匹配；③ `pinnedDims` 的字段级 token 经对齐表**解析而不改写**。

### D2 · 【掩码·HIGH】25 个 membership pin 在 NL 里没有任何依据 —— 且 CRUD 腿缺「pin ⊆ NL 说过」这条不变量

- **证据（今日复算）**：`216` 个 CRUD 用例中，**103** 个在 NL 里**穷举**了查询条件（`extractSurfaceList(nl,'inQuery')` 命中，形如「查询有 A、B」），**113** 个没有穷举列举。把 `membership` 钉进 `pinnedDims` 的共 **25** 例（`162`–`186`），**其中带查询措辞的：0 例**。这 25 例里 **10** 例写了 `inQuery:false`（16 个字段：如 `167` 的 `邮箱/状态`、`170` 的 `部门/职位`），**15** 例一个 false 都不写（gold 按 schema 默认全 true，模型若「合理地」收窄查询栏反被判错）。
- **证据（结构）**：片段腿与弹窗腿都强制 **`pinnedDims ⊆ nlStatedDims`**（`fragment-scorers.test.mjs:390`、`dialog-scorers.test.mjs:96`）；**CRUD 腿没有这条不变量** —— `scripts/eval/scorers.test.mjs:535-542` 只校验「token 可记分」「`维度:字段` 引用的字段真实存在」，**不校验 NL 说没说**。全语料 279 例中仅 **63** 例带 `nlStatedDims`（全部是片段）⟹ 「scoped 不得惩罚 NL 未声明的意图」这条锁，恰好只在**门槛最高的那条腿**上缺。
- **证据（既有日志）**：`membership` 24 行失败、field 级 **140 次 miss，其中 111 次 want-false-got-true**（ruler 文档 §3）——与全语料 **215** 个「无穷举查询列举却写了 `inQuery:false`」的字段同源。（原稿的 `53 例 / 120 字段` 是其更窄的切片：**完全**无查询措辞的 72 例里，53 例写了共 120 个 false；数字本身没错，但「无查询措辞」不是判别式 —— 见 §8 C1。）
- **性质**：**掩码不可推断**，违反本仓自己的标注原则「只钉 NL 表层无歧义锁定的那一点」（ruler 文档 §2.2）。与 D1 不同：D1 是尺子把对的判错，这里是**语料要求了一个 NL 没说的东西**。
- **影响**：`membership` 63.4%。门禁侧它只在**被 pin 的行**上扣分，但这 25 例**同时钉了 `propSet`**（25/25）、`actions`（22）、`mergeConfig`（15）⟹ 上限不是「直接拿下 25 行」，而是「这 25 行不再被 membership 一票否决」；其中 **7 例是 `FEWSHOT_DERIVED`**（172/173/176/177/179/181/185）**不进 heldout** ⟹ 影响门禁的是 **18 行 = 9.3pp（上界）**。且这 25 例**全部没有 `refinements`** ⟹ **无法经收敛腿兜回**，漏一个就整行丢。
- **修法（推荐，零模型成本）**：**把 `membership` 从这 25 例的 `pinnedDims` 里摘掉** —— `byCapability.membership` 照旧观测（`applicable: () => true`，`scorers.mjs:408`），能力不丢、难度不降，只是不再一票否决。**不要**为了追 gold 去改这 25 例的 NL：会动 `corpusHash`、可能触发 `check:fewshot-registration`（NL ≥0.35 下界）与 `check:case-titles`，且 113 例里有收敛语料（见 §8 C8）。
  - **必须同批补锁**：CRUD 掩码加 `nlStatedDims` + meta-eval 的 `pinnedDims ⊆ nlStatedDims`（照片段腿的写法），否则摘完下次又会长回来。
  - **不推荐**：删 gold 的 `inQuery:false`（这些用例就不再考查询面推断，能力静默丢失）。
  - **不做**：让 scorer 忽略**所有**未 pin 的 membership（会削弱「每个 CRUD 页都有查询栏」这一基础能力）。

### D3 · 【教学·MED】`tableBtns` 自定义文案/位置、`dialogs` 底座键：NL 说了、模型不写

- **证据**：`tableBtns` 3/13、`dialogs` 3/15；日志里 8+ 例 `tableBtns: want 导出/新增… | got （无）`。源码上省略 `tableBtns` 会按 `actions` 派生（三端 `es-crud-page.vue` 的 `normalizedToolbarBtns`，如 `packages/vue3/src/components/es-crud-page/src/es-crud-page.vue:150-157`），但派生文案是「导出/新增」，**位置与自定义文案丢失** —— 是真内容缺口，不是判据问题（ruler 文档 §4-P3）。
- **修法**：few-shot 增一条「NL 写了按钮文案/左右位置 ⟹ 必须显式声明 `tableBtns`（含 `name/code/actionType`）」；`dialogs` 补一条底座键示例；**同时**在生成器里对「NL 明显想要但配置里没有」的情况发非静默告警（mark-never-drop）。

### D4 · 【能力·MED，待复算】高级特性维度（columns 多级表头 / reactions / expandConfig / editConfig / isHidden）

- **证据**：12.5% / 7.7% / 13.3% / 42.9% / 18.5%（heldout）。其中 `columns` 34 个声明里 **10 例是多级表头（`groups`）**、8 例有自定义（今日复算）。
- **性质**：**不能现在归因**——这些维度受 D1 遮蔽。ruler 文档 §4 已否证「省略 columns/dialogs 被误判」两个假设（只有 1–2 例等价）。
- **修法**：D1 落地后**用同一份 dump 复算**，把「改名造成的假 miss」与「内容真错」分开，再对真错的那部分补 few-shot/教学。**不要先改 prompt**（会把噪声当信号调）。

### D5 · 【收敛·MED】收敛腿 53.3%（16/30），且它是**唯一能兜底的分**

- **证据**：`rateAtK 0.5333`；`turn0 10 / scripted 6`；算术见 §1。
- **性质**：能力 + 口径（scripted refinements 只认确定性纠正）。
- **修法**：在 D1/D2/D3 之后做——给收敛语料补「第一轮最常见的错」的纠正话术；目标 ≥80%（值 ~+4pp）。**不能把它提前当主力**（最多 10pp）。

### D6 · 【全场景·HIGH】片段腿 55.6% 与探针 93.7% 的 38pp **不是"模型不会片段"**：它 100% 卡在 `propSet`

- **证据（产物算术，今日复算）**：`last-accuracy.json.fragments` 里 `core == scoped == stated == 0.5556`，且 `byDim.propSet = 35/63 = 0.5556` —— **四个数完全相等**，因为 63 个片段**行行都钉了 `propSet`**。而 `byDim.formtype 42/42 = 100%`、`dataOptions 32/33`、`target/apiUrl/mode/defaultTitle/options.*/context/buttons/extPoints` 全 100% ⟹ **28 行失败全部由"字段名/字段集"决定**，没有一丝"片段契约理解不了"的成分。
- **同源到 D1**：`fragment-scorers.mjs:93` 的 `fieldMap` 同样以 `prop` 建索引 ⟹ 片段腿与 CRUD 腿是**同一把尺子**的同一个缺陷。**阶段 A 必须同时改两个 scorer**（原稿只写了 `scorers.mjs`）。
- **剩下真的不是 propSet 的部分**（都是小簇，dump 一次就能定位到具体 NL）：`fieldLayout 9/18`、`labelKey 3/9`、`fieldSpan 3/6`、`fieldAttrs 15/18`、`fieldRequired 17/21`、以及 `tableOptions.rowHeight/estimatedRowHeight/overscanCount/rowClassName/localPagination` 各 `3/6`–`0/3`。后者与「vue2 `virtual`/`rowHeight` 仅部分支持」（D9）方向一致，但**现在还不能断定是端能力缺口**——这些行同样先被 `propSet` 判死了。
- **探针 93.7% 的读法（更正）**：`ROADMAP.md:528`（2026-10-20，`deepseek-v4-pro`，core 95.2/scoped 93.7）与 `ROADMAP.md:436`（2026-10-19，scoped 77.8%）是**两次不同时间的探针**，且与 10-22 的门禁跑批（`claude-opus-4-6`）**模型不同**。所以 38pp 里至少有三块：模型差异、尺子（同源 D1）、时间差上的 prompt/契约变更。**在阶段 A 落地前，这 38pp 不具有"模型能力"含义。**
- **影响**：`fragmentStats.ok` 是 `passed` 的**组成项**（`eval-llm.mjs:1735-1741`），片段地板 77.8% 现在按 `propSet` 口径是**不可能**的 —— 所以"编译 100% + 全场景"这条口径下，**片段腿在阶段 A 之前不可能绿**。这与我原稿把它排到阶段 F 的顺序矛盾（见 §8 C12）。
- **修法**：① 阶段 A 同批改 `fragment-scorers.mjs`（label 身份 + `propNameMatch` 观测）；② 阶段 C 的 dump **已包含片段行**（`--dump-pred` 落 `kind:'fragment'`），零额外成本即可把上面每个小簇定位到具体 NL；③ 地板**重新取证**（不下调），取证后写进 `accuracy-baseline.json`；④ 同模型同 commit 跑一次 `--fragments` 只用于**解释探针差**，不再作为门禁依据。
### D7 · 【编译覆盖面·LOW/MED】100% 是真的，但分母有边界

- **证据**：`computeCrudMetrics` 只对 `lang === 'zh'` 聚合编译（`scripts/eval/run-metrics.mjs:46,85`）；en 腿 191 行有打分但**不进编译门**；Tier B 类型腿每端抽 10 例（`typecheck.samplePerTarget: 10`）。
- **性质**：覆盖面边界（不是缺陷数字）。
- **修法**：① en 行也进编译分母（它的 `compiles` 已经算了，只是没聚合）；② 类型腿从抽样改为**全量**（确定性、无 API 成本，代价是时长）；③ 补一组**转义/属性名 fuzz 语料**（`check:generator-escaping` 已登记残留的 `prop` 含引号类），把「compile 100%」从「这 216 个碰巧过」变成「这类输入结构性过」。

### D8 · 【度量可靠性·HIGH（过程）】P0 已落地但从未真实跑过；夜间疑似断供

- **证据**：`RULER_VERSION = 'prop-identity-v1'`（`scripts/eval/dump.mjs:42`）说明尺子还没换；ruler 文档 §13.4 的下一步（`--dump-pred` + `rescore --expect`）**尚未执行**——即 dump 路径只有单测，没有一次真实全量产物验证过。`last-accuracy.json` 最后一次完整测量是 **2026-10-22**，10-23 由本地跑批替换过「measurement failed」的夜间产物；**此后工作区里再无徽章回写**。
- **证据的边界（更正）**：`last-accuracy.json` 的最后提交日期 **不能**区分「跑挂了 / 没跑 / 跑了但产物逐字节相同所以没提交」（nightly 只在产物变化时提交）。所以只能写「**无回写**」，不能写「断供」。要判定必须看 Actions 日志（本机无外网）或 workflow 的 `if: always()` 落 artifact。
- **性质**：测量管道可靠性。若不先修，D1/D2 的效果**无法在付钱之前预测**，只能一次次付费跑。
- **修法**：① 先跑一次 `--dump-pred` 全量（这本来就是 P1 的前置），并用 `rescore --expect` 复现 22.7%——**复现不了就先修管道**；② 夜间加健康门：产物 `measurement !== 'complete'` 时徽章回灰 + 显式报「未测到」，而不是停在旧数字（F6 同类）；③ workflow 每轮**无条件**上传 pred dump 为 artifact（哪怕失败/未变更），让「断供」与「无变化」在事后可区分。

### D9 · 【组件/契约面·MED】「全场景」的宣称边界

- **证据**（`docs/ai/ai-capability-matrix.json`，现场生成）：41 个能力令牌中 **24 声明式 / 22 前门一步可达 / 2 仅 from_config**；15 个三端能力里 **8 个三端 full**；`tableOptions.virtual` **vue2 = none**；`rowHeight/estimatedRowHeight/overscanCount` 仅 vue3 部分支持；`engine:'virtual'` 三端虽可用但语义不同（AI-38 已登记/教学）。
- **性质**：设计边界（D 档 = 宿主编排，已写进公开文档），**不是缺陷**；但「全场景」四个字必须带上这张表，否则就是把 D 档说成 A 档。
- **修法**：站点/README 的「全场景」文案与 `ai-capability-matrix.json` **同源**（已有 `check:site-claims`，需扩到「能力矩阵数字」而不只是断言存在）。

### D10 · 【治理·MED】门禁长期红 ⟹ 红盲

- **证据**：`passed: false`（def95 22.7% < 95%；片段 scoped 55.6% < 地板 77.8%），已持续多日。一个每天红、且离目标 72pp 的门禁，**不会保护任何回归**。
- **性质**：治理缺陷（不是数字缺陷）。
- **修法**：在 95% 达成前，门禁改为「**不劣化 + 阶段棘轮**」：`definition95 ≥ 基线` ∧ `core ≥ CORE_FLOOR` ∧ 逐维 rate ≥ 基线 ∧ 零未测到；绝对 95% 继续**公布**但不作 exit code 的唯一条款。阶段棘轮按 §4 的预期逐段上调（人工 PR 写入，不由脚本回写 —— 沿用 `accuracy-baseline.json` 的既有规则）。

### D11 · 【语料·MED】6 例 NL 的穷举查询列举与 gold **正面矛盾**；而现有守卫只查一个方向

- **证据（今日复算，用仓库自己的抽取器）**：`check:membership-trap` 只查「NL 穷举了 A、B，gold 漏写 `false`」这一个方向。反过来的「NL 穷举了 A、B，gold 却把 A 标成 `inQuery:false`」**没有任何检查**。实际命中 **6 例**：

  | 用例 | NL 的穷举查询列举 | gold 把哪个标成 false |
  |---|---|---|
  | `59-drug-index-group` | 药品名称、**规格** | `spec` |
  | `153-invoice-link-render` | 开票方、**金额区间** | `amount` |
  | `154-revenue-spark-render` | 月份、**渠道** | `channel` |
  | `155-score-gauge-render` | 对象名称、**等级** | `level` |
  | `157-shipment-track-render` | 运单号、**承运商** | `carrier` |
  | `159-task-progress-render` | 任务名称、**负责人** | `owner` |

  ⟹ 模型照 NL 把该字段放进查询栏，反被判错。这是**语料自相矛盾**，不是模型错。
- **另有一类同族但方向相反的缺陷**：NL 穷举了 gold **根本没有**的字段 —— `54-meeting-selection-sfc`（NL「查询有会议主题、**会议室**」，gold 四个字段里没有会议室）。该例钉了 `propSet`，模型按 NL 补上会议室就丢 `propSet`。另一处 `21-audit-readonly-sfc` 的 `inTable` 是抽取器把「全部只读展示」当成字段名，属误报。
- **修法**：① 守卫扩成**双向**（穷举列举里的 token 若被 gold 标 `false` → 红；穷举列举里的 token 若在 gold 里**无对应字段** → 红）；② 这 6 例按 NL 修 gold（把该字段的 `inQuery` 删掉/改 true），`54` 补字段或改 NL —— **逐例人工裁决，写进 PR 说明**，不做批量脚本。

### D12 · 【能力·MED】NL 要「区间查询」，schema 里没有区间概念

- **证据**：`153-invoice-link-render` 的 NL 写「查询有开票方、金额区间」。schema 里没有「range」字段级声明；生成器只在日期选择器上**顺便**读过 `attrs.type` 含 `range`（`packages/shared/src/structured-generator.ts:2154,2172`），**没有任何 golden 用例用声明式表达过区间查询**。
- **性质**：① 「全场景」的表达力缺口（真实业务最常见的查询形态之一）；② 与 P2 `mark-never-drop` 冲突——NL 明显想要、配置面无处安放时，现在**静默丢弃**（没有告警）。
- **修法（先轻后重）**：① 生成器对「NL 里的区间/范围措辞」发**非静默告警**（mark-never-drop 的最低要求），并入 `check:generator-escaping` 同族的守卫；② 真要补表达，走 schema 评审（`inQuery` 侧的 range 语义 vs 两个字段的下界/上界），**不要**为了一例语料临时加键；③ 语料侧把 `153` 的「金额区间」改成 `金额`，先把矛盾消掉，表达力缺口单独登记。

### D13 · 【度量·MED】棘轮基线没有 `rulerVersion` 指纹 ⟹ 换尺子后旧基线会长期掩盖回归

- **证据**：`accuracy-baseline.json` 只存百分比与 `applicableCounts`，**不记录尺子版本**；而 `RULER_VERSION` 在阶段 A 会从 `prop-identity-v1` 变成 `label-identity-v2`。基线是「不劣化」判据 ⟹ 新旧两把尺子的数字被直接相减，`compareToBaseline` 会把**尺子造成的跳变**读成能力跳变（两个方向都会错）。
- **修法**：`accuracy-baseline.json` 增 `rulerVersion` 字段；`compareToBaseline` 在版本不同时**拒绝比较并报错**（要求同批 PR 重新取证基线 + 写 `_comment`）。阶段 A 的 PR 必须同时重新取证，不允许"先改尺子分数大涨、基线慢慢再说"。

### D14 · 【全场景约束·HIGH】en 腿**不能**用 label 身份 —— 阶段 A 必须是 zh-only

- **证据**：`nlEn` 腿的输入是英文（如 `shows username, email and status`），而 gold 的 `label` 是中文（`用户名/邮箱/状态`）⟹ label 归一化匹配在 en 腿上**结构性 0 命中**。现行 `prop` 身份在 en 腿上恰好是可用的（`prop` 是模型唯一能从 NL 侧猜对的锚点，`userName/email/status`）。
- **性质**：这不是"要不要一起改"，而是**改了就是错的**。原稿 §4 阶段 A 没写这条，实施时极易顺手统一。
- **修法**：`alignFields` 收 `lang` 参数；`zh` 走 label 身份（`prop` 作观测量），`en` **保持 prop 身份**并在产物里显式标注 `identity: 'prop'`。en 腿的公平性另议（它是观测腿，`compileRate` 分母也已排除它，见 D7），**不作为 95% 的门禁依据**。

---

## 4. 可行方案（阶段、验收、成本）

> 原则：**先修掩码 → 再修尺子 → 再探管道 → 一次付费取 dump → 才谈教学**。每一步都必须能被「同一份 dump 复算」验证，否则又回到「改一次 prompt 付一次钱、还分不清是尺子还是能力」。
> 顺序与原稿的差别（见 §8）：**阶段 0（掩码）提到最前**——它零成本、可算上界、且不依赖 dump；**片段 scorer 与 CRUD scorer 在阶段 A 同批改**（同一个缺陷两条腿）；**片段地板在阶段 A 之后就不可能是绿的**（D6），所以它在关键路径上，不属"最后收口"。

### 阶段 0 · 掩码与语料矛盾（0 模型成本，半天）—— 对应 D2 / D11 / D12③

| 动作 | 验收（变异 → 红） |
|---|---|
| 25 例**按桶处理**（§10.3 A1 细化）：`162`–`171` 共 10 例 **补 NL 的查询面一句**（不在收敛语料里，pin 与能力都保住）；`172`–`186` 共 15 例 **摘掉 `membership`**（gold 等同 schema 默认、与 `propSet` 冗余，摘了无损）；两种情况 `byCapability.membership` 都照旧观测 | 复算：`membership` 仍出现在 `byCapability`（分母不变）；被摘的 15 行 `exactIntentScoped` 的 AND 集合少一项（用 gold-vs-gold + 一个「只错 membership」的 pred 双向断言）；补 NL 的 10 行会动 `corpusHash` ⟹ 同批重取证基线 |
| CRUD 掩码补 `nlStatedDims`（照片段腿的字段名与语义）+ `scorers.test.mjs` 加 `pinnedDims ⊆ nlStatedDims` | 造一条「pinnedDims 含 NL 未说的 token」的临时语料 ⟹ meta-eval 红；恢复 ⟹ 绿 |
| D11 的 6 例正面矛盾逐例人工裁决（改 gold 的 `inQuery`，不改 NL）；`54` 补字段或改 NL | `check:membership-trap` **扩成双向**：穷举列举里的 token 被标 `false` → 红；穷举列举的 token 在 gold 无字段 → 红。修前 6 例红，修后绿 |
| `153` 的「金额区间」改成「金额」（表达力缺口另见 D12） | 该例 NL 不再要求 schema 表达不了的形态 |
| **深等值维度的「作者自选值」**（§9 D15）：`columns` 的 `width/fixed/align/autofocus`（11 个 heldout 例）、`expandConfig.title`（11 个）——NL 一个字没说 | 逐例裁决（scorer 做**投影**：未在 NL 声明的键不参与深等值）或移出 pin；变异测试：只改 gold 的 `width`、NL 不动 ⟹ 仍 pass |
| **迁移面先说清**（§9 C17）：216/216 例都有 `pinnedDims`（857 token），**0** 例有 `nlStatedDims` ⟹ 不变量若**无条件**加会全红 | 临时语料「有 pin 无 stated」⟹ 红；补上 stated ⟹ 绿。且需「凡有 pin 必须带 stated」的完整性规则，否则自报字段形同虚设 |
| **更细的修法可选**（§9 C18）：语料已有 19 处**字段级** pin 惯用法（`inQuery:createdAt`/`inTable:remark`/`inForm:code`）；`membership` 全维度 pin 是异类 | 把 `162`–`171` 的 `membership` 换成「NL 真说了的那一面/那个字段」，AND 集合仍非空且只含 NL 依据项 |

**预期**：门禁上界 **+9.3pp**（18 个 heldout 行不再被 membership 一票否决；这 25 例同时钉了 `propSet`/`actions`/`mergeConfig`，**实际增幅取决于这些维度**，不是 9.3pp 全收）。`membership` 维度分本身**不变**（仍是 63.4% 量级）—— 阶段 0 只改「能不能一票否决」，不改「模型做得对不对」。这一点必须写进 PR，否则又是一次"分数涨了但不知道涨的是什么"。

### 阶段 A · 尺子（0 模型成本，1–2 天）—— 对应 D1 / D13 / D14

| 动作 | 验收（变异 → 红） |
|---|---|
| `scripts/eval/align.mjs`：`alignFields`（label 归一化精确匹配 + 单射 + 兜底 prop）+ `normalizePredForCompare`（白名单，8 类结构） | 12 条测试矩阵（ruler 文档 §8.4）先写先红：改名不改 label ⟹ 全维 pass；`treeConfig.childrenField` 不被误改；`extPoints.render` 内容变了仍 pass |
| **`scorers.mjs` 与 `fragment-scorers.mjs` 同批改**走对齐结果（两处 `fieldMap` 都以 prop 建索引：`scorers.mjs:47`、`fragment-scorers.mjs:93`） | 片段腿：gold-vs-gold 仍 63/63；只改名不改 label 的 pred 由红转绿（当前必红） |
| **`describeDimMiss` 同批改**（`scorers.mjs` / `fragment-scorers.mjs` 的诊断打印器） | 不变量「`want===got` ⟺ 该维 pass」用测试钉住（先例：commit ec0cf50 的同类修复）；否则日志会与新分数自相矛盾 |
| `pinnedDims` 的**字段级 token**（`formtype:actionType`、`isHidden:supplier`…）经对齐表**解析**，**不改写**语料 | gold 侧 token 被扰动到同 label 异 prop 的字段 ⟹ 仍 pass（证明是"解析"不是"照抄"）；token 引用的 prop 在 gold 里**不存在**时仍红（不许借对齐放行笔误） |
| `RULER_VERSION → 'label-identity-v1'`（`dump.mjs:41` 头注已登记这个串；原稿写 `-v2`，见 §9 C15）；`accuracy-baseline.json` 增 `rulerVersion`，`compareToBaseline` 版本不同则**拒绝比较** | 旧版本基线 + 新尺子 ⟹ 显式报错而非静默相减（D13）；`check:artifact-freshness` 不因版本变化误红 |
| **`alignFields(lang)`：`en` 腿保持 `prop` 身份**，产物标注 `identity:'prop'`（D14） | en 行：改名不改 label 的 pred **仍红**（如果 label 身份误用到 en，这条会假绿） |
| `--fixed-fields` 仍为诊断开关 | 同原稿 |

**预期**：可证下界 **+25 行**（ruler 文档 §9.1，按当时 210 行口径推导）；换算到今天的 194 行 heldout 约 **→35%**，**不是精确值**，阶段 C 的 dump 到位后按真集合重算。上限不可预设（§9.2）。**这一步不需要跑模型。**

### 阶段 C₀ · 管道体检（极小付费，~10 min）—— 对应 D8

`node scripts/eval-llm.mjs --limit 8 --dump-pred .tmp-audit/probe.jsonl` 然后 `rescore --expect` 复现这 8 行的数字。
**验收**：dump 与 rescore 逐字段自洽（含 `hasRefinements` 的收敛行）。**管道不通就不要跑全量**——全量 3.5 h 的失败比 10 min 的失败贵 20 倍。

### 阶段 C · 一次全量 + 双尺子复算（1 次付费，~3.5 h）

```bash
npm run build:libs
ESPLUS_EVAL_KEY… node scripts/eval-llm.mjs --dump-pred .tmp-audit/pred-<date>.jsonl
node scripts/eval/rescore.mjs .tmp-audit/pred-<date>.jsonl --expect __tests__/golden/last-accuracy.json  # 旧尺子必须复现
# 同一份 dump 用 v2 尺子复算 → 精确 delta（不额外付费）
```

**验收**：① 旧尺子复现当次产物（不一致 ⟹ 先修 dump）；② 新尺子给出 `definition95`、`propNameMatch`、近失分布；③ 把「D4 的真内容缺口」按维度列出来；④ **片段行同样来自这份 dump**，把 D6 里 `fieldLayout/labelKey/rowHeight` 那些小簇定位到具体 NL。

**这是整条路线唯一的必经付费点**——在此之前不要改 prompt。

### 阶段 D · 教学补齐（1 次付费验证）—— 对应 D3/D4

按阶段 C 的真失败集逐类消：`tableBtns` 文案/位置 → `dialogs` 底座键 → `columns.groups` → `reactions` → `expandConfig` → 片段腿的 `fieldLayout/labelKey` 簇。
每条 few-shot **必须同时**登记 `FEWSHOT_DERIVED`（否则 heldout 被污染，`check:fewshot-registration` 会红）。

### 阶段 E · 收敛腿（1 次付费验证）—— 对应 D5

目标 ≥80%（+4pp 左右，上限 +10pp）。**排在 D 之后**，因为收敛用的纠正话术依赖真失败集。

### 阶段 F · 全场景收口（0 模型成本）—— 对应 D6/D7

| 动作 | 验收 |
|---|---|
| 片段地板重新取证（**不下调**）：阶段 C 后按新尺子跑一次全量，把值写进 `accuracy-baseline.json` | 人工 PR 写入 + `_comment` 记录来源；取证前片段腿处于"已知红"状态并在徽章上写清 |
| 片段进「不劣化」棘轮 | 片段 scoped ≥ 新基线 |
| 「38pp 探针差」书面归因（模型 / 尺子 / 时间差），**不追平探针** | 只要求写进文档；探针是 `deepseek-v4-pro`、门禁是 `claude-opus-4-6`，两者不可同口径比较 |
| en 腿进编译分母 + typecheck 全量 + 转义 fuzz 语料 | 编译率仍 100%，且分母从 216 → 407+ |

### 阶段 G · 度量可靠性（持续）—— 对应 D8/D10/D13

- 夜间健康门：`measurement !== 'complete'` ⟹ 徽章回灰 + 明确「未测到」，**不许停在旧数字**；
- 每轮无条件上传 pred dump artifact（失败也传），让「断供」与「无变化」事后可区分；
- 门禁改「不劣化 + 阶段棘轮」，95% 继续公布；棘轮值随阶段人工上调：`0.35 → 0.55 → 0.75 → 0.90 → 0.95`；
- 每次换尺子/换语料 ⟹ 同批重新取证基线并更新 `rulerVersion` / `corpusHash`。

## 5. 95% 的可达性判断（诚实版）

| 阶段完成后 | 预期 `definition95` | 依据 |
|---|---|---|
| 今天 | **22.7%** | 产物 |
| **今天（语料 + 尺子都不动）** | **硬上限 83.5%** | 32 个 heldout 行钉了 NL 没说、也推不出的值（§9 D15）；0 行有 `refinements`，收敛腿兜不住。**这个上限与模型无关** |
| **0（掩码）** | 22.7% → **≤32.0%** | 上界 +9.3pp（18 个 heldout 行不再被 membership 一票否决）；**真正能收多少取决于这 18 行的 `propSet`/`actions`/`mergeConfig`**，多半收不满 |
| A（尺子） | 32–45% | 可证下界 +25 行（ruler 文档 §9.1 的 210 行口径）；按 194 行换算约 →35%，不精确 |
| +D（教学） | 45–70% | tableBtns/dialogs/columns 从 3/13、3/15、4/32 抬到 60%+ |
| +E（收敛） | 55–80% | 收敛腿最多 +10pp，且只在普通用例 ≥85% 时才有意义 |
| **95%** | **需要 D4 的每个维度都接近满分** | 算术：普通用例 ≥155/164 |

> **与原稿的顺序更正**：原稿是「A 尺子 → B 语料 → D 教学」。复核后 **掩码（阶段 0）必须最先**：它零成本、上界可算、且不依赖 dump；而「补 NL」那条路被证明**不必走**（摘 pin 即可，见 D2）。**片段腿在阶段 A 之前不可能绿**（D6/§8 C12），所以它不属"最后收口"。

**结论**：95% 在「四场景 + 216 例语料」的口径下是**可达但极难**——它要求零编辑腿在**每一个 pinned 维度**上都接近满分，而当前最难的四个维度（columns/reactions/expandConfig/isHidden）都还是 12–19%。**不要承诺 95%**；用上面的阶段棘轮把「进展」变成可验收的东西，同时保留「若 D 阶段后普通用例 <70%，则重新评审语料代表性（是否把过多高级特性塞进 heldout）」的决策点。

**三条出路（按推荐序）**

1. **把掩码说清（0）+ 把尺子修对（A）+ 把教学补齐（D）** → 真实能力达标；
2. **收敛定义下达标**：`≤K` 收敛是产品实际使用路径（TypeChat 同构），门禁是 ∨，不是 one-shot；
3. **达不到就改口径**——**必须走评审**，且不得因此删难例（`check:ratchet` 已有防洗分，需扩到「删语料」）。

---

## 6. 不做清单（避免走错方向）

- ❌ **不恢复 `--fixed-fields` 进正式批**（AN-01 的核心决定；那会让 `propSet` 变成抄写保真度）。这 25 例虽带 `fixedFields`，也不能因此当"给定字段"处理。
- ❌ **不做 label 模糊匹配**（拼音/编辑距离）——只做归一化精确匹配 + 近失集公布。归一化后同 case 内 **0 冲突**（今日复算，1041 字段），所以不需要模糊匹配。
- ❌ **不把 label 身份用到 en 腿**（gold label 是中文、`nlEn` 是英文，必然 0 命中；见 D14）。
- ❌ **不为变绿下调片段地板**（77.8% 口径过期，要**重新取证**，不是下调）。
- ❌ **不把片段混进 CRUD 的 95% 分母**（两套能力的回归信号会互相钝化）；但**两把尺子必须同批修**。
- ❌ **不先改 prompt 再改尺子**（会把命名噪声当能力信号调）。
- ❌ **不改 gold 去迎合模型**——**唯一例外是 D11 那 6 例**：那是 gold 与自己的 NL 正面矛盾，改的是 gold 且逐例人工裁决。
- ❌ **不为了「让 membership 好看」改收敛语料的 NL**（它们是收敛腿的铰链，见 §8 C8）。
- ❌ **不混用历史数字**（55.5% / 22.7% / 93.7% 三个数各自的口径在 §1 已写明）。
- ❌ **不把深等值维度的作者自选值当能力缺口去调 prompt**：`columns.width/fixed/align`、`expandConfig.title` 先做「未声明键不参与比较」的投影（§9 D15），再谈教学。

---

## 7. 风险登记

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| 修尺子被看成「放水」 | 数字一次性大涨 | 同时公布 `propNameMatch`、近失集；12 条反向测试钉住「改名以外仍判负」 |
| 阶段 0 被看成「摘 pin 洗分」 | 摘 membership 后分数上升 | 摘的是**不可推断的掩码**，不是难度：`membership` 维度分不变、`propSet`/`actions`/`mergeConfig` 照旧钉；同批补上 `pinnedDims ⊆ nlStatedDims` 这条**更严**的不变量 |
| 阶段 0 摘错（本该钉的也摘了） | 某例 NL 其实说了查询 | 25 例逐个过一遍 NL（今日已全量导出，0 例有查询措辞）；守卫改造后由机器保证 |
| 片段 38pp 是模型问题 | 同模型复跑仍 55% | 已更正：55.6% 完全由 `propSet` 决定（D6），**不是模型问题**；模型差异只在探针 vs 门禁的口径讨论里出现 |
| 夜间一直是断的 | 无徽章回写 | 阶段 G 的健康门 + 无条件上传 pred artifact；判定依据是 Actions 日志不是提交时间 |
| 换尺子后基线失真 | `rulerVersion` 不一致仍相减 | D13：`compareToBaseline` 拒绝跨版本比较 |
| 95% 长期不可达 | 阶段 D 后 <70% | 决策点：评审语料代表性，或承认 95% 是 ∨ + 收敛口径下的目标 |
| 深等值维度被当成能力缺口 | `columns` / `expandConfig` 长期低位 | 先投影再谈教学：11 + 11 行的 gold 值 NL 没说、模型推不出（D15）；`columns` 真实上限 = 21/32 |

---

## 附：本报告用到的复算命令（可重跑，全部读 `__tests__/golden/cases/*.json`）

```bash
# 1) 字段身份可推断性（今日复算：40/1041 prop、1024/1041 label、归一化后同 case 内 0 冲突）
node --input-type=module -e "
import fs from 'node:fs'
const D='__tests__/golden/cases'
let n=0,p=0,l=0
for(const f of fs.readdirSync(D)){const c=JSON.parse(fs.readFileSync(D+'/'+f,'utf8'))
  for(const x of c.config?.fields??[]){n++;const nl=String(c.nl??'')
    if(x.prop&&nl.includes(x.prop))p++; if(x.label&&nl.includes(x.label))l++}}
console.log(n,p,l)"

# 2) 掩码面（今日复算：216 例 = 144 有查询措辞 + 72 无；103 穷举列举 / 113 无；25 个 membership pin 全部无查询措辞）
node --input-type=module -e "
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
const u=(p)=>pathToFileURL(process.cwd()+'/'+p).href
const {isCrudCase}=await import(u('scripts/eval/scenes.mjs'))
const {extractSurfaceList}=await import(u('scripts/lib/membership-trap.mjs'))
const D='__tests__/golden/cases';const Q=/查询|筛选|搜索|检索|过滤/
for(const f of fs.readdirSync(D)){const c=JSON.parse(fs.readFileSync(D+'/'+f,'utf8'))
  if(!isCrudCase(c))continue
  if((c.pinnedDims??[]).some(t=>String(t).startsWith('membership')))
    console.log(f,'hasQ=',Q.test(c.nl),'enum=',!!extractSurfaceList(c.nl,'inQuery'))}"

# 3) 片段腿为何 55.6%：scoped ≡ propSet（四个数相等即证明失败全由 propSet 决定）
node -e "const a=require('./__tests__/golden/last-accuracy.json');const f=a.fragments;
console.log({core:f.core,scoped:f.scoped,stated:f.stated,propSet:f.byDim.propSet})"

# 4) 当前分布
node -e "const a=require('./__tests__/golden/last-accuracy.json');console.log(a.byCapability)"
```

---

## 8. 二次复核记录（对本报告自身的更正与补漏）

> 本节是**同日对本报告 §0–§7 的复核结果**：逐条重跑证据、逐条问「这个结论反过来能不能成立」。
> 标 **❌ 更正** = 原文写错了（已在正文改掉，此处保留错在哪，便于追溯）；**➕ 补漏** = 原文没看到；
> **✅ 复核确认** = 原文对、且这次独立验过。所有数字都可按附录命令重跑。

### ❌ 更正（原文错的）

| # | 原文 | 更正 | 影响 |
|---|---|---|---|
| **C1** | D2 用「53 例无查询措辞 / 120 个 false」作判别式，推荐「给这 53 例补 NL」，并提出守卫扩「gold 的每个 false 都要在 NL 里找到依据」 | 53/120 只是「**完全**无查询措辞」的窄切片（216 例里 72 例无措辞、其中 53 例写了 120 个 false）；**真判别式是「被 pin 的维度在 NL 里没说过」**。全语料 468 个 `inQuery:false` 里 **459 个的 label 出现在 NL**（98%）⟹ 「label 不在 NL」区分不了任何东西，那条守卫扩法**会把本该判错的判绿**，与既有守卫刻意排除 `inForm` 的理由同构 | D2 整段重写：改「摘 25 个 pin」而非「补 53 例 NL」 |
| **C4** | D6 定性为「片段腿 55.6% vs 探针 93.7%，38pp 未解释（模型/中继/口径三选一）」 | `core == scoped == stated == byDim.propSet == 35/63` 四个数**完全相等** ⟹ 28 行失败**全部**由 `propSet` 决定，与"模型会不会写片段"无关；`formtype` 42/42=100%。这是 D1 的同一个缺陷在第二条腿上的表现 | D6 重写；阶段 A 从「改 `scorers.mjs`」扩成「两条腿同批改」 |
| **C9** | D8「此后 4 天无徽章回写 ⟹ 夜间疑似断供」 | nightly 只在产物变化时提交 ⟹ 提交时间**无法**区分「跑挂了 / 没跑 / 跑了但逐字节相同」。只能写「无回写」 | D8 改口径 + 加「无条件上传 artifact」 |
| **C12** | 阶段 F（最后）才处理片段腿 | `fragmentStats.ok` 是 `passed` 的**组成项**（`eval-llm.mjs:1735-1741`）⟹ 片段地板在阶段 A 之前不可能绿，它在**关键路径**上 | §4 重排顺序与 §5 表格 |
| **C13** | 「25 个 membership pin，值 ~+12.9pp」 | 其中 **7 例是 `FEWSHOT_DERIVED`**（172/173/176/177/179/181/185）不进 heldout ⟹ 影响门禁的是 **18 行 = 9.3pp（上界）**；且这 25 例**同时钉 `propSet`**，实际收不满 | §5 表格 + D2 |

### ➕ 补漏（原文没看到）

| # | 新发现 | 落在哪 |
|---|---|---|
| **C2** | **`check:membership-trap` 只查一个方向**。反方向「NL 穷举了 A、B，gold 却把 A 标 false」有 **6 例**（59/153/154/155/157/159）；另有 `54-meeting-selection-sfc` 的 NL 要求「会议室」而 gold **没有这个字段**，该例又钉了 `propSet` ⟹ 模型照 NL 写反而扣分 | 新增 **D11** |
| **C3** | NL 要「**金额区间**」这类**区间查询**，schema 里没有该概念（只有日期选择器上顺带读 `attrs.type` 含 `range`）⟹ 真实业务最常见的查询形态之一在配置面**无处安放**，且**静默丢弃**（违反 P2 mark-never-drop） | 新增 **D12** |
| **C5** | **en 腿不能用 label 身份**：gold `label` 是中文、`nlEn` 是英文 ⟹ 归一化匹配结构性 0 命中。阶段 A 若顺手统一，en 腿会全线假负 | 新增 **D14**，并写进阶段 A 验收与 §6 不做清单 |
| **C6** | 诊断打印器 `describeDimMiss` / `describeFragmentDimMiss` 必须**同批**跟着改，否则「want===got 却判负」的日志与分数自相矛盾（先例：commit ec0cf50 的同类修复） | 阶段 A 增一行验收 |
| **C7** | `accuracy-baseline.json` **没有 `rulerVersion` 指纹** ⟹ 换尺子后 `compareToBaseline` 会把尺子跳变读成能力跳变，且旧基线会长期掩盖回归 | 新增 **D13** |
| **C8** | 「补 NL」这条路**不能走**：30 个收敛语料里 **28** 个没有穷举查询列举、且**全部**含 `inQuery:false`；改它们的 NL 就是在动「欠定 NL 是收敛铰链」这一设计（见记忆 `convergence-second-leg-structural-miss`）。且改 NL 会动 `corpusHash`、可能触发 `check:fewshot-registration`（NL ≥0.35）与 `check:case-titles` | D2 修法改为「摘 pin」，并在 §6 明列 |
| **C10** | **归一化不会撞车**：NFKC → 去空白 → 去标点 → 小写后，**同 case 内 0 冲突**（1041 字段），跨 case 只有 1 组拼写变体（`SKU 名称` vs `SKU名称`，不影响 case 内单射）⟹ 精确匹配 + 单射是可实现的，不需要模糊匹配 | D1 修法可行性背书 |
| **C11** | `pinnedDims` 的**字段级 token**（如 `formtype:actionType`、`isHidden:supplier`）里的字段名仍是 **gold prop 空间**，必须经对齐表**解析**而**不能改写**（改写等于改语料）；语义从「同 prop」放宽为「同 label 的字段」 | 阶段 A 增一行验收 |

### ✅ 复核确认（原文对，且这次独立验过）

- `passed` 的组成项：`gateRate >= TARGET_ACCURACY && guards.ok && frontDoorStats.ok && compileRate === 1 && fragmentStats.ok`（`eval-llm.mjs:1735-1741`）。
- `compileRate` 的分母**排除 en 行**（`run-metrics.mjs:85` 只取 `lang === 'zh'`）⟹ 100% 是真的，覆盖面是 D7 说的那个边界。
- `accuracy-baseline.json` 的百分比字段**刻意留 null**、只由人工 PR 写 ⟹ 棘轮改值不能由脚本回写。
- 25 个 membership pin 的用例**全部没有 `refinements`** ⟹ 它们拿不到收敛腿的兜底，membership 一错就是整行丢。
- 严格保留：**本报告不改任何语料、不动任何 scorer、不跑模型**——以上全部只靠读语料与读产物得出。

---

## 9. 三轮复核（源码 + 能力面 + 报告自校，2026-10-27 晚）

> 这一轮的三个动作：① 把 §0–§8 的每个数字从语料现场重算；② 读**打分器与保护守卫的实现**（不只是产物）；③ 把「AI 原生支持能力」当被测面，问一句「语料+尺子**能不能**让这一行变绿」。
> 结论先放前面：**第三问给出了一个与模型无关的硬上限 83.5%** —— 这是本轮最重要的发现（D15），它把「95% 很难」改写成「95% 现在不可能」。

### ❌ 更正（§0–§8 里写错的）

| # | 原文 | 更正 | 影响 |
|---|---|---|---|
| **C14** | D1：「`prop` 在 NL 里只出现 **40（3.8%）**」 | 附录命令 №1 复现的是 **22（2.1%）**。40 是**忽略大小写**的计数（`nl.toLowerCase().includes(prop.toLowerCase())`）。结论方向不变（label 98.4%），但数字必须写成两档 | D1 证据 + 根因 1 已改 |
| **C15** | 阶段 A：`RULER_VERSION → 'label-identity-v2'` | `dump.mjs:41` 的版本台账里登记的是 **`label-identity-v1`**。写 v2 会让实施者以为有两个版本 | 阶段 A 已改 |
| **C16** | D2：「25 个 membership pin ⟹ 18 heldout ⟹ 上限 +9.3pp」 | 25 例要拆成两类：**10 例（`162`–`171`）gold 显式收窄**（16 个 `inQuery:false`）——这是**真的不可推断**；**15 例（`172`–`186`）gold 等同于 schema 默认**（一个 false 都没有）⟹ `membership` 与 `propSet` **冗余**（pred 字段集对齐后不写 `inQuery` 就默认 true，必然命中），它们失败只可能是模型自己收窄了查询 | 摘 pin 的**理由**要分开写：10 例是公平性，15 例是冗余；收益上界仍是 9.3pp，但能被摘出来的确定收益 ≤**5.2pp**（10 行） |

### ➕ 补漏（本轮新发现）

#### D15 · 【掩码·HIGH（本轮最重要）】深等值维度把**作者自选的展示值**钉进门禁 ⟹ `definition95` 的硬上限 = **83.5%**

- **机制**：`columns` / `expandConfig` / `treeConfig` / `mergeConfig` / `editConfig` 的判定是**整体深等值**（`eq(g.x, p.x)`，`scorers.mjs:24-35` 的 `canon` 只按键排序列化，不清洗值）。而 `ColumnSchema` 与 `expandConfig` 把 `width/align/fixed/sortable/autofocus/title` 都声明成了**一等键**（`structured-config.schema.ts:300-307,355`）⟹ 这些值既不会被 zod 剥掉，也不会被生成器填成 gold 的值。
- **证据（今日复算，全部 heldout）**：

| 桶 | 行数 | gold 里的值 | NL 依据 |
|---|---|---|---|
| A `membership` + gold `inQuery:false` | **10**（`162`–`171`，16 个字段） | 哪个字段不在查询栏 | **0/10** 有查询措辞 |
| B `columns` 深等值 | **11**（`48/50/52/54/55/57/58/60/61/87/103`） | 数据列 `width`（100/80/120/180…）、`fixed`、`align`、`autofocus` | **0/11** 提到宽度/固定/对齐 |
| C `expandConfig.title` | **11**（`62/64/65/66/68/69/70/72/73/75/76`） | 标题串（联系方式/出版信息/车主与保险…） | **0/11** 的 NL 里出现该串 |

- **算术**：三桶并集 **32 行 / 194 = 16.5pp** ⟹ **`definition95 ≤ 83.5%`**，且这 32 行**全部没有 `refinements`** ⟹ 收敛腿兜不住。若把 few-shot 里**已经教过**的 `index:60 / selection:50` 也计入（宽口径），是 **36 行 ⟹ ≤81.4%**。
- **为什么这比 D2 更严重**：① 面更大（32 vs 25 行）；② 阶段 A（label 身份）**完全治不了**它——对齐只解决「这个字段是谁」，解决不了「作者为什么给课时列 `width:100`」；③ 它让 `columns` 的真实上限 = **21/32**（32 个 pin 里 11 个不可能过），所以 §5 的「+D 把 columns 从 12.5% 抬到 60%+」**结构上做不到**。
- **可辩解的边界**（别把它当成放水）：`48` 这类 **NL 穷举了两级表头**的例，`columns` 的内容是**可推断**的——不可推断的只有 `width:100` 这一项。所以修法**不是**「不考 columns」，而是「考 NL 说了的部分」。
- **修法**：`columns`/`expandConfig` 改**投影比较**——只比 NL 可推断的键（prop/label/groups 结构/`editRender.name`+`props.type`/`type`），`width/fixed/align/sortable/autofocus`/`title` 默认**不参与**；如某例确实要考（NL 明写「标签宽 90px」式的），走 `ADJUDICATED` 逐例登记。这条与守卫既有的「宁可漏，不可误红」同一条原则。

#### D16 · 【守卫·MED】双向 membership 守卫按现抽取器会**误红 3 例** ⟹ 阶段 0 的验收写错了

- **证据（今日复算，用仓库自己的 `extractSurfaceList`）**：反向扫描得到 **5 个 `false` 命中 + 6 个「gold 无此字段」**，但其中 3 例是**抽取器假阳**：

| 用例 | 抽取到的 token | 真因 |
|---|---|---|
| `09-audit-readonly` | 操作时间**范围** | 字段是 `操作时间`——「查询有…**范围**」的区间后缀 |
| `18-notice-custom-dialog` | **公告**标题、发布时间**范围** | 字段是 `标题`（实体前缀）、`发布时间`（区间后缀） |
| `39-swap-hidden-eq` | **条件**员工姓名 | NL 写「查询**有条件**员工姓名」，`LEADS` 把「查询有条件」当成了「查询有」 |

- ⟹ 阶段 0 的验收「修前 6 例红、修后绿」**按现状不可达**（会先看到 9–10 例红）。守卫必须先定**token→字段解析规则**：去 `范围/区间` 后缀、允许包含匹配（`公告标题` ⊃ `标题`）、`LEADS` 覆盖「查询有条件」。真缺陷仍是 6 例（`59/153/154/155/157/159`）+ `54` 的「会议室」缺字段。

#### 其余补漏

| # | 新发现 | 落在哪 |
|---|---|---|
| **C17** | **阶段 0 的迁移面被低估**：216/216 个 CRUD 例都有 `pinnedDims`（共 857 个 token），**0** 例有 `nlStatedDims`。不变量若照片段腿**无条件**加，第一天就 216 例全红。而且 `nlStatedDims` 是**自报字段**（照抄 pin 就能过）⟹ 它只是纪律检查，不是公平性证明；要真锁，得加机检下界（穷举列举 ∨ `ADJUDICATED`） | 阶段 0 增两行 |
| **C18** | **更细的修法已经存在于语料里**：19 处**字段级** pin（`inQuery:createdAt`×10、`inTable:remark`×5、`inForm:code`×4，全在收敛/精修例上）。`membership` 这种**全维度** pin 是异类 ⟹ 可以把 `162`–`171` 换成「只钉 NL 说了的那一面」 | 阶段 0 增一行 |
| **C19** | **产物里两个字段名互相误导**：`inSchemaIntentZeroEdit` = **∨ 门禁**（heldout），`inSchemaIntentZeroEditAll` = **core ∧**（all 216）。名字读起来像「同一判据的 heldout / 全集」，实际是**两个不同判据**（`eval-llm.mjs:1670-1676`）。基线/看板若把两者相减，会得到无意义的数 | 建议在 D13 同批加 `metricId` 或改名 |
| **C20** | `run-metrics.mjs` 的注释与代码不符：注释说 `capRows` 用 `rows`（含 en），实际是 `heldout`（zh 非 few-shot）。`byCapability` 产物（`applicable: 194`）证明代码是后者 | 低优先，但会让复算者怀疑口径 |

### ✅ 复核确认（本轮独立验过，§0–§8 写法正确）

- **D9 的能力矩阵数字**全部对：`41 令牌 / 24 声明式 / 22 前门可达 / 2 仅配置`；15 个三端能力里 **8 个三端 full**；`tableOptions.virtual` = `full/none/full`（vue2 none）；`rowHeight/estimatedRowHeight/overscanCount` = `partial/none/none`。`node scripts/gen-ai-capability-matrix.mjs --check` 通过。
- **D12 的源码引用对**：生成器里唯一读 `range` 的地方就是 `inferTsType`/`getDefaultValue` 的 `DatePicker/TimePicker` 分支（`structured-generator.ts:2154,2172`）——只有**日期区间**，没有数值区间查询。
- **CRUD 掩码确实只带 `pinnedDims`**（`eval-llm.mjs:509`），片段腿带 `pinnedDims + statedDims`（`:711-716`）⟹ 不变量缺失这一结构性判断成立。
- **`check:membership-trap` 确实只咬一个方向**，且它的「宁可漏，不可误红」与 `inForm` 豁免是**刻意**的（头注写明）⟹ §8 里撤掉「每个 false 都要有 NL 依据」那条扩法是对的。
- **`accuracy-baseline.json` 无 `rulerVersion`**；百分比字段 `null`、只由人工 PR 写 ⟹ D13/棘轮写法的前提成立。
- **`passed` 组成**（`eval-llm.mjs:1735-1741`）、`exactIntentScoped` 的空掩码退化（`scorers.mjs:640-641`）与 §8 写的一致。
- **§1 的算术自洽**：`194 = 164 + 30`；`44 = 38 scoped + 6 scripted`；`28/164 = 17.1%`；`185 = 155 + 30`。逐项可对上产物。
- **25 个 membership pin**：`162`–`186` 连续 25 例；7 例 fewshot-derived（`172/173/176/177/179/181/185`）；前 10 例共 16 个 false；25/25 钉 `propSet`；**0/25** 有 `refinements`。
- **语料面数字**：`468` 个 `inQuery:false`、其中 `459` 的 label 在 NL、`215` 落在无穷举列举的例；CRUD `103` 穷举 / `113` 不穷举；`144` 有查询措辞 / `72` 无。
- **归一化 0 冲突**：NFKC+去标点+小写后，1041 个字段在**同一 case 内** 0 碰撞、原始 label 也 0 重复 ⟹ 精确匹配 + 单射可实现，不需要模糊匹配。
- **片段腿四个数相等**：`core == scoped == stated == byDim.propSet == 0.5556`，`formtype 42/42`，`compileRate 1` ⟹ D6「100% 卡在 propSet」成立。
- **`frontDoor.noTableExercised = 406/407` 不是缺陷**：它是**正向覆盖计数**（eval 主动清空 table 面去覆盖该分支，只有 == 0 才判红，`eval-llm.mjs:1144`）。下一轮别再把它读成「前门空转」。
- **en 腿的 prop 可用性**（D14 的量化背书）：191 个带 `nlEn` 的用例里，728 个字段有 **349 个（47.9%）** 的 `prop` 字面出现在 `nlEn`；而 `label` 是中文、在 `nlEn` 里 0 命中 ⟹ 阶段 A 若把 label 身份用到 en 腿，是把一条**能用的**尺子换成一条 **0 命中**的尺子。

### 附：本轮新增的复算命令

```bash
# 5) 硬上限：钉了「NL 没说也推不出」的值的 heldout 行（今日复算：A=10 / B=11 / C=11，并集 32 ⟹ ≤83.5%）
node --input-type=module -e "
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
const u=(p)=>pathToFileURL(process.cwd()+'/'+p).href
const {FEWSHOT_DERIVED}=await import(u('scripts/eval/fewshot-derived.mjs'))
const D='__tests__/golden/cases'
const held=fs.readdirSync(D).filter(f=>f.endsWith('.json')&&!f.startsWith('frag-')&&!f.startsWith('dlg-')&&!FEWSHOT_DERIVED.has(f))
const bad=new Set()
for(const f of held){const c=JSON.parse(fs.readFileSync(D+'/'+f,'utf8'));const p=(c.pinnedDims??[]).map(String);const nl=String(c.nl??'')
  if(p.some(t=>t.startsWith('membership'))&&(c.config.fields??[]).some(x=>x.inQuery===false))bad.add(f)
  if(p.some(t=>t.startsWith('columns'))){const s=JSON.stringify(c.config.columns??[])
    const w=(s.match(/\"width\":\\d+/)||[]).length&&!/宽|像素|px/.test(nl)
    if(w||(/\"(fixed|align|autofocus)\"/.test(s)&&!/固定|对齐/.test(nl)))bad.add(f)}
  const t=c.config.expandConfig?.title
  if(p.includes('expandConfig')&&t&&!nl.includes(t))bad.add(f)}
console.log('hard-capped',bad.size,'/',held.length,'⟹ 上限',(100-bad.size/held.length*100).toFixed(1)+'%')"

# 6) 双向守卫的假阳面（今日复算：09/18/39 是抽取器假阳，54 是真缺陷）
#    见 §9 D16 —— 用 extractSurfaceList(nl,'inQuery') 的 token 去 gold 里找字段并看 inQuery

# 7) 深等值维度的 heldout 门控面（今日复算：77/194 行至少被一个深等值维度一票否决）
#    columns 32 / expandConfig 14 / treeConfig 14 / editConfig 14 / mergeConfig 8 / virtualScroll 9 / configTableOut 7

# 8) 能力矩阵（今日复算：41 令牌 / 15 三端能力 / 8 全 full / virtual vue2=none）
node scripts/gen-ai-capability-matrix.mjs --check
node -e "const m=require('./docs/ai/ai-capability-matrix.json');const e=Object.entries(m.capabilities);
console.log(m.stats, e.length, e.filter(([,v])=>Object.values(v.targets).every(t=>t.level==='full')).length)"
```

---

## 10. 修订建议（第四轮）：这套方案能到哪，以及要改哪六处

> 回答两个问题：**按 §4 的顺序走，核心目标能达成到什么程度？** 以及 **方案本身要怎么改、补什么、往哪提升？**
> 原则不变：本节**只改文档**，不动语料、不动 scorer、不跑模型；所有数字来自 §9 的复算与产物。

### 10.1 三层判断（把「难」和「不可能」分开）

| 层 | 结论 | 判定依据 |
|---|---|---|
| **① 数学可能性** | 阶段 0 + 投影之前，**95% 在数学上不可能**（上限 83.5%）；做完之后上限回到 100%，95% 才进入「难」的范畴 | §9 D15：32 行钉了推不出的值，0 行可走收敛腿 |
| **② 现实预期** | 这条路线现实落点 **60–75%**（见 10.2 的阶段表） | ruler 文档 §9.1 的可证下界 + 单维上限（10.3） |
| **③ 95% 的门槛** | 194 行里今天 150 行失败 ⟹ 95% 要求 **141/150 个失败行全部转正**，只允许 9 行错 | `185 − 44 = 141`；`194 − 185 = 9` |

**阶段表（替换 §5 的预期列）**

| 阶段 | 预计 `definition95` | 行数 | 依据性质 |
|---|---|---|---|
| 今天 | 22.7% | 44 | 产物 |
| **0（掩码 + 投影 + 守卫）** | 22.7%，**至多 +10 行**（≤27.8%） | 44–54 | **只解锁不给分**：这些行还被 `propSet` 卡着；能直接转正的前提是「只栽在 membership 上」 |
| **A（label 尺子）** | 32–36% | 62–70 | ruler 文档 §9.1 的**可证下界 +25 行**（194 行口径 ≈35.6%） |
| **A′（装饰键投影）** | 与 A 同批，不单独计分 | — | 它只解除 `columns`/`expandConfig` 的 22 行天花板，不给行 |
| **C（一次 dump，双尺子）** | — | — | 把剩余失败**按行**归因，D 阶段才有可加性 |
| **D（教学）** | 50–70% | 97–136 | 单维上限之和（10.3），重叠未去 |
| **E（收敛）** | +5–10pp | +10–20 | 收敛边际上限 20 行；只在普通用例 ≥85% 后才值钱 |
| 天花板 | 100% | 194 | 投影 + 摘/补那 32 行之后 |

**结论**：方案的方向对，但**当前排序会把两次付费跑批花在错误的地方**——0 阶段之后不先做 A，分数几乎不动（这些行还钉着 `propSet`）；D 阶段不按 dump 排序，就会去补 `dataOptions`（42.3% 很难看，但只 pin 了 5 行）。

### 10.2 为什么各阶段不能相加：单维上限表

`exactIntentScoped` 是**被钉维度的 AND**，一个维度修好能拿多少分，取决于「有多少行**只**栽在它上面」——而这件事今天无法从产物得知（没有逐行 dump）。可算的只有单维上限 `min(该维失败数, 钉了该维的 heldout 行数)`：

| 维度 | 现状 | 钉了该维的 heldout 行 | **单维上限** | 备注 |
|---|---|---|---|---|
| `propSet` | 70/194 | 189 | **≤124** | A 阶段主攻 |
| `isHidden` | 5/27 | 28 | ≤22 | 被 prop 键遮蔽，A 后复算 |
| `columns` | 4/32 | 32 | **≤17** | 11 行不可推断，投影后才轮到这 17 |
| `membership` | 123/194 | 18 | ≤18 | 其中 10 行是 D15-A 桶 |
| `formtype` | 172/194 | 16 | ≤16 | 缺口比 rate 小得多 |
| `expandConfig` | 2/15 | 14 | ≤13 | 11 行靠投影解锁 |
| `dialogs` | 3/15 | 12 | ≤12 | 真教学缺口（D3） |
| `reactions` | 1/13 | 14 | ≤12 | 被 prop 键遮蔽 |
| `tableBtns` | 3/13 | 13 | ≤10 | 真教学缺口（D3） |
| `editConfig` | 6/14 | 14 | ≤8 | |
| `extPoints` | 16/23 | 22 | ≤7 | 只比 presence |
| `actions` | 188/194 | 184 | ≤6 | 基本达标 |
| `dataOptions` | 47/111 | **5** | **≤5** | **最容易被误排优先级的一维** |
| `fieldSpan` | 3/7 | 6 | ≤4 | |
| `apiParams` | 6/8 | 8 | ≤2 | |
| `treeConfig` / `mergeConfig` / `formLayout` | 13/14 · 7/8 · 2/3 | 14 · 8 · 3 | ≤1 各 | |
| `permissions`/`i18n`/`target`/`mode`/`virtualScroll`/`configTableOut`/`operationColumn` | 全过 | 8–74 | 0 | 已达标 |

**合计 ≈ 279 行，而实际失败只有 150 行** ⟹ 约 1.9 倍重叠。⟹ **D 阶段必须按 `dump` 的逐行失败集排序，不能按 `byCapability` 的百分比排序。**

### 10.3 六处修订

**A1 · 阶段 0 拆两半，修法按「哪个更保能力」分桶**（细化 §4 阶段 0）

| 桶 | 例 | 修法 | 理由 |
|---|---|---|---|
| `membership` 10 行 | `162`–`171` | **改 NL 补一句查询面**（如「查询只按物料编码、物料名称」） | 这 10 例**都不在 30 条收敛语料里**（§8 C8 的约束只管收敛例）⟹ 补 NL 是「让 NL 说出 gold 已经写的东西」，属纠错而非迎合模型；**pin 与能力都保住** |
| `columns` 11 行 | `48/50/52/54/55/57/58/60/61/87/103` | **投影比较**（装饰键不参与） | 宽度/固定/对齐是作者口味，写进 NL 就变成「念数字」 |
| `expandConfig` 11 行 | `62/64/65/66/68/69/70/72/73/75/76` | **投影比较**（`title` 不参与） | 同上 |

> 改 NL 的代价要明说：会动 `corpusHash` 与片段/CRUD 基线 ⟹ **同批重新取证基线**（D13 的 `rulerVersion` 机制同一批上）。这是这条路线唯一的「改语料」动作，且只改这 10 例。

**A2 · 新增阶段 A′：装饰键投影（零成本，与 A 同批）**

规则写进 scorer 注释 + 变异测试钉住：`width / fixed / align / sortable / autofocus / title` 属**装饰键**——
`gold 有而 pred 无 ⟹ 不判负`；`两边都有 ⟹ 比值`（写错仍判负）。这样「猜不到」不再等于「做错」，但「写错」仍然扣。
验收 = §9 附录命令 5 的镜像：**只改 gold 的 `width`/`title`、NL 不动 ⟹ 仍 pass**。

> **落地记录（0a，2026-10-27）**：已按此实施，并折入两处细化——①**对称化**：`pred 有而 gold 无` 同样豁免
> （模型给 gold 没声明的列写了个宽度，与「gold 写了 pred 没写」是同一类「猜」，罚一边放一边会教出
> 「永不写装饰」的偏置）；②`ellipsis`/`showOverflowTooltip` 今天语料 0 处，**暂列结构键**（宁可暂严，
> 不可误绿），`scorers.test.mjs` 的列键白名单会在它们（或任何新键）进语料时强制做分类。

**A3 · 新度量 `byCapabilityOnPinned`（只在被 pin 的行上统计）**

`byCapability` 的分母是全部 194 行，而门禁只吃 pin ⟹ `dataOptions 42.3%` 看起来最急，实际只 pin 了 5 行。
加一个「分母 = 钉了该维的 heldout 行」的同构度量（纯聚合、无 API 成本），D 阶段的排序才能从「感觉」变成「行数 × 可教学性」。

**A4 · 给片段腿一个可证伪的预测（写进阶段 A 验收）**

今天片段 `core == scoped == stated == byDim.propSet` 四个数完全相等 ⟹ **每个片段行的非 `propSet` 维度今天全过**。
⟹ **A 落地后片段 scoped 应当 ≈ 新的 `propSet` 命中率**（若 label 身份把 propSet 送到 90%，片段就该到 ~90%）。
若 A 之后片段仍停在 55%，说明还有别的阻断被掩码藏住（那时才去看 `fieldLayout/labelKey` 簇）。这条预测可伪造，比「片段预期提升」有用。

**A5 · 编译腿提前加固（与 0/A 并行，零模型成本）**

核心目标里唯一已经达成的是「编译 100%」，但分母有边界（D7）：en 191 行不进编译门、typecheck 只抽 30。
把 en 进分母（216→407）、typecheck 改全量、补转义 fuzz 语料——**三件事不花一分钱**，直接把「编译 100%」从「这批碰巧过」变成「这类输入结构性过」。这是当前性价比最高的动作。

**A6 · 95% 的口径两档（替换 §5 的对外表述）**

- **产品口径**：`zero-edit ∨ ≤3 轮收敛`（用户已拍板的定义，也是真实使用路径）。
- **公开口径**：投影落地前**不出现 95%**；落地后按棘轮逐段上调 `0.35 → 0.55 → 0.75 → 0.90`，95% 只在「普通用例 ≥155/164」被真实产物验证后才写进文案。

### 10.4 立刻可做的三件事（都不需要跑模型）

1. **投影 + 10 例补 NL + 15 例摘 pin** ⟹ 把上限从 **83.5% 抬回 100%**。这是所有后续工作的前提，不做则以下全部无意义。
2. **`byCapabilityOnPinned`** ⟹ 让下一次付费跑批的信息量翻倍，避免按错维度排序。
3. **`check:rescore-parity` 常态化 + dump 无条件落 artifact** ⟹ 整条路线只有阶段 C₀ 能证明「复算自洽」，而它**至今没真跑过一次**（D8）。

### 10.5 修订后的执行顺序（替换 §4）

```
0a 投影（scorer，装饰键）        ─┐
0b 10 例补 NL + 15 例摘 pin      ├─ 零模型成本，同批重取证基线
0c 双向守卫（先定 token→字段解析）┘
A  label 尺子（两个 fieldMap）   ── ✅ 已落地，见 §11.4。同批：RULER_VERSION → label-identity-v1+deco-projection-v1
                                    （A′ 装饰键投影、describeDimMiss 已随 0a 落地，见 §11.1）
                                    附带补掉两个真缺陷：`defaultSort` 此前无维度覆盖（166 的头号需求）；
                                    `isHidden` 裸表达式（`{'>':[{var}]}`）在改名时漏改写
A5 en 进编译分母 / typecheck 全量 / 转义 fuzz   ── 与 A 并行
A4 验收：片段 scoped ≈ 新 propSet 命中率（可证伪）
C₀ 管道体检（--limit 8 + rescore --expect）
C  一次全量 dump（旧尺子复现 → 新尺子复算 → 逐行失败集）
D  按「单维上限 × 可教学性」排序：isHidden → columns(投影后) → dialogs → reactions
   → expandConfig → tableBtns → editConfig → extPoints（dataOptions 只 pin 5 行，最后）
E  收敛腿（普通用例 ≥85% 之后再动）
G  度量可靠性（健康门 / artifact / 棘轮 / version 指纹）
```

> **一句话**：这套方案能把 95% 从「数学上做不到」变成「数学上做得到、工程上极难」，现实落点 **60–75%**；要跨过 95%，靠的不是再加阶段，而是**先有一次逐行 dump 说清「剩下 141 行到底差在哪」**。

---

## 11. 执行记录（按 §10.5 逐项落地）

### 11.1 0a 装饰键投影 ✅（2026-10-27）

**改了什么**

| 文件 | 改动 |
|---|---|
| `scripts/eval/scorers.mjs` | 新增 `COLUMN_KEY_CLASS` / `EDIT_RENDER_KEY_CLASS` / `EXPAND_KEY_CLASS`（键分类**单一源**）+ `projectColumns` / `projectExpandConfig`（深拷贝后按位投影，不改入参）；`columns` / `expandConfig` 两个维度改判投影后的值；`describeDimMiss` 补 `expandConfig` 分支、`columns` 分支改用投影（保住「`want === got` 当且仅当 pass」） |
| `scripts/eval/scorers.test.mjs` | 2d/2e 增投影变异用例（单侧 width 通过 / 两侧同写不同值判负 / `groups` 递归 / `editRender.autofocus` 豁免但 `name` 不豁免 / `permissionValue`、`dataOptions` 不豁免 / 标题单侧豁免）；第 4 节增**列键白名单**（语料出现未分类键即红）+ **语料投影自检**（把 216 个 CRUD gold 的装饰键全删掉，`columns`/`expandConfig` 必须仍判正）；`describeDimMiss` 不变量节补 `expandConfig` 与「豁免时两侧投影相同」 |
| `scripts/eval/dump.mjs` | `RULER_VERSION = 'prop-identity-v1+deco-projection-v1'`（复合串：字段身份 + 装饰策略两轴；只改装饰策略也要换串，否则两把尺子共用一个版本号） |

**实测（今日复算）**

- 「结构全对、装饰全没猜」的完美模型：heldout CRUD **194/194** 通过 ⟹ 尺子侧上限 **100%**（0a 前：32 行钉死、上限 83.5%）。
- 语料里含装饰键的 CRUD 例 **27** 个：`47-61`（列宽/固定/对齐/自动聚焦）、`62-76`（展开区标题）、`87`、`103`、`186`。
- 0a 直接解锁 **22** 行（`columns` 11 + `expandConfig.title` 11）；剩下 **10** 行 `membership`（`162-171`，gold `inQuery:false` 而 NL 无查询措辞）**投影治不了** ⟹ 当前上限 **184/194 = 94.8%**，由 0b 修。
  - ⚠ **更正（2026-10-29）**：`expandConfig.title` 的 11 行是**纸面推断**——豁免规则要求「任一侧没写」，
    而真实 pred 与 gold **两侧都会写** title，豁免从不触发，实测解锁 **0** 行。见 §11.12。
- 复现：`node scripts/eval/scorers.test.mjs`（含语料投影自检）、`npm run check:consistency`（EXIT=0）。

**刻意不动**：`permissionValue`（无权限不出列）、`dataOptions`（码值→文案）、`editRender.name/type/options/props/defaultValue`（编辑器语义）、`btns`、`groups` 结构、列序与列数 —— 这些是行为契约，单侧缺失/写错照旧判负。

> **一句话**：0a 把「尺子自己把上限压在 83.5%」改成「只剩 10 行语料缺口」，且**没有放宽任何行为契约**；下一步 0b 是纯语料工作（10 例补 NL + 15 例摘 pin），完成后上限回到 100%。

### 11.2 0b 语料：10 例补查询面 + 15 例摘 pin ✅（2026-10-27）

| 改动 | 用例 | 依据 |
|---|---|---|
| 补穷举查询面（`nl` + `nlEn` 同步） | `162`–`171` | 这些用例的 gold 都有 1–2 个 `inQuery:false`，而 NL 一处查询措辞都没有 ⟹ pin 的是推不出的意图。补法不是「发明新需求」，而是把 gold **本来就这么设计**的查询面写进 NL（`164` 的查询面为空集，故写「不提供查询条件」）。机器验收：`extractSurfaceList(nl,'inQuery')` 与 gold 的可查字段集**逐项相等**、`inQuery:false` 字段零泄漏（10/10 ✅） |
| 摘掉 `membership` pin | `172`–`186` | 15 条 merge 用例的 gold **全默认**（无一处 `inQuery:false`），NL 也不谈查询 ⟹ 该 pin 只约束「别乱造」，没有任何 NL 依据。按 `pinnedDims ⊆ nlStatedDims` 摘除（将来若要度量「不乱造」，应补 NL 再钉） |

- pin 总量：**857 → 842** token、`membership` pin **25 → 10**（与 C16/C17 的数一致）。
- **顺带修了 6 例反向矛盾**（旧守卫只查一个方向，抓不到）：`59`（规格）、`153`（金额区间）、`154`（渠道）、`155`（等级）、`157`（承运商）、`159`（负责人）——
  NL 明说「查询有…」，gold 却给该字段写了 `inQuery:false`。修法是**删掉那处 `false`**（NL 是规格、gold 要忠实于它），
  不是改 NL 迁就 gold。
- **偏离方案一处**：没有给 216 条 CRUD 补 `nlStatedDims`。理由是它**在 CRUD 腿上是死数据**
  （`eval-llm.mjs:509` 的掩码只读 `pinnedDims`，`nlStatedDims` 只被片段腿消费），且自报字段
  证明不了自己诚实（C17）。改为在 0c 用**机器下界**替代（见 §11.3），语义等价、不可自欺。
- 语料上限：0a 之后剩的 10 行 `membership` 不可推断，0b 之后 **194/194 均可推断** ⟹ 语料 + 尺子侧上限回到 **100%**。

### 11.3 0c 双向 membership 守卫 ✅（2026-10-27）

`scripts/lib/membership-trap.mjs` 新增三个导出，`scripts/check-membership-trap.mjs` 从一条腿扩到三条腿：

1. **正向**（原有）：NL 穷举列举了某界面，gold 却省略该开关（默认 true）⟹ 矛盾。
   本次把匹配器归一化（去空白/引号、去「范围/区间」后缀、双向包含），修掉了 `09` 那类假红。
2. **反向**（新）：NL 点名可查、gold 却写显式 `false` ⟹ 矛盾。用**严格匹配**（归一后相等或列举项包含
   label）：`66` 的表格列举是「姓名、班级、总分」，展开区字段叫「家长姓名」——宽松匹配会把它误判成
   「NL 点名进表格」（实测踩到，已固化成夹具）。
3. **pin 下界**（新）：`membership` 或 `inQuery:<prop>` 进了 `pinnedDims` ⟹ NL 必须**可判定地**声明查询面
   （穷举列举，或「不提供查询」这种全否表述）。这是 `pinnedDims ⊆ nlStatedDims` 在 CRUD 腿的机器实现。

每条腿都配内联夹具（guard 失配即红），并用 `git show HEAD:` 的**修前语料**验证过它们真的咬得住：
6 条反向矛盾全部报出、`163/164` 的 pin 下界判定为「无依据」。守卫全绿（216 用例 + 25 few-shot）。

### 11.4 A 尺子：字段身份改按 `label` ✅（2026-10-27）

**改了什么**

| 文件 | 改动 |
|---|---|
| `scripts/eval/align.mjs`（新） | `normalizeLabel`（NFKC → 去空白 → 去标点 → 小写，**不做语义归一**）、`alignFields`（① 归一 label 精确匹配 → ② prop 兜底；**单射**，重复 label 只认第一个、其余进 `unmatchedPred`）、`normalizePredForCompare`（白名单改写 8 类结构）、`propNameMatch`（观测量）、`scoreOptsForLang`（zh=label / en=prop 的**单源**） |
| `scripts/eval/scorers.mjs` | `scoreAll` / `describeDimMiss` 入口先对齐一次，所有维度（含 `fieldMap`/`sharedFields`/深等值）经同一份 `alignedPred`；新增**观测量** `propNameMatch` / `alignMode` / `alignUnmatched*`（不返回 `alignedPred`，避免调用方又拿它去比 gold） |
| `scripts/eval/fragment-scorers.mjs` | `scoreFragment` / `describeFragmentDimMiss` 同批对齐（设计 §8.3 的「两个 `fieldMap` 同批改」）；返回值增 `propNameMatch` |
| `scripts/eval-llm.mjs` · `rescore.mjs` | `scoreAll(..., scoreOptsForLang(lang))`：**en 腿仍走 prop 身份**（D14）——gold 标签是中文、pred 是英文，按 label 比结构性必错，且 en 只观测不门禁；`propNameMatch` 进 `computeCrudMetrics` / 片段汇总 / 产物 |
| `scripts/eval/dump.mjs` · `artifact.mjs` · `ratchet.mjs` | `RULER_VERSION = 'label-identity-v1+deco-projection-v1'`；产物身份增 `rulerVersion`（**缺了只警告不判红** —— 已提交的旧产物是旧代码写的，判红会恒红到下次夜间跑批）；`compareToBaseline` 版本不同则**硬失败并拒绝比较**；`rescore --expect` 同样拒绝跨版本比对（且报错必须说「尺子版本不同」，不能说成「聚合漂移」） |
| `__tests__/golden/accuracy-baseline.json` | 增 `rulerVersion: null`（尚未在任何一把尺子下测过）+ 计数更新记录；新增维度 `defaultSort` 计数 1 / 地板 1 |
| `package.json` | 新脚本 `check:align`，并入 `check:consistency` 链 |

**实测（全离线，0 模型成本）**

- **定义级断言，全语料**：把 216 条 CRUD gold 的**每个字段 prop 全部改名**（label 原样），用 216/216 条重新打分 ⟹
  所有 applicable 维度 pass、`exactIntentScoped` **216/216**、`exactIntentFull` **216/216**、`propNameMatch = 0`。
  语料里**没有一条**带无 label 字段 ⟹ 兜底分支在真实语料上不会被用来蒙混。
- **尺子没被改瞎**：同一次改名之上再弄错首字段 `formtype` ⟹ `formtype` 维度 **216/216 判负**。
- **片段腿**：63/63「prop 全改名、label 不变」⟹ `byDim` 全 pass 且 `scoped`/`stated` 为真（改名器在测试里
  **独立重写一遍**，不 import `align.mjs` 的改写器，否则是「用实现验证实现」）。反例：label 互换是**映射错**
  不是集合错 ⟹ `propSet` 仍 pass，由字段级维度咬住（这条同时钉住了 `propSet` 的语义 = identity 集合相等）。
- `node scripts/eval/align.test.mjs`（6 节：归一化 / 单射与兜底 / 改名全绿 / 改错仍红 + 白名单 / prop 身份）；
  `npm run check:consistency` EXIT=0。

**顺带补掉的三个真缺陷**（都是写测试时被咬出来的，不是设计里写的）

1. **`defaultSort` 此前没有任何维度覆盖**。`166-announcement-defaultsort-vue3` 的头号需求是「默认按发布时间倒序
   排列」，gold 也声明了 `tableOptions.defaultSort` —— 但 CRUD 记分卡的 24 个维度里没有一个读它，模型**整个漏写**
   也判满分。属 "mark, never drop" 缺口（同一批的 `nav`/`defaultSort` 在片段腿有 `tableOptions.defaultSort` 维，
   CRUD 腿漏了）。已补维度 + 扰动用例 + `describeDimMiss` 分支；`applicableCounts.defaultSort = 1`、
   `minApplicable = 1`（n=1 时 10% 余量会退化成 0，等于「删掉唯一难例也不红」）。**语料只有 1 例声明它** ⟹ 该维
   当前只观测不门禁，补语料留到 D 阶段。
2. **`isHidden` 的裸表达式形态漏改写**：`{'>': [{var:'amount'}, 100]}`（`frag-form-05`「金额大于 100」）既没有
   `field` 也没有 `expr`/`when` 键，旧改写器直接返回原对象 ⟹ 改名后的**正确**配置被判红。改为 `renameCondition`
   （field / expr / when / 裸表达式 / `and-or` 嵌套统一递归），并加夹具钉住。
3. **`align.test.mjs` 的 `defaultSort` 断言写错**（挂到 `columns` 维上）——这不是代码缺陷，但它暴露了「维度清单
   只在注册表里、没有可读的对照」；测试改为直接断言改名结果 + 维度判负。

**刻意不做的**

- **不做模糊匹配**（拼音/同义/编辑距离）。先只做归一化精确匹配，是否放宽由数据决定（设计 §8.5）。
- **prop 兜底不放宽也不收紧**：pred 的 `prop` 与 gold 相同、`label` 写错时仍判正（与 R2 之前的尺子等价）。
  要收紧成「label 必须相等」是另一个决策（会改全语料判负面），不在本次范围。
- **`treeConfig.childrenField` 是行数据键，不改写**（测试钉住：设成字段 prop 仍判负）；`extPoints` 源码串同样不动。
- **`nlStatedDims` 仍不进 CRUD 腿**（§11.2 的偏离保持）。

**留给 C 阶段验证的两件事（可证伪）**

- **A4**：片段腿今天 `core == scoped == stated == byDim.propSet`（55.6%）。label 身份落地后，片段 `scoped` 应
  ≈ **新的 `propSet` 命中率**；若仍停在 55%，说明还有别的阻断被掩码藏住。
- **en 腿数字必须不变**（`byLanguage.en`）：它走 prop 身份，本次改动对它是恒等变换。下次跑批若 en 腿数字动了，
  说明 `scoreOptsForLang` 没生效。

### 11.5 A5 编译分母含 en 腿 + 类型腿全量 + 属性式 fuzz 守卫 ✅（2026-10-27）

**改了什么**

| 文件 | 改动 |
|---|---|
| `scripts/lib/generator-loader.mjs`（新） | 生成器的 esbuild 打包**单源**（从 `packages/shared/src` 直接打包，不依赖 `dist`）+ `crippleEscaperSource`（恒等转义器，保留 `assertEmittableExpr` 与 `findNonJsonValues` 真实）。escaping 守卫原有的私有副本删除 |
| `scripts/check-generator-fuzz.mjs`（新） | **属性式**守卫：19 个载荷 × 3 target × 2 mode × 2 个槽族 = 228 份配置，判据 = Tier A 编译器能否编译产物；自由槽额外断言哨兵出现在产物里（防「值被静默丢弃」的假绿）；身份槽判据为析取（Zod 拒绝 ∨ 能编译），并断言「至少一条被拒绝」（否则析取退化）；非空证明 = 恒等转义器下同一份语料必须变红 |
| `packages/shared/src/codegen-escape.ts` | `q()` 的换行归一化 `/\r?\n/` → 逐字符（`\r`→`\r`、`\n`→`\n`） |
| `packages/shared/src/structured-generator.ts` | 导出 handler 的 `as any` 跟着 `typescript` 走（`queryForm${ts ? ' as any' : ''}`） |
| `scripts/eval/compile-leg.mjs` | `summarizeCompile` 增 `byLang`（诊断拆分，**不是**第二个分母）；SFC 判定改为「以 `<template>`/`<script>` 起头」+ `compileProduct` 按产物结构分派（有 `wrapperCode` ⟹ `code` 是模块） |
| `scripts/eval/run-metrics.mjs` | 编译门分母 `zhRows` → `rows`（**含 en 腿**） |
| `scripts/eval-llm.mjs` · `artifact.mjs` · `rescore.mjs` | 产物/日志带 `compileByLang`；`verifyArtifact` 只查「桶自身自洽」（红），桶之和 ≠ 全局分母只**警告**（观测腿跑一半是正常状态）；类型腿 `TYPECHECK_FULL = true`（`mode: 'full'`，超时 15 min，抽样保留为降级开关） |
| `package.json` | 新脚本 `check:generator-fuzz`，并入 `check:consistency` 链（紧跟 `check:generator-escaping`） |

**实测（全离线，0 模型成本）**

- `check:generator-fuzz`：**228 份配置 → 198 份产出可编译产物，30 份被 schema fail-closed 拒绝**；恒等转义器下 **108 条变红** ⟹ 判据有约束力。自由槽 100% 到达发射器（覆盖性断言）。
- `check:generator-escaping`：9 份产物 / 四种上下文全绿；非空证明 18 条变红（改用共享 loader 后行为不变）。
- `npm run check:consistency` **EXIT=0**（含新守卫）。

**首版即咬出的三处真实缺陷**（都不是读代码发现的，且当时全部守卫为绿）

1. **`sfc` 模式 + `actions` 含 `export` + `typescript:false`** ⟹ `new URLSearchParams(queryForm as any)` 里的类型断言
   在 JS/JSX 产物里是语法错。语料里恰好没有「sfc + 导出」的组合，Tier A 因此长期是 100%。
2. **孤立 `\r`**：`/\r?\n/` 抓不到单独的 CR，而裸 CR 在单引号字面量里就是行终止符 ⟹ `Unterminated string constant`。
3. **编译腿把模块误判成 SFC**：内联 JSON 只转义 `</script`、开标签原样保留 ⟹ 带 `<script>` 的 label 触发
   `Element is missing end tag` 的**假编译失败**。这是**尺子**缺陷，不是产物缺陷。

**刻意不做的**

- **编译门判据不变**（仍是 `compileRate === 1`），只换分母：en 腿进分母是因为编译失败是**产物**属性（每条产物一次
  独立发射），不像准确率那样要把「没测到」按 0 计；若把 en 的**语义** miss 也算进编译门，就变成第二道准确率门。
- **`byLang` 不参与门禁**：桶之和 ≠ 全局分母只警告 —— 观测腿跑一半时判红会让门禁在正常状态下恒红（红盲）。
- **类型腿仍是观测**：不进 `passed` / 徽章 / exit code，全量只让它**更容易**红（样本多了、形态全了）。

> **一句话**：三件事把「编译 100%」从「这批中文用例碰巧过」变成「这类输入结构性过」，代价是零模型成本；
> 而且守卫第一次运行就抓出两条产物缺陷 + 一条尺子缺陷。

### 11.6 A4 片段腿可伪证 + C₀ 管道体检 + A3 门禁口径逐维 ✅（2026-10-27）

**A4：§11.4 留的两条可伪证预测，都拿真实产出验了**

预测①「片段 scoped 应 ≈ 新的 `propSet` 命中率；若仍停在 55%，说明还有别的阻断被掩码藏住」。

实测（`--fragments` 探针 63 条，63/63 有产物、零未测到）：

| 指标 | 值 |
|---|---|
| `propSet` | **63/63 = 100%** |
| `scoped`（pinnedDims） | **60/63 = 95.2%** |
| `core` / `stated` / `full` | 100% / 95.2% / 90.5% |
| 编译 | 100%（63/63） |

- 预测**在方向上成立**：旧口径的 55.6% 确实是被 `propSet` 撑破的；label 身份落地后 scoped 抬到 95.2%，
  且两者已**解耦**（`propSet` 100% > `scoped` 95.2%）—— 这正是「尺子不再掩码」的形状。
- 剩下 3 条 miss **全部是 `frag-form-06`**（vue3 / vue2 / antdv 各一条），唯一失败维 = `reactions`
  （级联 `country → province → city`）。这不是尺子问题，是可教学的真实缺口 ⟹ D 阶段第一顺位。
- 另有一处**未 pin** 的失败（`tableOptions.localPagination` 0/3，该 case 没有 pin 它）—— 不影响
  门禁口径。它恰好演示了 A3 要分开的两件事：维度差 ≠ 维度差且对门禁有杠杆。

预测②「en 腿数字必须不变」。CRUD-8 探针里 en 行 `propF1` = 0.29–0.80（同批 zh 行全 1.00）⟹
`scoreOptsForLang` 生效、en 仍走 prop 身份；`compileByLang` = **zh 8/8 · en 8/8**。

**C₀：管道体检（`--limit 8` + 离线复算）**

- 默认模型 id `claude-opus-5` 在本机 PPIO 中继 **404**：16 行全「未测到」、`served` 为空，脚本按设计
  **FAILED 且不写任何产物**。这条链本身就是 C₀ 要证明的（探针不许当成绩）。
- 换 `ESPLUS_EVAL_MODEL=pa/claude-opus-4-8`（`served pa/venus-marble-4-8`）后全通：`--limit 8` 16 行
  零失败、类型腿全量 8/8、前门 16/16、编译 16/16；`--fragments` 63 行零失败。
- 离线复算：`rescore` 在探针 dump 上重建 8 例 / 63 例，与跑批聚合同源同值（95% 定义 4/4、
  编译 16/16、片段 scoped 0.9524）。dump 的 meta/尺子版本/语料指纹三件齐全。
- **未做**：`--expect` 逐字段比对需要一份完整跑批产物，而探针按定义不写产物 ⟹ 这一项仍等 C 阶段。

**A3：`byCapabilityOnPinned`（门禁口径的逐维视图）**

| 文件 | 改动 |
|---|---|
| `scripts/eval/run-metrics.mjs` | 新口径：分母 = **钉了该维** 的 heldout 行（token 支持整维与 `维度:字段`），与 `byCapability` 同构、同精度 |
| `scripts/eval-llm.mjs` | 行携带 `pinnedDims`（**成功与错误两条路径都要带** —— 否则答错的 pin 从分母里消失，等于免罚）；summary 两列并列打印；产物带 `byCapabilityOnPinned` |
| `scripts/eval/rescore.mjs` | 同上同构（从 dump 的 `mask` 取）；`--expect` **只在产物带该块时**比对（旧产物没有 → 不误报成漂移） |
| `scripts/eval/artifact.mjs` | 只查自洽：`pass ≤ applicable`；`applicable = 0` 时 `rate` 必须是 `null`（「没人 pin」不是「全错」） |
| 测试 | `check:run-metrics` 增第 8 节（字段级 pin / 答错行进分母 / 无人 pin ⟹ null / 无 `pinnedDims` 的旧行不抛错 / 两口径必须能给出不同数字）；`check:artifact-self` 增 5 条判据 |

实测（8 例探针，只示**口径会翻转排序**，不作成绩）：`formtype` all 2/4 vs pinned **0/2**；`propSet`
all 2/4 vs pinned 2/2。只看 all 列会把 `propSet` 当短板，而门禁真正挂掉的是 `formtype`。

**刻意不做的**

- `byCapabilityOnPinned` **不进门禁、不进棘轮**：它是 D 阶段的排序依据，不是第三个成绩口径。
- 探针不因 A3 而改写产物：`--limit` 的语义仍是「零副作用」。

> **一句话**：A4 证明新尺子不再掩码（片段 55.6% → 95.2%，残余 3 条全指向同一个可教学维 `reactions`）；
> C₀ 证明整条管道（探针 → dump → 复算）在工作，且默认模型 id 打不通时它**拒绝开跑**而不是产出假成绩；
> A3 让「哪维差」变成「哪维差且门禁在乎」。

### 11.7 §10.4③ 复算自洽常态化 + dump 无条件落 artifact ✅（2026-10-27）

**问题（D8）**：`rescore --expect` 早就写好了，但**没有任何东西调用它** —— 每次改 scorer 都只能靠
单测证明「新口径自洽」，没有任何一次真跑批证明「产物里的数字 = 从 dump 复算出来的数字」。

**改了什么**

| 文件 | 改动 |
|---|---|
| `scripts/check-rescore-parity.mjs`（新） | 守卫入口：只在**产物自称完整测量**时比对；四条跳过规则各自显式打印（失败产物 / 无 `measurement` 的旧产物 / 无 CRUD 行的片段探针 dump），而「自称完整测量却拿不出 dump」是**红**（那正是「无法复算却发布」的形状） |
| `.github/workflows/eval-llm.yml` | 夜间跑批**无条件** `--dump-pred .tmp-eval/pred.jsonl`；新增 `Rescore parity` 步（`always()`）；dump 经 Actions artifact 留 14 天 |
| `.gitignore` | `.tmp-eval/`、`.tmp-audit/` 不进版本库（dump 只走 artifact，仓库仍只留产物与徽章） |
| `package.json` | 新脚本 `check:rescore-parity`（需 dump 参数，故不进 `check:consistency` 链） |
| `scripts/eval/rescore.test.mjs` | 第 5 节把四条跳过规则逐条钉住（含「一致 → 打印逐字段一致」「缺 dump → 红」）；产物夹具补 `measurement` |

**自守机制**：若有人删掉 `--dump-pred`，那份 dump 就不存在 ⟹ parity 步在「产物自称完整测量」时
直接红 —— 不需要再加一条「守卫 YAML 文本」的脆守卫。

**实测**：构造一份与 dump 完全一致的产物 → `125 项逐字段一致`、退出 0；把 `propSetF1` 改 0.5 →
退出 1；`measurement=failed` → 显式跳过、退出 0；片段-only dump → 显式跳过。

> **一句话**：这条链到此闭环 —— 夜间跑批从此自己证明「产物 = 复算」，且 dump 留档把 C/D 阶段的
> 「逐行差在哪」变成可离线回答的问题。

### 11.8 C 阶段：一次全量 dump（旧尺子复现 → 新尺子复算 → 逐行失败集）✅（2026-10-27）

**跑批事实**（本地全量，PPIO 中继）

| 项 | 值 |
|---|---|
| 产出 | 492 行（CRUD zh 216 / CRUD en 191 / 片段 63 / PRD 22） |
| 模型 | 请求 `pa/claude-opus-4-8`，中继实际服务 `pa/venus-marble-4-8`（别名路由，产物按 servedModel 归属） |
| 时长 | 08:36Z → 10:35Z ≈ **119 min**（4.1 行/分；含中继冷却 8 次共 360 s） |
| 传输重试 / 降级调用 | 14 次 / 0 |
| Tier A 编译 | **407/407 = 100%**（zh 216/216 + **en 191/191**，en 已进分母，见 §11.5） |
| Tier B 类型腿（全量） | 214/216 = 99.07%，2 处类型错（§11.5 只观测不门禁） |
| 未测到 / 答错 | 0 / 0（CRUD 两条腿）；片段腿 3 行未测到 → 补跑后 **63/63 完整**（见 §11.9） |
| 产物 | `measurement: complete`；`rescore --expect` **125 项逐字段一致** |

类型腿的两处失败都是「模型写了 schema 里没有的键」，不是生成器缺陷：
`13-all-formtypes [vue3]` 的 `columns[].children`（`TableColumnDataOption` 无此键）、
`161-contract-status-render [vue2]` 的 `options.tagType`。归因 `modelFailureTypecheck = 60`。

**① 旧尺子复现 → 新尺子复算（同一批产出，只有尺子不同）**

用同一份 dump 跑两遍判据（`identity:'prop'` = A 之前的尺子；默认 = label 身份 + 装饰键投影）：

| 指标 | 旧（prop 身份） | 新（label + 投影） | Δ |
|---|---|---|---|
| 95% 定义（门禁 ∨） | 32.5%（63/194） | **69.1%（134/194）** | +36.6 pp |
| core（四维硬口径） | 23.2% | 52.6% | +29.4 pp |
| scoped HELDOUT | 28.4% | 63.9% | +35.6 pp |
| full ALL | 19.0% | 33.3% | +14.4 pp |
| propSet F1 | 77.5% | 99.4% | +21.8 pp |
| attribute acc | 95.5% | 95.0% | −0.5 pp |
| actions F1 | 99.1% | 99.1% | 0.0 pp |
| 逐行翻转 | — | **78 行，全部由红转绿，0 行转红**（其中 71 行是 heldout） | — |

两条结论：

1. **尺子效应是单调的**：78 行翻转里没有一行因为换尺子而被判负 ⟹ label 身份不是「换一批人过、
   换一批人不过」的口径挪移，只是把「命名彩票」这一项从字段集合判定里摘掉。
2. **它摘得准**：`propSet` 暴涨 21.8 pp，而 `attribute acc`（字段属性对错）与 `actions F1`
   （按钮集合）几乎不动 ⟹ 放掉的只是「同一字段起了不同名字」，没有顺带放掉「属性写错」。
   这也是反假绿的第一道证据。

**跨批次归因**（22.7% → 69.1% 这 46.4 pp 从哪来）

| 段 | 值 | 来源 |
|---|---|---|
| 2026-10-23 产物（`3198d3b`） | 22.7%（44/194） | 尺子 = prop，模型 = `claude-opus-4-6` |
| 同一批产出、仅换回 prop 身份 | 32.5%（63/194） | 模型（4-6 → 4-8）+ 语料 0b（10 例补 NL、15 例摘 pin）≈ **+9.8 pp** |
| 换新尺子 | **69.1%** | **+36.6 pp**（真实尺子效应**更大**：今天的「旧尺子」里装饰键投影已无开关，0a 那部分测不出来） |

跨批次比不了「en 腿数字必须不变」这条不变式 —— 本次换了模型，模型效应与尺子效应混在一起。
**批内**可测的那一半已经测了：en 腿 heldout core `0.2663` 正是 `identity:'prop'` 的结果；
若 `scoreOptsForLang` 失效、en 走 label，同一批产出会读 **0.3979**（191 行里 28 行结论不同）
⟹ 这个开关是承重的，且本次确实生效。

**② A4 验收（片段腿，可伪证）**

| 指标 | 2026-10-23 | 本次（补跑 3 行后，63/63 完整） |
|---|---|---|
| 片段 scoped | 55.6% | **96.8%（61/63）** |
| 片段 core / propSet | 55.6% / 55.6%（35/63） | **100% / 100%（63/63）** |
| 片段 full（诊断） | 50.8% | 92.1%（58/63） |

A 阶段留的断言是「片段 scoped ≈ 新 propSet 命中率；若仍停在 55%，说明还有别的阻断被掩码藏住」。
实际 propSet 63/63 = 100%、scoped 61/63 = 96.8% —— **差的 2 行有名字**：`frag-form-06`
（province→city 级联）在 **antdv 与 vue2 两个目标**上 `reactions:*` 未命中，vue3 目标通过。
`full` 的另 3 行是 `frag-table-02`（`tableOptions.stripe|rowkey|rowHeight|estimatedRowHeight|
overscanCount|rowClassName|cachePageSelection|refetchKeepPage|localPagination|configTableOut`
十键全缺）—— 那是「NL 没要求、gold 声明」的诊断口径，不进 scoped。
掩码已摘掉，「剩下的差在哪」从此可回答，而且答案小到能逐条点出来。

**③ 逐行失败集（门禁口径：只认被 `pinnedDims` 钉住的维）**

60/194 失败 = **52 行单维阻断 + 8 行组合阻断**：

| 单维阻断的维 | 行数 | 修好该维后的门禁 |
|---|---|---|
| `isHidden` | 9 | 73.7% |
| `expandConfig` | 9 | 73.7% |
| `tableBtns` | 8 | 73.2% |
| `columns` | 7 | 72.7% |
| `reactions` | 6 | 72.2% |
| `editConfig` | 4 | 71.1% |
| `propSet` | 4 | 71.1% |
| `extPoints` | 2 | 70.1% |
| `fieldSpan` / `dialogs` / `treeConfig` | 各 1 | 69.6% |
| **单维全修（上限）** | **52** | **95.9%** |

组合阻断 8 行：`columns+editConfig` 4、`actions+tableBtns` 2、`isHidden+reactions` 1、`dialogs+tableBtns` 1。

**对 §10.5 的 D 排序提出两处修订**（依据是上表的行数，不是感觉）：

- `expandConfig`（9 行）与 `tableBtns`（8 行）应排在 `dialogs`（单维只 1 行，另 1 行与 tableBtns 组合）
  与 `reactions`（6 行）**之前**。原排序 `isHidden → columns → dialogs → reactions → expandConfig → tableBtns`
  是按「单维上限」推的，实测行数把后两项顶到了前面。
- `columns+editConfig` 这 4 行要**成对修**：它们是同一类「可编辑列」形态，单独修任一维都转不了绿。

修订后：`isHidden → expandConfig → tableBtns → columns（含 columns+editConfig 4 行成对）→ reactions
→ editConfig → propSet → extPoints`。**dataOptions 仍是最后**（只 5 行 pin 它，且多为组合中的一员）。

**④ 反假绿抽查**：107 行「scoped zero-edit 通过」里抽 5 行比对 pred 与 gold 的字段集合 ——
4 行 `propF1 = 1.00`（字段集合同构）、1 行 0.86（多写一个未 pin 的字段）。没有出现「通过但 pred 与 gold
不像」的行，`propSet F1 = 99.4%` 不是聚合口径造出来的。

> **一句话**：门禁数 69.1% 落在 §10.5 预判的 60–75% 区间内；其中 36.6 pp 是尺子（单调、只摘命名彩票），
> 剩下 60 行差在哪已逐行有名字，D 阶段的排序按实测行数做了两处修订。

### 11.9 C 阶段咬出的度量缺口：熔断阈值让「抖动的前 N 行」必然作废（→ 已按 ① 落地，见 §11.11）

**现象**：跑批中途中继抖动约 2.5 分钟，`frag-dialog-06-vue2` / `06-vue3` / `07-antdv` 三行各自
耗尽 4 次传输重试后落成 `ERROR(unknown) — Connection error.`；紧接着 `frag-dialog-07-vue2` 开始
「中继不可用，冷却 30s/60s/120s 后重试」，第三次冷却后**成功**。整轮共 8 次冷却、360 s。

**机理**（`scripts/eval/repair-loop.mjs` `createResilientTransport`）：熔断是 `tripAfter = 3`
——**连续 3 个调用各自耗尽全部重试**才算「中继整段不可用」，第 4 个才进冷却。设计初衷成立
（「抖动是散点，不是连片」），但代价被写死在：任何一次抖动，**前 3 行必然陪葬**，而每行还要
先白烧 4 次重试（3+6+12+24 ≈ 45 s）才记一档连败。本次正是这个形状：3 行 × 45 s ≈ 2.25 min 的死时间，
换来 3 行未测到。

**为什么这在本项目里是硬伤**：片段腿门禁是「零未测到」（AN-18），CRUD 门禁腿同理
（`evaluateHealth`）。也就是说 **2.5 分钟的中继抖动足够把一次 2 小时的跑批判红**，而这与
被测能力毫无关系 —— 这正是 §11.7 / D8 那类「测量工具自己制造红盲」的形状。

**已做的处置（治标，0 成本）**：`--fragments` 补跑片段腿（63 行，约 13 min，不进产物/徽章），
按 `file` 合并回 dump（`.tmp-audit/merge-frag.mjs`，只覆盖片段行，尺子版本不一致直接拒绝合并）。
补跑后 63/63 全部测到，合并后的 dump 复算仍与产物 **125 项逐字段一致**（CRUD 腿未受影响）。

**待决策的两个修法（治本，改的是花钱跑批的行为，故未擅自落地）**：

> **裁决（2026-10-29，用户拍板）**：选 ①**行级重放**。理由是它不改变任何打分语义 ——
> 重放成功的行是**真实测量**，与 `frag-dialog-07-vue2` 那次碰巧落在熔断之后被救回的重试同质，
> 只是把「碰巧」变成「一定会发生」。实现与证据见 **§11.11**；②`tripAfter = 1` 不采用
> （单行持续性故障会反复冷却，烧等待预算）。

| 方案 | 做法 | 代价 | 风险 |
|---|---|---|---|
| ① 行级重放（**已落地**） | 主循环跑完后，对 `isNotMeasured` 行**再跑一遍**（预算内、只一遍） | 与首次尝试同价（本次 3 行 ≈ 45 s） | 无：重放成功的行是**真实测量**，产物照旧记 `transportRetries` |
| ② `tripAfter = 1` | 第一个整行耗尽的调用就进冷却 | 每次散点抖动多等 30 s | 单行**持续性**故障（如某 case 永远超时）会反复冷却，烧等待预算 |

我倾向 ①：它把「少丢几行」变成「不丢行」，且不改变任何打分语义 —— 与 `frag-dialog-07-vue2`
那次救回来的重试是同一种东西，只是把它从「碰巧发生在熔断之后」变成「一定会发生」。

> **一句话**：这次跑批证明测量链本身还有一个「按分钟计的中继抖动 ⟹ 整批判红」的口子；
> 补跑只是治标，治本已按 ① 落地（行级重放，2026-10-29，§11.11）。

### 11.10 顺带查明的另一件事：夜间跑批**结构性断供**（不是代码问题）

本地这次跑通 ≠ 门禁线通了。**两边根本不是同一个中继**，失败原因也各自独立：

| | 本地（今天这次 C 阶段） | 夜间 CI（run `40477086547`，08:56Z） |
|---|---|---|
| endpoint | `https://api.ppio.com/anthropic`（PPIO 派欧云） | `agentrs.jd.com`（京东云，2026-10-16 起） |
| model | `pa/claude-opus-4-8` → 实际 `pa/venus-marble-4-8` | `claude-sonnet-4-6`（仓库变量，自 2026-10-16） |
| 结果 | 492 行全部测到，门禁 69.1% | **407/407 行未测到**，`measurement: failed`，一个百分比都没发布 |
| 错误 | — | 逐行 `403 {"code":"1301","message":"无配额可用"}` |

本地补做了两次最小请求探测（2026-10-27 11:15Z，各 1 次、无 token 消耗）：

| 对 PPIO 发 model id | 结果 |
|---|---|
| `claude-sonnet-4-6`（不带 `pa/` 前缀） | **404 `MODEL_NOT_FOUND`** |
| `pa/claude-sonnet-4-6` / `pa/claude-opus-4-8` / `pa/venus-marble-4-8` / `pa/claude-opus-4-6` | 403 `NOT_ENOUGH_MEMBER_BUDGET` |

**注意不要用本地结论去解释 CI**：`pa/` 前缀是 PPIO 的命名法，京东云那个网关对
`claude-sonnet-4-6` 原样回显（无别名），CI 拿到的 `403 1301 无配额可用` 是**京东云侧配额**。
所以两件事要分开处置：

1. **CI 断供 = 京东云配额**（`403 1301`）。代码侧没有可改的东西；要么在京东云开额度，
   要么把 workflow 的 secret/variable 换回 PPIO（那时变量要写成 `pa/claude-opus-4-8`）。
   改仓库 secret/variable 是外部动作，未擅自执行。
2. **本地 PPIO 预算也已耗尽**：今天这次全量跑（119 min）+ 片段补跑（13 min）之后，
   所有 `pa/*` 一律 403 ⟹ 在充值/换 key 之前，D 阶段任何需要模型的动作都跑不了。

> **一句话**：本地 69.1% 证明的是「口径与语料现在是对的」，**不是**「门禁线上是绿的」——
> 夜间线卡在京东云的配额上，本地线卡在 PPIO 的预算上，两条都不在代码里。

### 11.11 §11.9 ① 落地：行级重放（2026-10-29）

把「抖动的前 N 行必然陪葬」从**缺陷**降级成**代价**：主循环跑完后，把**没测到**的行补跑一遍，
补回来的行是真实测量。落地刻意收得很窄 —— 这不是重试策略的调参，而是唯一一处
「同一条语料被模型答两次」的路径，所以规则要逐条写死、逐条守。

#### 四条纪律（`scripts/eval/replay.mjs`，纯函数 + 自测）

| 纪律 | 做法 | 不这么做会怎样 |
|---|---|---|
| 只补「没测到」 | 判据只有一份：`isNotMeasured(kind)`（`repair-loop.mjs`），由调用方**注入**，缺参即抛 | 把 `model-failure` 也重放 ⟹ 每条答错的语料多一次抽样机会，分数会在没人改语料/尺子时自己往上爬 |
| 只补一遍 | 单一 pass，重放失败不再进第二轮 | 多轮 = 变相 best-of-N，且成本随轮数失控 |
| 死中继即停 | 连续 `REPLAY_ABORT_AFTER = 3` 行仍没测到 ⟹ `aborted`，停止 | 中继整段死掉时会白烧一整轮的等待预算 |
| 有上限 | `REPLAY_MAX_DEFAULT = 32`，超出的计数 `skippedOverCap` | 抖动规模远超上限时等于把整轮重跑一遍 |

#### 分母不变是硬不变式（两条腿各有一份证据）

重放写第二行，若按「出现几次算几行」读回，那一行会在分母里被算**两次**（一次未测到 0 分、
一次测到）⟹ 一次基础设施抖动被记成半次模型失败，复算与产物必然对不上。所以：

- **落盘点**：`runCrudEntry` / `runFragmentEntry` 改成**返回**结果、由 `commitCrud` /
  `commitFragment` 唯一落账（`rows` 按 key upsert，`dump` 同刻 append，重放行带 `replay: true`）。
- **读盘点**：`readDump` 改成「同一 `(kind, file, lang)` 后写覆盖先写」并计数 `superseded` ——
  dump 是 append-only（进程被杀仍保住已跑完的行），后写覆盖先写是唯一与内存 `rows` 同构的语义。
- **产物自证**：`artifact.replay = { crud, fragments }`，每腿
  `attempted = recovered + stillUnmeasured`；`passed === true` 时两腿的 `stillUnmeasured` 必须为 0
  （`verifyArtifact` 判红）。恒等式写进产物，是因为**分数不会露馅** —— 重放成功只会让分数变好，
  看起来像「模型变强了」。
- **离线复算**：`rescore.mjs` 读到 `superseded > 0` 时打印一行提示，数字一律取后写那一版。

#### 探针不重放

`PROBE`（`--limit` / `--fragments` / `ESPLUS_FRAG_ONLY` / `--fixed-fields` / `--prd`）下**跳过**重放：
探针的价值恰恰是如实暴露抖动，重放会把它抹平。重放只在会写产物的全量跑批里生效。

#### 一个被这次改动顺带咬出来的测试缺陷

`rescore.test.mjs` 原来把**三条**记录（完美 / 缺字段 / 没测到）写成同一个 `(kind, file, lang)`，
靠「出现几次算几行」凑出 `cases = 3`。那正是要去掉的语义 —— 它是**复用同一把钥匙**，
不是三条用例。改成三条不同 `file`（`gold` / `worse` / `error` 后缀）后，断言（分母含错误行、
编译分母只数有产物的行）逐条不变，语义仍成立。

#### 验证

```
node scripts/eval/replay.test.mjs     ✅ 只放没测到 / 只一遍 / 死中继即停 / 上限 / 计数对账 / 判据单源
node scripts/eval/dump.test.mjs       ✅ + 第 6 节：同一行写两次 ⟹ 只算一行、后写覆盖先写、键含 lang
node scripts/eval/rescore.test.mjs    ✅ 分母完整 / 95% 定义 / 编译门 / --expect 双向
node scripts/eval/artifact.test.mjs   ✅ 55 条判据（+ 4 条 replay 对账反例）
npx eslint <改动的 9 个文件>          0 error
```

`check:replay` 已进 `check:consistency`（紧跟 `check:dump`）。**运行时证据待下一次能跑模型的批次**
（本地 PPIO 预算与京东云配额都还没恢复，见 §11.10）—— 这次落地的是**策略与不变式**，
它们全部有离线自测；驱动侧（`runCrudEntry` / `runFragmentEntry` → `commit*`）走的是与旧循环
逐行同构的路径，`eslint` 无 `no-undef` 报错、`node --check` 通过。

> **一句话**：重放不改变「什么是成绩」，只改变「一次抖动会让几条成绩消失」；
> 而它必须付出的代价是**分母不变式要能被产物自己核对**，否则它就是分数自增器。

### 11.12 D 阶段（离线部分）：`expandConfig.title` 是不可测量键 ✅（2026-10-29）

**怎么发现的**：拿 §11.8 的 C 阶段 dump 做逐维失败诊断（`.tmp-audit/dim-rows.mjs`，读 dump 不调模型）。
`expandConfig` 维度 9 条失败，**每一条都只差 `title`**：

```
62-supplier-expand-index.json   gold title="联系方式"   pred title="供应商详情"
75-invoice-expand-title.json    gold title="开票信息"   pred title="发票信息"
```

（10 行标题不同：`62 65 66 69 70 72 73 75 76`，另加 186。）

**根因**：§11.1 的装饰键投影规则是「同一位置的装饰键，只要**任一侧没写**，两侧都不比」。
`title` 是散文标题，模型与 gold **总会各写一个** ⟹ 豁免条件恒不成立 ⟹ 这个键每次都被比值。
而 NL 从不陈述它：全语料 216 例里没有一例在 NL 里点名展开区标题
（186 的 title「明细」被 NL 的「备注明细」包含，但那句说的是*展开后能看到什么*，不是*标题叫什么*）。
于是这 9 条在尺子上**结构不可过**，模型无从推断。

**§11.1 的一处错判（本次更正）**：那里写「0a 直接解锁 22 行（`columns` 11 + `expandConfig.title` 11）」。
前半句实测成立，后半句是**纸面推断**——当时的验收用的是一个「结构全对、装饰全没猜」的合成完美模型
（两侧都缺装饰键，豁免恰好触发），真实 pred 两侧都写 title，豁免从不触发。
「合成样本通过」不等于「真实产出通过」，这条教训写在这里而不是改在 §11.1 里：原文的推理链要看得到错在哪。

**改了什么**

| 文件 | 改动 |
|---|---|
| `scripts/eval/scorers.mjs` | 新增第三种分类 **`unmeasured`**（`EXPAND_KEY_CLASS.title`），`projectExpandNode` 对这类键**无条件**从两侧删除；头注写明它与 `decoration` 的区别（豁免条件「单侧缺失」对两侧都写的键永不成立） |
| `scripts/eval/scorers.test.mjs` | 2e 把「两侧标题不同应判负」翻成**应判正**（并加对称断言 + 「只改字段仍判负」证明维度没睡）；语料投影自检把 `unmeasured` 一并删（删完 gold 少 title、pred 仍有 ⟹ 必须仍判正）；扰动表 `expandConfig` 改用**结构键**（`fields[0].label`），否则得到一条永远咬不住的假红 |
| `scripts/eval/dump.mjs` | `RULER_VERSION` 追加一段：`label-identity-v1+deco-projection-v1+unmeasured-expand-title-v1`（同一份 pred 得不同分 ⟹ 必须换串） |
| `__tests__/golden/accuracy-baseline.json` | 头注里「首跑后写回」的版本串同步（该字段仍为 `null`，只改注释） |

**边界守卫**：`unmeasured` 的前提是「NL 从不陈述它」。语料体检新增一条 —— 若某例的 NL 在**引号内**
点名了展开区标题（「展开区标题写处理信息」），直接红，逼作者二选一：删掉这个期待，
或把它升回 `structural` 走正式口径。只认引号内文本：裸串匹配会误伤 186（title「明细」被「备注明细」包含）。

**实测（同一份 C 阶段 dump，只有尺子不同）**

| 指标 | 改动前 | 改动后 | Δ |
|---|---|---|---|
| 95% 定义（门禁 ∨） | 69.1%（134/194） | **73.7%（143/194）** | **+9 行 / +4.6 pp** |
| scoped HELDOUT | 63.9% | 68.6% | +4.7 pp |
| 逐维失败行总数 | 60 | **51** | −9 |
| `expandConfig` 维度失败 | 9 | **0** | −9 |

**+9 与「10 行标题不同」的差额有名字**：186-dept-merge-with-expand-vue3 的 gold/pred 标题也不同
（明细 → 备注明细），但它的 `pinnedDims` 是 `["propSet","actions","mergeConfig"]` —— **不 pin
`expandConfig`**，这处差异本来就没进门禁。其余 9 行都 pin 了 `expandConfig`，逐行核对后全部翻转，
没有一行因为这次放宽而在别处变红（`check:scorers` 的 gold-vs-gold 与 26 个维度扰动全绿）。
**先对账再宣布**：+9 这个数字是从上面的口径解释出来的，不是数出来的期望值。

**复现**

```bash
node scripts/eval/rescore.mjs .tmp-audit/full-c-merged.jsonl   # 73.7%（143/194）
git stash push -- scripts/eval/scorers.mjs && \
  node scripts/eval/rescore.mjs .tmp-audit/full-c-merged.jsonl && git stash pop   # 旧尺子 69.1%
node scripts/eval/scorers.test.mjs                             # ✅ 含 title 两条新语义
npm run check:scorers|check:rescore|check:ratchet|check:artifact-self|check:dump|check:replay   # 全绿
```

> **一句话**：装饰键的豁免条件是「有一侧没说」，而**两侧都会说的散文**需要的不是豁免而是
> **不参与比较**——分类表里必须留出这一类，否则「模型猜不到」会一直伪装成「模型写错了」。

