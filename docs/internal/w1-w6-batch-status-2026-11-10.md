# W1–W6 批次状态与 A 批执行记录

日期：2026-11-10
分支：`master`（本地未 push）
口径：本文件回答「A/B/C/D 四批各自完成了什么、还差什么」。所有「未完成」项都附源码证据；
所有读数都标明来源，**不把工作区未提交的 `last-accuracy.json` 当作门禁读数**。

## 一、总表

| 批次 | 内容 | 状态 | 出口标准 | 判定 |
|---|---|---|---|---|
| **A** | W1 标准 + W2 1 小时 spike + `tools/list` 快照 | ✅ 完成 | 冻结产物重算，中文腿不变、英文腿可解释 | zh 未变、en 可逐维解释；spike 与快照今日落盘 |
| **B** | W2 单源派生 + W3 工具收缩 | ◐ 部分（W3 ✅ / W2 ✗） | 守卫净减 ≥2,000 行；`tools/list` <40 KB | front-door 已降到 **21.1 KB / 12 工具**（<40 KB 达成）；W2 的 790 行镜像未动，故「净减 ≥2,000 行」未达成 |
| **C** | W4 回读闭环 + W5 弱维度 | ✗ 未开始（W5 半套） | 往返测试绿；membership/dataOptions 有归因数据 | 无 `read_page`/`__esPlusSource`；产物无逐行 misses |
| **D** | W6 legacy 退役 | ◐ 部分 | 无 importer；资源文案不再失实 | 文案已实（a5554f3）；importer 仍有 6 处 |

A 批的「W1 标准」早在 `86316bf`（`+en-text-agnostic-v1`）与 `fc59d13`（`+label-typographic-v1`）
落地；本日补的是 A 批剩下的两件：**W2 1 小时 spike** 与 **`tools/list` 快照**。
B 批当日完成的是 **W3 工具收缩**（前门 16 → 12 工具、171.1 → 21.1 KB）与预算守卫；
**W2 单源派生未动**，B 批的「净减 ≥2,000 行」仍未达成（见 §二 W2 与 §四）。

## 二、逐项核对（源码证据）

### W1 · 评估标准 —— ✅ 完成

- **en 腿可译文案按结构身份归一**：`scripts/eval/scorers.mjs:682`（`+en-text-agnostic-v1`），
  `scripts/eval/dump.mjs:80` 记录版本含义。
- **列标题/选项标签/展开区标题与字段身份同规**：`+label-typographic-v1`，`dump.mjs:85`。
- **冻结产物重算**：`scripts/eval/rescore.mjs` 可离线重算 JSONL dump，零 API 成本；
  `check:rescore-parity` 保证与在线跑批同分。
- **同 dump 重算结果**（198 条 en turn-0）：

  | 指标 | 旧尺子 | 新尺子 |
  |---|---|---|
  | en `exactIntentScoped` | 24.7% | **36.4%** |
  | en `exactIntentFull` | 14.6% | **21.7%** |
  | en `exactIntentCore` | 23.6% | **26.3%** |
  | zh `exactIntentScoped` | 84.8% | **84.8%（未变）** |

  分维：dataOptions 4/96→26/96、columns 3/36→19/36、tableBtns 4/15→14/15、
  expandConfig 5/16→10/16、reactions 3/15→7/15。A 批出口「中文腿不变、英文腿可解释」达成。

- **仍未达的是 P0-4 的 0.40 验收线，不是 A 批出口**。剩余主因已换人：`propSet` 88/198（44%）
  —— en 腿字段身份只能退回 `prop`，一行里一个字段名写法不同就整维判负。下一批该打命名与
  few-shot，而不是继续放宽 scorer。

### W2 · 契约单一真源 —— ✗ 未开始（spike 已完成）

- 手写镜像仍在：`packages/mcp-server/src/tools/_front-door-knobs.ts`（**241 行**）、
  `_fragment-shapes.ts`（**549 行**）、`generate-from-config.ts` 的 `configShape`。
- 源码自己写明这是「deliberately, separately worded」的临时状态：
  `generate-from-config.ts:543`「the copy could be replaced by the shared schema's `.shape`
  — it stays … until that refactor is measured against the eval corpus」。
- zod 已统一到 4.6.7（shared 与 mcp 均 `^4.4.3`），**版本前提已具备**。
- spike 结论见 §三.2：SDK 接受 shared 的 ZodObject，但直接 `.pick()` 不是 drop-in。
- 附带修正：`check-tool-shapes.mjs` 与 `scripts/lib/front-door.mjs` 的头注仍写着
  「zod 3 与 zod 4 两代不能复用」，已改为当前事实（统一在 v4；镜像暂留的真实原因是
  `.default()` 注入、strip-vs-strict 与 profile 相关描述）。

### W3 · 收工具面 —— ✅ 完成（2026-11-10）

收缩前后的宿主侧实测（`npm run tools:list:snapshot`，真 SDK 的 `client.listTools()`）：

| profile | 工具数 | 总字节 | 描述 | schema |
|---|---|---|---|---|
| front-door（收缩前） | 16 | 171.1 KB | 14.0 KB | 157.1 KB |
| **front-door（收缩后）** | **12** | **21.1 KB** | 8.9 KB | 12.2 KB |
| full（未变） | 19 | 243.8 KB | 16.2 KB | 227.6 KB |

收缩前各工具对 front-door 体积的贡献：

| 工具 | 体积 | 占比 |
|---|---|---|
| `generate_crud` | **80.9 KB**（schema 78.8 KB） | front-door 的 **47%** |
| `generate_table` | 27.6 KB | 16% |
| `generate_dialog` | 21.1 KB | 12% |
| `generate_form` | 20.2 KB | 12% |
| `generate_scene` | **1.9 KB**（schema 0.9 KB） | 1% |

**做法**：front-door 不再注册 7 个工具 —— `generate_crud`（`scene='crud'` 的兼容 adapter）、
`generate_form` / `generate_table` / `generate_dialog`（三个单面片段，对应 `generate_scene` 的
另外三个 scene）、`generate_crud_from_config`（ADVANCED）、`generate_crud_page` /
`generate_crud_schema`（LEGACY）。隐藏标准不是「旧不旧」，而是 **`generate_scene` 能否逐字节
复现**：四个 scene 复用同一组发射器，`check:scene-parity` 继续证明产物相同。

改到的面（一处漏掉宿主就会拿到 tool not found）：

- `src/tools/index.ts`：注册分支按 profile 拆开；
- `generate-scene.ts` / `generate-composition.ts`：描述改为 profile 相关，front-door 档不点名被隐藏的工具；
- `validate-config.ts`：片段类型名从「`generate_table` 的入参」改述为「scene `'table'` 的 intent」；
- `detect-project-target.ts`：front-door 的 `generators` 只列 `generate_scene` / `generate_composition` / `get_component_api`；
- `instructions.ts`、`prompts/crud-page.ts`、`resources/conventions.ts`、`resources/surfaces-examples.ts`：同源改写；
- `src/profile.ts` 头注、`es-plus-docs/src/docs/mcp-server.{md,en.md}`、两份 README、
  `AI-NATIVE-ARCHITECTURE.md`、`server.json`（registry manifest）与 `docs/why-es-plus.{md,en.md}`：
  计数 16 → 12、隐藏名单 3 → 7。

**新增守卫**：

- `scripts/check-surface-budget.mjs`（`check:surface-budget`）：读快照做预算棘轮 ——
  front-door 总量 40 KB / 单工具 10 KB，full 总量 250 KB / 单工具 85 KB，并断言
  front-door 至少比 full 小 4 倍（防止重量级工具漏回前门）。
- `tools:list:check` 首次入闸，排在预算守卫之前：先证明快照与源码一致，预算才量的不是陈旧产物。
- `check-tool-surface` 的 `FRONT_DOOR_HIDDEN` 扩到 7，并对每个隐藏工具做反向断言。
- **`check-doc-drift` 的一处自相矛盾已修**：`STALE` 黑名单里钉着 `| \`front-door\` | 12 |`，
  收缩后 12 变成**正确值**，静态黑名单反而把正确文档判红。该数字已由动态断言覆盖，黑名单条目删除。

已修 / 已否决：

- ✅ `resources/examples.ts:27` 的失实文案已在 `a5554f3` 改为「legacy 引擎、仅作形状参考」，
  并由 `front-door-profile.spec.ts` 反向断言锁住。
- ❌ **默认 profile 翻 `front-door` 已否决**：`profile.ts:19` 与 ARCHITECTURE §4.0/§9.4
  写明「AN-25 收敛后才翻」，翻转会与文档决策对打。**因此 `<40 KB` 是「可达且已有守卫」，
  不是默认档的事实**：默认 full 仍是 243.8 KB（兼容性决定，见 `check:surface-budget` 的棘轮）。
- ✅ `cli-flags.ts` 的过期工具计数（「all 15 tools」）已在 `a5554f3` 改为 19 / 16。
- ⏳ **`check:surface-budget` 已建立**；`generate_crud` 仍是 full 档的独立注册项
  （与 `generate_scene('crud')` 共用同一条实现），但 front-door 已不再暴露它。

### W4 · 回读闭环 —— ✗ 未开始

- 全仓 grep `__esPlusSource|read_page|lossy[]` **零命中**；`ingest_schema` 只认
  `openapi / jsonSchema / sample-json / ts-interface / sql-ddl`（数据 schema，不认 `.vue`）。
- schema 模式投影有损仍是事实：`structured-generator.ts:740`（权限忽略）、`:778`
  （formatter 丢弃）、`:843`（apiUrl 折叠）、`:1986` 起注入 `span`/`attrs`/自动 rules。
- 最小可靠解不变：随 `pageSchema` 发射 `__esPlusSource`，再补 `read_page` 与显式 `lossy[]`。

### W5 · 弱维度归因 —— ◐ 半套

- **已有**：`scoreAll` 返回 `attrMisses`；工作区 artifact（deepseek-flash，2026-11-09，
  ruler 仍是补丁前版本）给出聚合归因：

  | 维度 | 命中 |
  |---|---|
  | membership | 64.8%（129/199） |
  | dataOptions | 48.2%（54/112） |
  | dialogs | 53.3%（8/15） |
  | formtype | 85.4%（170/199） |
  | `definition95` | 88.94%（177/199） |

- **没有**：artifact 不持久化逐行 `misses[]`（`last-accuracy.json` 的键里没有
  `misses`/`attrMisses`）。定位仍要手工 rescore dump —— C 批出口「membership/dataOptions
  有归因数据」只算做到一半，且这份读数的 rulerVersion 早于 W1 两次补丁，**不能当门禁数**。

### W6 · legacy 退役 —— ◐ 部分

- 资源文案已不再失实（`a5554f3`，`resources/examples.ts:27`）。
- importer 仍在（`generateCrudPage` / `PRESET_EXAMPLES`）：
  `packages/cli/src/commands/create.ts:317`、`packages/mcp-server/src/resources/examples.ts:9`、
  `packages/mcp-server/src/tools/generate-crud-page.ts:35`、`packages/shared/src/index.ts:2`、
  `packages/shared/src/code-generator.ts:28`、`packages/shared/src/constants.ts:25`，
  另有 `packages/shared/__tests__/code-generator*.spec.ts` 两套快照。
- 前置不变：先把 `generateScaffold` / `generateAppEntry` 从 `code-generator.ts` 拆出去
  （`scaffold_page` 与 CLI `scaffold` 依赖它们，不是 crud-engine 的依赖），再逐消费方改指。

## 三、A 批本次落地

### 1. `tools/list` 快照（新增）

- 脚本：`scripts/tools-list-snapshot.mjs`
  - 用**真** `McpServer` + `InMemoryTransport` + **真** `client.listTools()`，与宿主同链路；
  - 从**源码** esbuild 打包（`metafile` 自证没命中 `shared/build`，防陈旧产物）；
  - 每个工具压成一行紧凑 JSON，改一个工具只动一行；
  - `--check` 逐工具报告「新增 / 删除 / 定义变化」，带 KB 增量。
- 基线：`packages/mcp-server/tools-list.snapshot.json`（424 KB）。
- npm：`tools:list:snapshot` / `tools:list:check`。
- 2026-11-10 W3 起 `tools:list:check` 与 `check:surface-budget` 已入 `check:consistency`
  （`cross-target` 组，顺序：快照一致性 → 预算），不再是只能手动运行的审阅基线。

注意：两个 profile 的工具定义**不共用**。front-door 不只隐藏 3 个工具，还会改写描述与
入参字段的 `describe`（`validate_config` 的 `structured-crud-config` 一句就不同）。快照
因此按 profile 分开存；曾试图按工具名合并，`validate_config` 立刻冲突。

### 2. W2 1 小时 spike（结论：能力前提成立，派生不是 drop-in）

新增用例：`packages/mcp-server/__tests__/real-sdk-registration.spec.ts` 的
「W2 spike：shared 的 StructuredCrudConfigSchema 可直接作为 inputSchema 并完整出现在
tools/list」。它钉住的是**能力前提**：`registerTool({ inputSchema: StructuredCrudConfigSchema })`
不抛，`tools/list` 里 20 个顶层键一个不少，嵌套 `tableOptions` 也被完整翻出。

实测数据：

| 问题 | 实测 | 结论 |
|---|---|---|
| SDK 接受 shared 的 ZodObject？ | `registerTool` 不抛；`tools/list` 返回 20 个顶层属性，`tableOptions` 嵌套属性完整 | ✅ 成立 |
| 体积会不会爆？ | 宿主侧：派生 **82.8 KB** vs 手写镜像 **78.8 KB**（+5%） | ✅ 不是障碍 |
| `.default()` 会注入吗？ | `StructuredCrudConfigSchema.shape.tableOptions.safeParse({bogusKnob:1})` → 成功，且返回 `{border:true,stripe:true,rowkey:'id',highlightCurrentRow:true}`；字段解析注入 `formtype/inQuery/inTable/inForm` | ❌ 真阻塞：`withRowkey` 会把默认 `rowkey:'id'` 当成用户显式配置 |
| 未知键会被 strip 吗？ | 同上，`bogusKnob` 静默消失 | ❌ 真阻塞：`collectUnknownKeys` 会恒空，未知键闸门失效 |
| 描述能直接复用吗？ | front-door 会改写描述与字段 describe（`validate_config`/`detect_project_target`/`ingest_schema`/`refine_config` 四处） | ❌ 需要一层 profile 相关的描述覆盖 |

因此 B 批的 W2 不是「删掉镜像、改 import」，而是要同时解决：**去默认值**、
**递归收紧为 strict（或保住 `.passthrough()` 的未知键闸门）**、**描述覆盖层**。
三项都有明确做法，但需要一次设计 + 一轮 eval 语料测量，不能盲改。

## 四、剩余批次的前置

| 批次 | 现在就能做 | 必须先解决 |
|---|---|---|
| B | ✅ W3 已落地（前门 12 工具 / 21.1 KB，`check:surface-budget` 入闸）；W2 的默认值/strict/描述三件事仍未动，故「守卫净减 ≥2,000 行」未达成 | W2 三件事 + `_front-door-knobs.ts`（241 行）/ `_fragment-shapes.ts`（549 行）/ `configShape` 的镜像退役 |
| C | `misses[]` 落 artifact（`scoreAll` 已有 `attrMisses`，只是没写出去）；往返测试骨架 | `__esPlusSource` 的发射位置与 `lossy[]` 契约；生成 → 回读 → 再生成的字节级断言 |
| D | 拆 `generateScaffold` / `generateAppEntry` 的独立批次 | 逐消费方改指（CLI create / MCP examples 资源 / docs 回退 / demo） |

## 五、复现命令

```bash
export PATH="/d/nvm/v20.15.0:$PATH"   # 本机默认 node 14，会误报 ??= 语法错

npm run tools:list:snapshot           # 重写基线（有意变更时）
npm run tools:list:check              # 逐工具断言与基线一致
npx vitest run packages/mcp-server/__tests__/real-sdk-registration.spec.ts
npm run check:tool-shapes             # 镜像 ↔ 权威 schema 逐键对账
npm run check:tool-surface            # 工具面 profile / 标签 / 引导文案
```

W1 的冻结产物重算：

```bash
node scripts/eval/rescore.mjs <pred.jsonl> --expect __tests__/golden/last-accuracy.json
```

> 工作区的 `last-accuracy.json` 是 2026-11-09 的 deepseek-flash 读数，`rulerVersion` 早于
> `+en-text-agnostic-v1` / `+label-typographic-v1` 两次补丁；本文件只把它用于**归因**，
> 不用于门禁判定。门禁读数以 nightly 提交到 master 的产物为准。
