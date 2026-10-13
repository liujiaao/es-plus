# @es-plus/mcp-server — AI 原生能力 Backlog

> 工程内部路线图，不是公开文案（公开 AI 页文案在 [docs/ai/ai-tools.md](../../docs/ai/ai-tools.md)）。
> 来源：2026-10 的能力评估（Q5 四优先级 + Q6 五个全球借鉴点）+ 2026-10-13 复核评审（三端源码核对 + 业界主流做法检验）。
>
> **Wave 1 技术实施方案**：[docs/internal/wave-1-eval-trust-design.md](../../docs/internal/wave-1-eval-trust-design.md)（P0 + AI-05，拆成 PR-1~4）。
> **Wave 2 技术实施方案**：[docs/internal/wave-2-production-trust-design.md](../../docs/internal/wave-2-production-trust-design.md)（信任地基：C1 编译门 / A1' scoped 指标 / A2' ingest / A3' refine / C2 前门 validate）。
>
> **一句话战略判断**：瓶颈不在模型，在 config schema 的表达边界。
> 不该放宽自由字符串逃生舱去「显得能力更强」，而该沿同一条确定性组合路线把
> **typed surface 往外扩**（把当前无法表达的特性建模进 schema），同时把 eval 从
> 单一合成分拆成**可信的按维度记分卡**。前者决定覆盖面，后者决定敢不敢说「生产可用」。

---

## 准确率口径（扩场景，诚实基线）

当前 heldout `∨ 100%(23/23) / compile 100%` 为真，但 scoped 于 **L1–L3 标准 CRUD 主导**的 golden
集；L4（vxe/虚拟/树/行内编辑/多级表头）、L5（自定义 render/第三方控件）几乎未进 golden。
**「全场景 ≥95%」= 既把这些能力 schema 化、又把 golden 扩到 L4/L5 真测。** 扩集期测得的
∨ 会**先回落再收敛**——这是扩大覆盖面的正常代价，非退步。守底线的两条结构腿不变：
**∨（scoped zero-edit ∨ ≤K 轮收敛）+ emit-what-compiles-and-warn**——新能力未教会时 compile-100% 也不破。

**能力按「声明式可解性」分三层，排期按层走：**
- **Tier-1 干净声明式**（可 golden）：configTableOut 响应映射、isHidden 条件、groups/tree/expand/editConfig。
- **Tier-2 受限表达式 DSL**（AI-16）：字段联动/computed；收窄 `formatter`(→string) / `permissionValue`(→bool) / `isHidden`(→bool)。
- **Tier-3 永久逃生口**：`render`(→VNode，本质 JS/JSX，DSL 替代不了) 留此层；esbuild 门控、降级+警告。

**⚠ Golden 规模验收门（对标业界 eval 标准，最大短板）**：当前每能力维仅 1–5 例，±1 case ≈ ±4.3%，是脆弱估计非稳态 95%。
**凡新建 schema 能力，其 golden 覆盖须 ≥8 例/维（L4/L5 目标 ≥15/维）方可声称该维达标**；徽章口径须随扩集重算、允许中途回落如实回写。

---

## 业界检验（本方案 vs 全球主流做法，2026-10-13 复核）

主体方向与海外最前沿**同向**，经得住检验；核对逼出的 4 处硬约束已折入下方各项。

| 本方案决策 | 主流对照 | 裁决 |
|---|---|---|
| 确定性工具 + 宿主填类型化字段（schema-gen 非 freeform） | TypeChat / Instructor / BAML / structured-output | ✅ 组件库「一配置→三端+一次编译」唯一可行路线 |
| 自愈：校验入库、重试回路留宿主/eval | TypeChat（库内 repair） | ✅ 可辩护偏离：MCP 工具确定性、agent 回路归宿主 |
| isHidden = 声明式条件 | Amis `visibleOn` / JSON Forms `if/then/else` | ✅ |
| AI-07 联动 = 声明式 reaction + 表达式 | Formily `x-reactions` | ✅✅ 联动可声明式，不必只靠裸 JS |
| AI-08 响应映射 = 路径对象 + 回调兜底 | ProTable `postData` / Amis `api.adaptor` | ✅ 简单声明式 + 复杂函数双层 |
| AI-09 高级表格 = 列定义声明式 | AG Grid column defs（children/treeData/editable） | ✅ 全声明式已验证 |
| AI-16 DSL = CEL/JSONLogic | CEL（K8s/IAM/Envoy 生产级、沙箱） | ✅ CEL 上选；但替代不了 render(→VNode) |
| esbuild parse-gate + emit-what-compiles | 多数 LLM codegen 无编译保证 | ✅ 强于行业均值 |

**4 处硬约束（已折入）**：① Golden 规模验收门（见上）；② AI-13 收紧措辞（host 杠杆非 server）；③ AI-16 不替代 render；④ Wave 5 扁平 vs 拆分架构抉择须显式做。

---

## 图例

**优先级**
| 级 | 含义 |
|----|------|
| **P0** | 可信度基建——没有它，「≥95% / 生产可用」是无凭据承诺。先做。 |
| **P1** | 低成本高回报——几小时到几天，直接抬准确率。 |
| **P2** | 扩 schema 表达力——决定能覆盖多少真实复杂场景（真正的瓶颈）。 |
| **P2b** | 生成器/脚手架接线——非 schema，守隐式结构契约 + 跨文件装配。 |
| **P3** | 收敛逃生舱 + 补齐——把不可校验的自由字符串变成受控能力。 |

**工作量**：`S` ≤1d · `M` 2–5d · `L` 1–2wk · `XL` >2wk

---

## P0 · 评测可信（让「准确率」这个数字有凭据）

当前 `exactIntent` 只打分 fields + 4 个属性 + actions + tableBtn code，忽略
dialogs / operationColumn / permissions / apiParams / render / formatter / i18n /
virtualScroll / target / mode；且仓库里**没有** committed 的 `last-accuracy.json`。

### AI-01 — exactIntent 拆成按能力维度记分卡 · `M`
- **Why**：合成单分无法定位回归（「总分掉了」vs「dialog 维度掉了」是两件事）；现在度量的只是最容易的那一维。
- **验收**：eval 输出 per-capability 分（fields / formtype / membership / dialogs / actions / operationColumn / permissions / apiParams / i18n / target 各一分），回归报告按维度列出 diff。
- **可借 AI-17** 的平台能力，不必自造记分框架。
- **状态**：✅ 已落地（PR-1）。`scripts/eval/scorers.mjs` 16 维条件记分卡（纯函数、无 SDK）+ `scorers.test.mjs` meta-eval（gold-vs-gold 满分 + 每维扰动咬合）接入 `check:consistency`；`eval-llm.mjs` 输出 `byCapability` + 观测 `exactIntentFull`，门禁仍落历史 `exactIntentCore`（决策 B）。

### AI-02 — 补英文 NL eval 用例 · `S`
- **Why**：现有 eval 语料全中文，海外用户的第一个 prompt 就落在分布外。
- **验收**：每个能力维度至少 1 条英文 NL 用例，与中文用例共用记分卡。
- **状态**：✅ 已落地（PR-2）。25 个 golden case 各补 `nlEn`（复用同一份 gold config，零重复）；`eval-llm.mjs` 双语打分，zh 门禁 / en 观测（`byLanguage`）；`score-golden.mjs` 校验 nlEn 并报 `bilingual N/25`。

### AI-03 — runtime tier：mount 生成出来的 schema · `M`
- **Why**：现在 runtime 测试挂的是**手写** schema——等于没测生成物真能渲染/交互。golden 的 `vite build` 只证明「能编译」，不等于「能跑」。
- **验收**：至少对 golden 子集，把生成的 pageSchema mount 起来跑冒烟断言（能渲染、表单能填、弹窗能开）。
- **状态**：⬜ 未落地（**P0 唯一未完项**）。「能编译」已证、「能跑」仍缺。归入 Wave 3 收尾；与 AI-18 的零代码联动冒烟合并做。

### AI-04 — commit 真实 accuracy 数字 + README 徽章 · `S`（依赖 AI-01）
- **Why**：没有数字的「AI 原生」是营销。
- **验收**：nightly `eval-llm.yml` 产出的 `last-accuracy.json`（按维度）committed；README 徽章显示总分 + 最弱维度。
- **状态**：✅ 已落地（PR-4）。`eval-llm.mjs` 额外写 shields endpoint `last-accuracy-badge.json`（门禁口径 heldout 分，≥95 brightgreen/≥90 green/≥80 yellow/else red）；`eval-llm.yml` 加 `permissions: contents:write` + `concurrency` + 变更检测的 commit-back（`[skip ci]`，`always()` 使红值也如实回写）；README / README.en 加 endpoint 徽章 + 「heldout 非营销」注脚；徽章文件先种 grey `pending nightly` 占位，首夜真跑后覆盖。

---

## P1 · 补 few-shot 盲区（排在任何 schema 改造之前）

### AI-05 — 填齐 eval steering few-shot 的 heldout 维度 · `S`–`M`
- **Why**：steering prompt 只有 6 个 shot，`cascader / render / i18n / sfc-mode / virtualScroll / formLayout / 多 dialog / permissionValue / operationColumn / antdv` 一个示例都没有——LLM 对没见过示例的维度准确率断崖。补齐是几小时的活、却直接抬分。
- **验收**：上述每个维度 ≥1 个 shot，加入后 AI-01 对应维度分可观测上升。
- **状态**：✅ 已落地（PR-3）。`NL_TO_CONFIG_FEWSHOT` 6 → 14 shot，8 个全新域（AddressBook/MenuManage/TagManage/MetricLog/MemberManage/SalaryManage/TicketManage/CommentManage）覆盖 cascader+children / i18n+formLayout / sfc / virtualScroll / 多 dialog / permissionValue / render+operationColumn对象 / antdv；域名与 25 个 golden 名均不碰撞，`FEWSHOT_DERIVED`（静态 6 文件）不变，heldout 仍是干净泛化测试；spec 加 2 道护栏（generateFromConfig 不抛 + 17 维覆盖断言）。

---

## Wave 2 · 生产信任地基 ✅ 已交付（设计见 wave-2-production-trust-design.md）

ROADMAP backlog 此前未追踪，补记。这批工具不改模型、专治「敢不敢说生产可用」，并占回「Wave 2」号位（消除与下方 schema 表达力的撞号）：
- `ingest_schema`（openapi / jsonSchema / sample-json → 草稿 config；ts-interface / sql-ddl 未支持）
- `generate_crud_from_config` 前门 + `validateAndRepair`（shared，Zod 阻断式校验，只判不改、无模型回灌）
- `refine_config`（确定性 validate + diff，不喂模型，多轮精修）
- `validate_config`（structured-crud → Zod；其余 → Ajv）
- scoped 指标 + 95% 约定（scoped zero-edit ∨ ≤K 轮收敛）+ 收敛语料（leg-2 结构性 miss）
- C1 编译 parse-gate：render/formatter 走 esbuild（见 AI-10 现状）

---

## P2 · 扩 config schema 表达力（真正的瓶颈）

每补一个，就把一类场景从「只能塞进 render 字符串」升级为「类型安全 + golden 可编译保证」。按文档里真实高频、当前**无法表达**的特性排。
**三端源码核对（2026-10-13）确认 AI-06/07/08/09 四缺口真实存在**：组件 `FormItemOption`/`TableColumn` 有、AI `FieldConfigSchema`（`shared/src/structured-config.schema.ts:64`）无。
**根因之一**：组件层拆 `formItems: FormItemOption[]` + `columns: TableColumn[]`（`vue3/.../es-crud-page/src/types.ts:8,16`），AI schema 拍平成单字段数组再派生。

### AI-06 — `isHidden` 条件可见性 · `M`
- **Why**：组件文档里有、`FieldConfig` 里却缺，是最刺眼的缺口。三端 reactive（`es-form.vue:369`）。
- **验收**：schema 支持 `isHidden`（**声明式条件，非裸 JS**，对标 Amis `visibleOn` / JSON Forms `if/then/else`）；三端生成 + golden 覆盖（≥8 例）；eval 维度纳入。

### AI-07 — 字段联动 / computed · `L`
- **Why**：一个字段的值/选项依赖另一个字段，是复杂表单的核心需求，当前完全不可表达。
- **验收**：schema 声明依赖关系（**声明式 reaction + 表达式，对标 Formily `x-reactions`**，配合 AI-16 的 DSL）；三端等价；golden 覆盖（≥8 例）。
- **不走**裸 JS 回调（`on`/listenToCallBack 归 Tier-2/3），不拓宽自由串。

### AI-08 — `configTableOut` 后端字段映射 · `M`
- **Why**：官方 headline feature，schema 里**完全没有**；中心度第一（数据接线），L3 case7「任意后端适配」头牌。
- **验收**：schema 建模出参字段映射为**路径对象**（total/data/pageSize/current，对标 ProTable `postData` / Amis `api.adaptor`）；复杂入参回调（listenToCallBack/apiParams.model）归 Tier-2/3；生成代码接上（`field-resolver.ts:273`）；golden 覆盖（≥8 例）。

### AI-09 — 高级表格特性 epic（group header / row-expand / tree table / 可编辑单元格）· `L`–`XL`
- **Why**：L4 头牌「超库上限」，当前只能靠 render 字符串硬塞。对标 AG Grid 列定义（children/treeData/masterDetail/editable）全声明式。
- **⚠ 架构抉择（本 epic 必须显式做）**：非字段列（`type:'index'|'selection'|'expand'`）、`groups` 多级表头在扁平 FieldConfig 里无处安放。**二选一**：(a) 加可选 `columns` 逃生数组承载非字段/分组/展开列（AG Grid/ProTable 路线，列独立）；(b) 扩 FieldConfig 带列专属字段（扁平+派生，AI 生成便利）。落地前定稿。
- **验收**：**拆成 4 个子 issue** 独立推进（groups / expand+expandConfig / treeConfig / editConfig）；`editRender` 自定义编辑器归 Tier-3；每子项带三端生成 + golden（L4 ≥15/维）+ eval 维度。不要一次性合并。

---

## P2b · 生成器/脚手架接线（非 schema，三站点头牌场景靠它守 compile+runtime）

这两项不是 schema 能解的——是生成器恒定输出 + prompt/脚手架约定问题，误并入 schema 批次会导向错误实现。

### AI-18 — 生成器恒吐 form↔table provide/inject 契约 · `S`–`M`
- **Why**：零事件代码联动靠 EsForm 物理嵌在 EsTable 默认插槽 + `triggerEvent:true`（why-es-plus §3.2 点名 AI 常误造 event-bus/Pinia）。隐式结构契约，模型「看不见」。
- **验收**：schema 模式生成物恒含正确嵌套 + triggerEvent；golden 加「零代码联动」冒烟断言（配合 AI-03）。

### AI-19 — scaffold_page + conventions 教 `app.use(ESPlus)` 全局装配 · `S`
- **Why**：permissionValue / labelKey 只在 main.ts 装配 `{permission, t, httpRequest}` 后才生效——跨文件依赖，模型常漏。
- **验收**：`scaffold_page` 产出含全局装配样板；conventions 资源写明；生成权限/i18n 页时 prompt 强制引用。

---

## P3 · 收敛逃生舱 + 补齐

### AI-10 — 编译检查 render/formatter/permissionValue 字符串 · `M`
- **Why**：现在是不经编译检查的 JS 字符串——拼错的变量名能骗过全部 341 测试、运行时才炸。
- **验收**：这些片段喂给 esbuild transform 做 parse 级校验。**AI-16 是 formatter/permissionValue 的终局形态；render(→VNode) 永留本层。**
- **状态**：🟡 ~2/3 已落地。render+formatter 已走 esbuild parse-gate（`shared/src/codegen-escape.ts:186`，接 `structured-generator.ts:997`），语义是**降级+警告**（优于原验收硬报错，保留此语义）。**残余**：① permissionValue 未过门；② schema 模式内联 render/formatter 仍缺（当前仅 SFC 列路径）。归入 Wave 3 收尾。

### AI-11 — SFC-mode ↔ schema-mode 特性对齐 · `M`
- **Why**：SFC 路径当前功能更少，两条路不等价会让 `mode` 选择变成能力陷阱。
- **验收**：两模式特性矩阵对齐；差异点要么补齐、要么在 schema 层显式拒绝并给出告警。
- **状态**：**降优先/暂停**。默认是全保真 schema 模式；无明确单文件 SFC 消费方前，投平价为净负担。SFC 当前已对不支持项发警告（非静默）。

### AI-12 — `get_component_api` 扩到 EsDialog / EsCrudPage / vxe · `S`–`M`
- **Why**：覆盖不全，LLM 写 render 字符串时查不到真实 API，只能凭空捏造 prop/slot。当前仅 EsForm/EsTable/useDialog 有文档，EsDialog/EsCrudPage/SvgIcon 走占位分支。
- **验收**：三个组件族的 API 可查；AI-15 依赖它。归入 Wave 3（低成本直接抬接地准确率）。

---

## Q6 · 全球同类库的借鉴点（approach / spike，横切支撑上面各项）

你现在走的「确定性组合 + schema 校验 + 一次编译保证」和海外最前沿**同向**（见上「业界检验」表）。以下按能直接接入的程度排。

### AI-13 — 语法受限解码 spike（Outlines / XGrammar / llguidance / GBNF）· `M` spike
- **Why**：「单前门 + 填 surfaces 表」本质是手工约束解码。真正的 constrained decoding 让模型**生成时**就只能吐合法 token。
- **现状/收紧**：类型化字段是 **validate 时**约束，**不等于** token 级受约束解码——**这是 host 的杠杆，不是 server 的**（server 只能定 schema，无法约束解码）；strict structured-output 支持与否取决于 host（Claude Code / Cursor）。今天靠 `validateAndRepair` + 宿主重试（`driveToValidConfig`）补齐。**维持 spike、不进主线**。
- **验收**：spike 报告——当前 host 下可行性与接入点；host 不支持则记「待 host 能力」。

### AI-14 — TypeChat 式「校验—修复」自愈回路 · `M`
- **现状更正**：校验层（`validateAndRepair` + `buildSemanticWarnings`）与**模型驱动重试回路已交付**，但刻意分置：
  - 确定性校验层：shared `validateAndRepair`，三前门共用（只判不改）。
  - 自愈重试回路：`driveToValidConfig`（≤2 次回灌 Zod issues）**只在 eval/宿主侧**（`scripts/eval-llm.mjs:143`）。
- **设计裁决**：工具内自动回灌 **WON'T-DO-BY-DESIGN**——会破坏「MCP 确定性 / 宿主推理」边界（`validate-and-repair.ts:11`）。与 TypeChat（库内 repair）的偏离是有意为之、更契合 MCP。`refine_config` 是宿主侧确定性 per-turn 对应物。

### AI-15 — 写 render 前先 RAG 组件 API · `M`（依赖 AI-12）
- **Why**：海外做法在让模型写任何自由片段前先检索真实 API 注入上下文，减少捏造。
- **验收**：生成 `render` 字符串前强制先读 `get_component_api`，相关 API 进 prompt 上下文。
- **状态**：**降优先**。few-shot 资源是其静态形态；等场景数涨到需要动态检索 L4/L5 范例时再做。

### AI-16 — 用表达式 DSL 替代裸 JS 字符串（JSONLogic / CEL）· `L`
- **Why**：把**可求值/谓词型**逃生点（`formatter`→string / `permissionValue`→bool / `isHidden`→bool / 联动→值/选项）换成可求值、可静态校验、沙箱安全的表达式。好处三连：能校验、三端等价求值、不留注入口。是 AI-07 联动的底座。对标 CEL（K8s/IAM 生产级）。
- **⚠ 边界**：**不覆盖 `render`**——render 必返 VNode，本质 JS/JSX，永留 Tier-3（Formily 同理：reaction 用表达式、自定义渲染用 JSX）。
- **验收**：选型（JSONLogic vs CEL，倾向 CEL）→ 三端求值器 → schema 接入 → 迁移 formatter/permissionValue/isHidden/联动点位（**不含 render**）。

### AI-17 — 按特性维度的 eval 平台（promptfoo / braintrust / OpenAI-Evals）· `M`
- **Why**：这些平台原生支持 per-assertion / per-feature 记分与回归看板，直接对应 AI-01，不用自造轮子。
- **验收**：选型并接入现有 eval 语料；AI-01 的记分卡跑在该平台上。
- **状态**：**Wave 1 显式推迟**（见设计文档 §6）。当前 scorer 深耦合权威 Zod schema + `generateFromConfig` 编译校验，迁移在本波是净负担；`byCapability` 已满足看板需求。维度矩阵继续膨胀或需对外托管看板时再评估。

---

## 建议执行波次

| 波 | 内容 | 理由 |
|----|------|------|
| **Wave 1** | ✅ 已完成：AI-01 + AI-02 + AI-05 + AI-04（PR-1~4；AI-17 显式推迟） | 先让分数可信、再用低成本 few-shot 把分抬起来。 |
| **Wave 2** | ✅ 已交付：信任地基（ingest / refine / validate / from_config 前门 / validateAndRepair / scoped+收敛） | 占回「Wave 2」号位（实际交付即此，消除与 schema 表达力撞号）。 |
| **Wave 3 · 对齐+收尾**（阶段 0） | 本次 ROADMAP 重编 → AI-10 收尾（补 permissionValue 门）→ AI-12（EsDialog/EsCrudPage/vxe API）→ AI-03（runtime mount，并 AI-18 联动冒烟） | 零风险、消除方向冲突、AI-12 当场抬准确率接地。 |
| **Wave 4 · 最高频声明式缺口**（阶段 1，Tier-1） | AI-08 configTableOut（响应映射路径对象）→ AI-06 isHidden（声明式条件）+ golden 扩 L3/L4 | 中心度第一（数据接线）+ 最刺眼缺口；真正的「全场景」第一步。 |
| **Wave 5 · 高级表格 epic**（阶段 2，Tier-1） | AI-09 拆 4 子项（groups/tree/expand/editConfig）+ 先定扁平vs拆分架构 + golden L4 | L4 头牌「超库上限」，类型化结构可 golden。 |
| **Wave 6 · 表达式 DSL 基石**（阶段 3，Tier-2） | AI-16（CEL，不含 render）→ AI-07（联动/computed）+ 收窄 formatter/permissionValue/isHidden | DSL 做底座，安全解锁联动，收敛逃生舱。 |
| **横切**（贯穿 Wave 4–6） | AI-18 provide/inject 恒吐 + AI-19 全局装配教学 | 非 schema，守头牌「零代码联动」compile+runtime。 |
| **降优先/暂停** | AI-11（非默认低保真 SFC parity）· AI-15（RAG，场景到量再做）· AI-13（spike，host 杠杆非 server）· AI-17（平台） | 当前投入为净负担或非 server 可控。 |
