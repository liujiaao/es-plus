# W1–W6 批次状态与 A 批执行记录

> **本文是历史批次记录（2026-11-10 的口径），不是当前状态。** 当前工具数以
> `packages/mcp-server/tools-list.snapshot.json` 为准（`npm run tools:list:check` 钉住），
> 当前准确率读数以 `__tests__/golden/accuracy-baseline.json` 为准。文中「12/18/19 工具」
> 「21.1 / 340.8 KB」等数字都是当日快照，后续批次已变动 —— 引用前先查快照，不要直接抄本文。

日期：2026-11-10
分支：`master`（本地未 push）
口径：本文件回答「A/B/C/D 四批各自完成了什么、还差什么」。所有「未完成」项都附源码证据；
所有读数都标明来源，**不把工作区未提交的 `last-accuracy.json` 当作门禁读数**。

## 一、总表

| 批次 | 内容 | 状态 | 出口标准 | 判定 |
|---|---|---|---|---|
| **A** | W1 标准 + W2 1 小时 spike + `tools/list` 快照 | ✅ 完成 | 冻结产物重算，中文腿不变、英文腿可解释 | zh 未变、en 可逐维解释；spike 与快照今日落盘 |
| **B** | W2 单源派生 + W3 工具收缩 | ✅ 完成 | 守卫净减 ≥2,000 行；`tools/list` <40 KB | front-door **21.1 KB / 12 工具**（<40 KB 达成）；W2 三份镜像全部清零（旋钮 + configShape + 片段形状），**净 −667 行**；「净减 ≥2,000 行」按实测**不可达**（候选总量 ~1,140 行），出口标准已改判为「镜像清零」 |
| **C** | W4 回读闭环 + W5 弱维度 | ✅ 完成 | 往返测试绿；membership/dataOptions 有归因数据 | W5 已落盘逐行归因（旁路 + 零 API 复算，membership/dataOptions 均有通道级归因）；W4 的 `__esPlusSource` / `read_page` / `lossy[]` 全部落地，往返断言「读回配置再生成 = 逐字节相同」（shared `page-source.spec.ts` 18 例） |
| **D** | W6 legacy 退役 | ✅ 完成 | 无 importer；资源文案不再失实 | `generateCrudPage` / `PRESET_EXAMPLES` / MCP `generate_crud_page` 删除，全仓零代码 importer；`esplus://examples` 改走前门 `emitSceneArtifact`，文案与产物同源 |

A 批的「W1 标准」早在 `86316bf`（`+en-text-agnostic-v1`）与 `fc59d13`（`+label-typographic-v1`）
落地；本日补的是 A 批剩下的两件：**W2 1 小时 spike** 与 **`tools/list` 快照**。
B 批当日完成的是 **W3 工具收缩**（前门 16 → 12 工具、171.1 → 21.1 KB）、预算守卫，
以及 **W2 单源派生的全量**（前门旋钮 + `generate_crud_from_config` 的 `configShape`
+ `_fragment-shapes.ts` 的片段形状，三份手写镜像清零）。
「净减 ≥2,000 行」实测**不可达**：全部手写镜像合计只有约 1,140 行候选，减去派生层与单测
后净减约 667 行；该出口标准已改判为**镜像清零**（见 §二 W2 与 §四）。

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

### W2 · 契约单一真源 —— ✅ 完成（2026-11-10）

**已退役的三份镜像**（与 shared `StructuredCrudConfigSchema` / `SurfaceFieldSchema` 单源）：

| 文件 | 之前 | 之后 | 做法 |
|---|---|---|---|
| `src/tools/_front-door-knobs.ts` | 241 行手写副本 | **48 行**（6 个 `deriveSchema(...)`） | 逐颗旋钮从 `StructuredCrudConfigSchema.shape.<knob>` 派生 |
| `src/tools/generate-from-config.ts` | 330 行 `configShape` 字面量 + 318 行字段词汇表 | **7 行**（`const configShape = StructuredCrudConfigSchema.shape;`） | 整份 shape 直接复用；死词汇表随 configShape 一起删除 |
| `src/tools/_fragment-shapes.ts` | **550 行**手写镜像（字段词汇 + 四组容器 + reactions） | **113 行**（容器 4 行派生 + surface 基座 8 行 + 输出适配） | 先把 shared 的 `SurfaceField` 从 TS interface 提升为权威 Zod（`SurfaceFieldSchema = FieldConfigSchema.omit({inQuery,inTable,inForm})`），弹窗底座用 `DialogBlockOptionsSchema = DialogConfigSchema.pick({…13 键})` |

新增派生层 `src/tools/_derive.ts`（204 行，含契约注释）与 `__tests__/_derive.spec.ts`
（16 例），把 spike 暴露的三个阻塞逐条解决：

1. **去默认值** —— `.default()` 解包丢弃，但**保留「输入可省略」**（补 `.optional()`）。
   spike 实测的 `withRowkey` 误判（默认 `rowkey:'id'` 当成显式配置）由此消失。
2. **未知键** —— 递归 `.strict()`（前门旋钮）或 `.passthrough()`（片段口径）；拼错的键
   必须在工具层报错，不能静默 strip（`_arg-guard` 的 did-you-mean 闸门依赖它）。
   备份策略 `inherit` 留给 `validate_config` 那条只判不改的路径。
3. **描述** —— `.describe()` 在 zod 4 里挂在实例 registry 上，重建会丢；派生对每个重建
   结果显式重新 `describe()`。**教学面与配置判据自此同源**。

派生并非只是「少几百行」：对账实测出镜像里两处**静默失败**并已消除 ——

- `keyboardConfig` / `mouseConfig` / `validConfig` / `seqConfig` 四个嵌套对象漏了
  `.strict()`，拼错的子键在 args 到达 handler 前被 strip；
- `operationColumn.btns` / `expandConfig.fields` / `mergeConfig.rowsBy` 漏了 shared 的
  `.min(1)`，空数组被当作合法配置一路传到生成器。

**守卫从「对账」改为「反向断言」**（这是本次最容易被忽略的一处）：

- `scripts/lib/entry-keys.mjs` 新增 `DERIVED_CONFIG_SHAPE_MARKER`；切片器见到标记就复用
  shared 的顶层键块，见不到才回退到字面量切片。
- `check-schema-contract` 新增 `assertConfigShapeIsDerived()`：不再查「副本是否同步」，
  而是查**副本不存在**（标记在、字面量不在）。原因是切片选择器一旦失配，
  `configShapeKeys` 会变空集，所有差集断言都会看起来成立 —— 这正是本仓
  「证据正则型守卫的锚点过期」那一类假绿。
- `readDialogContract` 的 `mcpDialogKeys` 同源（W2 后 mcp 的 `dialogs` 就是 shared 的
  `DialogConfigSchema`），但比较保留，用以兜住「派生被改成部分拼装」。

**片段镜像（第二批，同一天）**：`_fragment-shapes.ts` 550 → 113 行。它不是
`deriveSchema` 的 drop-in，三处**有意差异**写在文件头：

1. **单面字段 / 弹窗选项 `.passthrough()`** —— MCP SDK 进 handler 前先 `safeParse`，
   `z.object` 默认 strip：`fields[0].formType`、`options.widht` 这类拼写错误会在
   `_arg-guard` 看到之前消失，did-you-mean 闸门恒空。让错键活到 handler 再判。
2. **容器选项 `inherit`（保持 strip）** —— 与 shared 一致；未知旋钮丢弃不产生
   「接受却永不注入」（发射枚举断言兜住）。
3. **`formtype` 在单面字段上重新设必填** —— shared 用 `.default('Input')`，派生剥默认
   后会变成可省略；但它是模型必须做的一次判断。表字段（`tableFieldSchema`）例外：
   表格路径零消费者，放宽为 optional。

`check-fragment-contract` 的 Zod 一侧改为**运行时读取**（`captureFrontDoor()` 现打包源码），
因为派生结果没有字面量可切；并新增 `assertDerivedShapes()` 反向断言「不再有手写
`z.object` 字面量」。`entry-keys.readReachability` 的容器键同样按
`FRAGMENT_DERIVED_MARKERS` 复用 shared 切片（含 optional 包装的拆层）。

派生的第一轮就抓到一个**真实缺陷**（不是既有 bug，是派生暴露的 zod 4 语义坑）：
`value: z.unknown().optional()` 里 `z.unknown().isOptional()` 为 `true`，按它判断
「已可选」会丢掉 `ZodOptional` 包装，而 object 里 `z.unknown()` 仍要求键存在 ——
`isHidden: { field, op }` 这种省略 `value` 的合法条件被判 `expected nonoptional`，
43–46 号 golden 全部过不了前门。判据改为看**包装层**（`_zod.def.type === 'optional'`），
`_derive.spec` 加一例钉住。

同时 `rules` / `permissionValue` 两条教学文案原本**只**存在于手写镜像，派生后
`check-fragment-prompts` 立刻变红（片段 prompt 的唯一教学来源就是 shape 的
`.describe()`）—— 已上提到 shared 权威 schema，三处一起受益。

**代价与预算**：

- full 档 `tools/list` 243.8 → **340.8 KB**（`generate_crud` 130.5 KB：
  `surfaces.query/table/form` 三处各内联一次字段形状）。增长全部来自把 shared 的权威
  文案搬上教学面 —— 手写副本里有事实性错误，例如称 antdv 的 `a-table` 支持虚拟滚动
  （实际两端都没有）。`check:surface-budget` 的 full 预算 250/85 → 275/95 → 345/135
  两次有据上调，理由写在脚本注释里（棘轮允许有据上调）。
- front-door 档不变（**21.1 KB / 12 工具**）：前门不含这四个工具。
- `check:consistency` 142/143，唯一红的是 `check:eval-freshness`（语料哈希与 prompt
  指纹都变了 —— 派生的描述进了 prompt 源）。**这是预期**：已发布数字必须由一次新的
  完整测量替换，本批不买这次 token。

**本批净行数**：三份镜像退役合计 **−667 行**（含派生层 204 行、单测 16 例、守卫改写的
净增量）。「净减 ≥2,000 行」按实测不可达 —— 全部候选 ~1,140 行；出口标准已改判为
**镜像清零**（三份副本均已不存在，且由反向断言棘轮钉住）。其余零散「镜像」经核对均为
**有意差异**（片段独有键、profile 相关文案），不属可退役集合。

### W3 · 收工具面 —— ✅ 完成（2026-11-10）

收缩前后的宿主侧实测（`npm run tools:list:snapshot`，真 SDK 的 `client.listTools()`）：

| profile | 工具数 | 总字节 | 描述 | schema |
|---|---|---|---|---|
| front-door（收缩前） | 16 | 171.1 KB | 14.0 KB | 157.1 KB |
| **front-door（收缩后）** | **12** | **21.1 KB** | 8.9 KB | 12.2 KB |
| full（W3 时未变） | 19 | 243.8 KB | 16.2 KB | 227.6 KB |
| full（W2 前两份镜像退役） | 19 | 266.7 KB | 16.2 KB | 250.5 KB |
| **full（W2 片段镜像退役后）** | 19 | **340.8 KB** | 16.2 KB | 324.6 KB |

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
  front-door 总量 40 KB / 单工具 10 KB，full 总量 345 KB / 单工具 135 KB（W2 两次由
  250/85 有据上调，理由见 W2 节），并断言
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

### W4 · 回读闭环 —— ✅ 完成（2026-11-10）

**出口标准「往返测试绿」已达成**：生成 → 读回 → 用读回的配置再生成，产物逐字节相同
（schema 与 sfc 两种模式；`packages/shared/__tests__/page-source.spec.ts`）。

- **出处位置**：`__esPlusSource` 嵌在 pageSchema **内部**（不是兄弟 export，否则
  `extractPageSchema` 与既有测试的「唯一 export」假设会破）；sfc 模式没有 pageSchema，
  写成 `<script>` 内单行注释 `// __esPlusSource: {…}`。单源 `packages/shared/src/page-source.ts`，
  三端 `CrudPageSchema` 各持一份同形镜像（渲染端不依赖 shared 运行时）。
- **`config` 是解压不是反推**：生成器把**真正喂给发射器**的那份配置（归一 + 剔除未知键后）
  原样带进产物。回读拿到的是输入，不是「从 formItems / 可见性反推出来的猜测」。
- **`lossy[]` 四类都显式**：`dropped`（未知键 / 非 JSON 值）、`ignored-in-mode`
  （schema 模式的 `permissions` / formatter；sfc 模式的 `dialogs` / `tableBtns` / `toolbarBtns` /
  object 形态的 `operationColumn`）、`not-expressible`（行内函数、`hasCustomRender`）、
  `normalized`（`rowkey → tableOptions.rowkey` 等确定性修复）。空数组 = 逐键无损。
- **`read_page` 工具**（两种 profile 都注册）：返回 `config` + `lossy[]`，并给一份
  **机械投影**的 `intent.surfaces`（front-door 没有 `generate_crud_from_config`，
  「读回 → 改 → 再生成」必须能落回 `generate_scene`）。投影丢掉的键（显式 `columns`
  没有 surfaces 通道）写进 `surfacesLossy[]`，不静默丢。无出处的页面（W4 前 / 手写）
  明确报错 + 提示，不反推。
- **守卫同步改判**：`check:unknown-keys` 的 C1/C3 先剔除出处再查泄漏（出处**故意**保留
  宿主原配置，含 `formatter` / `widht`）；生成器单测里同类断言统一走
  `runtimeSchemaOf` / `withoutSourceComment`。fuzz 抓到 sfc 注释被 U+2028/U+2029
  （JSON 合法、JS 行终止符）截断 —— 已在发射前转义为 `\uXXXX`。
- **产物重算**：7 个 frozen-config 案例 + composition gallery + ai-workflows +
  fragment dashboard + cases metrics 全部重放；三站副本 `cases:sync`、`docs:sync`、
  `llms:gen`。全链 139/143，仅剩 `check:eval-freshness`（需付费全量跑批，见下）。

### W5 · 弱维度归因 —— ✅ 完成（2026-11-10）

**出口标准「membership/dataOptions 有归因数据」已达成**：逐行明细现在会落盘，且离线就能出数。

- **逐行归因单源**：`scoreAll` 直接把「哪些 pin 没中」算成 `scopedMisses`
  （`scripts/eval/scorers.mjs`），聚合走新函数 `summarizeMisses`
  （`scripts/eval/run-metrics.mjs`）—— 与门禁同一份实现，故**在线跑批与离线复算的归因结构一致**。
  每行保留 `failedCapabilities / scopedMisses（≤12）/ attrMisses（≤12）/ errorKind / firstConvergedTurn`，
  另给全量的 `byDimension.{applicable,missed}`（聚合计数不受 `rows` 截断影响）。
- **为什么是旁路文件**：`last-accuracy.json` 的每个字段都被守卫逐项绑定，把 421 行明细塞进去
  会让「读徽章」的每次校验都拖上一份诊断数据。故写 `__tests__/golden/last-accuracy-misses.json`
  （`artifact.mjs` 的 `MISSES_FILE`），由 `check:eval-freshness` 用**同一性**（corpusHash /
  rulerVersion / model / 门禁读数 / K）校验它属于主产物那一次测量；旧产物没有该文件不报红。
- **零 API 成本出数**：`node scripts/eval/rescore.mjs <dump> --misses <out>` 用同一份
  `summarizeMisses` 从已落盘预测重建归因；旁路里 `rulerVersion` = **本次复算的尺子**，
  `source.dumpRulerVersion` = dump 当时那把。两者不同即「新尺子量旧产物」，
  `evaluateMissesSidecar` 会拒绝把它冒充成当前测量的归因。
- **实测归因**（`.tmp-eval/pred.jsonl`，223 例 / heldout 199 / 门禁 87.9%，dump 尺子为 W1 补丁前版本，
  **只作方向性读数，不进任何门禁**）：

  | 弱维度 | 未命中行 | 主因（按 pin / attr 通道计次） |
  |---|---|---|
  | membership | 130/421 | `inQuery`（50）与 `inForm`（19）是主通道 —— 命中率仍受 `inQuery` 默认 true 陷阱支配；其次 `propSet`（18）、`columns`（9）、`dialogs`（8） |
  | dataOptions | 105/217 | 不是「下拉选项没写」，而是 `propSet`（37）连带判负；独立通道只有 `inQuery`（14）/`inForm`（5） |
  | dialogs / columns / propSet | 20/30 · 31/72 · 132/421 | 与 W3 后的工具面无关，属投影/字段身份问题 |

  ⟹ 下一批该打的是**字段身份（propSet）与可见性布尔**，而不是继续放宽 scorer：
  membership 的两大通道都是「本该 false 的 `inQuery/inForm` 被留成 true」，
  dataOptions 的 3/4 未命中是同一行里的 propSet 连带。
- **未做（刻意）**：不把归因写进 `last-accuracy.json`；不做时间型新鲜度判据
  （一次测量内 `measuredAt` 允许缺省，同一性比时间更难撒谎）。

### W6 · legacy 退役 —— ✅ 完成（2026-11-10）

**出口标准「无 importer；资源文案不再失实」已达成**。退役的是 `generateCrudPage`
（legacy 正则引擎 → 整页 SFC）整条腿，不是「再标一次 legacy」。

- **shared 面**：`generateCrudPage` / `GenerateResult` / `PRESET_EXAMPLES` 三个公开导出删除；
  `generateScaffold` / `generateAppEntry` 先拆到 `scaffold-generator.ts`（`scaffold_page`
  与 CLI `scaffold` 继续依赖，它们不是 crud-engine 的依赖），再删引擎本体与两套快照。
- **MCP 面**：`generate_crud_page` 注册与工具文件删除（它只剩 schema 分支有独立价值，
  而前门可逐字节复现）；在 W4 的 **full 19 / front-door 13** 基础上再 −1：full → **18**、
  front-door → **12**，隐藏集 7 → 6。**全文工具计数以本节（W6）为准** —— W4 节的「19 / 13」
  是那一步的中间态，不是与本节矛盾。
- **CLI 面**：`create` 的 sfc 离线 NL 路径改为**可执行的报错**（给出 `--ai` /
  `--from-config` / `--mode schema` 三条出路），交互式预设搬到
  `packages/cli/src/commands/preset-examples.ts`（本地 8 条，不再对外导出）。
- **资源文案已实**（这才是出口标准的第二半）：`esplus://examples` 改走
  `emitSceneArtifact({ scene: 'crud', intent })` —— 与宿主调前门完全同一条
  `composeCrudConfig → generateFromConfig` 链，不再是「另一个引擎的产物」。
- **零 importer 证据**：全仓 `generateCrudPage` / `registerGenerateCrudPage` /
  `PRESET_EXAMPLES` 只剩注释里的历史说明（CLI 本地同名常量除外），无代码引用。
- **守卫与文档同批收口**：`check:tool-surface` 的层级/隐藏数文案、`tools-list.snapshot.json`
  （full 18 / 339.4 KB，front-door 12 / 21.1 KB）、`check:doc-drift`、
  `check:surface-budget`、`check:ai-presets` 全绿；`docs/why-es-plus` 镜像与
  `docs:check` 逐字节一致；`AI-NATIVE-ARCHITECTURE.md` 的入口表/总览矩阵/已知边界
  改为 18 工具并注明 `generate_crud_page` 已删。

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
| B | ✅ W3 已落地（前门 12 工具 / 21.1 KB，`check:surface-budget` 入闸）；✅ W2 全量：旋钮 + `configShape` + 片段形状三份镜像全清零（净 −667 行，`_derive.ts` 16 例钉住剥默认/收紧/保文案/`unknown().optional()` 省略语义） | 「净减 ≥2,000 行」实为不可达，已改判为「镜像清零」；full 档 `tools/list` 340.8 KB（shared 权威文案，预算 345/135）；`check:eval-freshness` 需要一次付费全量测量（语料哈希与 prompt 指纹均已变） |
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
