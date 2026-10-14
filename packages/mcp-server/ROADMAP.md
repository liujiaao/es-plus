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

**4 处硬约束（已折入）**：① Golden 规模验收门（见上）；② AI-13 收紧措辞（host 杠杆非 server）；③ AI-16 不替代 render；④ Wave 5 扁平 vs 拆分架构抉择须显式做 → ✅ **已定稿**（AI-09 选 **(a) 加可选 `columns` 富列数组**，逐条依据见 AI-09 段）。

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
- **状态**：✅ 已落地（2026-10-13，vue3）。新增 `packages/vue3/__tests__/generated-runtime.spec.ts`（11 例）+ 共用 harness `runtime-harness.ts`：golden config → `generateFromConfig(mode:schema)` → 提取 `pageSchema` 对象（与 `score-golden.mjs` checkSyntax **同一条正则**，避免一处认的产物另一处认不出）→ 挂**真实** EsCrudPage/EsTable/EsForm/useDialog + 内存后端，断言「能渲染（拉数+回写 data-source+行文本）/ 表单能填且值随 formParams 下发 / 弹窗能开」。覆盖三种装配路径：01 legacy actions 模式、05 显式 dialogs 新模式、13 多 formtype；另单列 golden-30 断言**列级 permissionValue 的运行时门控**（AI-20 的运行时见证：无权限列不渲染、有权限正常渲染——证明是门控而非生成物根本没这列）。`crud-runtime.spec.ts` 改为复用同一 harness（后端契约不再可能分叉）。**踩坑记录**：`EsPlus` 的 install 会执行 `configureEsPlus(options)`（洗掉先前配置）且 `provide('$EsPlus', {...options})`，故全局 `permission` 必须经 `[[EsPlus, {permission}]]` 插件选项传入，先 `configureEsPlus()` 再挂载会被覆盖。golden-05「显式 dialogs 无 toolbarBtns」下工具栏**不**生成「新增」（组件既有行为，非缺陷），其弹窗靠行内「编辑」打开。**范围**：本轮 vue3（Tier-1 已证生成物可跑）；antdv（Tier-1 已有 crud-runtime 脚手架）留作同构扩展。**P0 至此全清**。

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
- **状态**：✅ 已落地（2026-10-13）。**架构抉择（用户拍板）= 运行时解释 + 放宽 `isHidden`**（不新增 `hiddenWhen` 键）：声明式条件是**纯 JSON 数据**，逐字节发射进 `pageSchema`（schema 模式仍是纯 JSON）；由 core `normalizeFormItem` 在**归一化唯一入口**把它编译成谓词 → **三端渲染器零逻辑改动**（`formItemListFilter` 无一处改动，「零代码联动」的承重点在此）。语义：`isHidden` = **条件成立即隐藏**，单条件或数组（AND），op = `eq|ne|in|nIn|empty|notEmpty|truthy|falsy`（缺省 `eq`），**表单作用域**（查询表单 + 新增/编辑弹窗），**非表格列**。改动：(1) core `types.ts` 加 `FieldHiddenOp`/`FieldHiddenCondition`/`FieldHidden` 三型 + 放宽 `FormItemOption.isHidden`（函数 | 声明式）；(2) `field-resolver.ts` 新增 `matchHiddenCondition`/`compileHiddenCondition`（`looseEqual` 只对 **number↔string** 宽放、刻意不采裸 `==`（会让 `''==0` 为真；该由 `empty/falsy` 表达）；未知 op / 非法 field **fail-open 返回 false**（不隐藏，避免丢信息）且**一次性 `console.warn`**）+ `filterVisibleFormItems` 加声明式分支；(3) `compat.ts` `normalizeFormItem` 水合（**只认非 null 对象**，函数/缺省原样透传，经 `Record` 视图读写绕开泛型索引签名）；(4) AI Zod `HiddenConditionSchema`/`HiddenConditionListSchema` + `FieldConfigSchema.isHidden`（复用 `isSafeProp` 防线 + `op` default `eq`）；(5) 生成器 `buildFormItem` **一处** emit（schema/SFC 共用；**不进** `buildTableColumn`——列级显隐走别的层）；(6) prompt 系统规则 + `RefundManage` few-shot + 覆盖守卫；(7) scorer 新增 `isHidden` 维度（**整对象深等值**，非 presence）+ meta-eval base/扰动；(8) golden 8 例（`39`–`46`，逐 op：eq/ne/in/nIn/empty/notEmpty/truthy+falsy 反相/数组 AND；跨 vue3×3/vue2×2/antdv×3 + schema×6/sfc×2）。
- **跨面板一致（本项特有）**：同步了 **MCP 内联 Zod**——`packages/mcp-server/src/tools/generate-from-config.ts` 的 `FieldConfigSchema` 此前**没有** `isHidden`（走 MCP 路径会被 Zod **静默剥掉**，与 AI-08/`position` 同类静默丢弃、零告警）。已补 schema；`check-schema-contract.mjs` 新增 `STRUCTURED_FIELD_CONTRACT` 守卫（两处 Zod 都必须声明 `isHidden`，**负测已验咬得住**：删声明即红，且 `isHiddenFooter` 不误匹配）+ `REQUIRED_FIELDS` 加 `form-item.isHidden`。MCP 资源/prompt 同步：`nl-to-config-examples` 加 `isHidden` few-shot（与 shared prompt 同域 `RefundManage`）、`conventions` 扩展点措辞更正（条件可见性是**声明式数据、非扩展点**）、`form-config`/`get-component-api`/`resources/types` 类型补 `isHidden`。
- **测试**：core 294（`field-resolver` +9 声明式例 / `compat` +4 水合例）、shared 463（Zod +7 / 生成器 +4）、三端 es-form 各 +2~3 例、**运行时见证**（`generated-runtime.spec.ts`：挂 golden-45 的**生成物** `dialogFormItems` 到真实 EsForm + reactive model，字段随开关出现/消失——把「发射了条件」升级为「条件真的驱动可见性」）、MCP +1 例（`z.object(shape).parse` 真解析保留 `isHidden`）。golden 46/46 + 双语 46/46；`check:scorers` OK（`isHidden 8 case(s)`）；全量 **2421** 测试 + typecheck 绿。
- **范围（保留项，非缺口）**：surfaces 前门（`generate_crud`）的 `SurfaceField` + zod3 `surfaceFieldSchema` + `composeCrudConfig` + fragment-generator 的 `isHidden` 接线**暂缺**——与 AI-08 前门同一保留项（前门连 `tableOptions` 都不带），待前门补 tableOptions 时一并带。另：`FieldHidden*` 类型**刻意不入** `PUBLIC_CONTRACT_TYPES`（否则按 `check:exports` 三端都要 re-export），按 vue3/antdv 本地 `FormItemOption` 特化同法各留一份。

### AI-07 — 字段联动 / computed · `L`
- **Why**：一个字段的值/选项依赖另一个字段，是复杂表单的核心需求，当前完全不可表达。
- **验收**：schema 声明依赖关系（**声明式 reaction + 表达式，对标 Formily `x-reactions`**，配合 AI-16 的 DSL）；三端等价；golden 覆盖（≥8 例）。
- **不走**裸 JS 回调（`on`/listenToCallBack 归 Tier-2/3），不拓宽自由串。
- **状态**：✅ 已落地（2026-10-14，commit `8efcbc8`）。**架构（用户拍板：一次落全——显示派生 + 值回写）**：字段级 `reactions: FieldReaction[]`（纯 JSON，**绝无回调**），每条 `{ dependencies?, when?, fulfill }`，`fulfill` 四键 `{ dataOptions?, required?, disabled?, value? }`——`dataOptions` 是**字面量选项数组**（AI-16 DSL 刻意排除对象字面量，故选项分支用**多条规则 + 各自 `when`** 表达）、`required`/`disabled`/`value` 是**表达式节点**（同一套 DSL，复用 `HiddenExprNodeSchema`）。**core**：新增零依赖纯规划器 `reactions.ts`（`resolveReactionOverlay` / `resolveReactionValues` / `collectReactionDependencies`，只读 model 不写）——逐键 try/catch + **fail-safe = 保留静态值**（畸形键丢弃、绝不产生空选项/误禁/写垃圾，方向同 `isHidden` 的 fail-open）+ `warn-once`；**`normalizeFormItem` 不参与**（与 `isHidden` 刻意不对称：reactions 依赖实时 model、每次变更重算，在 computed 里编译闭包会每次分配）。**三端渲染器只多两处相同接线**：① `formItemListFilter` 里 **overlay 先于 `normalizeFormItem`** 合并（`disabled`/`required` 须在归一化前进入，才到得了控件）——computed 天然响应式，无需新 watcher；② model **watcher**（source = 依赖值拼接串，只在依赖真变时触发；`looseEqual` 仅变更时写回 → 收敛终止；含 `MAX_REACTION_PASSES=8` 有界不动点兜底 + warn-once）。vue2 值回写走文件局部 `setReactiveModelValue`（末段与每个新建中间容器都经 `$set`，因 Vue 2 检测不到属性新增）。**求值全在 core → 三端等价由构造保证**（无渲染侧规划器）。**Zod**：shared 权威 + mcp 内联 zod3 **两份同改**（`ReactionSchema`/`ReactionFulfillSchema`；`.refine` 强制 `fulfill.value` 需非空 `dependencies`，防踩用户手改），`check-schema-contract.mjs` 加 `STRUCTURED_FIELD_CONTRACT` 成员 + 5 断言 + `REQUIRED_FIELDS` 登记。**生成器**：`buildFormItem` 一处 emit（schema/SFC 共用；**不进** `buildTableColumn`——列级非本次范围，同 `isHidden` 层级）。**eval/scorer**：`reactionsEqual`（整内容深等，`value`↔`dataOptions` 互换/`dependencies` 序错/`when` 错均算 miss）+ `CAPABILITY_SCORERS` + `FIELD_SCORERS` 三处接线，meta-eval 加「2c-bis) reactions」段。**教学/类型/文档**：prompt 规则 + few-shot、`nl-to-config-examples` 示例 + intro bullet、`conventions.ts` `reactions` 块、`resources/types`（`TYPES_FALLBACK_VUE3`）+ vue3/antdv 本地类型加 `FieldReaction*`、`usage.md` 删失效 `linkage:{effect,action}`（正是被禁的裸回调形态、零代码读取）改写为声明式 `reactions`。**golden**：15 例（`122`–`136`，options/value/required/disabled/级联/value+disabled/reactions+isHidden/多规则+when，三端齐 schema×11/sfc×4）。**验证**：core 328 / shared 502 / mcp 174 / vue3 550 / vue2 337 / antdv 598 全绿；`check:schema`/`check:contract`（FormItemOption 26 字段三端齐）/`check:scorers`（`reactions 15 case(s)`）等守卫全绿；`schemas:sync`→`check` 逐字节一致；`test:golden` **136/136**；typecheck 绿。**范围**：reactions **不入**表格列 / fragment 词汇表（同 `isHidden`）；不做裸回调/`run`/副作用/异步/跨表单/规则间拓扑保证；环检测靠「仅变更才写」收敛 + `MAX_REACTION_PASSES` 兜底。

### AI-08 — `configTableOut` 后端字段映射 · `M`
- **Why**：官方 headline feature，schema 里**完全没有**；中心度第一（数据接线），L3 case7「任意后端适配」头牌。
- **验收**：schema 建模出参字段映射为**路径对象**（total/data/pageSize/current，对标 ProTable `postData` / Amis `api.adaptor`）；复杂入参回调（listenToCallBack/apiParams.model）归 Tier-2/3；生成代码接上（`field-resolver.ts:273`）；golden 覆盖（≥8 例）。
- **状态**：✅ 已落地（2026-10-13）。**落点唯一且经三处源码核对**：`configTableOut` 在库的每一层都属 **table options**——core `TableOptions`（`types.ts:680`）、三端本地 `TableOptions`（`vue3/types/index.ts:243` 等）、组件读 `props.options.configTableOut`（`vue3/es-table/src/component.vue:295`）、**JSON 单源** `table-options.schema.json` 早已声明它（4 键 + `additionalProperties:true`）——**唯一缺口是 AI config 的 Zod**（`tableOptions` 是普通 `z.object` 无 passthrough，直接在关卡处把它 strip）。故建模为 **AI `tableOptions.configTableOut`**（与 `engine`/`virtual`/`rowClassName` 同构，非顶层）。改动：① schema 加 4 键平铺路径对象；② 生成器 `TableOpts` + **两处 emit**（schema 的 `schema.tableOptions`；SFC 手搓 `options` 块逐键 `q()` 转义——SFC 不发即静默丢弃，违反 WS-5）；③ few-shot 加 `LedgerManage` shot + 系统规则行 + 覆盖守卫；④ scorer 新增 `configTableOut` 维度（整对象等值）+ meta-eval base/扰动。**两处会咬人的陷阱已排除**：(a) 组件三端**本地** `checkQueryFields` 用 `['total','pageSize','current','tableData']` 且只校验「已存在的键」→ 偏映射（如 `{tableData:'list'}`）合法（core 的 `checkQueryFields` 要 `listData`，是 form 侧 `configFormOut` 用的，**不是**这条路径）；(b) `CrudPageSchema.tableOptions?: Partial<TableOptions>` 已含 `configTableOut` → 生成的 `pageSchema` 字面量在 Tier-0 `vite build` 无 excess-property 报错，**三端渲染包零类型改动**。golden：新增 8 例（`31`–`38`，跨 vue3×4/vue2×2/antdv×2 + schema×6/sfc×2，键子集含 4 键全映射 / 单键 override / `{data,total}` / `{list}` 无 total 等）——`configTableOut 8 case(s)` **恰好顶格**；`test:golden` 38/38、`check:scorers` OK。测试：生成器 spec 4 例（schema 发/不发 + sfc 发/不发）+ **运行时见证**（`generated-runtime.spec.ts`：只吐 `{list, totalCount}` 的后端仍渲染出行——把「发射了映射」升级为「映射真的驱动数据接线」，与 AI-20 同构）。全量 2384 测试绿、typecheck 绿。**范围**：surfaces 前门（`generate_crud`）的 `input` 目前**不含** tableOptions（它连 `virtual`/`engine` 也不带走），故 `configTableOut` 暂不入前门——留作后续（前门补 tableOptions 时一并带）。

### AI-09 — 高级表格特性 epic（group header / row-expand / tree table / 可编辑单元格）· `L`–`XL`
- **Why**：L4 头牌「超库上限」，当前只能靠 render 字符串硬塞。对标 AG Grid 列定义（children/treeData/masterDetail/editable）全声明式。
- **⚠ 架构抉择（本 epic 必须显式做）**：非字段列（`type:'index'|'selection'|'expand'`）、`groups` 多级表头在扁平 FieldConfig 里无处安放。**二选一**：(a) 加可选 `columns` 逃生数组承载非字段/分组/展开列（AG Grid/ProTable 路线，列独立）；(b) 扩 FieldConfig 带列专属字段（扁平+派生，AI 生成便利）。落地前定稿。
- **✅ 定稿（架构抉择，2026-10-13，用户拍板）= 选 (a) 加可选 `columns` 富列数组**。**决定性依据（三处源码核对，非偏好）**：① `groups` 是**递归**——core `TableColumn.groups?: TableColumn[]`（自指，`types.ts:410`）+ JSON 单源 `table-column.schema.json` `groups.items.$ref:"#"` → **扁平 `FieldConfig[]` 结构上表达不了多级表头**；② 非字段列（`type:'index'|'selection'|'expand'`）**无** `prop`/`label`/`formtype`，而 `FieldConfigSchema` 三者**硬必填**（`.min(1)`）→ 塞入只能放宽必填，削弱最常用场景的类型保证；③ 三端 `CrudPageSchema.columns` **已是** `TableColumn[]`（vue3:16 / antdv:18 / vue2:29）→ (a) 与渲染契约 **1:1 零阻抗**；当前唯一断裂点是生成器 `structured-generator.ts:177` 把 `columns` 从 `fields` **扁平派生**（无逃生口）。**语义**：新增 `StructuredCrudConfig.columns?: TableColumn[]`（可选）；**存在即整体覆盖** `schema.columns`（override **非** merge——避免「排序 / 同 prop 重复」二义）；`fields` 继续驱动 query/dialog 表单；`inTable` 仅在**派生路径**（无 `columns` 时）生效。**操作列语义（用户拍板）**：给 `columns` 时操作列**仍按 `actions`/`operationColumn` 追加到末尾**（与派生路径一致——不会让编辑/删除凭空消失）；想完全自管操作列则配 `operationColumn:false`。现有 **46 golden 无一设 `columns`** → 零回归。**渲染器约束（已核，须写进 AI 生成约定 + 各子项落地）**：`type` 三端默认路径均可用（vue3/vue2 靠 `el-table-column` 原生 `type` 透传，antdv 显式映射 selection→`rowSelection` / index→`_sn` / expand→`#expandedRowRender`）；`groups` **antdv N 层递归、vue3/vue2 默认仅 1 层** → **跨端安全上限 = 2 级表头**（AI 教 ≤2 级，3+ 级降级/告警归 groups 子项）；`type:'expand'` 三端都需**内容 slot**（antdv `#expandedRowRender`）→ 单发列 = 空展开，归 expand 子项（配 `expandConfig`/slot 约定）；`editRender` **仅 vxe 引擎** → 归 editConfig 子项；vue3/vue2 默认路径**不消费** `options.multiSelect/snIndex/expand`（antdv 由 a-table 内建）→ 布尔开关语义跨端不一致，子项内再核。**遗留（非本决策，建议）**：`check:parity`/`check:schema` 现**无列级守卫** → 新增列 parity 断言（防三端对 `type`/`groups` 处理漂移），归 groups 子项；JSON 单源 `table-column.schema.json` 相对 core `TableColumn` **缺** `editRender`/`footerFormatter`/`sortable`/`permissionValue` → `columns` 落地时须补（否则 `validate_config` 的 Ajv 会拒），归对应子项。
- **验收**：**拆成 4 个子 issue** 独立推进（groups / expand+expandConfig / treeConfig / editConfig）；`editRender` 自定义编辑器归 Tier-3；每子项带三端生成 + golden（L4 ≥15/维）+ eval 维度。不要一次性合并。**排期**：① groups（多级表头，≤2 级跨端安全 + 列 parity 守卫 + JSON 单源补键）② expand+expandConfig（行展开，slot 约定）③ treeConfig（树表）④ editConfig（vxe 行内编辑；`editRender` 自定义编辑器 → Tier-3）。每子项落地路径：AI `columns` 建模（Zod 递归 `z.lazy`，shared 权威 + mcp 内联双份）→ 生成器 emit（schema 直发 / SFC 递归列发射器）→ 三端运行时见证 → golden L4（≥15/维）→ scorer 维度 + meta-eval → 守卫。
- **状态 · ① groups：✅ 已落地（2026-10-13）**。建模：`StructuredCrudConfig.columns?: TableColumn[]`（可选）——shared 权威 `ColumnSchema = z.lazy(...)`（递归 `groups`，`structured-config.schema.ts`）+ mcp 内联同形双份（`generate-from-config.ts`），Zod strip 隐患由 `check-schema-contract.mjs` 双断言守（`columns: z.array(ColumnSchema)` 存在 + `ColumnSchema` 用 `z.lazy` 递归）。生成器：schema 模式直发 `config.columns`（override 非 merge，`fields` 仍驱动 query/dialog，操作列仍追加）；SFC 模式新增递归列发射器 `pushSfcColumn`（`q()`/`numOrStr`/`bool` 转义、`fixed` 布尔 vs 字符串、`btns` JSON 兜底降级告警）。eval：`CAPABILITY_SCORERS` 加 `columns` 维度（deep-eq，顺序敏感）。meta-eval：scorers.test.mjs 新增「columns」段（深等 / 顺序 / type 变 / groups 展平 / pred 缺 / 非适用）。golden L4：15 例（47–61，覆盖 selection/index + 2 级 groups + vue2/antdv/SFC 三端 + 列级 permissionValue）。教学：shared `ai-nl-to-config-prompt` 规则 + AttendanceManage few-shot；mcp `nl-to-config-examples` 同题 shot + bullet；`conventions.ts` bullet（标为纯 JSON 数据、非扩展点）。测试：shared 生成器 7 例 + mcp 参数 schema 1 例 + 顶层键快照 + vue3 `generated-runtime.spec.ts` 运行时见证（golden-48：生成物 `columns/groups` 真的驱动两级表头 + 数据渲染）。**遗留（归后续子项）**：列级 parity 守卫（防三端对 `type`/`groups` 处理漂移）；JSON 单源 `table-column.schema.json` 相对 core `TableColumn` 缺 `editRender`/`footerFormatter`/`sortable`/`permissionValue`（`columns` 落地时须补，否则 `validate_config` 的 Ajv 会拒）。
- **状态 · ② expand + expandConfig：✅ 已落地（2026-10-13）**。**建模**：`StructuredCrudConfig.expandConfig?: { title?, fields: [{prop, label?, labelKey?}] }`（`fields` ≥1，空的展开无意义故拒）。shared 权威 + mcp 内联双份，Zod strip 隐患由 `check-schema-contract.mjs` 双断言守（顶层 `expandConfig: z.object(...)` 存在 + 内含 `fields: z.array(...)`）。**运行时落点 = `columns[].expandConfig`（列级，三端统一）**，刻意区别于 `tableOptions.expandConfig`（那是 vxe 的 `{accordion}` 开关，与内容无关）——AI 面向的 `tableOptions` Zod 不含 `expand`/`expandConfig`，故无同名字段冲突。**生成器**：`applyExpandConfig` 单点接线（无 `columns` → 前置一个 `{type:'expand'}`；`columns` 已声明 `{type:'expand'}` → 内容挂到该列、位置保持、不重复前置）；SFC 模式 `pushSfcColumn` 发 `expandConfig: JSON.stringify(...)`（try/catch → 降级告警）；`engine:'vxe'`/virtual 引擎告警「内容不被该引擎渲染」但数据保留。**渲染器**：vue3/vue2 `column-item.vue` 新增 `type==='expand'` 模板分支（`.es-expand-content/title/field/label/value` + `fieldLabel`（labelKey→t()→label→prop）/`cellValue`）+ `columnBindAttr` 跳过 `expandConfig`（防其作为 DOM 属性下发）；antdv `#expandedRowRender` 渲染明细 + **放宽 `expandEnabled`**（`(options.expand || hasExpandColumn) && (hasExpandSlot || hasExpandConfig)`——此前硬性要求宿主 `#expand` 插槽，导致「只写 expandConfig」的配置有数据无展开入口）。**eval**：`CAPABILITY_SCORERS` 加 `expandConfig` 维度（deep-eq，字段序/标题敏感）。meta-eval 新增「expandConfig」段（2e：深等 / 字段序 / title / pred 缺 / 非适用）+ BASE_INPUT/PERTURB。**golden L4**：15 例（62–76，覆盖 title 有无 + 单/多字段 + 三端 vue2/antdv/vue3 + schema/SFC + `expandConfig` 挂到显式 `columns` 的 `{type:'expand'}`）。**教学**：shared `ai-nl-to-config-prompt` 规则 + `OrderExpandManage` few-shot（含「与 `tableOptions.expandConfig` 区分」）；mcp `nl-to-config-examples` 同题 bullet + shot；`conventions.ts` bullet。**测试**：shared 生成器 7 例（前置/挂现有列/无 columns 回归/SFC emit/vxe 告警/Zod 接受 labelKey/Zod 拒空 fields）+ mcp 参数 schema 1 例（顶层保留）+ 顶层键快照（`expandConfig` 入列）+ vue3 `generated-runtime.spec.ts`（golden-62：点击展开 → 标题 + `label: value` 明细真渲染）+ antdv `table-expand-config.spec.ts`（仅凭列上 `expandConfig` 即渲染展开器，见证 `expandEnabled` 放宽）。JSON 单源 `table-column.schema.json` 补 `expandConfig`（`additionalProperties:true` 本不拒，补为文档 parity；`schemas:sync` 分发三消费方）。**遗留**：vue2 无 DOM 运行时见证（element-ui 未加载，同 ① 先例）——vue2 SFC 路径由 golden 编译门 + `sfc-template-compile` 覆盖。
- **状态 · ③ treeConfig（树表）：✅ 已落地（2026-10-13）**。**建模**：`StructuredCrudConfig.treeConfig?: { childrenField?: string; expandAll?: boolean }`（**跨端窄子集**，静态树）。shared 权威 + mcp 内联双份，Zod strip 隐患由 `check-schema-contract.mjs` 双断言守（顶层 `treeConfig: z.object(...)` 存在 + 内含 `childrenField: z.string(...)`）。**命名/分层**：顶层 `treeConfig` 是 AI 面向键，**同名不同层**于 core `TableOptions.treeConfig`（vxe 专有 `VxeTreeConfig`，`types.ts:627-648`/`899`）——本键被生成器映射到**唯一运行时家** `tableOptions.treeConfig`，三端各自翻译。**生成器**：schema 模式在 `schema.tableOptions` 块内**逐键**发射（仅 `childrenField`/`expandAll` 存在时发，`expandAll` 归一为 `true`——只发真值）；SFC 模式 `q()` 转义逐键发射（对齐 `configTableOut` 手搓块）；`row-key` **无需新动作**（生成器恒发 `rowkey`，三端已据此转发 `row-key`/`rowKey`）。**三端渲染器**：vue3/vue2 在 `tableBindAttrs` 把 `childrenField≠'children'` 翻译为 `treeProps={ children: X }`、`expandAll` 翻译为 `defaultExpandAll=true`（`treeConfig` 仍留在 `TABLE_INTERNAL_KEYS`，不散给 el-table）；antdv 模板把硬编码 `:defaultExpandAllRows="false"` 放宽为 `options.treeConfig?.expandAll === true` + 新增 `:childrenColumnName="options.treeConfig?.childrenField || 'children'"`（显式绑定在 `v-bind="tableBindAttrs"` **之前**，宿主仍可覆盖；antdv `tableBindAttrs` 本不透传 `options.*`，无需动内部键表）。vxe 路径**零改动**（`build-grid-config.ts:60-68` 已归一化 `childrenField`/`expandAll`）。**eval**：`CAPABILITY_SCORERS` 加 `treeConfig` 维度（deep-eq，`childrenField`/`expandAll` 敏感）；meta-eval 新增「2f) treeConfig」段（正例 / `childrenField` 变 → false / `expandAll` 变 → false / pred 缺 → false / gold 缺 → 非适用）+ BASE_INPUT/PERTURB。**golden L4**：15 例（77–91，覆盖 3 target × schema/SFC + `childrenField` 缺省/自定义（`subItems`/`nodes`/`children`）+ `expandAll` true/false + 1 例带显式 `columns`（87 树 + 分组列共存））。**教学**：shared `ai-nl-to-config-prompt` 规则行 + `DepartmentTreeManage` few-shot（含「与 `tableOptions.treeConfig` 区分」）；mcp `nl-to-config-examples` 同题 shot + intro bullet；`conventions.ts` bullet（标为顶层纯 JSON DATA、非扩展点）。**测试**：shared 生成器 6 例（schema 双键发射 / 空 `treeConfig:{}` → `"treeConfig": {}` / SFC emit / 无 treeConfig 不发且 `warnings` 净 / Zod 接受窄子集 / Zod 拒 `childrenField:123`）+ mcp 参数 schema 1 例（顶层保留）+ 顶层键快照（`treeConfig` 入列）+ vue3 `generated-runtime.spec.ts`（golden-77 嵌套三层 rows + expandAll 初始全展开真渲染；golden-78 `childrenField=subItems` 点击展开真渲染）+ antdv `table-tree-config.spec.ts`（见证 `childrenColumnName` 驱动嵌套解析 + `defaultExpandAllRows` 放宽）。**遗留**：① 懒加载/异步 `load`（vue3/vue2 `lazy`+`load`、antdv `loadData`、vxe `treeConfig.lazy/loadMethod`）**延后为已知扩展点**——函数值 schema 模式本就无法序列化（同 `formatter`/`render` 降级告警）；② vue2 无 DOM 运行时见证（element-ui 未加载，同 ①② 先例）——vue2 SFC 路径由 golden 编译门 + `sfc-template-compile` 覆盖；③ 未新增 `table-options.schema.json` 键（顶层 `treeConfig` 非 tableOptions 键；JSON 单源本就未收录 vxe 专有键，保持一致）。
- **状态 · ④ editConfig（vxe 行内编辑）：✅ 已落地（2026-10-13）= AI-09 epic 收尾**。**建模（两个 AI 面向新增，均双份 Zod）**：表级开关 `tableOptions.editConfig?: { trigger?:"click"|"dblclick"|"manual", mode?:"cell"|"row", showStatus?, showUpdateStatus?, showInsertStatus?, autoClear?, enabled? }` + 列级 `columns[].editRender?: { name?, type?:"default"|"visible", options?, props?, autofocus?, defaultValue? }`。**分层（用户拍板）**：**嵌套 `tableOptions.editConfig`**（与 core `TableOptions.editConfig` 同层同形）——**刻意不放顶层**：顶层键（`columns`/`expandConfig`/`treeConfig`）是 ③ 明文定义的「**跨端**窄子集」，而 `editConfig` **仅 vxe 生效**，放顶层会印证「同名不同层」的方向性错误。**列级 `editRender` 必须在 ④ 内**：vxe 的表级 `editConfig` 只是开关，**列上无 `editRender` 则该列不可编辑** → 只落 `editConfig` 等价空转。Zod strip 隐患由 `check-schema-contract.mjs` 4 断言守（`editConfig: z.object(` + `trigger: z.enum(`；`editRender: z.object(` + `name: z.string(`）；`editConfig` 置于 `configTableOut` **之前**（守卫 `tableOptions` 块定位器非贪婪、止于首个 `}).optional()`）。**生成器**：`TableOpts` 加 `editConfig?: Record<string,unknown>`；schema 模式 `...(tOpts.editConfig ? { editConfig: tOpts.editConfig } : {})` 直传；SFC 模式 `inlineJson(tOpts.editConfig)` 发射（纯 JSON，无函数值）；列级 `editRender` **schema 模式走引用透传**（`applyExpandConfig` 不被剥即随列透传，零新增代码）、**SFC 模式 `pushSfcColumn` JSON.stringify**（try/catch → 不可序列化值省略 + 告警，保「发射的永远能编译」）。**告警（两模式）**：`editConfig` 存在但 `engine !== 'vxe'` → push 告警（三端都适用，不放进 `isVue2` 分支）。`keepSource` **不建模**（`build-grid-config.ts:20-24` 已在 `editConfig` 存在时自动置 `true`）。**eval**：`CAPABILITY_SCORERS` 加 `editConfig` 维度（deep-eq，`trigger`/`mode` 敏感；列级 `editRender` 已由 ① `columns` 维度整体深等覆盖）+ `describeDimMiss` 分支；meta-eval 新增「2g) editConfig」段（整体一致 → true / `trigger` 变 → false / `mode` 变 → false / pred 缺 → false / gold 缺 → 非适用）+ BASE_INPUT/PERTURB。**golden L4**：15 例（92–106，覆盖 3 target × schema/SFC + `trigger`(click/dblclick/缺省) 与 `mode`(cell/row) 变体 + `showStatus`/`autoClear`/`enabled` + `editRender` 名（`$input`/`$select`+`options`/`$textarea`/`$date`）+ `props`/`autofocus`/`defaultValue` + 1 例与显式 `columns` 的 `groups` 共存（105 列组子列带 `editRender`））。**教学**：shared `ai-nl-to-config-prompt` 规则行（三件套必须同给 + `engine:'vxe'`）+ `SkuPriceEditManage` few-shot；mcp `nl-to-config-examples` 同题 shot + intro bullet；`conventions.ts` `tableOptions` 类型块补 `editConfig` + bullet。**测试**：shared 生成器 8 例（schema 发 `editConfig`+列 `editRender` 且无告警 / `engine!=='vxe'` 告警 / SFC 发对象字面量 / SFC `engine!=='vxe'` 告警 / 无配置不发且 `warnings` 净 / 列 `editRender` 含 BigInt → 降级告警并省略 / Zod 接受窄子集 / Zod 拒 `trigger:'hover'`）+ mcp 参数 schema 1 例（双保留）+ vue3 `vxe-editconfig-witness.spec.ts`（新见证：golden-92 → `generatePageSchema` → 生成物 `schema.tableOptions.editConfig` 深等 + 列 `editRender` 存活 → 喂 `buildFirstClassGridOptions` → `result.editConfig` 直传 + `keepSource===true`）。JSON 单源 `table-options.schema.json` 补 `editConfig`、`table-column.schema.json` 补 `editRender`（`additionalProperties:true` 本不拒，补为文档 parity；`schemas:sync` 分发三消费方）。**顺带修正**：mcp 内联 `tableOptions` 补 `configTableOut`（AI-08 只落 shared 权威、漏 mcp 内联副本的同类 strip 隐患）+ `check-schema-contract.mjs` 加 `configTableOut` 双断言纳管。**遗留**：① `editRender.events`（函数值）/自定义注册渲染器/`vxeColumn.rules`·`validConfig`/`editRules`·`editMethod` **延后 Tier-3**；② vue2/antdv 无非 DOM 运行时见证（vxe-table 无法在 jsdom 挂载，同 ①②③ 先例）——由 golden 编译门 + 上述纯函数见证覆盖。

---

## P2b · 生成器/脚手架接线（非 schema，三站点头牌场景靠它守 compile+runtime）

这两项不是 schema 能解的——是生成器恒定输出 + prompt/脚手架约定问题，误并入 schema 批次会导向错误实现。

### AI-18 — 生成器恒吐 form↔table provide/inject 契约 · `S`–`M`
- **Why**：零事件代码联动靠 EsForm 物理嵌在 EsTable 默认插槽 + `triggerEvent:true`（why-es-plus §3.2 点名 AI 常误造 event-bus/Pinia）。隐式结构契约，模型「看不见」。
- **复核更正（2026-10-13，三端源码核对）**：原表述「**schema 模式**生成物恒含正确嵌套 + triggerEvent」**方向有误**。schema 模式生成物是**纯 JSON schema**（`export const pageSchema = {...}`），既无模板也无嵌套——装配由 **EsCrudPage 组件内部**完成：其模板**恒为** `<es-table><es-form :form-item-list="schema.formItems" :config-btn="mergedFormBtns"/></es-table>`，且 `mergedFormBtns` 的查询/重置**恒带** `triggerEvent:true`（`es-crud-page.vue:12-20,189-206`）。**嵌套 + `triggerEvent` 只出现在 SFC 模式与 `queryBtns` 发射**（`structured-generator.ts:342-357,436-437`）。
- **验收（修正后）**：SFC 模式生成物恒含嵌套 + `triggerEvent`（已满足）；schema 模式的联动契约由 **EsCrudPage 承载**，以**运行时断言见证**——即 AI-03 的「点查询 → 表格重载且值随 formParams 下发」（已落地）。
- **状态**：✅ 契约成立且已有运行时见证（2026-10-13，并入 AI-03 的 `generated-runtime.spec.ts`）。schema 模式**无需发射层改动**（嵌套是组件内建能力），故本项不做生成器改动。

### AI-19 — scaffold_page + conventions 教 `app.use(ESPlus)` 全局装配 · `S`
- **Why**：permissionValue / labelKey 只在 main.ts 装配 `{permission, t, httpRequest}` 后才生效——跨文件依赖，模型常漏。
- **验收**：`scaffold_page` 产出含全局装配样板；conventions 资源写明；生成权限/i18n 页时 prompt 强制引用。

---

## P3 · 收敛逃生舱 + 补齐

### AI-10 — 编译检查 render/formatter/permissionValue 字符串 · `M`
- **Why**：现在是不经编译检查的 JS 字符串——拼错的变量名能骗过全部 341 测试、运行时才炸。
- **验收**：这些片段喂给 esbuild transform 做 parse 级校验。**AI-16 是 formatter/permissionValue 的终局形态；render(→VNode) 永留本层。**
- **状态**：🟡 ~1/2 已落地。render+formatter 已走 esbuild parse-gate（`shared/src/codegen-escape.ts:186`，接 `structured-generator.ts:997`），语义是**降级+警告**（优于原验收硬报错，保留此语义）。**Wave 3 收尾复核（2026-10-13）**：
  - ① ~~permissionValue 未过门~~ → **误判，已更正**。`permissionValue` 是**权限码字符串**（core `types.ts:257`，由全局 `permission(code)` 消费，非 JS 表达式），esbuild parse-gate 对它**不适用**（校验一个权限码没有意义）。复核顺带挖出**真缺陷**：字段级 `permissionValue` 是**幻影能力**——prompt 教学（`ai-nl-to-config-prompt.ts:363`）+ surface schema（`_fragment-shapes.ts:93`）+ scorer（`scorers.mjs:189` `extPoints`）三处都认，但**组件契约与生成器都没接** → LLM 产出被静默丢弃、green eval、运行时零效果（正是本库「mark, never drop」原则禁止的）。已修，见 **AI-20**。
  - ② schema 模式内联 render/formatter 仍缺（当前仅 SFC 列路径）→ **结构性 JSON 限制**（函数无法内联进纯 JSON），已由标记扩展点 + 降级告警缓解，非接线缺口；终局归 AI-16（表达式 DSL）/ AI-11（模式对齐）。
  - 附：`permissionValue` 现行语义 = 权限码；AI-16 拟将其收窄为 bool 表达式属**未来形态**，届时另行迁移（`permissionValue(bool)` 与 `permission(code)` 不是同一契约）。

### AI-20 — 字段/列级 permissionValue 端到端接线（修 AI-10 暴露的幻影能力）· `M`
- **Why**：AI-10 收尾复核挖出——字段级 `permissionValue` 三处（prompt 教学 / surface schema / eval scorer）都认，**组件契约与生成器都没接**：LLM 按提示产出 → schema 校验通过 → scorer 记分 → 生成器静默丢弃 → 运行时零效果。是「mark, never drop」明令禁止的静默丢弃（同 `tableBtns actionType` / `operationColumn` 的 scorer 建模坑同构）。
- **验收**：字段级 `permissionValue` 全链路生效——类型契约声明（core + 三端）+ 三端 es-form `formItemListFilter` / es-table `filteredColumns` 与 `isHidden`/`hidCol` 同层过滤 + generator 全模式 emit；未配全局 `permission` 时一律放行（向后兼容）。
- **状态**：✅ 已落地（2026-10-13）。类型：core `types.ts`（`FormItemOption` + `TableColumn`）、vue3 / adapter-antdv 局部类型各加 `permissionValue?: string`（vue2 复用 core 类型）。接线：`vue3/vue2/adapter-antdv` 的 `es-form` + `es-table` 各 2 处 = 6 处，均复用既有 `checkPermission`（`!pvalue → true`，未配全局 `permission` 放行）。生成器：`shared/src/structured-generator.ts` 3 个 emit 点（`buildFormItem` / `buildTableColumn` / `buildTableColumnSFC`），用 `q()` 转义（权限码非 JS 源，刻意不过 esbuild）。测试：三端 es-form/es-table 各 2 例 + shared 生成器 2 例（SFC 列 + schema JSON）全绿。golden：新增 `30-payroll-field-permission.json`（新域 PayrollManage，与 few-shot 域 SalaryManage 不碰撞；`pinnedDims:["extPoints:netPay"]`）——`score-golden` 30/30、`check:scorers` OK（免费确定性门禁）。向后兼容：仅当 field 带 `permissionValue` 才 emit → 既有 29 例生成物逐字节不变（golden-04 的 permissionValue 是**按钮级**，不受影响）。

### AI-11 — SFC-mode ↔ schema-mode 特性对齐 · `M`
- **Why**：SFC 路径当前功能更少，两条路不等价会让 `mode` 选择变成能力陷阱。
- **验收**：两模式特性矩阵对齐；差异点要么补齐、要么在 schema 层显式拒绝并给出告警。
- **状态**：**降优先/暂停**。默认是全保真 schema 模式；无明确单文件 SFC 消费方前，投平价为净负担。SFC 当前已对不支持项发警告（非静默）。

### AI-12 — `get_component_api` 扩到 EsDialog / EsCrudPage / vxe · `S`–`M`
- **Why**：覆盖不全，LLM 写 render 字符串时查不到真实 API，只能凭空捏造 prop/slot。当前仅 EsForm/EsTable/useDialog 有文档，EsDialog/EsCrudPage/SvgIcon 走占位分支。
- **验收**：三个组件族的 API 可查；AI-15 依赖它。归入 Wave 3（低成本直接抬接地准确率）。
- **状态**：✅ 已落地（2026-10-13）。新增 `docEsDialog` / `docEsCrudPage` / `docSvgIcon`（三端 per-target 分支：antdv 独有的 `iconName`/`iconClass?`、`title`/`default`/`footer` 插槽、**无 `open` 事件**；vue3/vue2 的 required `iconClass`）；`docEsTable` 追加 `## vxe engine — options.engine:'vxe'` 段（激活方式 + 安装提示 + `VxeOnlyOptions` + `vxeConfig`/`vxeOn` 逃生口 + vxe-only 实例方法 + 三条 gotchas）；顺带修正 `docUseDialog` 里**失实**的 `## Dialog Instance` 段（旧文写 `registerRef`/`getRefs`/`setLoading` 挂在 dialog 实例上——实为 `render` 上下文产物、`setLoading` 根本不存在；改为真实的 `{instance, close, destroy}` + 可直呼 `dialog.close()/dialog.destroy(cacheKey?)`，见 `use-dialog.ts:238-262`）。新增 spec `__tests__/get-component-api.spec.ts`（38 例）：驱动**真实 handler**，钉 6 组件 × 3 target 的良构性（非空 / 平衡围栏 / 无 `\n`&#124;`` \` `` 泄漏）+ 各 per-target 分支 + vxe 段 + EsCrudPage 全 emits/exposed/schema 键；已用 mutation（重注 `\n`）验证该守卫会咬（2 红）。全部逐条对三端源码复核（`engine:'vxe'` 三端皆有 `vxe-engine.vue`、install-hint 文案、`refresh/reload→commitProxy` 仅 proxy 模式、`editConfig→keepSource` 自动、antdv `defineExpose({close,closed,toggleFullscreen,doClose})`、CrudPage 7 exposed + 11 emits、SvgIcon 解析 `iconClass&#124;&#124;iconName`）。typecheck + 156 测试全绿。

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
| **Wave 3 · 对齐+收尾**（阶段 0） | ~~本次 ROADMAP 重编 → AI-10 收尾（补 permissionValue 门）~~ ✅ → ~~AI-12（EsDialog/EsCrudPage/vxe API）~~ ✅ → ~~AI-03（runtime mount，并 AI-18 联动冒烟）~~ ✅ | 零风险、消除方向冲突、AI-12 当场抬准确率接地。AI-10 收尾落为 **AI-20**（字段级 permissionValue 端到端接线）+ 该条残① 误判更正。AI-03 落地即 **P0 全清**；顺带源码核对更正 AI-18 的「schema 模式发射嵌套」错误前提（嵌套是 EsCrudPage 内建，非生成器发射）。 |
| **Wave 4 · 最高频声明式缺口**（阶段 1，Tier-1） | ~~AI-08 configTableOut（响应映射路径对象）~~ ✅ → ~~AI-06 isHidden（声明式条件）+ golden 扩 L3/L4~~ ✅ → ~~AI-09 前置（扁平vs拆分架构定稿）~~ ✅ 选 (a) `columns` 富列数组 → ~~AI-09 子项① groups（多级表头）~~ ✅ | 中心度第一（数据接线）+ 最刺眼缺口；真正的「全场景」第一步。AI-08 已落地（schema/generator/前门教学/scorer/golden 8 例/运行时见证）。AI-06 已落地（core 运行时编译 + 三端零改动 + AI Zod/生成器/scorer/golden 8 例/运行时见证 + **MCP 内联 Zod 补齐 + 守卫**）。AI-09 前置已定稿（架构抉择 (a)，依据/语义/渲染器约束见 AI-09 段）；子项① groups 已落地（Zod 递归 `columns` 双份 + 生成器双模式 + 守卫 + scorer + meta-eval + **golden L4 15 例** + 教学 + vue3 运行时见证）；子项② expand+expandConfig 已落地（顶层 `expandConfig` Zod 双份 + 生成器 `applyExpandConfig`（前置/挂现有列）+ 三端渲染 + **antdv `expandEnabled` 放宽** + scorer + meta-eval + **golden L4 15 例** + 教学 + vue3/antdv 运行时见证 + JSON 单源补键）；子项③ treeConfig 已落地（顶层 `treeConfig` Zod 双份 + 生成器双模式逐键发射 + **三端运行时接线**（el-table `treeProps`/`defaultExpandAll` · antdv `childrenColumnName`/`defaultExpandAllRows` 放宽 · vxe 零改动）+ scorer + meta-eval + **golden L4 15 例** + 教学 + vue3/antdv 运行时见证）。 |
| **Wave 5 · 高级表格 epic**（阶段 2，Tier-1） | AI-09 拆 4 子项（~~① groups~~ ✅ → ~~② expand+expandConfig~~ ✅ → ~~③ treeConfig~~ ✅ → ~~④ editConfig~~ ✅）**epic 完结** + 架构已定稿（`columns` 富列数组）+ golden L4（≥15/维） | L4 头牌「超库上限」，类型化结构可 golden。 |
| **Wave 6 · 表达式 DSL 基石**（阶段 3，Tier-2） | AI-16（CEL，不含 render）→ AI-07（联动/computed）+ 收窄 formatter/permissionValue/isHidden | DSL 做底座，安全解锁联动，收敛逃生舱。 |
| **横切**（贯穿 Wave 4–6） | AI-18 provide/inject 恒吐 + AI-19 全局装配教学 | 非 schema，守头牌「零代码联动」compile+runtime。 |
| **降优先/暂停** | AI-11（非默认低保真 SFC parity）· AI-15（RAG，场景到量再做）· AI-13（spike，host 杠杆非 server）· AI-17（平台） | 当前投入为净负担或非 server 可控。 |
