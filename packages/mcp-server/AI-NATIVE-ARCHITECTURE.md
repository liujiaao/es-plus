# @es-plus/mcp-server — AI 原生能力架构与工具手册

> **文档地位：本文件是 mcp-server AI 原生能力的「工作方式」单一真源。**
> 任何涉及工具、配置 IR、生成链路、三端运行时契约的改动，必须在同一个 PR 内更新本文件；
> 与 README / ROADMAP / 站点文案冲突时，**「系统如何工作」以本文件为准**，
> **「接下来做什么」以 [AI-NATIVE-REMEDIATION-PLAN.md](./AI-NATIVE-REMEDIATION-PLAN.md) 为准**。
>
> - 版本基线：2026-10-20，HEAD `1623859` + 工作区改动
> - 相关文档：
>   - [AI-NATIVE-REMEDIATION-PLAN.md](./AI-NATIVE-REMEDIATION-PLAN.md) — 可执行修复计划（AN-xx）
>   - [ROADMAP.md](./ROADMAP.md) — 历史 backlog（AI-xx）
>   - [AI-SCENE-COVERAGE-PLAN.md](./AI-SCENE-COVERAGE-PLAN.md) — 四场景覆盖方案
>   - [../../docs/ai/ai-tools.md](../../docs/ai/ai-tools.md) — 三站公开文案真源
>
> **标注约定**：
> - **现状** = 本文写作时代码的真实行为（含已知缺陷）；
> - **目标态** = 修复计划落地后的行为，见 REMEDIATION 对应 AN 条目；
> - 未标注的段落描述现状。

---

## 0. 一句话架构

```
LLM 只做一件事：把需求翻译成一份受约束的 JSON。
ES-Plus 做其余全部：校验 → 组合 → 确定性编译 → 三端代码。
```

MCP server **不调用模型、不写文件、不持有会话**。所有“理解”发生在宿主
（Claude Code / Cursor / Continue 等）；server 侧全部是纯函数，因此同一输入恒得同一输出，
可被 CLI、eval、MCP 三方复用。

---

## 1. 设计宗旨与不变量

### 1.1 核心宗旨

- **一份配置**：`StructuredCrudConfig` 是三端唯一 IR。
- **三端一致**：Vue 3 + Element Plus / Vue 2 + Element UI / Vue 3 + Ant Design Vue
  共享 JSON，只有 wrapper 语法和 UI 库符号不同。
- **可复现**：同一 config + 同一 target + 同一版本 → 字节级相同产物。
- **可编译**：产物由模板发射，不拼接自由代码。

### 1.2 五条不变量

| # | 不变量 | 现状（2026-10-20） | 目标态 |
|---|---|---|---|
| I1 | **单一真源**：一份 IR 驱动三端，生成器不得有只对某端成立的语义 | ⚠️ 部分成立：`multiSelect`/`snIndex`/`ellipsis`/`defaultSort` 存在三端差异 | AN-09 / AN-10 |
| I2 | **无静默降级**：每个键要么三端生效，要么显式报错/告警 | ❌ 多处静默丢弃：未知键、`render`/`formatter`、`permissions`、`pageSizes` | AN-08 / AN-11 |
| I3 | **编译是发射器的性质**：金标 + 模型输出都跑真实编译，编译率参与门禁 | ❌ `compileRate` = “生成器没抛异常”，且不参与门禁 | AN-13 / AN-14 |
| I4 | **准确率可审计**：受约束输入、无提示泄漏、分母完整 | ❌ `fixedFields` 全量注入、多个维度真空通过、片段不门禁 | AN-01 / AN-19 |
| I5 | **前门唯一**：默认只暴露一条生成路径 | ❌ 三个工具都自称“主路径/推荐” | AN-27 |

> **任何 PR 不得在未更新对应 AN 条目的情况下削弱以上不变量。**

---

## 2. 系统分层

```
┌─────────────────────────────────────────────────────────────────────┐
│ 宿主 LLM（Claude Code / Cursor / Continue / CLI --ai）               │
│  · 读项目 package.json、PRD、设计稿（视觉能力在宿主侧）              │
│  · 读 MCP resources（few-shot / conventions / types）                │
│  · 做唯一一次语义翻译：NL/规格 → surfaces 或 StructuredCrudConfig     │
│  · 读 warnings、改配置、重试；写文件到工作区                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ MCP (stdio)
┌───────────────────────────────▼─────────────────────────────────────┐
│ packages/mcp-server（无状态、无模型、纯函数）                         │
│  · tools    14 个（生成 / 校验 / 精修 / 摄取 / 参考 / 脚手架）         │
│  · resources 7 族（conventions / types / examples / nl-to-config /   │
│              surfaces / crud-page-schema / schemas）                 │
│  · prompts   2 个（crud-page / form-config）                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ import
┌───────────────────────────────▼─────────────────────────────────────┐
│ packages/shared（确定性内核）                                         │
│  · compose-crud-config.ts    三面意图 → 唯一 config                   │
│  · structured-config.schema.ts 权威 Zod 单源                         │
│  · normalize-config.ts       入口归一（别名/搬迁/弹窗简写）           │
│  · repair-config.ts          确定性修复环（schema 驱动、只减 issue）  │
│  · validate-and-repair.ts    前门校验（只判不改）                     │
│  · structured-generator.ts   config → schema/wrapper 或 SFC           │
│  · fragment-generator.ts     config/fields → 独立 table/form/dialog   │
│  · crud-engine.ts            旧 regex NL 解析器（legacy）             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ runtime
┌───────────────────────────────▼─────────────────────────────────────┐
│ 三端运行时                                                            │
│  packages/vue3        + element-plus                                  │
│  packages/vue2        + element-ui                                    │
│  packages/adapter-antdv + ant-design-vue                              │
└─────────────────────────────────────────────────────────────────────┘
```

**边界纪律**

- server **不得**引入模型 SDK、发起网络请求、写文件、保存 pin。
- server **不得**包含“仅某端可用”的生成逻辑而不发告警。
- 宿主的推理质量不属 server 责任；server 的责任是**让错误配置无法静默通过**。

---

## 3. 主流程链路（逐步）

### 3.1 标准链路（推荐，覆盖 90% 请求）

| 步骤 | 执行者 | 动作 | 产物 / 失败处理 |
|---|---|---|---|
| 0 | MCP server | `initialize` 返回 `instructions`：先探测 target、优先前门、如何填 surfaces | 宿主获得路由规则 |
| 1 | 宿主 | 读项目 `package.json` | 文本 |
| 2 | server | `detect_project_target(package.json)` | `{ target: 'vue3' \| 'vue2' \| 'antdv' }` |
| 3 | 宿主 | 读 resources：`esplus://examples/surfaces`、`esplus://examples/nl-to-config`、`esplus://conventions[/target]`、`esplus://types[/target]` | few-shot + 约定 |
| 4 | 宿主 | 把需求映射成 `surfaces{query,table,form,dialog}`（字段形状受 `surfaceFieldSchema` 约束） | 类型化意图表 |
| 5 | server | `generate_crud(surfaces, target, 可选旋钮)` | 进入 3.2 分支 |
| 6 | server | 有表：`composeCrudConfig` → `validateAndRepair` → `generateFromConfig` | 代码 + warnings；非法则**不生成** |
| 7 | 宿主 | 读 warnings，逐条判断是否映射错误 | 修正后重调 |
| 8 | 宿主 | 把 `schema.ts` + `Page.vue`（或 SFC）写入项目 | 文件 |
| 9 | server | （首次落地）`scaffold_page` 生成页面骨架 + 应用入口装配 | `app.use(ESPlus, { permission, t, httpRequest })` |
| 10 | 宿主 + server | （多轮）用户纠正 → 宿主改写 config → `refine_config(previous, revised)` → `generate_crud_from_config(revised)` | 校验 + diff + 新产物 |

### 3.2 `generate_crud` 内部分支

```
surfaces
  │
  ├─ table 非空 ──► composeCrudConfig
  │                   · 成员布尔：字段出现在哪个面 → inQuery/inTable/inForm
  │                   · 同名字段归并：identity 首见 / semantic 取 form / display 取 table
  │                   · dialogs：罐头键或全参对象
  │                 → validateAndRepair
  │                     ├─ 非法 → 结构化 per-issue 错误，不生成
  │                     └─ 合法 → generateFromConfig
  │                                ├─ mode='schema' → pageSchema JSON + wrapper SFC
  │                                └─ mode='sfc'    → 单文件 SFC
  │
  └─ table 为空 ──► 按出现过的面逐段发片段
                      query  → generateFormBlock(context:'query', buttons:'query')
                      dialog → 每个 entry 一段 generateDialogBlock
                      form   → generateFormBlock(context:'form', buttons:'submit')
```

### 3.3 其他入口

| 入口 | 链路 | 状态 |
|---|---|---|
| 配置直通 | `generate_crud_from_config(config)` → `validateAndRepair` → `generateFromConfig` | **主生成路径（高级）** |
| 旧 NL | `generate_crud_page` / `generate_crud_schema` → `crud-engine` regex → 生成 | **legacy fallback** |
| 精修 | `refine_config(previous, revised)` → 校验 + `diffConfig` | 确定性，无模型 |
| 摄取 | `ingest_schema(text, kind)` → `ingestSchema` → `composeCrudConfig` 草稿 | 只做类型→formtype |
| 单组件 | `generate_form` / `generate_table` / `generate_dialog` → `fragment-generator` | 显式单组件请求 |

### 3.4 输入类型与真实边界

| 输入 | 实际链路 | 被工程化保障的程度 |
|---|---|---|
| 自然语言 | 宿主 → surfaces / config → 前门 | ✅ 有语料、有指标、有前门校验 |
| PRD / 规格说明（文本） | 宿主自行抽取字段/动作 → surfaces | ⚠️ 无专用工具、无语料；`ingest_schema` 仅覆盖 OpenAPI/JSON Schema/样例 JSON |
| 原型 / 截图 / 设计稿 | 宿主（若有视觉）自行理解为字段 → surfaces | ❌ server 无图像入参；无语料、无指标 |
| OpenAPI / JSON Schema / 样例 JSON | `ingest_schema` → 草稿 config | ✅ 确定性，但只到“类型→formtype” |
| 已有页面 schema | `ingest_schema`（部分）/ 手工 config | ⚠️ |

> **禁止在任何对外文案中声称 server 能直接读设计稿。** 视觉理解是宿主能力，server 只提供
> 提取契约（目标态见 AN-20）。

---

## 4. 工具手册（15 个）

### 4.0 工具面 profile（AN-26）

`ESPLUS_MCP_PROFILE` 决定注册哪些工具：

| profile | 注册数 | 隐藏 |
|---|---|---|
| `full`（**默认**） | 15 | — |
| `front-door` | 12 | `generate_crud_from_config`（ADVANCED）、`generate_crud_page` / `generate_crud_schema`（LEGACY FALLBACK） |

- 默认 `full` 是**刻意**的：§9.4 的废弃流程要求开关「默认关闭」，且存量宿主与本站文档仍在
  调 `generate_crud_from_config`；改默认会让它们在同一个小版本里静默失败。待 AN-25 收敛完成
  后再翻转默认值。
- `front-door` 下 server instructions 会追加一段说明，宿主读到的是「这些工具被隐藏」而不是
  tool-not-found。
- 守卫 `check:tool-surface`：唯一 `FRONT DOOR` 措辞、两档工具集合精确互补、解析器大小写/空白
  归一。`__tests__/tool-surface.spec.ts` 在进程内做同一组断言，防止守卫与测试分叉。

### 4.1 总览矩阵

| # | 工具 | 层 | 确定性 | 主要输出 | 是否调用模型 | 状态 |
|---|---|---|---|---|---|---|
| 1 | `detect_project_target` | 环境 | ✅ | `{ target }` | 否 | 稳定 |
| 2 | `generate_crud` | **前门（FRONT DOOR）** | ✅ | 代码 + warnings | 否 | **推荐入口** |
| 3 | `generate_form` | 片段 | ✅ | `<es-form>` SFC | 否 | 稳定 |
| 4 | `generate_table` | 片段 | ✅ | `<es-table>` SFC | 否 | 稳定 |
| 5 | `generate_dialog` | 片段 | ✅ | composable / `<es-dialog>` SFC | 否 | 稳定 |
| 6 | `generate_crud_from_config` | 生成 | ✅ | 代码 + warnings | 否 | **ADVANCED**（已持有类型化配置） |
| 7 | `generate_crud_schema` | legacy | ✅ | schema + wrapper | 否 | **LEGACY FALLBACK** |
| 8 | `generate_crud_page` | legacy | ✅ | schema/SFC | 否 | **LEGACY FALLBACK** |
| 9 | `validate_config` | 校验 | ✅ | errors / suggestions | 否 | 稳定 |
| 10 | `refine_config` | 精修 | ✅ | diff / errors | 否 | 稳定 |
| 11 | `ingest_schema` | 摄取 | ✅ | 草稿 config | 否 | 稳定 |
| 12 | `get_component_api` | 参考 | ✅ | API 文档 | 否 | 稳定 |
| 13 | `list_form_types` | 参考 | ✅ | formtype 列表 | 否 | 稳定 |
| 14 | `scaffold_page` | 工程 | ✅ | 页面骨架 + 入口装配 | 否 | 稳定 |
| 15 | `doctor_page` | 工程 | ✅ | 入口体检报告 | 否 | 稳定 |

### 4.2 逐个说明

#### 1) `detect_project_target`

- **定位**：在生成前确定 target，避免默认 vue3 导致语法/UI 库错误。
- **输入**：项目 `package.json` 的文本内容（宿主读取后传入）。
- **内部**：匹配 Vue 版本、`element-plus` / `element-ui` / `ant-design-vue`、`@es-plus/*` 依赖。
- **输出**：`{ target }`；无法判定时给默认与理由。
- **何时用**：**每次生成前**。
- **维护注意**：新增 target 或 UI 库时，同步 [detect-project-target.ts](./src/tools/detect-project-target.ts) 与三端 README。

#### 2) `generate_crud`（前门）

- **定位**：复合请求的唯一推荐入口。宿主只填 `surfaces`，路由由代码决定。
- **输入**：
  - `name`、`apiUrl`（必填）
  - `surfaces{query?,table?,form?,dialog?}`（至少一个非空）
  - `target`、`mode`、`typescript`、`i18n`
  - 可选旋钮：`actions`、`permissions`、`pagination`、`tableOptions`、`formLayout`、
    `operationColumn`、`tableBtns`、`toolbarBtns`、`expandConfig`、`treeConfig`、`mergeConfig`、`rowkey`
- **内部**：见 §3.2。
- **输出**：schema 模式返回 `schema.ts` + `Page.vue`；SFC 模式返回单文件；无表返回片段；附带 warnings。
- **何时用**：任何包含列表/表格/CRUD/多组件组合的请求。
- **何时不用**：明确只要一个独立 form/table/dialog（用片段工具）。
- **已知边界（现状）**：
  - `rowkey` 在 compose 调用中未透传（AN-06 邻项）。
  - 每个键 × mode 的发射/降级已收进 `render-plan.ts` 账本（AN-22），
    守卫 `check:render-plan` 对账；本节不再逐条罗列模式差异。
- **旋钮形状**：8 颗可选旋钮（`tableOptions`/`formLayout`/`operationColumn`/`tableBtns`/
  `toolbarBtns`/`expandConfig`/`treeConfig`/`mergeConfig`）是**显式 zod 3 形状 + `.strict()`**
  （AN-21，`_front-door-knobs.ts`），未知键在工具层直接报错；与 shared 权威 Zod 的逐键
  对账由 `check:tool-shapes` 守卫（含嵌套键）。`tableBtns` 的 `label`/`action` 别名归一化
  复用 shared `normalizeTableBtn`。
- **维护注意**：前门是 eval 与被测路径的交汇点；任何路由改动必须同步 `check-front-door`。

#### 3) `generate_form`

- **定位**：独立 `<es-form>` SFC（筛选/设置/嵌入式表单）。
- **输入**：`fields`、`target`、`typescript`、`i18n`、`context`、`buttons`、`formLayout`。
- **内部**：`generateFormBlock`；自包含 reactive model + formItemList。
- **输出**：`.vue` SFC。
- **已知边界**：字段级 `render`/`formatter` 在片段表单中被静默丢弃（AN-11）。
- **维护注意**：片段工具与 CRUD 共用 `buildFormItem`；改一处必须回归两处。

#### 4) `generate_table`

- **定位**：独立 `<es-table>` SFC（列表嵌入第三方布局）。
- **输入**：`fields`、`apiUrl`、`target`、`typescript`、`i18n`、`tableOptions`、`pagination`、`rowButtons`。
- **内部**：`generateTableBlock`；行按钮以 `triggerEvent` 发出，不内联 handler。
- **已知边界**：
  - 入参无 `columns`/`treeConfig`/`expandConfig`/`mergeConfig`/`tableBtns`（AN-22）；
  - `editConfig` 可用但无 `editRender` 表达通道，`engine:'vxe'` 时为静默 no-op（AN-11）。
- **维护注意**：`tableShape` 同时是 `validate_config({type:'es-table-config'})` 的判据。

#### 5) `generate_dialog`

- **定位**：独立弹窗（复用新增/编辑/查看）。
- **输入**：`fields`、`apiUrl`、`rowkey`、`target`、`typescript`、`i18n`、`composableName`、`mode`、`defaultTitle`、`options`。
- **内部**：`generateDialogBlock`。
  - `mode:'composable'`（默认）→ `.tsx`，弹窗体是 JSX render，需 JSX 插件；
  - `mode:'component'` → 自包含 `<es-dialog>` SFC，无 JSX 依赖。
- **契约**：`open(title, row?, onSuccess?)`；提交成功后调 `onSuccess`，由宿主刷新自己的表格。
- **已知边界**：标题字面量启发式（`'新增'`→POST、`'查看'`→只读）；自定义标题会失准（前门会告警）。

#### 6) `generate_crud_from_config`（ADVANCED）

- **定位**：宿主已写出类型化 `StructuredCrudConfig` 时的**高级**生成路径。自然语言请求走
  `generate_crud` 前门；本工具不是第二入口。
- **输入**：完整 config（`configShape`）。
- **内部**：先 `repairConfig`（无歧义格式错误确定性修掉），再 `validateAndRepair` → 失败即
  结构化错误、不生成 → `generateFromConfig`。
- **输出**：同前门。
- **何时用**：需要精确控制 `fields[]`、`columns`、`dialogs`、`tableOptions` 等全量键。
- **维护注意**：与 `generate_crud` 共享 `validateAndRepair → generateFromConfig`，改后端必须同时回归两条入口。
  `front-door` profile 下本工具不注册。

#### 7) `generate_crud_schema`（LEGACY FALLBACK）

- **定位**：旧 NL → schema 入口。
- **输入**：`description`、`target`。
- **内部**：`generateCrudSchema`（regex 解析）。
- **状态**：legacy fallback；自然语言请用 `generate_crud`。`front-door` profile 下不注册。

#### 8) `generate_crud_page`（LEGACY FALLBACK）

- **定位**：旧 NL → 页面入口，schema/sfc 两种模式。
- **内部**：schema 模式 `generateCrudSchema`；sfc 模式 `generateCrudPage`。
- **状态**：legacy fallback；描述中已标注“准确率受关键词覆盖限制”。`front-door` profile 下不注册。

#### 9) `validate_config`

- **定位**：统一校验入口，按 `type` 分派。
- **输入**：`config`（对象或 JSON 字符串）+ `type`。
- **内部**：
  - `structured-crud-config` → `validateAndRepair`（shared 的 Zod 权威单源）；
  - `es-table-config` / `es-form-config` / `es-dialog-config` → 复用片段工具的 Zod 形状；
  - 其余 → Ajv JSON Schema（`esplus://schemas/*`）。
- **输出**：`errors[]` + `suggestions[]`。
- **已知边界**：未知键被静默剥离（AN-08）。
- **维护注意**：三类片段配置的判据必须与工具入参同源；不得新增第三份字段清单。

#### 10) `refine_config`

- **定位**：多轮精修的一轮：校验 `revised` + 回显 `previous → revised` 的 diff。
- **输入**：`previous?`、`revised`（JSON 字符串）。
- **内部**：`validateAndRepair(revised)` → 合法则 `diffConfig` + `summarizeDiff`；非法只回错误。
- **关键约束**：**不调用模型**；纠正是宿主做的。无服务端 pin。
- **维护注意**：diff 的维度必须覆盖字段增删、formtype、成员关系、layout、actions、dialogs。

#### 11) `ingest_schema`

- **定位**：把既有 schema 预填成草稿 config，供宿主补全后送 `generate_crud_from_config`。
- **输入**：`text`、`kind`（`openapi` / `jsonSchema` / `sample-json` / `ts-interface` / `sql-ddl`）、`name?`、`apiUrl?`。
- **内部**：`ingestSchema`（类型→formtype）→ `composeCrudConfig`（table + form 两面）。
  - `jsonSchema` / `openapi` / `sample-json`：JSON 解析（OpenAPI 取 `components.schemas` 首个）。
  - `ts-interface`：`interface X {}` / `type X = {}` 字面量；JSDoc → label，非可选成员 → required，
    字符串字面量联合 → Select / 数组字面量联合 → Checkbox。
  - `sql-ddl`：`CREATE TABLE`；列类型 → formtype，`COMMENT` → label，`NOT NULL` / `PRIMARY KEY` → required，
    `ENUM/SET(...)` → dataOptions，表级约束整条跳过。
- **输出**：草稿 config + warnings。
- **已知边界**：只做「类型→formtype」这条轴；查询面取舍、按钮、弹窗仍由宿主补全。嵌套对象 / 无枚举数组 /
  未知命名类型一律 Input 兜底并告警（不静默吞字段）。OpenAPI YAML 不支持。

#### 12) `get_component_api`

- **定位**：六组件 API 文档（EsForm / EsTable / EsDialog / EsCrudPage / SvgIcon / useDialog），按三端分版。
- **输入**：`component`、`target`。
- **内部**：静态文档生成器。
- **维护注意**：组件 API 变更必须同步此工具；`check:api` 守卫 exposed API。

#### 13) `list_form_types`

- **定位**：列出全部 `formtype` + 描述 + 示例。
- **内部**：读 shared 的 `FORM_TYPES`。
- **维护注意**：新增 formtype 必须同步三端字段解析器与评分器。

#### 14) `scaffold_page`

- **定位**：空页面脚手架 + 应用入口装配样板。
- **输入**：`name`（kebab-case）、`features`（query/table/dialog）、`target`。
- **内部**：`generateScaffold` + `generateAppEntry`。
- **关键**：入口装配 `app.use(ESPlus, { permission, t, httpRequest })` 是 `permissionValue` / i18n `labelKey` / 远程 `apiParams` 生效的前提。
- **维护注意**：三端入口样板必须与运行时配置项同步；`check:scaffold` 守卫。

#### 15) `doctor_page`

- **定位**：检查宿主**已有**入口装配是否满足 preflight 清单 —— 「你现在这份缺了什么」，
  与 `scaffold_page` 的「该长什么样」互补，两者共用 `buildPreflight` 的 required 判定。
- **输入**：`entry`（必填）、`target`、可选 `config`（按该页真实用到的能力收紧 required）、
  可选 `viteConfig`（UI 自动导入 / JSX 插件）。
- **内部**：`doctorPage` 只做**字面量静态扫描**，先剥注释；结果三态
  `ok / missing / unverified`，`unverified`（标识符选项、spread 等）**不是通过**。
- **边界**：不执行代码、不解析别名、不读网络；不传 `config` 时 permission / i18n /
  httpRequest 保守按 required。

### 4.3 工具选择决策树

```
请求里是否有表格/列表？
├─ 有 → generate_crud（填 surfaces）
│         └─ 需要精确控制 columns/dialogs/tableOptions？→ generate_crud_from_config
├─ 没有
│   ├─ 明确只要一个 form → generate_form
│   ├─ 明确只要一个 table → generate_table
│   ├─ 明确只要一个 dialog → generate_dialog
│   └─ 组合（form+dialog / query+form）→ generate_crud（surfaces 无 table 分支）
└─ 已有 OpenAPI/JSON Schema → ingest_schema → 人工补全 → generate_crud_from_config
```

**禁止**：用多个片段工具手拼一个复合页面。前门存在的原因就是消除这种编排错误。

---

## 5. 配置 IR 契约

### 5.1 `surfaces`（前门意图表）

```ts
{
  query?: SurfaceField[],
  table?: SurfaceField[],
  form?:  SurfaceField[],
  dialog?: (('add'|'edit'|'view') | {
    key: string
    title?: string
    width?: string | number
    fullscreen?: boolean
    formItems?: SurfaceField[]
  })[]
}
```

`SurfaceField` 的权威形状见 [src/tools/_fragment-shapes.ts](./src/tools/_fragment-shapes.ts)；
可与完整 `FieldConfig` 对照，但**不含** `inQuery/inTable/inForm`（由组合推导）。

### 5.2 `StructuredCrudConfig` 顶层键

| 键 | 作用 | 三端 |
|---|---|---|
| `name` / `apiUrl` | 页面名 / REST 基址 | ✅ |
| `fields[]` | 字段表 + 三成员布尔 | ✅ |
| `actions[]` | add/edit/delete/view/export/import | ✅ |
| `columns[]` | 显式列（覆盖字段派生） | ✅ |
| `tableOptions` | 表格外观/状态/引擎/请求映射 | 大部分 ✅，`virtual` vue2 不支持、`editConfig` 仅 vxe |
| `pagination` | `pageSize` / `pageSizes` | ✅（schema 模式当前丢 `pageSizes`，AN-08 邻项） |
| `formLayout` | `labelWidth` / `minFoldRows` | ✅ |
| `operationColumn` | 操作列配置 / `false` 隐藏 | ✅ |
| `tableBtns` / `toolbarBtns` | 表格工具栏 / 表单区按钮 | ✅（契约见 AN-07） |
| `dialogs` | 每弹窗底座 + `formItems` | ✅ |
| `expandConfig` | 声明式行展开 | ✅ |
| `treeConfig` | 声明式树表 | ✅ |
| `mergeConfig` | 声明式合并单元格 | ✅ |
| `permissions` | 动作权限码 | ⚠️ 声明但 schema 模式无消费（AN-11） |
| `i18n` / `typescript` / `target` / `mode` | 生成选项 | ✅ |

权威 Zod：[../shared/src/structured-config.schema.ts](../shared/src/structured-config.schema.ts)。

### 5.3 成员关系与归并优先级

`composeCrudConfig` 的固定规则（[../shared/src/compose-crud-config.ts](../shared/src/compose-crud-config.ts)）：

1. **标识**（`prop/label/formtype/labelKey`）：首次出现为准，冲突告警。
2. **语义**（`required/rules/dataOptions/apiParams/attrs/isHidden/reactions`）：query 铺底，**form 覆盖**。
3. **展示**（`width/minWidth/align/fixed/ellipsis/formatter/render`）：query/form 铺底，**table 覆盖**。
4. **span**：`querySpan` 来自 query 面，`formSpan` 来自 form 面。
5. **permissionValue**：任一面首个非空值。
6. **actions**：显式优先；否则按 dialogs key 推导，再否则按 form 面推导，最后 `['view']`。

> 现状缺陷：第 2 步只从 query/form 拷贝，**table 面的语义键会丢失**（AN-08 邻项）。

### 5.4 三种产物形态

| 形态 | 何时 | 内容 | 保真度 |
|---|---|---|---|
| schema | 有表，`mode:'schema'`（默认） | `pageSchema` JSON + wrapper SFC | 最高；推荐 |
| SFC | 有表，`mode:'sfc'` | 单文件 SFC | 较低：`dialogs/tableBtns/toolbarBtns/operationColumn` 不全量发射 |
| fragment | 无表 / 显式单组件 | 独立 `<es-form>` / `<es-table>` / dialog composable | 自包含、可嵌入 |

**发射账本（AN-22）**：每个顶层键在两个 mode 下的归宿不散落在生成器的 `if (config.x)`
里，而集中在 `shared/src/render-plan.ts` 的 `RENDER_PLAN_CONTRACT`：`emit`（逐字/等价发射）、
`derive`（由其他键派生）、`meta`（只影响生成，不出现在产物）、`downgrade`（本 mode 不支持，
**必须**在 warnings 里点名）、`absent`（配置未声明）。上表 SFC 的「较低」即账本里的
`downgrade` 行。`check:render-plan` 对账键集、快照与真实产物证据，新增键漏登记会红。

---

## 6. 三端运行时契约

### 6.1 `es-crud-page` 的规范化与兜底

三端同构（vue3 见
[../vue3/src/components/es-crud-page/src/es-crud-page.vue](../vue3/src/components/es-crud-page/src/es-crud-page.vue)）：

| 计算属性 | 优先读 | 否则 | 当前兜底 |
|---|---|---|---|
| `normalizedDialogs` | `schema.dialogs` | `schema.dialogFormItems` + `actions` | `['add','edit','delete']` |
| `normalizedToolbarBtns` | `schema.toolbarBtns` | `operationColumn !== undefined` → `[]` | 由 `actions` 派生 |
| `normalizedOperationColumn` | `schema.operationColumn` | 由 `actions` 派生 | `['add','edit','delete']` |
| `normalizedTableBtns` | `schema.tableBtns` | `[]` | — |

> 现状缺陷：`schema.actions` 缺失时硬编码默认三动作（AN-06）。目标态改为“按 schema 语义推导”。

### 6.2 `es-table` 引擎与选项映射

| 能力 | 默认引擎（el-table / a-table） | virtual | vxe |
|---|---|---|---|
| `multiSelect` 选择列 | ⚠️ vue3/vue2 默认不合成；antdv 合成 | ✅ | ✅ |
| `snIndex` 序号列 | ⚠️ 同上 | ✅ | ✅ |
| `ellipsis` | el-table 用 `show-overflow-tooltip`；antdv 需映射 | ✅ | ✅ |
| `defaultSort` | el-table 透传；antdv 需翻译 | ✅ | ✅ |
| `editConfig` 行内编辑 | ❌ | ❌ | ✅ |
| `treeConfig` 树表 | ✅（组件侧翻译） | ✅ | ✅ |
| `mergeConfig` 合并 | ✅（spanMethod/customCell） | ✅ | ✅ |
| `virtual` | ❌ | ✅ | ✅（vue2 有 vxe） |

> 能力矩阵的目标态见 AN-09 / AN-10；任何差异必须有生成时告警。

### 6.3 运行时前置（编译通过 ≠ 能力生效）

| 前置 | 影响 | 缺失后果 |
|---|---|---|
| `app.use(ESPlus, { httpRequest })` | 列表加载、增删改 | 请求不可用 |
| `permission` | `permissionValue` / 列级权限 | 静默放行 |
| `t` | i18n `labelKey` | 显示原始 key |
| JSX 插件 | dialog composable（`.tsx`） | 构建失败 |
| 三端 UI 库 | 所有组件 | 构建失败 |

`scaffold_page` 负责生成入口装配；目标态增加 `preflight` 输出（AN-16）。

---

## 7. 质量保障体系

### 7.1 语料

```
__tests__/golden/cases/
  ├─ 188 条 CRUD（166 heldout + 22 few-shot 派生）
  └─ 63 条片段（21 场景 × 3 端：table / form / dialog）
```

- `__tests__/golden/last-accuracy.json`：最近一次**本地**结果（可能过期，见 AN-03）。
- 远端 nightly 产物由 CI 提交；**不要**把工作区旧快照当最新成绩（见 `eval-artifact-ref-trap` 记忆）。

### 7.2 指标定义

| 指标 | 定义 | 示例快照（2026-10-19 run 39225471476；**当前值以 `last-accuracy.json` 为准**，本文不重复维护） |
|---|---|---|
| `exactIntentCore` | 核心字段/动作/成员关系全等 | 50.0%（83/166） |
| `exactIntentFull` | 全量意图（含所有可选键） | 28.3%（47/166） |
| `exactIntentScoped` | 只比 NL 锁定维度 | 48.8% |
| `definition95` | scoped 零编辑 ∨ ≤K=3 轮收敛 | **51.2%（85/166）** |
| `compileRate` | 现状 = `generateFromConfig` 未抛异常 | 99.47%（187/188），**不门禁** |
| 收敛 @3 | 5 行，脚本化纠正 | 100%（5/5，均值 0.80 轮） |

### 7.3 守卫目录（节选）

| 命令 | 守护内容 |
|---|---|
| `check:entry` | 前门键集可达性 vs schema |
| `check:schema` | Zod 声明 ↔ 生成器发射 ↔ 运行时消费 |
| `check:render-plan` | 顶层键 × mode 发射账本（键集 / 快照 / 产物证据 / 降级告警） |
| `check:fragment` | 片段契约 |
| `check:threeway` | 三端一致性 |
| `check:front-door` | 真 handler 驱动 + 编译 + round-trip |
| `check:scene-coverage` | 片段三端 vite build |
| `check:parity` | 三端 renderer 列契约 |
| `check:feature-coverage` | 文档案例可达性台账（含 es-eui / es-pc 站点案例 → 单源演示 → 能力令牌，未匹配显式 D） |
| `check:fewshot-registration` | few-shot 与 heldout 隔离 |
| `check:membership-trap` | inQuery 默认 true 双向规则 |
| `check:site-claims` | 公开声明（目标 / 当前徽章 / 语料规模与 artifact 绑定，AN-27） |
| `check:tool-surface` | 唯一 FRONT DOOR + profile 两档工具集合（AN-26） |
| `check:scorers` / `check:ratchet` | 评分器 / 棘轮 |

完整命令见根 [package.json](../../package.json) 的 `check:*`。

### 7.4 发布门禁（目标态）

```
1. check:consistency 全绿
2. 编译腿 Tier A 100%（measured 行）
3. heldout definition95 ≥ 95%
4. 未测到行数 = 0
5. artifact/徽章/站点文案与本次运行一致
```

---

## 8. 已知边界与禁止事项

1. **无视觉输入**：server 不接受图片/URL/Figma；不要把设计稿理解写进 server 责任。
2. **无模型调用**：server 内不得出现 LLM SDK；`refine_config` 的纠正是宿主做的。
3. **无会话**：pin 由宿主持有；不要引入服务端配置存储。
4. **禁止静默丢弃**：任何无法表达的键必须告警或报错，并保留扩展点标记。
5. **禁止第二份字段清单**：schema、tool shape、validator 必须同源或由守卫对账。
6. **legacy 工具不删但降级**：`generate_crud_schema`/`generate_crud_page` 仅作 fallback。
7. **未知键策略**：现状是静默剥离（缺陷）；目标态见 AN-08（严格 IR + `x-*` 逃生口）。

---

## 9. 维护协议

### 9.1 新增一个配置键（必做）

1. `shared/src/structured-config.schema.ts`：声明 + `.describe()`。
2. `shared/src/render-plan.ts`：在 `RENDER_PLAN_CONTRACT` 登记该键 × 两个 mode 的
   disposition（`emit`/`derive`/`meta`/`downgrade`）与产物证据 token；`downgrade`
   必须带 `reason`。漏登记 = `tsc` 缺键 + `check:render-plan` 红。
3. `structured-generator.ts`：发射条件读 `buildRenderPlan(...)` 的 disposition
   （schema 模式与 SFC 模式都发射，或显式告警/降级）。
4. 三端运行时：确认消费；不支持的端登记到 capability 矩阵。
5. `_fragment-shapes.ts`：若前门/片段需要，补形状。
6. 守卫：`check:schema` / `check:entry` / `check:parity` / `check:contract` /
   `check:render-plan` 至少一项覆盖。
7. 语料：至少 1 条 golden（三端）+ few-shot（如需要）。
8. 文档：本文件 §5/§6 + REMEDIATION 状态。

### 9.2 新增一个工具（必做）

1. 纯函数实现放 `shared`（可单测），工具只做形状 + 调用。
2. `src/tools/index.ts` 注册 + `src/index.ts` instructions 更新。
3. 工具描述写清“何时用/何时不用/已知边界”。
4. 本文件 §4 增加条目；选择决策树更新。
5. 新增契约测试（不起传输层，直接测纯函数）。
6. 如涉及生成，纳入 eval/片段腿。

### 9.3 修改一个指标（必做）

1. 先在 `scripts/eval/*.test.mjs` 增加定义级测试。
2. 更新 `accuracy-baseline.json` 的口径与适用数（不得手改计数）。
3. 用旧快照复跑一次，确认变化方向可解释。
4. 更新本文件 §7.2 + REMEDIATION 验收。
5. **不得**为了让数字变绿而放宽定义；只可修正测量错误。

### 9.4 弃用流程

- 先改描述（“legacy / fallback”），保留一个 minor 周期；
- 再加 profile/env 开关（默认关闭）—— 已落地 `ESPLUS_MCP_PROFILE=front-door|full`，默认 `full`；
- 最后在大版本移除；
- 每一步同步本文件与 CHANGELOG。

### 9.5 PR 完成定义（DoD）

- [ ] 代码 + 单测/守卫
- [ ] 相关 golden / eval 证据
- [ ] 本文件更新（如行为变化）
- [ ] REMEDIATION 中对应 AN 条目状态更新
- [ ] `check:consistency` 本地绿（Windows 假阳性见记忆 `windows-crlf-guard-false-positives`）
- [ ] 无静默丢弃、无第二份字段清单

---

## 10. 附录

### 10.1 文件地图

| 路径 | 职责 |
|---|---|
| `src/index.ts` | server 创建、instructions |
| `src/tools/index.ts` | 14 工具注册 |
| `src/tools/generate-crud.ts` | 前门 + surfaces 形状 |
| `src/tools/generate-from-config.ts` | 配置直通 + 语义告警 |
| `src/tools/_fragment-shapes.ts` | 片段/前门字段形状 |
| `src/resources/*` | 7 族资源 |
| `src/prompts/*` | 2 个 prompt |
| `../shared/src/compose-crud-config.ts` | 三面归并 |
| `../shared/src/structured-config.schema.ts` | 权威 Zod |
| `../shared/src/validate-and-repair.ts` | 前门校验 |
| `../shared/src/structured-generator.ts` | schema/SFC 生成 |
| `../shared/src/fragment-generator.ts` | 片段生成 |
| `../shared/src/crud-engine.ts` | legacy regex NL |
| `../../scripts/eval-llm.mjs` | eval 主链路 |
| `../../scripts/eval/scorers.mjs` | 维度评分 |
| `../../scripts/lib/front-door.mjs` | 前门驱动/编译 |

### 10.2 术语

| 术语 | 含义 |
|---|---|
| surfaces | 前门的意图表（query/table/form/dialog） |
| 三面 | query / table / form 字段列表 |
| 成员布尔 | `inQuery/inTable/inForm` |
| schema 模式 | 输出 `pageSchema` + wrapper SFC |
| SFC 模式 | 输出单文件 SFC |
| 片段 | 独立 table/form/dialog 产物 |
| golden | 评测金标用例 |
| heldout | 非 few-shot 派生的评测集 |
| 前门 | `generate_crud` |
| pin | 宿主自持的上一轮配置 |
