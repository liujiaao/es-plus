# Wave 2 落地方案 — 生产可信（Production Trust）

> 延续 [Wave 1 — 评测可信](./wave-1-eval-trust-design.md)。Wave 1 把「数字可信」做实；Wave 2 把两个**生产级承诺**做实：
> **（P1）100% 一次性编译——做成对任意 valid config 成立的真·不变量，而不只是对策划语料的观察。**
> **（P2）95% 准确率——先把口径改良定义，再在 schema-grounded 语料上诚实逼近。**
> 本文是技术实施方案，不是公开文案。具体 AI-xx roadmap 映射在落地时同步进 [ROADMAP.md](../../packages/mcp-server/ROADMAP.md)。
>
> **补记（2026-10-29）：** A2' 的第三处宿主已交付 —— `es-plus ingest <file>` 子命令（原「CLI 延后」条目），并把 `buildIngestDraft` 下沉到 shared 与 MCP 共用，详见 §4.2。
>
> **状态（2026-10-12）：🚧 实施中。PR-C1 已落地并自测通过**（见 §2 末）；**PR-A1' 已收尾**（scoped 指标 + 掩码摄取 + eval 并列报告 + membership 拆成 inQuery/inTable/inForm；全量语料掩码 **25/25 标注完成**，`check:scorers` + `test:golden` 双绿，见 §3.5）；**PR-A2' 已落地**（引擎 + MCP 工具两步，CLI 延后；`schema-ingest.ts` + `defaultFormtypeForType` + `ingest_schema` 工具，shared 422 测试 / mcp 112 测试 + 覆盖率 branches 85.9≥77 全绿，golden 25/25、fragment 78/78 无回归，见 §4 末）；**PR-A3' 已落地**（B3 精修回环 + B4 pin；`diffConfig` + `refine_config`「确定性 validate+diff」工具 + eval K 轮收敛驱动 + `firstConvergedTurn`/`summarizeConvergence` + convergence@K 指标；两处偏离 §5 字面已评审拍板：工具不喂模型、只认 scripted refinements；shared 430 测试 / mcp-server 116 测试 + `check:scorers` + `test:golden` 26/26 全绿，见 §5 末）；C2 待做。A3' 带 key 付费复测已跑（`pa/claude-opus-4-8`）；**PR-B3'→B3'' 已把空载的精修环填实**——统一 ∨ 指标 + 结构性 miss 铰链语料（27/28/29）令精修环首次被真实模型走到：turn-0 scoped=X → 第 1 轮收敛，convergence@3 heldout 100%、mean turns **0.00→0.75**、95%-def heldout **73.9%（17/23）**，见 §5.3；**PR-C2（A3）已落地**（确定性前门校验：shared `validateAndRepair` + 两个生成前门生成前过闸、非法回结构化 per-issue 错误；三处偏离 §6 字面已评审拍板：前门不含模型回灌循环、不按默认改写 config、assertValidConfig 早已被 catch；shared 443 测试 / mcp-server 118 测试 + typecheck/lint/golden/fragment/scorers 全绿，见 §6 末）；A4 沙箱 build-repair 独立后续 PR。
>
> **复核纠正（落地时发现，已改）：** 原 §2.2 写「esbuild 已在仓库依赖链里，不新增运行时依赖」——**错**。实测 esbuild 只在**根仓库**（golden/smoke 脚本），三个发布包（shared/cli/mcp-server）都没有它。经确认采 **A 方案：给 `@es-plus/shared` 加 esbuild 依赖**，做真不变量（发射前校验与 CI 发射后校验同款解析器、零漂移）。另：`generate_crud` 的 `mode` 默认**本就是 `schema`**，A1 实际只剩「选 sfc 加保真度警告」。
>
> **承重前提（已拍板·2026-10-12）：** 「95%」重定义为——**在 schema-grounded 语料上、只对 NL 真正锁定（pinned）的维度做 zero-edit，或 ≤K 轮自然语言精修内收敛**。
> 这一条是整个 P2 成立的基础：旧定义（裸 NL → 逐字节复现作者整份 config）数学上不可达，因为短 NL 本质欠定（见 Wave 1 §抬头 + memory `eval-heldout-vs-95-claim`）。
> 新定义下，强模型可合法逼近 95%，且与真实生产工作流（给契约 + 反复自然语言微调）一致。
>
> **两条承诺性质不同，必须分轨治理：**
> - P1 是**确定性不变量**——模型只产出数据（config），代码来自确定性、golden+vite 双重把关的生成器。可证明。
> - P2 是**欠定任务上的统计目标**——只有先锚定字段来源、再把成功定义为收敛，才良定义、才可达。

## 0. 现状校准（三份源码测绘的实证结论）

动手前先把 Wave 2 要依赖的真实基建钉清楚（均已核实到 file:line）：

| 维度 | 真实情况（已核实） | 对 Wave 2 的意义 |
|---|---|---|
| 生成脊柱 | [structured-generator.ts:113](../../packages/shared/src/structured-generator.ts#L113) `generateFromConfig` 是唯一权威落地路径；`composeCrudConfig`+片段生成器复用其原子 builder，字段级字节一致 | P1 的地基已经对，只需补洞 |
| 注入安全 | [codegen-escape.ts](../../packages/shared/src/codegen-escape.ts) 六个发射器对所有 caller 数据做上下文正确的转义，语法安全 | P1 的大部分已天然成立 |
| **唯一的编译洞** | [structured-generator.ts:992-993](../../packages/shared/src/structured-generator.ts#L992-L993)：`formatter`/`render` 两个扩展点字符串**逐字节原样内联、发射前零解析**；schema 只约束 `z.string()`。畸形字符串 → 语法破损 SFC，而 `generateFromConfig` **不抛错正常返回** | **P1 的唯一真·缺口**；触发面 `mode=sfc` + `generateTableBlock` |
| schema 模式免疫 | 同文件 render→TODO 槽+注释（[L890-905](../../packages/shared/src/structured-generator.ts#L890-L905)），formatter→降级警告（[L136-146](../../packages/shared/src/structured-generator.ts#L136-L146)） | P1 的生产默认应钉死 `mode=schema` |
| 入口 fail-fast | `assertValidConfig` 对非 schema-valid config **抛错**（非返回警告） | P1 需在前门把它包成结构化错误 + 修复 |
| 类型→formtype | 结构化脊柱**无**代码级类型推断（按设计是 LLM 的活，仅 prompt 文本制导）；老引擎 [crud-engine.ts:31-49](../../packages/shared/src/crud-engine.ts#L31-L49) 有关键词映射但属低保真旧路径 | P2 的 B1 需新建**干净的类型→formtype 默认映射** |
| 门禁指标 | gate = 19 条 heldout 中文用例的 `exactIntentCore` 均值（[scorers.mjs:215](../../scripts/eval/scorers.mjs#L215)），`propF1.f1===1` 硬 AND 项把它钉在 ~0 | P2 的 B2 需引入 scoped 指标 |
| 模型输入 | 评测只喂 NL 字符串，无 schema、无字段清单（[eval-llm.mjs:129](../../scripts/eval-llm.mjs#L129)） | P2 的 B1/B2 需把字段集喂给模型 |
| 修复循环 | 唯一真实的 validate→repair 只在 nightly [eval-llm.mjs:128-155](../../scripts/eval-llm.mjs#L128-L155)（≤2 次、只修 schema 合法性、从不看 gold） | P1 的 A3 把它搬进前门；P2 的 B3 另造「看 gold/修正」的收敛循环 |
| 四大缺口 | **schema 摄取、运行时编译回环、服务端 validate→repair、精修/diff 回环+pin** 全部缺失（MCP server 只是薄封装） | 即 Wave 2 要补的四件，均为**加法不是重写** |

**结论：** P1 离「真不变量」只差 1 个补洞（A2）+ 1 道安全网（A4）；P2 离「可达」差一个口径改造（B2）+ 一个字段锚定来源（B1）+ 一个收敛回环（B3/B4）。没有任何一项要重写脊柱。

## 1. 执行顺序（含依赖）

沿用 Wave 1 的「先有能自证的度量，再谈逼近」纪律——否则无法证明「补了某块让某指标上升」。两轨并行、各自可独立合入：

```
P1 编译不变量轨：
  C1 (A1 schema默认 + A2 扩展点parse-gate) ──▶ C2 (A3 服务端validate→repair + A4 沙箱build-repair)
        │  最便宜·最高杠杆·零付费run                         │  生产安全网
        └──────────────────────────────┐                    │
P2 准确率轨：                            ▼                    ▼
  A1' (B2 scoped指标 + 规格掩码语料) ──▶ A2' (B1 schema摄取层) ──▶ A3' (B3 精修回环 + B4 pin)
        │  度量先行（scorecard-first）     │  锚定 propSet         │  兑现「收敛」定义
```

- **C1 最先做**：零/极小改动即把 P1 从「语料观察」升级成「任意 valid config 的不变量」，立竿见影、不花钱。
- **A1'（B2）其次**：和 Wave 1 的 AI-01 同理——没有良定义的 scoped 指标，B1/B3 的进步无法被度量、无法防灌水。
- A2'（B1）、A3'（B3/B4）、C2 依序；每一步落地后再跑**一次**带 key 的真实 run 看指标（付费 run 需显式指令，不自触发）。

---

接下来按 PR 粒度拆。每个 PR 独立可合、独立有价值。本文先给 **C1 / A1'** 的完整技术方案（最先落地的两块）；A2'（B1 摄取层）/ A3'（B3 收敛）/ C2（安全网）在后续消息补细节，避免一次输出过长。

## 2. PR-C1 · A1+A2 把「100% 一次性编译」做成不变量

> 目标：对**任意 schema-valid config**，`generateFromConfig` 必产出语法正确、可 vite build 的代码——不再依赖「作者手保 formatter/render 合法」。

### 2.1 设计决策（三条）

**决策 C1-a — 生产默认钉死 `mode=schema`。** schema 模式已把两个扩展点隔离进 TODO 槽+警告，对编译洞**天然免疫**，且是全保真路径（`mode=sfc` 会静默欠支持 dialogs/tableBtns/toolbarBtns/operationColumn，只警告不发射，[structured-generator.ts:312-336](../../packages/shared/src/structured-generator.ts#L312-L336)）。前门 `generate_crud` 的 `mode` 默认改为 `schema`，并在选 `sfc` 时回传一条「保真度下降」提示。**零新代码，纯策略 + 一行默认值 + 一句警告。**

**决策 C1-b — 扩展点字符串发射前必过 parse-gate（唯一真·补洞）。** 这是 P1 从「观察」变「不变量」的关键一改。保持 schema 模式现有行为不变；只在 `mode=sfc` / `generateTableBlock` 真要内联 `formatter`/`render` 的那两行之前，加一道解析闸。

**决策 C1-c — 解析失败不抛错、而是降级隔离。** 为了让生成**保持 total**（永不因用户的坏字符串而崩），parse 失败时复用 schema 模式**已有**的降级路径：把该字符串塞进 TODO 注释（`sanitizeForComment` 已存在）+ 推一条 warning，而**不是**原样内联。于是「发射的东西永远能编译」成为结构性保证，坏字符串最多变成一个待填的 TODO，不会变成语法错误。

### 2.2 文件级改动

- **改** [structured-generator.ts:992-993](../../packages/shared/src/structured-generator.ts#L992-L993)（`buildTableColumnSFC` 内联点）：内联前调用新 helper `assertEmittableExpr(src)`。
- **新增** `packages/shared/src/codegen-escape.ts` 里 `assertEmittableExpr(src: string): boolean`：用 esbuild `transformSync` 把 `const __esplus_probe = (${src});` 干跑解析；**先试 `loader:'tsx'`（覆盖 JSX render）再试 `'ts'`（覆盖 `<T>()=>…` 泛型箭头），任一通过即判合法**——只解析、不执行、不改写内容。与 CI 的 score-golden / golden:e2e 同款解析器。
- **加依赖**：`@es-plus/shared` 的 `dependencies` 增 `esbuild: ^0.21.5`（与根仓库同版本）；同步 `package-lock.json`（esbuild 从 dev-only 提升为 shared 的生产依赖，-24 处 `dev:true`、+1 处声明）。
- **改** 内联逻辑：`ok`→照旧内联；`!ok`→**省略该扩展点** + `warnings?.push` 降级告警（对象字面量塞不进行注释，故省略而非 TODO 注释；与 schema 模式「emit unformatted + warn」同构）。`buildTableColumnSFC` 签名增可选 `warnings?: string[]`，两个调用点（[structured-generator.ts:455](../../packages/shared/src/structured-generator.ts#L455) 的 generateSFC、[fragment-generator.ts:231](../../packages/shared/src/fragment-generator.ts#L231) 的 generateTableBlock）各传入其作用域内的 warnings 数组。
- **改** [codegen-escape.ts 顶部注释](../../packages/shared/src/codegen-escape.ts#L21)：从「刻意不经任何转义」改为「刻意不改写内容，但发射前过语法闸」。
- **改** [generate-crud.ts](../../packages/mcp-server/src/tools/generate-crud.ts) 的 `sfc` 分支：追加保真度警告（默认已是 schema，无需改默认）。

> esbuild 确为新增依赖（见复核纠正）；但 shared/cli/mcp 都是开发期 codegen 工具链、不进 app bundle，可接受。

### 2.3 新增/强化测试（已落地）

- **新增** [`packages/shared/__tests__/extension-point-gate.spec.ts`](../../packages/shared/__tests__/extension-point-gate.spec.ts)（9 测试）：
  1. `assertEmittableExpr` 放行合法 JS 箭头 / 带类型 TS formatter / JSX render；毙未闭合模板、括号不配平、垃圾串。
  2. `generateTableBlock`：合法 formatter 仍内联无告警；畸形 formatter 省略 + 降级告警 + **产物经 esbuild 解析通过**（不变量证明）。
  3. `generateFromConfig`（sfc 模式）：畸形 formatter 不抛错、不内联坏串、带告警、产物可编译。
- **强化** [compile-smoke.mjs](../../scripts/compile-smoke.mjs)：主矩阵后加「畸形 formatter」子集（三端 × ts/js = 6 个），断言产物仍可解析（闸被摘除即红）。

### 2.4 PR-C1 验收（✅ 全通过 2026-10-12）

- `@es-plus/shared` build 干净；vitest **401 pass**（Wave 1 的 392 + 新 9）。
- `test:golden` **25/25**（双语 25/25）；`fragment:smoke` **78 个产物全解析**（72 + 6 畸形子集）。
- `@es-plus/mcp-server` typecheck 干净、**107 pass**；`@es-plus/cli` typecheck 干净、**43 pass**（shared 签名改动向后兼容，消费者零回归）。
- `package-lock.json` 已同步（CI `npm ci` 不会因 package.json 漂移而失败）。
- 未在 Windows 本地跑整串 `check:consistency`（其中 one-config/og:check 有 CRLF 假性红，见团队记录），交 CI 验。`golden:e2e` 全量 vite build 亦交 CI（本地不跑 30min 作业；golden 语料只含合法 formatter，本改动不影响其行为）。

---

## 3. PR-A1' · B2 让「95%」良定义（scoped 指标 + 规格掩码语料）

> 目标：把门禁从「惩罚欠定」改成「只对 NL 真正锁定的维度记分」，使 exact-match 变公平。这是 P2 的度量地基（scorecard-first），必须早于 B1/B3。

### 3.1 设计决策（三条）

**决策 A1'-a — 新增 `exactIntentScoped`，不动 `exactIntentCore`/`Full`。** 延续 Wave 1 决策 B 的 ratchet 思路：保留现有两个合成分（[scorers.mjs:215/218](../../scripts/eval/scorers.mjs#L215)），新增第三个 `exactIntentScoped` = **只 AND 该 case 掩码里列出的维度**。门禁逐步从 core 迁到 scoped（迁移当天不红）。

**决策 A1'-b — 每条 golden case 加机器可读「规格掩码」。** 两个可选字段：
- `fixedFields: string[]`——NL/契约**明确给定**的字段 prop 集（喂给模型，使 propSet 从「猜」变「给定」）。
- `pinnedDims: string[]`——NL **真正锁定**的维度清单（如 `["propSet","formtype:amount","actions"]`），`exactIntentScoped` 只对它们记分。
掩码由 case 作者依据 `nl`/`notes` 的真实意图标注——这是本 PR 最承重的新字段，等于把「这句话到底定死了什么」显式化。

**决策 A1'-c — 掩码缺省时 scoped ≡ core（向后兼容）。** 未标注掩码的 case，`pinnedDims` 视为 core 的四维，`fixedFields` 为空（不喂字段），行为与今天完全一致。允许逐条迁移，不要求一次标全 25 条。

### 3.2 文件级改动

- **改** 25 个 [`__tests__/golden/cases/*.json`](../../__tests__/golden/cases/)：按真实意图补 `fixedFields`/`pinnedDims`（可选、可增量）。config、`nl`、`nlEn` 一字不动。
- **改** [score-golden.mjs:314-322](../../__tests__/golden/scripts/score-golden.mjs#L314-L322) 入参校验：接受新可选键（存在时类型校验：`fixedFields` 为 string[]、`pinnedDims` 为 string[]），保证 Layer-1 仍绿。
- **改** [scorers.mjs:156-173](../../scripts/eval/scorers.mjs#L156-L173)：`CAPABILITY_SCORERS` 的 `applicable(gold)` 扩展为 `applicable(gold, mask?)`——有掩码时以掩码为准（NL 没锁定就不计）；`scoreAll(gold, pred, mask?)`（[:179](../../scripts/eval/scorers.mjs#L179)）新增返回 `exactIntentScoped`。保持无 SDK 依赖。
- **改** [eval-llm.mjs:129](../../scripts/eval-llm.mjs#L129)：若 case 有 `fixedFields`，在 user 消息后追加 `Fields: <prop 列表>;请推断 formtype/membership/actions/布局`——把字段集喂给模型，使 propSet 可确定。
- **改** [eval-llm.mjs](../../scripts/eval-llm.mjs) 聚合与 record（[:221-224](../../scripts/eval-llm.mjs#L221) / [:311-330](../../scripts/eval-llm.mjs#L311)）：新增顶层 `inSchemaIntentScoped`（heldout 上的 scoped 均值）与 `byCapabilityScoped`；徽章端点（[:341-350](../../scripts/eval-llm.mjs#L341)）增一个「scoped 口径」消息（与现有 core 徽章并列，先不替换）。

### 3.3 新增/强化测试

- **强化** `scripts/eval/scorers.spec.ts`（Wave 1 已有 meta-eval）：
  1. 对标了掩码的 case 跑 `scoreAll(gold, gold, mask)` → `exactIntentScoped===true`。
  2. 掩码为空 → `exactIntentScoped === exactIntentCore`（兼容性断言）。
  3. 扰动**掩码内**维度 → scoped 掉；扰动**掩码外**维度 → scoped **不掉**（证明「只对锁定维度记分」咬得住）。
- **新增** 一道 `check:*` 轻量校验：`pinnedDims` 里引用的维度名必须是 `CAPABILITY_SCORERS` 的合法 key（防标注漂移）。

### 3.4 PR-A1' 验收

- `check:consistency`（含 `check:scorers`）绿；掩码缺省的 case 行为零变化。
- 新 meta-eval：scoped 对「锁定维度」咬得住、对「未锁定维度」免责。
- 带 key 复测（**需显式指令**）：heldout `inSchemaIntentScoped` 显著高于 `inSchemaIntentCore`（这正是「口径不公平」被纠正的量化证据）。
- 徽章同时展示 core（硬诚实数字）与 scoped（良定义口径），注脚说明两者区别。

### 3.5 落地记录（✅ A1' 收尾：全量 25/25 标注 + 管道落地 · 2026-10-12）

**粒度拍板（用户决策）：** `pinnedDims` 采**细粒度 `维度:字段`**（如 `formtype:amount`），只记 NL 真锁的那一列；裸写维度名=整维度。理由：B2 的全部价值在「只记 NL 真锁的那一点」，粗粒度会把 NL 没提的字段也拖进 AND，又把欠定惩罚带回来。

**已落地（全部本地门禁绿、零付费 run）：**
- **子步 1 · 评分核** [scorers.mjs](../../scripts/eval/scorers.mjs)：`scoreAll(gold, pred, mask)` 加第三合成分 `exactIntentScoped`；新增 `FIELD_SCORERS`（formtype/membership/**inQuery/inTable/inForm**/extPoints/apiParams/dataOptions 的字段级判定）+ `parsePinnedDim`/`isValidPinnedDim`/`FIELD_SCORABLE_DIMS`/`WHOLE_SCORABLE_DIMS` 导出。掩码缺省 → `scoped ≡ core`。
- **子步 2 · 入参与防漂移** [score-golden.mjs](../../__tests__/golden/scripts/score-golden.mjs) 接受可选 `fixedFields`/`pinnedDims`（仅形状校验，Layer-1 不依赖 scorers）；token 语义合法性 + `维度:字段`/`fixedFields` 的 prop 必须真实存在 → 落在 meta-eval 的全量语料体检里（致命断言，已验证「引用幽灵字段即翻红」）。
- **子步 3 · eval 驱动** [eval-llm.mjs](../../scripts/eval-llm.mjs)：`nlToConfig(…, fixedFields)` 把给定字段喂模型；`scoreAll(gold, pred, mask)`；聚合 `inSchemaIntentScoped`(+All)、控制台与 record 并列输出 core/scoped；新增 `last-accuracy-badge-scoped.json` 徽章（nightly commit-back FILES 已纳入）。**无 key 仍干净 SKIP、门禁仍落 core**（决策 A1'-a，scoped 本 PR 只观测）。
- **meta-eval** [scorers.test.mjs](../../scripts/eval/scorers.test.mjs)：掩码自洽 / 掩码内咬得住 / 掩码外免责 / 空掩码退化 / token 校验器 / 全量语料掩码合法性。

**全量标注（25/25，`check:scorers` 掩码合法性 + `test:golden` 形状校验双绿）：** 25 条 golden 全部补齐 `fixedFields`/`pinnedDims`。标注原则：**只钉 NL 表层无歧义锁定、且评分器能忠实捕捉的那一点**。两条可操作细则：
- **语义推断不钉**：「头像→Upload」「下单时间→DatePicker」「启用状态→Switch」这类从字段名推断的 formtype 一律不进 `pinnedDims`；只有 NL 明说控件（「级联选择」→Cascader、「下拉」→Select、「用 Switch 表示」→Switch）或明给枚举项（「状态（启用/禁用）」→Select+dataOptions）才钉 `formtype:X`(+`dataOptions:X`)。
- **评分器捕捉不到的锁不钉**（避免发射"看着在测、其实恒真/恒假"的伪信号）：`operationColumnEqual` 只比按钮 **name 集**（不含 permissionValue），故 case 04 的 `employee:delete` 行权限、case 23 未点名行按钮时的 operationColumn 均**不钉**；`dialogsEqual` 只比 dialog key 集 + formItems prop 集（不含 width/hasCustomRender），故 case 12 的 720px 宽、case 18 的自定义 render、case 23 未点名 formItems 的 dialogs 均**不钉**；无 i18n 评分维度，故 i18n 不钉。
- **membership 字段分量本批不钉**：`membershipEqual`/字段级分量均是裸 `===`、**无默认归一化**（gold 省略 `inQuery`(默认 true) vs pred 显式 `inQuery:true` 会误判不等），钉上去会低估语义相等的预测、污染 scoped 信号。分量评分器（inQuery/inTable/inForm）已落地并自测（咬得住 + 免责两向），留给未来显式写全 membership 的 case，本批 22 条一律走更稳的整维度/其它字段维度。
- **propSet 遇弹窗专属字段歧义时不钉**：case 05/19 的 `creditLimit`/`settlementCycle` 只在 edit 弹窗、不在顶层 `fields`，顶层字段集是否含它属 NL 欠定，故 05/19 **不钉 propSet**（但钉 `dialogs`——dialogsEqual 恰好锁住"edit 比 add 多一项"这条 NL 真锁的信息）；`fixedFields` 亦受合法性守卫约束（prop 必须真实存在于 `config.fields`），弹窗专属字段不入 `fixedFields`。
- **target/mode/virtualScroll 按 NL 显式与否钉**：NL 明说「用 antd」/「Vue2」→钉 `target`；明说「SFC 模式」→钉 `mode`；明说「虚拟滚动」→钉 `virtualScroll`。**反例 case 25**：config 是 `mode:sfc` 但 NL 通篇未提 SFC，故**不钉 mode**（只钉 propSet/actions/virtualScroll）——标注锚 NL，不锚 config。

**据实偏差（相对原 §3.2 计划）：**
1. meta-eval 文件实为 `scripts/eval/scorers.test.mjs`（`check:scorers`），非 `scorers.spec.ts`。
2. `byCapabilityScoped` **暂缓**：忠实的 scoped 版需 per-token 结果、且「字段级 pin 却按整维度 pass 聚合」语义自相矛盾；现有 `byCapability`（整维度诊断）+ 头条 `inSchemaIntentScoped` 已够用，不发射含糊指标。
3. README 公开 scoped 徽章**推迟**到首次真实 nightly 填出 `last-accuracy-badge-scoped.json` 之后再加（否则 raw URL 404）；本 PR 只落管道 + nightly 提交清单。

**✅ 已定夺（membership 粒度，用户决策）：** 字段级 membership 拆成 `inQuery:X` / `inTable:X` / `inForm:X` 三个独立 token（原捆绑式 `membership:X` 仍保留为"三者同时相等"的整字段判定）。拆分评分器已落地 + 自测（翻 `amount.inQuery` 翻红、翻同字段 `amount.inTable` 免责）。**但**因上述"无默认归一化"的评分器事实，本批 22 条标注**实际未使用** inQuery/inTable/inForm 分量（见上一节第 3 条）——拆分是把能力备好，钉不钉由"评分器能否忠实捕捉"这条更硬的线决定。此偏差已据实记录，非回避。

## 4. PR-A2' · B1 schema 摄取层（锚定 propSet）  ✅ 已落地（引擎 + MCP 工具 + CLI）

> 目标：补「四大缺口」里最大的一块——让字段来自**机器可读契约**而非散文推断。这是让 scoped 口径在**真实生产**中立得住的前提（B2 让它在语料里立得住）。

### 4.1 设计决策（三条）

**决策 A2'-a — 新建一个纯函数 `ingestSchema` 落在 `@es-plus/shared`。** 入参一段契约文本 + 一个 `kind`（`openapi` | `jsonSchema` | `ts-interface` | `sql-ddl` | `sample-json`），出参 `{ fields: Array<{prop,label,type}>, warnings }`。放 shared（不是 mcp-server）因为它要被 CLI、MCP、eval 三处复用，且必须确定性可单测。**先做 2 种高价值来源**（OpenAPI/JSON Schema + sample-JSON），其余 kind 留 stub + warning，增量补。

**决策 A2'-b — 新增代码级「类型→formtype 默认映射」。** 结构化脊柱按设计没有（见 §0），这里补一张**干净的、按数据类型**的映射（不是 [crud-engine.ts](../../packages/shared/src/crud-engine.ts#L31-L49) 的关键词启发式）：`integer/number→InputNumber`、`boolean→Switch`、`string+format:date→DatePicker`、`string+enum→Select(+dataOptions)`、`array→Transfer/Checkbox`、否则 `Input`。导出为 `defaultFormtypeForType(type)`，供摄取层预填、也供 prompt 文档引用（单一事实源，杜绝 prompt 与代码教的不一致——Wave 1 曾踩过「prompt fall-through 到 Input 教错」的坑）。

**决策 A2'-c — 摄取只定 `fields` 骨架，欠定残差仍交 LLM。** 摄取出的 `fields`（prop/label/type/默认 formtype/枚举 options）作为 `fixedFields` 喂给模型；模型只补 NL/flags 决定的**残差**（哪些进 query/table/form、label 本地化、actions、布局、tableBtns、dialog 拆分）。职责清晰：**确定的来自契约，欠定的来自 NL——这正是 scoped 口径记分的那条线。**

### 4.2 文件级改动

- **新增** `packages/shared/src/schema-ingest.ts`：`ingestSchema(text, kind)` + `defaultFormtypeForType(type)`。无运行时新依赖（OpenAPI/JSON Schema 为 `JSON.parse` + 遍历；sample-json 同理；ts-interface/sql-ddl 可后置到用 esbuild/轻量正则，先 stub；**两类已于 AN-20 用轻量扫描器落地**）。
- **~~改~~（落地修正：不改）** [ai-nl-to-config-prompt.ts](../../packages/shared/src/ai-nl-to-config-prompt.ts) 的 formtype 规则段。**源码核实后发现这是两条不同的轴**：prompt / 字段 `.describe` 教的是**按字段含义**推断（status→Select、头像→Upload），而 `defaultFormtypeForType` 是**按数据类型**推断（integer→InputNumber）。强行让语义 prompt「引用」数据类型表是错配。改为：`defaultFormtypeForType` 作为**数据类型轴**的单一事实源（供摄取层用），语义 prompt 保持不动；真正可守护的一致性 = `defaultFormtypeForType` **对输入域全覆盖且输出恒 ∈ `VALID_FORM_TYPES`**（无 undefined 落空），这正面堵住 Wave-1「fall-through 教错」坑。该不变量以 **vitest 全覆盖断言**实现（见 §4.3），而非 `check:*.mjs`——它本质是代码执行属性（既有 check 脚本都是文本巡检，验不了全覆盖），且 repo 刚修过的 shared-build 排序 CI 坑让「跑脚本前须先 build」的新门禁得不偿失。
- **新增** MCP 工具 `ingest_schema`（[`packages/mcp-server/src/tools/ingest-schema.ts`](../../packages/mcp-server/src/tools/ingest-schema.ts)，薄封装）：入参 `{ text, kind, name?, apiUrl? }`，内部 `ingestSchema → composeCrudConfig(table/form=摄取字段)`，出参一份**草拟好的 `StructuredCrudConfig` JSON + 合并告警**（供宿主 LLM 审阅修订后再调 `generate_crud_from_config`，占位 name/apiUrl 显式告警）。注册进 [tools/index.ts](../../packages/mcp-server/src/tools/index.ts)。
- **~~延后~~ 已交付（2026-10-29）** CLI 子命令 `es-plus ingest <file>`。当时判断「它只是薄壳」成立，但薄壳里的三件事必须做对，否则壳比核更危险：①**stdout 只放草稿 JSON**（推断说明/告警/下一步全走 stderr，`> config.json` 与 `-o` 产出同字节）；②**形态推断**（`.sql`/`.ts`/`.yaml` 看扩展名，JSON 看顶层 `openapi`/`swagger`/`$schema`/`type:"object"+properties`，`-k` 可覆盖、拼错即报错不回落）；③**失败即非零**（文件不存在 / kind 非法 / 抽不到字段）。随之把 `buildIngestDraft` 从 mcp-server **下沉到 shared**（`src/ingest-draft.ts`），MCP 改为转出同一实现 —— 两个宿主的占位符与告警文案从此不可能漂。守卫：shared 6 例 + CLI 20 例（含 stdout 纯度负测）。
- **（可选、更强）** `detect_project_target` 的对偶：日后把「离线文档解析」升级为「活 introspection」（直连运行中的后端 `/openapi.json` 或 DB），作为 B1 的 v2，不在本 PR。

### 4.3 新增/强化测试

- **新增** `packages/shared/__tests__/schema-ingest.spec.ts`：各 kind 的样例契约 → 期望 `fields[]`（含类型→formtype 预填、枚举→Select+options）；畸形契约 → 带 warning 不抛。
- **新增** 端到端用例：一段 OpenAPI → `ingestSchema` → `composeCrudConfig` → `generateFromConfig(mode=schema)` → esbuild 解析通过（证明摄取产物接得上脊柱）。

### 4.4 PR-A2' 验收  ✅

- ✅ 3 种高价值来源可用（jsonSchema / openapi / sample-json）；**AN-20（2026-10-20）补齐 ts-interface / sql-ddl**（轻量扫描器，见 AI-NATIVE-REMEDIATION-PLAN.md 的 AN-20 落地记录）。
- ✅ `defaultFormtypeForType` 对输入域**全覆盖且输出恒 ∈ `VALID_FORM_TYPES`**（vitest 全覆盖断言守护，替代原「与 prompt 文字同源」口径——见 §4.2 落地修正）。
- ✅ 摄取 → `composeCrudConfig` → `generateFromConfig(mode=schema)` 全链产物过 esbuild（`transformSync` loader:ts）解析（schema-ingest.spec.ts 端到端用例）。
- ✅ 门禁全绿：shared 422 测试、mcp 112 测试（覆盖率 branches 85.9≥77 / stmts 46.67≥27）、`check:scorers` / `test:golden` 25/25 / `fragment:smoke` 78/78、workspace typecheck。
- ⏳ 带 key 复测（**需显式指令**）：以 `fixedFields` 来自摄取的方式跑 scoped，propSet 维度趋近 1（字段给定后不再是猜）。**本次未触发**。

## 5. PR-A3' · B3+B4 精修回环 + pin（兑现「收敛」定义）✅ 已落地（diffConfig + refine_config + eval K 轮驱动）

> 目标：把承重定义里的「≤K 轮精修内收敛」做成**可度量**（指标）且**可用**（UX）。这是四大缺口的最后两块：refinement/diff 回环 + pin。

### 5.1 设计决策（三条）

**决策 A3'-a — pin 载体就用现成的 `StructuredCrudConfig`。** 它已可序列化、可移植、跨轮复用（[index.ts:128-134](../../packages/mcp-server/src/index.ts#L128-L134) 已声明「Schema is portable / keep the same JSON and just regenerate」）。**不做数据库、不做会话态**——pin 就是那段 JSON，由调用方（host LLM / CLI）持有。✅

**决策 A3'-b — `refine_config` 工具做成「确定性 validate + diff」（落地修正：~~喂给模型~~ 不在工具内调模型）。** §5 原写「config + NL 修正 → **喂给模型** 产出新 config」。源码核实后判定这与 es-plus 的 MCP 确定性工具范式冲突（LLM 推理只活在 host/CLI/eval，工具一律确定性，见 generate-from-config.ts "You (the AI client) do the reasoning"），**已评审拍板偏离**：由 host LLM 产出修订后的 `revised`，工具 = `validateStructuredConfig(revised)`（无效回 Zod 错误）+ `diffConfig(previous, revised)` 回显本轮改动。与现有 `validate_config` 同范式。原文「复用 A3 的 `validateAndRepair`」亦为错配——源码中**不存在** `validateAndRepair`（A3/C2-a 未落地），本 PR 用既有权威 `validateStructuredConfig` 做一次性校验，repair 回环留给 C2。

**决策 A3'-c — eval 侧 K 轮收敛驱动 + `convergence@K` 指标（只观测、不门禁；只认 scripted refinements）。** 在 [driveToValidConfig](../../scripts/eval-llm.mjs) 的 schema-repair 自修复环**之外**套一层精修循环：turn 0 后延续**同一段对话**逐条喂 `refinements` 的修正，每轮重算 scoped 分，`firstConvergedTurn` 记首个 `exactIntentScoped===true` 的 0-based 轮次（0=zero-edit，null=未收敛）。**头条 zero-edit/scoped 口径恒取 turn 0，精修不污染它。** §5 原文的 `diff(gold,pred)` 自动推修正会**泄漏 gold** → 收敛率虚高，**刻意不采用**（最多作 debug 上界，绝不进 record/badge）；与 heldout vs few-shot 的诚实性同源。指标沿用 B2 scoped 的「本 PR 观测、未门禁」先例。

### 5.2 文件级改动（已落地）

- **新增** [`packages/shared/src/config-diff.ts`](../../packages/shared/src/config-diff.ts)：`diffConfig(prev, next): ConfigDiff` + `summarizeDiff(diff)`，纯函数、不依赖 Zod（三成员布尔按 schema 默认 true 归一后比），`refine_config` 与 eval 共用。barrel 导出。单测 [config-diff.spec.ts](../../packages/shared/__tests__/config-diff.spec.ts)（8 例：增/删/改字段、formtype、membership、name/apiUrl、actions、空 prev）。
- **新增** [`packages/mcp-server/src/tools/refine-config.ts`](../../packages/mcp-server/src/tools/refine-config.ts)：`buildRefineResult({previous, revised})` 纯函数 + `registerRefineConfig`。单测 [refine-config.spec.ts](../../packages/mcp-server/__tests__/refine-config.spec.ts)（金额改数值右对齐 / 非法 revised 回错无 diff / 无改动 / 首轮）。
- **改** [eval-llm.mjs](../../scripts/eval-llm.mjs)：`nlToConfig` 拆成 `buildInitialMessages` + `driveToValidConfig`（可延续对话）；per-case 加 K 轮精修驱动（仅中文门禁语言 + 标了 refinements）；record 增 `convergence { k, source, rateAtK, meanTurnsToConverge, converged, total }`（无语料则为 null）；控制台打印 `convergence@K`。
- **改** [scorers.mjs](../../scripts/eval/scorers.mjs)：加 `firstConvergedTurn(scores)` 与 `summarizeConvergence(rows, k)` 纯函数；meta-eval [scorers.test.mjs](../../scripts/eval/scorers.test.mjs) 覆盖二者（无 key 可跑）。
- **改** [score-golden.mjs](../../__tests__/golden/scripts/score-golden.mjs)：Layer-1 形状校验接受可选 `refinements: [{correction, turn?}]` 与 `convergesBy`（正整数、需伴随 refinements）。
- **新增** golden 收敛语料 [26-order-amount-refine.json](../../__tests__/golden/cases/26-order-amount-refine.json)：金额首轮常猜成 Input，一条自然纠正后应收敛到 InputNumber（scoped 铰链 formtype:amount）。

### 5.3 PR-A3' 验收

- ✅ `diffConfig` 纯函数单测覆盖增/删/改字段、formtype、membership、name/apiUrl、actions。
- ✅ `refine_config`（buildRefineResult）单测含「金额改数值右对齐」→ 合法 + diff 捕获 formtype/align 变更。
- ✅ 门禁全绿：shared 430 测试、mcp-server 116 测试、`check:scorers`（含收敛纯函数）、`test:golden` 26/26、workspace typecheck、lint 0 error。
- ✅ 带 key 付费复测已跑（2026-10-12，`pa/claude-opus-4-8` @ PPIO 中继，46 调用，exit 0）：`convergenceRateAtK`（K=3, heldout）= **100%**、`meanTurnsToConverge` = **0.00**（converged 1 / total 1），已持久化进 `last-accuracy.json.convergence`。同轮口径：zero-edit heldout 35.0%（GATED，仍 < 95%）、scoped heldout 70.0%（观测）、attr 94.4%、compiles 100%。
  - ⚠️ **数字真但空心**：唯一的收敛语料 case 26 在 turn 0 就 zero-edit（真实模型首发即 `amount: InputNumber` + `align: right`），scripted 精修轮**从未触发**（`0 次纠正尝试`）。故「100% / 0 轮」反映的是 zero-edit 命中、**不是精修恢复**。收敛的打分数学（`firstConvergedTurn`/`summarizeConvergence`）已被 `check:scorers` 的 turn>0 合成序列单测覆盖，但 **eval-llm.mjs 的实时多轮精修环未被真实模型走到**。待一条「强模型 turn 0 必错、一条自然纠正后收敛」的语料来真正压测；为避免 overfit golden，**不**此刻改语料硬逼它错。「95% 第二条腿」目前是良构但 n=1 空载。
  - ✅ **更新（2026-10-12，PR-B3'→B3''：空心已填实）**：补真·逆先验语料 + 统一 ∨ 指标后，精修环已被真实模型走到。
    - **指标（B3'）**：`meets95Definition`/`summarize95` 把「scoped zero-edit ∨ ≤K 轮收敛」按 case OR 成单一数字（此前两条腿只分开报、从未 OR）。
    - **铰链重定向（B3''）**：首版 membership 语料（inQuery over-inclusion）被 opus-4-8 的闭合查询集推理**全部零编辑**，精修环仍未 fire。改用**结构性必 miss** 的铰链——欠定 base NL（「只按X搜索」）+ gold=精修后最终意图（该字段 `inQuery:true`）：turn-0 必 scoped=X（模型对未提及字段恒置 `inQuery:false`，few-shot「只按X搜索→其余 false」正好强化），一句「X 也要能筛选」后恢复。弃用 `formtype:Switch`（few-shot 已教「状态/是否→Switch」，模型多零编辑成空壳；08/14 实测仍 miss 故会 fire，但属概率性，不如 membership-under-spec 确定）。语料 [27 日期](../../__tests__/golden/cases/27-workorder-createdat-query-refine.json)/[28 文本](../../__tests__/golden/cases/28-customer-owner-query-refine.json)/[29 枚举](../../__tests__/golden/cases/29-asset-status-query-refine.json)。
    - **付费复测（`pa/claude-opus-4-8` @ PPIO，exit 1 = 预期门禁、非崩溃）**：27/28/29 turn-0 scoped=X（如期 miss）→ **第 1 轮收敛**。`convergence@3`（heldout）100%（4/4），**mean turns 0.00 → 0.75**（3 次真恢复 + case 26 zero-edit），精修环**首次被真实模型走到**。`95%-definition`（heldout）**73.9%（17/23）**，现为两条活腿的真 ∨。诚实代价：scoped-zero-edit heldout 65→61%（27/28/29 从「leg-1 白送」变「leg-2 真测」）；zero-edit core heldout 30.4%（仍 GATED，预期）；compiles 100%；membership 仍最弱（48%）。
  - ✅ **更新（2026-10-13，PR-B4：两个结构化 ∨-blocker 填平，跨过 95% 线）**：分类清楚「∨ 的结构化失败≠模型缺口」后，定位并修掉两个独立的「正确配置被误罚」问题（详见 memory `tablebtns-actiontype-canon-root-cause`），付费复测确认 `95%-definition`（heldout）**73.9%（17/23）→ 95.7%（22/23）**，首次越过约定的 95% 线。
    - **①tableBtns（prompt/gold，commit `7749620`）**：few-shot 示例 #3 把「新增订单」写成 `actionType:'add'`，违库契约 `DEFAULT_TOOLBAR_BTNS`——`es-crud-page.vue handleToolbarBtnClick` 只在 `if(btn.dialogKey)` 开弹窗，`actionType:'add'` 落到 `emit('add')` 不开弹窗 = **运行时死按钮**。修法 = few-shot 改 `dialogKey:'add'` + prompt 加库契约分流规则（add/edit/view→dialogKey、export/import→actionType、delete→confirm）+ gold23 补 `actionType:import/export` + spec 断言锁。方向 = 库契约→prompt/gold，非 overfit。复测 `tableBtns` capability **100%（5/5）**。
    - **②operationColumn（scorer，commit `ec76f29`）**：`es-crud-page.vue normalizedOperationColumn`（[:157-177](../../packages/vue3/src/components/es-crud-page/src/es-crud-page.vue#L157-L177)）在 `operationColumn===undefined` 时**按 actions 自动派生行按钮**（view→查看/edit→编辑/delete→删除），故「省略 operationColumn + actions 含 edit/delete」与「显式 `btns:[编辑,删除]`」渲染**同一组行按钮**；旧 `operationColumnEqual` 把 `undefined` 当空集 → 误罚正确的极简配置（**[golden-inquery-default-true-trap](../../scripts/eval/scorers.mjs) 在 scorer 层的同构**）。修法 = `effectiveRowBtns(cfg)` 镜像组件派生、比**有效行按钮集** + meta-eval 加「派生等价 + 守恒反例」回归锁。方向 = 库默认→scorer，非 overfit。复测 `operationColumn` capability **17%（1/6）→ 100%（6/6）**，11/17/20 的 scoped 全翻过（17 的 `actions` miss 不在 pinnedDims，不拦 ∨）。
    - **本轮全口径（heldout 23）**：`95%-definition` **95.7%（22/23）** · `convergence@3` 100%（4/4，mean 0.75）· scoped-zero-edit 82.6% · zero-edit core 39.1%（仍 GATED，约定错靶）· compiles 100% · propF1 95.6% · attr 94.0% · actions F1 98.2% · `operationColumn` 100% · `tableBtns` 100% · membership 仍最弱 52%（12/23）。
    - **残余 ∨-fail = case 08 → 已改 leg-2 并付费确认（commit `872429d`）**。诊断：旧 NL「在线/离线/故障 **用 Switch 表示是否启用**」自相矛盾——三值具名枚举却标 Switch，模型按 few-shot「状态(枚举)→Select」合理选 Select 反被误罚。改造成 leg-2 结构性收敛语料（[08-device-switch.json](../../__tests__/golden/cases/08-device-switch.json)，铰链 `formtype:online`）：turn-0 NL 刻意写成「在线/离线/故障三种」枚举（结构性必 miss → Select），一句「合并成在线/离线两态、表单用开关 Switch」后命中 few-shot「开关→Switch」→ 第 1 轮收敛，机制与 27/28/29 同族。
    - ✅ **更新（2026-10-13 第二轮付费复测，`pa/claude-opus-4-8` @ PPIO，exit 0）：case 08 第二条腿恢复已验证。** 08 zh turn-0 `scoped=X`（`online.formtype` want Switch got Select，如期结构性 miss）→ **第 1 轮收敛**（精修环真 fire，非 zero-edit 空壳）。全口径（heldout 23）：**`95%-definition` 95.7%（22/23）→ 100%（23/23）**、**`convergence@3` 4/4→5/5（mean turns 0.75→0.80）**、compiles 100%、tableBtns 100%（5/5）、scoped-zero-edit 82.6%、zero-edit core 47.8%（仍 GATED，约定错靶）。两条活腿（scoped zero-edit ∨ ≤K 收敛）均结构性过,逐 run ±1 case 的 capability 抖动（本轮 `operationColumn` 83%=case04 模型丢 `edit` 动作下游、非 pinned、不碰 ∨；`actions` 91%）属模型采样随机性,非 scorer/gold 回归。**P2 的「95% 可达」至此由真实强模型在 schema-grounded 语料上以 heldout ∨ 100% 兑现。**

## 6. PR-C2 · A3+A4 生产安全网（服务端 validate→repair + 沙箱 build-repair）  ✅ A3 已落地（确定性前门校验）· A4 延后

> 目标：把 P1 的「一次性」从「理论不变量」兜成「用户视角永远拿到能编译的产出」。C1 让坏输入几乎不可能变成坏代码；C2 兜住剩余尾部 + 把非法 config 挡在用户之前。

### 6.1 设计决策（两条）

**决策 C2-a — 确定性前门校验（A3）✅ 已落地。** 已评审拍板（同 A3' 的承重分界）：**前门只做确定性校验、回结构化错误，模型驱动的「repair 回灌」留在握着 client 的宿主侧**。把权威 Zod 判定 + 结构化 `/path: message` 错误/建议抽到 shared 的 `validateAndRepair`（[validate-and-repair.ts](../../packages/shared/src/validate-and-repair.ts)），让 mcp 前门、CLI `--from-config`、eval 共用同一份判定；两个生成前门（generate_crud / generate_crud_from_config）生成前先过它，**非法 config 到不了用户面前**，且回的是结构化 per-issue 错误 + 建议，而非过去 `assertValidConfig` 抛出的一句泛化 `Error generating code: …`。

> **三处偏离设计原文（均为确定性决策的直接后果，已记录）：**
> 1. 设计 §6 原写「把 nightly / eval 的 ≤2 次 Zod **回灌循环**搬进前门」。那个回灌是**模型驱动**的（eval 的 [driveToValidConfig](../../scripts/eval-llm.mjs#L143-L170) 跑在握着 client 的宿主侧），塞进确定性 MCP 工具会破坏「MCP 确定性 + 宿主推理」承重分界。故**前门不含回灌循环**——只校验 + 回结构化错误，宿主据此下一轮自纠。
> 2. 设计原文称前门「现在只校验一次、发非阻塞警告」——不确。[validate-config.ts](../../packages/mcp-server/src/tools/validate-config.ts) 的 validate_config 是**独立校验工具**、回的是 errors；非阻塞**警告**只有 generate 路径的 [buildSemanticWarnings:294-345](../../packages/mcp-server/src/tools/generate-from-config.ts#L294-L345)。而 `assertValidConfig` 的抛错其实**早已**被两个前门的 try/catch 兜成 `isError:true`——不是「冒泡」，真实缺口是「泛化字符串、无 per-issue 结构」。
> 3. `validateAndRepair` **不按 schema 默认改写** config（不回传 safeParse 的解析结果）：那会把省略的 `inQuery` 等落成显式 `true`，是另一层语义变更，[structured-generator.ts:99-101](../../packages/shared/src/structured-generator.ts#L99-L101) 的 `assertValidConfig` 已明确拒绝。本函数与它一致：只判、不改。「repair」是宿主下一轮的事。

**决策 C2-b — 沙箱 build-repair 回环（A4）⏳ 本 PR 延后。** 已拍板：A4（临时目录 vite build + 编译错误回喂的闭环，`--verify-compile` 旗标）与全量 vite 沙箱因成本/时延 + 需宿主侧模型回环，**拆成独立后续 PR**。CI 的 `golden-compile` job（[typecheck.yml:143](../../.github/workflows/typecheck.yml#L143) → `golden:e2e`）仍是广度保证；C1 的 parse-gate 已兜住绝大多数编译尾部。

### 6.2 文件级改动（A3 已落地）

- **新增** [validate-and-repair.ts](../../packages/shared/src/validate-and-repair.ts)（shared，SDK-free）：`validateAndRepair(config): ValidationResult` + `formatIssuePath` + `zodIssuesToResult` + `ZodIssueLike`。权威 `StructuredCrudConfigSchema.safeParse`，失败渲染成与 Ajv 分支一致的 `/path: message` 形态。barrel 导出。
- **改** [validate-config.ts](../../packages/mcp-server/src/tools/validate-config.ts)：删掉本地重复的 `formatZodPath`/`zodIssuesToResult`/`validateStructuredConfig` 实现体，`validateStructuredConfig` 收敛成 shared `validateAndRepair` 的薄包装（`validatePayload`、`refine_config` 调用方零改动）。
- **改** [generate-from-config.ts](../../packages/mcp-server/src/tools/generate-from-config.ts)：新增 `formatValidationError(result)`（与 validate_config 错误块同形）；`generate_crud_from_config` 生成前走 `validateAndRepair`，非法则回 `isError:true` + 结构化错误。
- **改** [generate-crud.ts](../../packages/mcp-server/src/tools/generate-crud.ts)：表格路径 `composeCrudConfig` 产出的 config 过 `validateAndRepair` 再 `generateFromConfig`（gate-only，不替换为归一后的 config——happy path 行为不变）。
- **测试**：shared `validate-and-repair.spec.ts`（13，内核 + 两个纯 helper）；mcp `generate-tools-and-prompts.spec.ts` 加「前门确定性校验闸」描述块（非法 → nothing generated + per-issue；合法 → 仍生成）；既有 `validate-config.spec.ts`（11）作为委托未改语义的集成守卫。

### 6.3 PR-C2（A3）验收  ✅

- ✅ 非法 config（坏枚举 formtype）→ 前门回结构化 `/fields/0/formtype` 错误 + 合法取值建议，**什么都没生成**（无 ```` ``` ````、无旧的 `Error generating code:`）。
- ✅ 合法 config happy path 零回归（仍出代码）。
- ✅ 门禁全绿：shared 443 测试、mcp-server 118 测试、workspace typecheck exit 0、lint exit 0（仅既有 any/console 警告）、`test:golden` 26/26、`fragment:smoke`、`check:scorers`、`check:exports`、`check:schema-validator`、`check:schema`、`check:fragment`。Windows 上不跑 `one-config:check`/`og:check`（CRLF 误报）。
- ⏳ A4（`--verify-compile` 沙箱 build-repair）独立后续 PR。

## 7. 全波风险与护栏

| 风险 | 护栏 |
|---|---|
| C1 parse-gate 误判合法扩展点为非法 | §2.3 用真实 golden 的 formatter（case 24 的 `toFixed`）做正例回归；闸只解析不改写 |
| 迁移门禁到 scoped 当天变红 | 决策 A1'-a：scoped 新增、core 保留，逐步 ratchet（同 Wave 1 决策 B） |
| 规格掩码标注把 NL 没锁的维度误标为锁定 → 虚高 | §3.3 meta-eval 的「掩码外维度免责」断言 + 掩码 key 合法性 `check` |
| B1 摄取被当成「全自动」掩盖欠定残差 | 决策 A2'-b/c：摄取只定 `fields` 骨架，残差显式交 LLM、显式计入 scoped |
| prompt 的 formtype 规则与代码映射再次漂移 | 决策 A2'-b（落地修正）：`defaultFormtypeForType` 作为**数据类型轴**单一事实源 + vitest「全覆盖 + 输出恒 ∈ VALID_FORM_TYPES」不变量；语义 prompt 是另一条轴，不绑定（见 §4.2） |
| 收敛驱动用 diff(gold,pred) 变相泄题 | 脚本化 `refinements` 优先；diff-oracle 仅模拟「人类看着错改一处」，且只在 eval、不进产物 |
| 付费 eval run 被无意触发 | 全波所有「带 key 复测」均标注**需显式指令**；不自触发、不在本设计阶段跑 |
| 持久化 JSON 的 Windows CRLF 守卫误报 | 徽章/accuracy JSON 强制 LF（沿用团队既有记录 memory `windows-crlf-guard-false-positives`） |
| sfc 模式欠支持 dialogs/tableBtns 被用户当成全保真 | 决策 C1-a：前门默认 schema + sfc 保真度警告 |

## 8. 一句话

Wave 2 不赌模型：**P1（100% 编译）靠在确定性脊柱上补一个扩展点 parse-gate（C1）+ 一道沙箱安全网（C2），做成对任意 valid config 成立的真不变量；P2（95% 准确率）靠先把口径改成「只记 NL 锁定维度」（A1'）、再用 schema 摄取锚定字段（A2'）、最后以 ≤K 轮收敛兑现承诺（A3'）。** 承重前提已拍板：95% = schema-grounded 语料上的 scoped zero-edit ∨ ≤K 轮收敛——这是诚实且可达的，而旧定义数学上不可达。先做 C1+A1'（最便宜、最高杠杆、零付费），其余依序。
