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
| **准确率 ≥95%** | `definition95 = 22.7%（44/194）`；zero-edit 腿 `19.6%（38/194）` | ❌ 未达，且**当前这个 22.7% 里有一大半不是模型能力问题** |
| **全场景** | 四场景语料+编译齐了，但**准确率只有 CRUD 腿进门禁**；片段腿 55.6% 与同语料探针 93.7% 差 38pp | ⚠️ 可测 ≠ 测对了 |

**根因排序（今日复算 + 既有日志，可复现）**

1. **尺子**：字段身份按 `prop` 精确判等，而 `prop` 在 NL 里**只出现 3.8%**（40/1041），`label` 出现 **98.4%**（1024/1041）⟹ 零编辑腿被**结构性封顶**。
2. **语料**：`53/216` 个用例在 gold 里写了 **120 个** `inQuery:false`，而 NL **没有任何查询措辞** —— 模型只能猜；这与日志里观测到的 **111 次 want-false-got-true** 几乎一一对应。
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
| **`membership`** | **63.4%** | 大半是**语料不可推断**（见 D2） |
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

- **证据（今日复算）**：全语料 1041 个字段，`prop` 字面出现在 NL 的 **40（3.8%）**，`label` **1024（98.4%）**；同一 case 内 `label` **0 重复**（可单射）。
- **证据（既有日志）**：`accuracy-95-ruler-v3-design.md:107-125` —— `propF1 < 1` 的 **129/210 行 scoped 通过率 0.0%**，其中 **125 行 gold label 全在 NL 里**；这 129 行被 `columns/isHidden/expandConfig/dialogs/tableBtns/extPoints/editConfig/reactions` 挡住，而这些维度**全部以 prop 为键**。
- **性质**：尺子缺陷（R2 已裁决：`label` 作身份 + `prop` 降为观测量），**不是放水**——仓库里 PRD 腿、AN-19、AI-46 早已这么判，只有 CRUD 主腿没对齐。
- **影响**：零编辑腿封顶；`propSet` 36.1%；连带 8 个 prop-keyed 维度大面积假负。
- **修法**：`scripts/eval/align.mjs`（`alignFields` 单射 + `normalizePredForCompare` 白名单重写）+ `scorers.mjs` 全部维度改走对齐结果 + 新增观测量 `propNameMatch`。测试矩阵见 ruler 文档 §8.4（12 条）。**不喂 gold、不动 AN-01、不改语料。**

### D2 · 【语料·HIGH】53 个用例的 membership 在 NL 里没有依据

- **证据（今日复算）**：`216` 个 CRUD 用例中，**144** 个有查询措辞（查询/筛选/搜索/检索/过滤/条件）；**53** 个**完全没有**查询措辞，但 gold 里写了 **120 个** `inQuery:false`（占这 53 例 169 个字段的 71%）。样例：`03-order-tablebtns`（NL 只说「表格列有…」，gold 把 `金额` 设 false）、`10-category-cascader`（`层级/排序` false）、`100-stock-adjust-edit`（`调整数` false）。
- **证据（既有日志）**：`membership` 24 行失败、field 级 **140 次 miss，其中 111 次 want-false-got-true**（ruler 文档 §3）——与 **120** 这个数几乎一一对应。
- **性质**：语料不可推断（违反本仓自己的标注原则「只钉 NL 表层无歧义锁定的那一点」，ruler 文档 §2.2 引 wave-2）。
- **影响**：`membership` 63.4%；且因为它 **`applicable: () => true`**（`scorers.mjs:408`），**每个用例都在判它**，即使 `pinnedDims` 没写。
- **修法（推荐）**：给这 53 例的 NL **补一句查询条件**（如「查询条件：订单号、下单时间」），**gold 一个字节不改** —— 这是「让 NL 说清它本来就想要的东西」，不是放松判据。
  - **不推荐**：删 gold 的 `inQuery:false`（会让这 53 例不再考查询面推断，能力静默丢失）。
  - **不做**：让 scorer 忽略未 pin 的 membership（会削弱「每个 CRUD 页都有查询栏」这一基础能力）。

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

### D6 · 【全场景·HIGH】片段腿 55.6% vs 同语料探针 93.7%：38pp 未解释

- **证据**：`last-accuracy.json.fragments`（2026-10-22，`claude-opus-4-6`）scoped **55.6%**、byScene table 42.9% / form 57.1% / dialog 66.7%；而 `--fragments` 全量探针（`deepseek-v4-pro`，63/63 实测）迭代到最后一次是 **core 95.2% / scoped 93.7% / full 88.9% / compiles 100%**（`ROADMAP.md:528`，2026-10-20，AI-52 基线；更早的 2026-10-19 探针是 scoped 77.8%，`ROADMAP.md:436`）。
- **性质**：**待判**——三种可能：① 模型差异（opus-4-6 在这套片段契约上确实更差）；② 中继降级（`servedModel` 报的是别名）；③ 口径漂移（探针与门禁跑批之间改了 prompt/判据）。
- **影响**：这是「全场景 ≥95%」目前**唯一有数字的场景级证据**，38pp 的差必须先解释，否则任何结论都不可信。
- **修法**：用**同一模型 + 同一 commit** 跑一次 `--fragments`（不写产物），与 10-22 的片段块对照；再跑一次 `--limit 3` 确认中继是否真在服务该模型（看 `servedModel`、`degradedCalls`、每行耗时）。**先诊断，再谈门禁。**

### D7 · 【编译覆盖面·LOW/MED】100% 是真的，但分母有边界

- **证据**：`computeCrudMetrics` 只对 `lang === 'zh'` 聚合编译（`scripts/eval/run-metrics.mjs:46,85`）；en 腿 191 行有打分但**不进编译门**；Tier B 类型腿每端抽 10 例（`typecheck.samplePerTarget: 10`）。
- **性质**：覆盖面边界（不是缺陷数字）。
- **修法**：① en 行也进编译分母（它的 `compiles` 已经算了，只是没聚合）；② 类型腿从抽样改为**全量**（确定性、无 API 成本，代价是时长）；③ 补一组**转义/属性名 fuzz 语料**（`check:generator-escaping` 已登记残留的 `prop` 含引号类），把「compile 100%」从「这 216 个碰巧过」变成「这类输入结构性过」。

### D8 · 【度量可靠性·HIGH（过程）】P0 已落地但从未真实跑过；夜间疑似断供

- **证据**：`RULER_VERSION = 'prop-identity-v1'`（`scripts/eval/dump.mjs:42`）说明尺子还没换；ruler 文档 §13.4 的下一步（`--dump-pred` + `rescore --expect`）**尚未执行**——即 dump 路径只有单测，没有一次真实全量产物验证过。`last-accuracy.json` 最后一次完整测量是 **2026-10-22**，10-23 由本地跑批替换过「measurement failed」的夜间产物；**此后 4 天无徽章回写提交**（本机无外网，无法拉 Actions 日志确认是「跑挂了」还是「没跑」）。
- **性质**：测量管道可靠性。若不先修，D1/D2 的效果**无法在付钱之前预测**，只能一次次付费跑。
- **修法**：① 先跑一次 `--dump-pred` 全量（这本来就是 P1 的前置），并用 `rescore --expect` 复现 22.7%——**复现不了就先修管道**；② 夜间加健康门：产物 `measurement !== 'complete'` 时徽章回灰 + 显式报「未测到」，而不是停在旧数字（F6 同类）。

### D9 · 【组件/契约面·MED】「全场景」的宣称边界

- **证据**（`docs/ai/ai-capability-matrix.json`，现场生成）：41 个能力令牌中 **24 声明式 / 22 前门一步可达 / 2 仅 from_config**；15 个三端能力里 **8 个三端 full**；`tableOptions.virtual` **vue2 = none**；`rowHeight/estimatedRowHeight/overscanCount` 仅 vue3 部分支持；`engine:'virtual'` 三端虽可用但语义不同（AI-38 已登记/教学）。
- **性质**：设计边界（D 档 = 宿主编排，已写进公开文档），**不是缺陷**；但「全场景」四个字必须带上这张表，否则就是把 D 档说成 A 档。
- **修法**：站点/README 的「全场景」文案与 `ai-capability-matrix.json` **同源**（已有 `check:site-claims`，需扩到「能力矩阵数字」而不只是断言存在）。

### D10 · 【治理·MED】门禁长期红 ⟹ 红盲

- **证据**：`passed: false`（def95 22.7% < 95%；片段 scoped 55.6% < 地板 77.8%），已持续多日。一个每天红、且离目标 72pp 的门禁，**不会保护任何回归**。
- **性质**：治理缺陷（不是数字缺陷）。
- **修法**：在 95% 达成前，门禁改为「**不劣化 + 阶段棘轮**」：`definition95 ≥ 基线` ∧ `core ≥ CORE_FLOOR` ∧ 逐维 rate ≥ 基线 ∧ 零未测到；绝对 95% 继续**公布**但不作 exit code 的唯一条款。阶段棘轮按 §4 的预期逐段上调（人工 PR 写入，不由脚本回写 —— 沿用 `accuracy-baseline.json` 的既有规则）。

---

## 4. 可行方案（阶段、验收、成本）

> 原则：**先修尺子 → 再修语料 → 再谈教学 → 最后才动模型侧**。每一步都必须能被「同一份 dump 复算」验证，否则又回到「改一次 prompt 付一次钱、还分不清是尺子还是能力」。

### 阶段 A · 尺子（0 模型成本，1–2 天）—— 对应 D1

| 动作 | 验收（变异 → 红） |
|---|---|
| `scripts/eval/align.mjs`：`alignFields`（label 归一化精确匹配 + 单射 + 兜底 prop）+ `normalizePredForCompare`（白名单，8 类结构） | 12 条测试矩阵（ruler 文档 §8.4）先写先红：改名不改 label ⟹ 全维 pass；`treeConfig.childrenField` 不被误改；`extPoints.render` 内容变了仍 pass |
| `scorers.mjs` 全部维度改走对齐结果；新增 `propNameMatch` 观测量 | 旧断言（同 label 同 prop）逐字节不变；`byDimension` 键集不变（不新增维度） |
| `RULER_VERSION → 'label-identity-v2'`；`--fixed-fields` 仍为诊断开关 | 产物写版本号；`check:artifact-freshness` 不因版本变化误红 |

**预期**：可证下界 **+25 行（→34.3%）**（ruler 文档 §9.1），上限不可预设（§9.2）。**这一步不需要跑模型**——但要等阶段 C 的 dump 才能得到点估计。

### 阶段 B · 语料确定性（0 模型成本，半天）—— 对应 D2

| 动作 | 验收 |
|---|---|
| 53 个用例的 NL 补「查询条件：…」（gold 不动） | 复算脚本：**0 个**用例「无查询措辞却有 `inQuery:false`」；`check:membership-trap` 扩一条「gold 的每个 false 都能在 NL 里找到依据（关键词窗口内）」 |
| 复核 4 个 `fixedFields` 真子集例（`04/13/30/58`） | 不动（它们是「给定字段」语义的合法子集） |

**预期**：`membership` 从 63% → 85–90%（依据：111/140 次 miss 落在这 53 例上）。

### 阶段 C · 一次全量 + 双尺子复算（1 次付费，~3.5 h）—— 对应 D8

```bash
npm run build:libs
ESPLUS_EVAL_KEY… node scripts/eval-llm.mjs --dump-pred .tmp-audit/pred-<date>.jsonl
node scripts/eval/rescore.mjs .tmp-audit/pred-<date>.jsonl --expect __tests__/golden/last-accuracy.json  # 必须逐字段复现旧口径
# 换 v2 尺子复算同一份 dump → 得到精确 delta（不额外付费）
```

**验收**：① 旧尺子复现当次产物（不一致 ⟹ 先修 dump）；② 新尺子给出 `definition95`、`propNameMatch`、近失分布；③ 把「D4 的真内容缺口」按维度列出来（此时失败集才准）。

**这是整条路线唯一的必经付费点**——在此之前不要改 prompt。

### 阶段 D · 教学补齐（1 次付费验证）—— 对应 D3/D4

按阶段 C 的真失败集逐类消：`tableBtns` 文案/位置 → `dialogs` 底座键 → `columns.groups` → `reactions` → `expandConfig`。
每条 few-shot **必须同时**登记 `FEWSHOT_DERIVED`（否则 heldout 被污染，`check:fewshot-registration` 会红）。

### 阶段 E · 收敛腿（1 次付费验证）—— 对应 D5

目标 ≥80%（+4pp 左右）。**排在 D 之后**，因为收敛用的纠正话术依赖真失败集。

### 阶段 F · 全场景收口（0 模型成本 + 1 次探针）—— 对应 D6/D7

| 动作 | 验收 |
|---|---|
| 片段腿诊断：同模型同 commit 跑 `--fragments`，与 10-22 片段块对照 | 38pp 差有书面归因（模型 / 中继 / 口径） |
| 片段地板重新取证（**不下调**）：按当前契约跑一次，写进 `accuracy-baseline.json` | 人工 PR 写入 + `_comment` 记录来源 |
| 片段进门禁（结论未定时**先不门禁**，但要有「不劣化」棘轮） | 片段 scoped ≥ 新基线 |
| en 腿进编译分母 + typecheck 全量 + 转义 fuzz 语料 | 编译率仍 100%，且分母从 216 → 407+ |

### 阶段 G · 度量可靠性（持续）—— 对应 D8/D10

- 夜间健康门：`measurement !== 'complete'` ⟹ 徽章回灰 + 明确「未测到」，**不许停在旧数字**；
- 门禁改「不劣化 + 阶段棘轮」，95% 继续公布；
- `accuracy-baseline.json` 的棘轮值按阶段人工上调：`0.35 → 0.55 → 0.75 → 0.90 → 0.95`。

---

## 5. 95% 的可达性判断（诚实版）

| 阶段完成后 | 预期 `definition95` | 依据 |
|---|---|---|
| 今天 | **22.7%** | 产物 |
| A（尺子） | 34–45% | 可证下界 34.3%；上限不可预设 |
| A+B（+语料确定性） | 45–60% | membership 63%→85%+ 的折算 |
| +D（教学） | 60–75% | tableBtns/dialogs/columns 从 3/13、3/15、4/32 抬到 60%+ |
| +E（收敛） | 70–85% | 收敛腿最多 +10pp，且只在普通用例 ≥85% 时才有意义 |
| **95%** | **需要 D4 的每个维度都接近满分** | 算术：普通用例 ≥155/164 |

**结论**：95% 在「四场景 + 216 例语料」的口径下是**可达但极难**——它要求零编辑腿在**每一个 pinned 维度**上都接近满分，而当前最难的四个维度（columns/reactions/expandConfig/isHidden）都还是 12–19%。**不要承诺 95%**；用上面的阶段棘轮把「进展」变成可验收的东西，同时保留「若 D 阶段后普通用例 <70%，则重新评审语料代表性（是否把过多高级特性塞进 heldout）」的决策点。

**三条出路（按推荐序）**

1. **把 NL 说清（阶段 B）+ 把尺子修对（A）+ 把教学补齐（D）** → 真实能力达标；
2. **收敛定义下达标**：`≤K` 收敛是产品实际使用路径（TypeChat 同构），门禁是 ∨，不是 one-shot；
3. **达不到就改口径**——**必须走评审**，且不得因此删难例（`check:ratchet` 已有防洗分，需扩到「删语料」）。

---

## 6. 不做清单（避免走错方向）

- ❌ **不恢复 `--fixed-fields` 进正式批**（AN-01 的核心决定；那会让 `propSet` 变成抄写保真度）。
- ❌ **不做 label 模糊匹配**（拼音/编辑距离）——只做归一化精确匹配 + 近失集公布。
- ❌ **不为变绿下调片段地板**（77.8% 口径过期，要**重新取证**，不是下调）。
- ❌ **不把片段混进 CRUD 的 95% 分母**（两套能力的回归信号会互相钝化）。
- ❌ **不先改 prompt 再改尺子**（会把命名噪声当能力信号调）。
- ❌ **不改 gold 去迎合模型**（阶段 B 补的是 NL，不是 gold）。
- ❌ **不混用历史数字**（55.5% / 22.7% / 93.7% 三个数各自的口径在 §1 已写明）。

---

## 7. 风险登记

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| 修尺子被看成「放水」 | 数字一次性大涨 | 同时公布 `propNameMatch`、近失集；12 条反向测试钉住「改名以外仍判负」 |
| 阶段 B 被看成「改语料洗分」 | 补 NL 后分数上升 | 补的是 NL 不是 gold；`check:membership-trap` 扩「每个 false 有 NL 依据」；语料 hash 进产物 |
| 片段 38pp 是模型问题 | 同模型复跑仍 55% | 那就如实写「片段腿在该模型上不达标」，并把它作为**选型依据**（模型也是系统的一部分） |
| 夜间一直是断的 | 无徽章回写 | 阶段 G 的健康门；必要时改为「提交失败也落 artifact」 |
| 95% 长期不可达 | 阶段 D 后 <70% | 决策点：评审语料代表性，或承认 95% 是 ∨ + 收敛口径下的目标 |

---

## 附：本报告用到的复算命令（可重跑）

```bash
# 字段身份可推断性（今日复算：40/1041 prop、1024/1041 label、0 重复 label）
node -e "…"   # 见本次会话脚本；读 __tests__/golden/cases/*.json

# membership 不可推断面（今日复算：144 有查询措辞 / 53 无措辞但有 false / 120 个 false 字段）
node -e "…"

# 当前分布
node -e "const a=require('./__tests__/golden/last-accuracy.json');console.log(a.byCapability)"
```
