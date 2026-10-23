# 准确率口径修正与 95% 路线设计（Ruler v3）

> 状态：**评审已裁决（2026-10-23）** —— D1 = **R2（label 作身份 + prop 观测）**；**先落 P0 再跑全量**。
> 本文其余部分保留评审前的论证原貌（含被否证的假设），裁决与落地记录见 §13。
> 上游：[Wave 1 — 评测可信](./wave-1-eval-trust-design.md)、[Wave 2 — 生产可信](./wave-2-production-trust-design.md)、
> [AI-NATIVE-REMEDIATION-PLAN.md](../../packages/mcp-server/AI-NATIVE-REMEDIATION-PLAN.md)。
> 触发：2026-10-22 全量跑批 `definition95 = 22.7%（44/194）`、`core = 15.5%`、片段 `scoped = 55.6% < 地板 77.8%`。

---

## 0. 摘要

2026-10-22 的 3.5 h 全量测量是**有效**的（`scoredRows 407`、`erroredRows 0`、`notMeasured 0`、`compileRate 100%`、`typecheck 100%`、`servedModel claude-opus-4-6`），
但它**不可与旧的 55.5% 相比**：语料扩了（186→216 / heldout 164→194）、AN-01 收紧了 scorer、模型换了、且 **`fixedFields` 不再喂给模型**。

复核后，22.7% 的成因被拆成四份，其中最大一份是**尺子与自身设计不一致**：

| # | 成因 | 证据强度 | 归属 |
|---|---|---|---|
| A | 字段身份按 `prop` 精确判等，但 prop 既不可从 NL 推断、也不由契约给定 | **强（可证）** | 尺子缺陷 |
| B | 与字段命名耦合的维度（columns/isHidden/expandConfig/dialogs/reactions/extPoints…）连带判负 | **强（可证）** | 尺子缺陷 |
| C | 真实内容缺口（membership 的 inQuery、tableBtns 未声明、reactions/columns 内容错） | **强（可证）** | prompt/能力 |
| D | 收敛腿 16/30，且 95% 的算术要求普通用例 94.5% | **强（可证）** | 能力 + 口径 |

**需要拍板的只有一件**（§5 D1）：**字段身份用 `prop` 还是 `label`**。它决定 95% 到底是「语义零编辑」还是「字面零编辑」。
其余（P0 预测落盘、产物同步、地板治理）都是不论选哪条路都要做的事。

---

## 1. 复核方法

三条独立证据线，全部只读，未改任何文件：

1. **es-plus 源码线**：字段身份在 `packages/shared` / `packages/core` / `packages/vue3` 中的真实语义（谁读 `prop`、谁读 `label`、哪些结构引用 prop）。
2. **评测代码线**：`scripts/eval-llm.mjs`、`scripts/eval/scorers.mjs`、`scripts/eval/ratchet.mjs` 的打分与落盘路径。
3. **设计与治理线**：`docs/internal/*`、`packages/mcp-server/*.md`、`accuracy-baseline.json` 的 `_comment`、守卫脚本。

外加对 279 个语料文件与其 NL 的**确定性统计**（脚本可复算，§3 全部数字均可由一段 node 脚本重现）。

---

## 2. 事实校准（逐条带证据）

### 2.1 `prop` 与 `label` 的源码语义

| 事实 | 证据 |
|---|---|
| `FieldConfig.prop` 与 `.label` **均为必填**；`prop` 被描述为 "Field key in the data model (camelCase)" | [structured-config.schema.ts:224-235](../../packages/shared/src/structured-config.schema.ts#L224-L235) |
| `prop` 承担**全部绑定**：表单 v-model 路径、表格列取值、查询/提交负载键、配置合并主键、reactions 写回目标、merge 列、插槽名 `column-<prop>`、i18n 默认键 `field.<prop>` | [use-form-inputs.ts:73-79](../../packages/vue3/src/composables/use-form-inputs.ts#L73-L79)、[structured-generator.ts:1885-1889](../../packages/shared/src/structured-generator.ts#L1885-L1889)、[compose-crud-config.ts:125-129](../../packages/shared/src/compose-crud-config.ts#L125-L129)、[merge-span.ts:61-67](../../packages/core/src/merge-span.ts#L61-L67) |
| `label` **只用于展示**：列头、表单项、校验文案、展开行标签；弹窗标题来自 `dialogs[k].title`（与 label 无关） | [structured-generator.ts:1889](../../packages/shared/src/structured-generator.ts#L1889)、[es-form.vue:228-233](../../packages/vue3/src/components/es-form/src/es-form.vue#L228-L233)、[column-item.vue:159-166](../../packages/vue3/src/components/es-table/src/column-item.vue#L159-L166) |
| 源码**不存在**任何 label→prop 的确定性映射（无拼音/英译/`toCamelCase(label)`） | 全仓检索零命中 |
| `isHidden` / `reactions` 以**表单 model**（键 = prop）求值；`{var:"x"}` / `dependencies` / 旧条件 `{field}` 引用的都是 prop 名 | [expr.ts:159-162](../../packages/core/src/expr.ts#L159-L162)、[field-resolver.ts:56-68](../../packages/core/src/field-resolver.ts#L56-L68)、[reactions.ts:162-201](../../packages/core/src/reactions.ts#L162-L201) |
| `treeConfig.childrenField` 是**行数据键**，不是字段 prop（改名陷阱） | [structured-config.schema.ts:752-759](../../packages/shared/src/structured-config.schema.ts#L752-L759) |
| `columns` 多级表头的键是 **`groups`**（不是 `children`），递归 | [structured-config.schema.ts:283-347](../../packages/shared/src/structured-config.schema.ts#L283-L347) |
| `columns` 是 **override 逃生口**：「省略即保持派生的一字段一列」 | 同文件 `:731` 的 describe |

**结论**：`prop` 是运行时的身份与绑定键；**语义身份是 `label`**。从 NL 推断 `prop` 在设计上是「语义英译 + camelCase」的经验猜测，不是可证映射。

### 2.2 设计文档自己怎么说

| 原文 | 位置 |
|---|---|
| 「把契约已定的 prop 名**给定**，只考核真正该推断的部分（formtype / membership / layout），**而不是让模型从中文 label 猜 camelCase**」 | [prompt.mjs:88-96](../../scripts/eval/prompt.mjs#L88-L96) |
| 「评分身份用 **label** 而非 prop：spec 给的是中文标签，prop 是命名选择，不应算第一英里的错」 | [AI-NATIVE-REMEDIATION-PLAN.md:756](../../packages/mcp-server/AI-NATIVE-REMEDIATION-PLAN.md)（AN-19） |
| `labelOf(field) = normalizeLabel(field?.label ?? field?.prop)`，且**已实现并测试** | [prd-leg.mjs:51-53](../../scripts/eval/prd-leg.mjs#L51-L53)、[prd-leg.test.mjs:56-57](../../scripts/eval/prd-leg.test.mjs#L56) |
| 「中文 label→camelCase prop 变成**命名彩票**」 | [ROADMAP.md:418](../../packages/mcp-server/ROADMAP.md)（AI-46） |
| 「只钉 NL 表层无歧义锁定、且评分器能忠实捕捉的那一点」 | [wave-2:150-155](./wave-2-production-trust-design.md) |

**结论**：按 label 评分**不是新发明**，而是仓库已实现（PRD 腿）、已命名（AI-46）、已写进原则（wave-2 标注原则）的做法；
CRUD 主腿是唯一还没对齐的实现。AN-01 移除 `fixedFields` 之后，这个缺口从「靠喂字段掩盖」变成「裸奔」，才暴露出来。

### 2.3 语料统计（可复算）

| 指标 | 数值 |
|---|---|
| 语料文件 | 279（216 CRUD + 63 片段） |
| 字段总数 | 1041 |
| **prop 字面出现在中文 NL 里** | **40 / 1041（3.8%）**，且多为 `ip` / `sku` / `amount` / `points` 这类本身即英文的 token |
| **label 出现在 NL 里** | **1024 / 1041（98.4%）** |
| 唯一 label / 唯一 prop | 434 / 379 |
| **同一 label 对应多个 prop** | **43（9.9%）**，例：用户名→`username`\|`userName`；商品名→`name`\|`productName`\|`goodsName`；排序→`sort`\|`sortOrder` |
| 同一 prop 对应多个 label | 57 |
| **同一 case 内 label 重复** | **0**（对齐可单射，无歧义） |
| 无 `label` 的字段 | **0** |
| 使用 `labelKey` 的字段 | 11（`FieldConfig.label` 仍必填，身份不受影响） |
| `fixedFields` 与 gold prop 集 | 275/279 完全相同、4 例为真子集（`04`/`13`/`30`/`58`） |
| `pinnedDims` | 279/279 有标注；**439 个字段级 token**；`propSet` 被 pin 在 271 例 |

**关键反例**：`prompt.mjs` 的 few-shot 写的是 `{ prop:'username', label:'用户名' }`，而 [167-user-cachepageselection-vue3](../../__tests__/golden/cases/167-user-cachepageselection-vue3.json) 的 gold 是 `userName`。
**照提示词写反而判负** —— 这不是能力差距，是命名彩票。

### 2.4 AN-01 的边界

- AN-01（`3b30d00`，2026-10-21 09:07）规定门禁跑批**不注入** `fixedFields`，并让 `fixedFieldsUsed:true` 的产物不可发布（[check-artifact-freshness.mjs:6-7](../../scripts/check-artifact-freshness.mjs#L6-L7)）。
- 其论证是「fixedFields 让 propSet 98.9% 变成抄写保真度」——**这一点成立，不应回退**。
- 但它同时**留下了** `propSet` 的 pin 与 prop 精确判等，于是「既不给、又要猜」。
- 门禁跑批里 `fixedFields` 恒为 `undefined`（[eval-llm.mjs:467-469](../../scripts/eval-llm.mjs#L467-L469)）；片段腿同规矩（`:632-635`）。

### 2.5 片段地板的出处（重要）

`accuracy-baseline.json` 的 `fragmentScopedMin = 0.7778` 来自 **2026-10-19 的 deepseek-v4-pro 探针**，
而 AN-01 落在 **2026-10-21**。同文件 `_comment` 自己写明「2026-10-19 的 51.2% 是修 AN-01 之前的口径（fixedFields 泄漏）」。
⟹ **片段地板与当前输入契约不同源，55.6% 不是回归，是口径不可比。** 处理方式见 §9-P5（重新取证，不是下调）。

---

## 3. 本次失败集的分解（2026-10-22 跑批日志，210 条可解析 zh 行）

| 分层 | 行数 | scoped 通过 | 说明 |
|---|---|---|---|
| `propF1 = 1.00` | 81 | **47（58.0%）** | 字段名全中 → 内容基本正确 |
| `propF1 < 1.00` | 129 | **0（0.0%）** | **零编辑腿被结构性封顶在 38.6%** |
| ↳ 其中 `attr = 1.00` | 85 | 0 | 只差字段集合/命名，属性全对 |
| ↳ 其中 gold label 全在 NL 里 | 125 / 129 | — | 语义可推断，缺的只是名字 |

`propF1<1` 的 129 行被哪些 pinned 维度挡住（行级计数，可多重）：

```
columns 20 · isHidden 19 · expandConfig 10 · dialogs 9 · tableBtns 8
extPoints 7 · editConfig 7 · reactions 7 · membership 3 · mergeConfig 3 …
```

**这些维度全部以 `prop` 为键或整体深等值**（§8.2），所以 B 类成因是 A 类成因的放大器。

`propF1=1` 的 34 行失败（真内容缺口）：`membership 24`（其中 `inQuery` 140 次 miss 里 **111 次是 want-false-got-true**）、`columns 8`、`dataOptions 7`、`reactions 4`、`actions 4`。

收敛腿：30 例里 turn-0 已过 10、≤3 轮收敛 16（53%）。

---

## 4. 原方案逐项复核（成立 / 修正 / 否证）

### P0 预测落盘 + 离线复算 —— **成立，且必须最先做**

现状：`scripts/eval-llm.mjs` 只写 3 个产物（[artifact.mjs:27-29](../../scripts/eval/artifact.mjs#L27-L29)），**预测配置从不落盘**（`rows.push` 不含 `pred`，[:534](../../scripts/eval-llm.mjs#L534)）。
⟹ 每改一次尺子 = 3.5 h + 一份配额，且失败不可复盘。**这是当前最大的过程缺陷。**

### P1 字段语义对齐 —— **成立，但要改写**（原方案只说改 `propSet`，不够）

原方案只改 `propSet` 只能拿回**下界 +25 行（→33%）**，因为 129 行里的阻断维度全是字段级。必须改为**共享原语 + 全维度投影**（§8）。

### P1 附带假设的两个**否证**（复核的价值所在）

| 假设 | 复核结果 |
|---|---|
| 「gold 声明 `columns` 但内容等于派生列 ⟹ 省略 columns 被误判」 | **否证**。34 例声明 columns，其中 **24 例是多级表头（`groups`）**、8 例含 `type`/`width` 等自定义；真正「纯派生」只有 **2 例**，其中 pin 了 `columns` 的只有 **1 例**（[61-contract-column-permission](../../__tests__/golden/cases/61-contract-column-permission.json)）。⇒ 不值得为它改判据。 |
| 「gold 声明 `dialogs` 但内容等于 legacy 派生 ⟹ 省略 dialogs 被误判」 | **基本否证**。15 例声明 dialogs，**只有 1 例**（[189-tablebtns-left-right-vue3](../../__tests__/golden/cases/189-tablebtns-left-right-vue3.json)）与 legacy 派生等价（仅 title 不同，而 title 本就**不参与** `dialogsEqual`）。其余 14 例都带自定义 formItems/底座键/configBtn。⇒ 可作为 1 例的可选修正，不构成主因。 |

### P3 tableBtns —— **成立，但归类要改**

日志里 8+ 例 `tableBtns: want 导出/新增… | got （无）`：模型**完全没声明** toolbar 按钮。
源码上这不是「派生等价」：省略 `tableBtns` 时工具栏按 `actions` 派生（[crud-actions.ts:60-90](../../packages/core/src/crud-actions.ts#L60-L90)），
但派生出来的文案是「导出/新增」，而 NL 要的是「批量导出/新增订单」，位置（left/right）也丢失。
⟹ **这是真实内容缺口（prompt 未教「自定义文案/位置必须显式声明 tableBtns」），不是尺子问题。**

### P5 地板与基线 —— **成立，但绝不下调**

- `CORE_FLOOR = 0.2`（[ratchet.mjs:30](../../scripts/eval/ratchet.mjs#L30)）当前红（core 15.5%）。P1 落地后 core 若随字段身份修正回升，**无需动它**；若仍低于 0.2，再按「计数/比率分开治理」重新取证。
- `fragmentScopedMin = 0.7778` 口径过期（§2.5）⟹ **按当前契约重新取证后由人工 PR 写入**，不得为了让红变绿而下调。
- 基线比例字段（`definition95`/`coreRate`/`byDimension`）继续按 `_comment` 的规则：**只由人工 PR 写，不由脚本回写**。

---

## 5. 决策点 D1：字段身份用 `prop` 还是 `label`

这是唯一需要拍板的架构决定。三个选项：

### R1′ 恢复「宿主给定字段契约」（不改尺子）

- 做法：把 `fields`（prop 名）像 `target`/`mode` 一样列为**宿主给定输入**（F9 先例：`givenInputs: ["target","mode","fields"]`），门禁喂入 `buildFieldsLine`。
- 优点：`prop` 是绑定键，给了它就真正「零编辑」；与真实产品一致（宿主永远知道自己的后端字段）。
- 代价：**推翻 AN-01 的核心决定** + 改写 `check-artifact-freshness` 的判据；`propSet` 变成近满分维度（gate 稀释）；`13`/`30`/`58` 等 4 例仍只给了子集。
- 结论：**不推荐**（治理成本最大，且直接触碰「禁止为变绿改定义」）。

### R2 以 `label` 为评分身份，`prop` 降为观测量 —— **已拍板（2026-10-23）**

- 做法：字段对应按 `label`（归一化后精确匹配）建立单射映射；`prop` 精确度单独作为 `propNameMatch`（观测、不进门禁），`propF1` 照旧公布。
- 优点：**不喂 gold、不动 AN-01**；与 AN-19 / AI-46 / wave-2 标注原则一致；源码上 label 是唯一「必填且 case 内唯一」的语义键。
- 代价：95% 变成「**语义**零编辑」；产物与 README 必须写明「prop 名需按宿主后端模型重绑」；历史数字全部不可比。
- 风险控制：标签匹配**只做归一化后精确匹配**（不做模糊），并同时输出「仅差标签字符串」的近失集，防止过宽。

### R3 只把 `propSet` 从 pin 里挪走，其它不动

- 优点：改动最小。
- 致命缺陷：129 行的阻断维度是 `columns/isHidden/dialogs/...`（全部 prop 键），`propSet` 解除封印后它们照旧判负 ⟹ **基本无效**。**不推荐**。

> **推荐 R2**。若评审倾向「字面零编辑」，则选 R1′，但必须先决定推翻 AN-01 的治理路径。

---

## 6. P0 设计：预测落盘 + 离线复算

### 6.1 新增 CLI

`--dump-pred <path>`（JSONL）。不作为探针开关的一部分；dump 无副作用，探针亦可开。

### 6.2 注入点（行号为当前工作区）

| 位置 | 写入内容 |
|---|---|
| [eval-llm.mjs:514-534](../../scripts/eval-llm.mjs#L514-L534) | `{kind:'crud', file, lang, turn:0, cfg:pred, gold, goldHash, mask, fewshotDerived, score:s, right, wrong}` |
| [eval-llm.mjs:521-532](../../scripts/eval-llm.mjs#L521-L532) | 每轮精修 `{turn, cfg:rPred, exactIntentScoped}`（否则只能复算 turn-0） |
| [eval-llm.mjs:576-594](../../scripts/eval-llm.mjs#L576-L594) | 错误行 `{cfg:null, error, errorKind}`（保住分母与「未测到」归因） |
| [eval-llm.mjs:663-676](../../scripts/eval-llm.mjs#L663-L676) | 片段 `{kind:'fragment', scene, gold, cfg:pred, ...}` |
| [eval-llm.mjs:748-761](../../scripts/eval-llm.mjs#L748-L761) | PRD 同理 |
| 出口 1098/1242/1693 | flush（探针、失败、成功三条出口都要） |

dump 头部落 `commit / corpusHash / model / servedModel / maxTokens / rulerVersion`。

### 6.3 `scripts/eval/rescore.mjs`

import `scoreAll` / `scoreFragment` / `summarize95` / `summarizeConvergence`，从 `gold + cfg + mask` 重算：
`definition95 / core / scoped / full / byDimension / convergence / fragments`。
对 `compileRate / typecheck / frontDoor` 明确打印 **"must rerun (deterministic, no API)"**，不伪造。

### 6.4 验收

- 同一 dump 复算出的各指标与当次产物**逐字段相等**（`rescore.mjs --expect <产物>`；端到端自测 `check:rescore` 覆盖双向）。
- 同一 dump 用两套尺子（旧 prop / 新 label）各算一遍 ⟹ **P1 的效果无需再付费跑一次即可精确量化**。这是本方案的核心收益。

---

## 7. 实现顺序（关键）

```
P0 落地 → 一次全量跑批（3.5h，带 dump）
        → 用旧尺子复算：必须复现 22.7%（证明 dump 完整）
        → 实现 P1 → 用新尺子复算同一份 dump → 得到精确 delta
        → 再决定 P2/P3 的 prompt 改动（此时失败集才是准的）
```

**不要**先改尺子再跑：那样旧口径的对照就永远丢了。

---

## 8. P1 设计：`alignFields` + `renameProps`

### 8.1 `alignFields(gold, pred)` —— 纯函数，新文件 `scripts/eval/align.mjs`

```
identity = label（zh 腿）/ prop（en 腿）      ← en 腿标签是中文 gold vs 英文 pred，结构性不可比；
                                              且 en 只观测不门禁（ratchet.mjs 门禁全走 zhRows）
key(goldField) = normalizeLabel(field.label)
normalizeLabel = NFKC → trim → 折叠空白 → 去标点 → 小写
匹配顺序：① 归一化 label 精确相等 → ② prop 精确相等（兜底，例如非中文字段）
输出：{ map: Map<goldProp, predField>, reverse: Map<predProp, goldProp>,
        mode: 'label'|'prop', ambiguous: [], unmatchedGold: [], unmatchedPred: [] }
约束：单射（一个 pred 字段只能被一个 gold 字段认领）；语料实测 0 重复 label，故无歧义；
      若 pred 出现重复 label → 只认领第一个，其余进 unmatchedPred（→ 字段集判负，不允许蒙混）
```

`pinnedDims` 的 `formtype:amount` 这类 token：仍以 **gold prop** 书写，解析时经 `reverse/map` 就近到 pred 字段 ⟹ **216 个语料文件一行不改**。

### 8.2 `normalizePredForCompare` —— 把 pred 的 prop 命名空间重写为 gold 的

逐结构处理（**白名单，宁可漏改不可误改**）：

| 结构 | 改写 | 依据 |
|---|---|---|
| `fields[].prop` | ✔ | 身份 |
| `dialogs[k].formItems[].prop` | ✔（先在顶层映射里查；查不到再按 dialog 内 label 二次对齐） | [schema:499-502](../../packages/shared/src/structured-config.schema.ts#L499-L502) |
| `columns[].prop`（递归 `groups[]`） | ✔；`type:index/selection/expand` 无 prop 不动 | [schema:283-347](../../packages/shared/src/structured-config.schema.ts#L283-L347) |
| `expandConfig.fields[].prop` | ✔ | [schema:734-751](../../packages/shared/src/structured-config.schema.ts#L734-L751) |
| `mergeConfig.rowsBy[]` | ✔（字符串即列 prop） | [merge-span.ts:61-76](../../packages/core/src/merge-span.ts#L61-L76) |
| `tableOptions.defaultSort.prop` | ✔ | [structured-generator.ts:2027](../../packages/shared/src/structured-generator.ts#L2027) |
| `isHidden`：`{field}` 或表达式里的 `{var:"x"}` | ✔（只改**整段等值**的顶层 token；含 `.` 的路径只改首段） | [field-resolver.ts:56-68](../../packages/core/src/field-resolver.ts#L56-L68)、[expr.ts:159-162](../../packages/core/src/expr.ts#L159-L162) |
| `reactions[].dependencies[]`、`when` / `fulfill.required|disabled|value` 里的 `{var}` | ✔ | [schema:190-222](../../packages/shared/src/structured-config.schema.ts#L190-L222) |
| `treeConfig.childrenField` | **✘ 不动**（行数据键，不是字段 prop） | [schema:752-759](../../packages/shared/src/structured-config.schema.ts#L752-L759) |
| `extPoints.render/formatter` | **✘ 不改内容**（判据本就只比 presence） | [scorers.mjs:388-399](../../scripts/eval/scorers.mjs#L388-L399) |
| `apiParams` / `dataOptions` / `querySpan`/`formSpan` / `formtype` / membership 三分量 | ✘ 无 prop 引用，只换字段查找 | — |

### 8.3 scorer 改造点（逐函数）

改 `fieldMap(pred)` 的唯一调用点即可覆盖 8 个维度 —— **但必须是「按对齐结果查找」而不是「按 prop 查找」**：

```
scripts/eval/scorers.mjs
  fieldMap/sharedFields        → 接受 align 结果
  propSet                      → 字段集 F1（按 identity）
  propF1 / attrAcc / exactIntentCore → 按 identity；propF1 另存 propNameMatch
  formtype / membership / apiParams / dataOptions / isHidden / reactions / fieldSpan / extPoints
                               → 全部经 normalizePredForCompare 后的 pred
  dialogs / columns / expandConfig / mergeConfig / editConfig / treeConfig / defaultSort
                               → 同上（深等值前先重命名）
  describeDimMiss              → 与判据同源（沿用 ec0cf50 的 want===got ⟺ pass 不变量）
```

`applicable(gold)` 不变 ⟹ `applicableCounts` / `minApplicable` 分母不变。

### 8.4 测试矩阵（先写测试，再改实现）

| 用例 | 期望 |
|---|---|
| pred 全部字段 prop 改名、label 不变 | **全维度 pass**（这是本次改动的定义级断言） |
| pred 某字段 label 改错 | 该维度 fail |
| pred 漏一个字段 / 多一个字段 | `propSet` fail |
| pred 两个字段同 label | 单射冲突 → `propSet` fail |
| `columns[].prop` 改名但结构与 label 不变 | `columns` pass |
| `columns` 换成 `groups` 多级表头 | 按结构比，仍可 pass |
| `dialogs.formItems[].prop` 改名 | `dialogs` pass |
| `isHidden: {field:'status'}` 改名 | pass；`op` 改成 `ne` 仍 fail |
| `reactions.dependencies`/`{var}` 改名 | pass；`value` 字面量改掉仍 fail |
| `treeConfig.childrenField` 改成字段 prop | **仍 fail**（不能被误重命名） |
| `extPoints.render` 内容不同 | **仍 pass**（只比 presence，行为不变） |
| en 腿 | 仍走 prop 身份（回归：数字不应因本次改动发生变化） |

### 8.5 不做的事

- **不做模糊匹配**（拼音/同义/编辑距离）——先只做归一化精确匹配，配合近失诊断；是否放宽由数据决定。
- **不改语料**（除 §9 的 1 例 dialogs 可选修正）。
- **不改 `pinnedDims` 语法**。

---

## 9. 预期准确性与不确定性（诚实版）

### 9.1 可证的下界

`propF1<1` 的 129 行里有 **25 行**在「其余 pinned 维度全过」——字段对齐后**必定转正**。
⟹ 下界 **+25 行**：216 行口径 47→72（**34.3%**），194 行口径 44→约 69（**≈35.6%**，最终以 heldout 子集复算为准）。

### 9.2 不可证的上界

另外 104 行被 1 个以上 pinned 维度挡住，且这些维度（columns/isHidden/dialogs/…）**同时受命名影响**。
在拿到预测之前，无法区分「改名造成的假 miss」与「内容真错」。
⟹ 上界 129 行全过（216 口径 83.8%），但**这只是数学上界，不是预测**。

**结论：P1 的点估计必须在 P0 之后用同一份 dump 复算得出，本文不预设数字。**
任何「P1 能到 6x%」的说法在复算前都是猜测。

### 9.3 95% 的硬算术（这条决定路线图）

194 heldout = 164 普通 + 30 收敛。要过 95% 需 **185** 例。

- 收敛腿最多贡献 30 ⟹ **普通用例必须 ≥155/164 = 94.5%**（即使收敛腿全绿）。
- 若收敛腿只到 80%（24），普通用例需 **98.2%**。

⟹ **95% 的主战场是零编辑腿，不是收敛腿。** 收敛腿从 53%→80% 只值约 +4 分。
⟹ 所以 P4 必须排在 P1/P2/P3 之后，且不能指望它兜底。

### 9.4 分阶段目标（复算驱动，不承诺）

| 阶段 | 目标 | 判定方式 |
|---|---|---|
| P0 | 复现 22.7%（旧尺子） | `check:rescore-parity` |
| P1 | 下界 ≥34%，并给出点估计与近失分布 | 同一 dump 新尺子复算 |
| P2（membership/tableBtns 文案） | 按复算出的 C 类失败集逐类消 | 一次付费跑批 |
| P3（新契约维度 few-shot） | 同上 | 一次付费跑批 |
| P4（收敛腿） | ≥80% | 一次付费跑批 |

---

## 10. 风险登记

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| **尺子放宽导致数字虚高** | 标签匹配过宽（同义/模糊） | 只做归一化精确匹配；同时公布 `propNameMatch`；近失集单列 |
| **对齐掩盖真实缺失** | 模型漏字段但标签碰巧撞上 | label 在 case 内唯一（实测 0 重复）+ 单射约束 |
| **深等值维度被误重命名** | `treeConfig.childrenField`、`extOptions.render` 被当成 prop | 白名单 + §8.4 的反向测试 |
| **en 腿数字回退** | 对齐策略未区分语言 | en 恒走 prop 身份，回归断言 |
| **历史数字被混用** | 新旧尺子的 22.7% / 55.5% 被拿来对比 | 产物写 `rulerVersion`；baseline `_comment` 明写不可比 |
| **门禁被稀释** | 新尺子下 propSet 变易 | `pinnedDims` 仍锚 NL；每维 ≥8 例的规模门不变 |
| **两套尺子长期并存** | 同时维护 prop/label 两条实现 | 只保留一个 `identity` 参数；旧口径仅由 dump 复算提供 |

---

## 11. 文档与守卫同步清单（落地时逐项勾）

1. `scripts/eval/scorers.mjs` + `scorers.test.mjs`：定义级测试先行。
2. `scripts/eval/align.mjs`（新）+ `align.test.mjs`（新）。
3. `scripts/eval/rescore.mjs`（新）+ `rescore.test.mjs`（新）+ `check:rescore`。
4. `scripts/eval-llm.mjs`：`--dump-pred`、`rulerVersion`、产物身份。
5. `scripts/eval/ratchet.mjs` + `ratchet.test.mjs`：仅当比值基线口径变化时。
6. `__tests__/golden/accuracy-baseline.json`：`_comment` 记录尺子版本；比例字段仍由人工 PR 填。
7. `packages/mcp-server/AI-NATIVE-REMEDIATION-PLAN.md`：AN-01 追加落地记录；新增一条 AN 条目承载本次口径修正与验收。
8. `docs/internal/wave-2-production-trust-design.md`：`12-14`（95% 承重前提）、`150-155`（标注原则）、`203-208`（refine 口径）。
9. `packages/mcp-server/AI-NATIVE-ARCHITECTURE.md`：指标表（`definition95` 的语义与 `propNameMatch`）、发布门禁、I4 不变量。
10. `packages/mcp-server/ROADMAP.md`：AI-33 / AI-46 / AI-51 的处置结论。
11. `README.md` / `README.en.md` / `docs/why-es-plus.md` / 站点：**修掉「零编辑命中率」未体现 ∨ 收敛腿的存量文案**，并写明 prop 重绑口径。守卫：`check:site-claims` / `check:readme-claims` / `check:artifact-freshness`。
12. `.changeset/`：口径变更记录。

---

## 12. 待审清单（裁决结果）

1. **D1 字段身份** → **R2**（label 身份 + prop 观测），2026-10-23 拍板。
2. **P0 先落地并跑一次全量做 dump** → **是**，P0 已落地（§13），全量跑批待执行。
3. **en 腿**：继续只观测、恒走 prop 身份、不因本次改动重定基线 → **是**。
4. **片段地板 0.7778**：确认口径过期，按当前契约重新取证后由人工 PR 写入 → **是**（不下调）。
5. **本轮不动的**：`CORE_FLOOR`、`pinnedDims` 语法、语料（除 1 例可选）、badge/README 当前读数、
   `accuracy-baseline.json` 比例字段 → **全部继续冻结**。

---

## 13. 裁决与 P0 落地记录（2026-10-23）

### 13.1 裁决

- **D1 = R2**：字段对应按归一化 `label` 建立单射；`prop` 精确度保留为观测量（`propNameMatch`），不进门禁。
- **顺序 = 先 P0**：先落盘，再跑一次全量，再实现 P1 并对同一份 dump 离线复算。

### 13.2 P0 已落地（本次提交）

| 文件 | 作用 |
|---|---|
| `scripts/eval/dump.mjs` | JSONL 写入/读取、`stableStringify`、`goldHashOf`、`RULER_VERSION`；逐行 append（进程被杀保住已完成行）、重开路径截断、半行 JSON 跳过 |
| `scripts/eval/run-metrics.mjs` | **指标聚合的唯一实现**（`computeCrudMetrics` / `computeFragmentMetrics` / `CONVERGE_K`）；`eval-llm.mjs` 与 `rescore.mjs` 共用 |
| `scripts/eval/rescore.mjs` | 离线复算 CLI；`--expect <产物>` 做逐字段比对（不一致退出 1） |
| `scripts/eval-llm.mjs` | 新增 `--dump-pred <path>`（**非探针开关**，零副作用）；落 CRUD 成功/错误行、每轮精修产出、片段行、PRD 行；聚合改为调用 `run-metrics` |
| `scripts/eval/{run-metrics,dump,rescore}.test.mjs` | 纯函数口径、落盘原语、端到端链路（含 `--expect` 双向） |
| `scripts/eval/ratchet.test.mjs` | 「门禁数字来自 `def95.rate`」的结构断言**随聚合一起迁移**到 `run-metrics.mjs`，并新增「eval-llm 不得自行再算 gateRate」 |
| `package.json` | `check:run-metrics` / `check:dump` / `check:rescore` 进 `check:consistency`；`eval:rescore` |

### 13.3 为什么聚合要抽成单一实现（而不是让 rescore 复制一份）

若 rescore 自带一份聚合，"复算与产物一致"就只能靠人工对齐两段复制品；而漂移的表现是
「复算与产物对不上」—— 读者会先怀疑打分器。抽成单一实现后，parity 由**构造**保证；
`rescore.test.mjs` 再钉住端到端链路（分母完整、错误行不被洗掉、`--expect` 双向咬得住）。

### 13.4 下一步（待执行）

```
npm run build:libs
ESPLUS_EVAL_KEY… node scripts/eval-llm.mjs --dump-pred .tmp-audit/pred-<date>.jsonl
node scripts/eval/rescore.mjs .tmp-audit/pred-<date>.jsonl --expect __tests__/golden/last-accuracy.json
```

第二条必须打印「逐字段一致」—— 否则说明 dump 不完整或口径漂移，**先修再谈 P1**。

---

## 附：可复算证据脚本（评审可自行重跑）

```bash
# 语料统计（prop/label 覆盖、label 唯一性、fixedFields 一致性、pin 分布）
node -e "…"   # 见本次会话；输出：40/1041 prop、1024/1041 label、0 重复 label、275/279 fixedFields

# 失败集分层（需 .tmp-audit/eval-opus46-3.log）
node -e "…"   # 输出：propF1=1 → 81 行/47 pass；propF1<1 → 129 行/0 pass；25 行下界
```
