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

### AI-07 — 字段联动 / computed · `L`
- **Why**：一个字段的值/选项依赖另一个字段，是复杂表单的核心需求，当前完全不可表达。
- **验收**：schema 声明依赖关系（**声明式 reaction + 表达式，对标 Formily `x-reactions`**，配合 AI-16 的 DSL）；三端等价；golden 覆盖（≥8 例）。
- **不走**裸 JS 回调（`on`/listenToCallBack 归 Tier-2/3），不拓宽自由串。

### AI-08 — `configTableOut` 后端字段映射 · `M`
- **Why**：官方 headline feature，schema 里**完全没有**；中心度第一（数据接线），L3 case7「任意后端适配」头牌。
- **验收**：schema 建模出参字段映射为**路径对象**（total/data/pageSize/current，对标 ProTable `postData` / Amis `api.adaptor`）；复杂入参回调（listenToCallBack/apiParams.model）归 Tier-2/3；生成代码接上（`field-resolver.ts:273`）；golden 覆盖（≥8 例）。
- **状态**：✅ 已落地（2026-10-13）。**落点唯一且经三处源码核对**：`configTableOut` 在库的每一层都属 **table options**——core `TableOptions`（`types.ts:680`）、三端本地 `TableOptions`（`vue3/types/index.ts:243` 等）、组件读 `props.options.configTableOut`（`vue3/es-table/src/component.vue:295`）、**JSON 单源** `table-options.schema.json` 早已声明它（4 键 + `additionalProperties:true`）——**唯一缺口是 AI config 的 Zod**（`tableOptions` 是普通 `z.object` 无 passthrough，直接在关卡处把它 strip）。故建模为 **AI `tableOptions.configTableOut`**（与 `engine`/`virtual`/`rowClassName` 同构，非顶层）。改动：① schema 加 4 键平铺路径对象；② 生成器 `TableOpts` + **两处 emit**（schema 的 `schema.tableOptions`；SFC 手搓 `options` 块逐键 `q()` 转义——SFC 不发即静默丢弃，违反 WS-5）；③ few-shot 加 `LedgerManage` shot + 系统规则行 + 覆盖守卫；④ scorer 新增 `configTableOut` 维度（整对象等值）+ meta-eval base/扰动。**两处会咬人的陷阱已排除**：(a) 组件三端**本地** `checkQueryFields` 用 `['total','pageSize','current','tableData']` 且只校验「已存在的键」→ 偏映射（如 `{tableData:'list'}`）合法（core 的 `checkQueryFields` 要 `listData`，是 form 侧 `configFormOut` 用的，**不是**这条路径）；(b) `CrudPageSchema.tableOptions?: Partial<TableOptions>` 已含 `configTableOut` → 生成的 `pageSchema` 字面量在 Tier-0 `vite build` 无 excess-property 报错，**三端渲染包零类型改动**。golden：新增 8 例（`31`–`38`，跨 vue3×4/vue2×2/antdv×2 + schema×6/sfc×2，键子集含 4 键全映射 / 单键 override / `{data,total}` / `{list}` 无 total 等）——`configTableOut 8 case(s)` **恰好顶格**；`test:golden` 38/38、`check:scorers` OK。测试：生成器 spec 4 例（schema 发/不发 + sfc 发/不发）+ **运行时见证**（`generated-runtime.spec.ts`：只吐 `{list, totalCount}` 的后端仍渲染出行——把「发射了映射」升级为「映射真的驱动数据接线」，与 AI-20 同构）。全量 2384 测试绿、typecheck 绿。**范围**：surfaces 前门（`generate_crud`）的 `input` 目前**不含** tableOptions（它连 `virtual`/`engine` 也不带走），故 `configTableOut` 暂不入前门——留作后续（前门补 tableOptions 时一并带）。

### AI-09 — 高级表格特性 epic（group header / row-expand / tree table / 可编辑单元格）· `L`–`XL`
- **Why**：L4 头牌「超库上限」，当前只能靠 render 字符串硬塞。对标 AG Grid 列定义（children/treeData/masterDetail/editable）全声明式。
- **⚠ 架构抉择（本 epic 必须显式做）**：非字段列（`type:'index'|'selection'|'expand'`）、`groups` 多级表头在扁平 FieldConfig 里无处安放。**二选一**：(a) 加可选 `columns` 逃生数组承载非字段/分组/展开列（AG Grid/ProTable 路线，列独立）；(b) 扩 FieldConfig 带列专属字段（扁平+派生，AI 生成便利）。落地前定稿。
- **验收**：**拆成 4 个子 issue** 独立推进（groups / expand+expandConfig / treeConfig / editConfig）；`editRender` 自定义编辑器归 Tier-3；每子项带三端生成 + golden（L4 ≥15/维）+ eval 维度。不要一次性合并。

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
| **Wave 4 · 最高频声明式缺口**（阶段 1，Tier-1） | ~~AI-08 configTableOut（响应映射路径对象）~~ ✅ → AI-06 isHidden（声明式条件）+ golden 扩 L3/L4 | 中心度第一（数据接线）+ 最刺眼缺口；真正的「全场景」第一步。AI-08 已落地（schema/generator/前门教学/scorer/golden 8 例/运行时见证）。 |
| **Wave 5 · 高级表格 epic**（阶段 2，Tier-1） | AI-09 拆 4 子项（groups/tree/expand/editConfig）+ 先定扁平vs拆分架构 + golden L4 | L4 头牌「超库上限」，类型化结构可 golden。 |
| **Wave 6 · 表达式 DSL 基石**（阶段 3，Tier-2） | AI-16（CEL，不含 render）→ AI-07（联动/computed）+ 收窄 formatter/permissionValue/isHidden | DSL 做底座，安全解锁联动，收敛逃生舱。 |
| **横切**（贯穿 Wave 4–6） | AI-18 provide/inject 恒吐 + AI-19 全局装配教学 | 非 schema，守头牌「零代码联动」compile+runtime。 |
| **降优先/暂停** | AI-11（非默认低保真 SFC parity）· AI-15（RAG，场景到量再做）· AI-13（spike，host 杠杆非 server）· AI-17（平台） | 当前投入为净负担或非 server 可控。 |
