# 场景优先 AI 原生架构 — 设计、源码核对与实施台账

> 状态：🚧 实施中（2026-11-03 起）
> 范围：`packages/shared` / `packages/mcp-server` / `scripts/eval` / `scripts/check-*` / 三端运行时
> 关联：`packages/mcp-server/AI-NATIVE-ARCHITECTURE.md`、`AI-FULLSCENE-PLAN.md`、`AI-SCENE-COVERAGE-PLAN.md`、`docs/internal/wave-2-production-trust-design.md`

## 0. 一句话

把「场景」从 eval 里的四个字符串，提升为 **shared 的单一真源**；所有入口（MCP / CLI / eval / 守卫）都从同一张 `SceneContract` 派生。但**不重写发射器**：`ScenePlan` 只做 lowering，最终仍落到 `composeCrudConfig` + `generateFromConfig` 或三个 fragment generator。

## 1. 四层模型

| 层 | 定义 | 现状 | 本方案 |
|---|---|---|---|
| **Scene** | 用户要建什么 | `SCENES = ['crud','table','form','dialog']` 只在 `scripts/eval/scenes.mjs` | 迁入 `packages/shared/src/scene/registry.ts`，成为单一真源 |
| **Artifact** | 产出什么文件形态 | `crud-page` / `table` / `form` / `dialog-composable` / `dialog-component` 分散在生成器与 eval | 写进 `SceneContract.artifacts` + `artifactFamily` |
| **Capability** | 哪些声明式键可达 | `CAPABILITIES`（key×target）、`feature-coverage.json`（A/B/C/D） | 给 token 加 `scenes[]`，派生 scene×capability 矩阵；不新建第三份 token 表 |
| **Entry** | 由哪个工具承载 | 16 个 MCP 工具 + CLI | `generate_scene` 为 canonical；旧工具为 adapter；CLI 后续接入 |

## 2. 源码核对结论（决定顺序）

1. **场景概念只活在 eval**：`packages/shared`、`packages/mcp-server` 源码 grep 无 `Scene` 抽象；`SCENE_TOOL` 在 `scripts/eval/scenes.mjs:55`。
2. **`generate_crud` 被钉死**：216 条 CRUD 语料 + `check:front-door` / `check:tool-surface` / `check:tool-shapes` / `check:entry-contract` 都以它为唯一前门。只能加法改造。
3. **片段运行时不具备编排契约**：`es-form` 无 emits（`packages/vue3/src/components/es-form/src/es-form.vue:153-156`）；片段 table 不发 refresh/row-action；片段 dialog 未接 success/error。组合场景必须后置。
4. **eval 测错路径**：门禁是 NL→完整 `StructuredCrudConfig`（`scripts/eval-llm.mjs:326-333`），再 `deriveSurfaces` 反向调用前门（`scripts/eval/front-door-leg.mjs:57`）。路由与 surfaces 首程未计分。
5. **单一真源已分裂**：场景/工具映射 5 份；token 表 2 份；shared Zod 4 vs mcp Zod 3；dialog 类型 3 份。
6. **守卫链会互相遮蔽**：`check:consistency` 是 121 段 `&&`；`check-feature-coverage.mjs:164-165` 会 `process.exit(1)` 终止后续检查。

## 3. 实施批次（依赖驱动）

| 批次 | 内容 | 验收 | 状态 |
|---|---|---|---|
| **P0** | 守卫分组全量报告 runner；旧链保留回退 | 组内第 2 个失败仍打印第 3–N 组结果 | ✅ 2026-11-03 |
| **P1** | 场景注册表单一真源 + `check:scene-registry` | 删 scene / 改生成器映射 / 缺语料 → 红；279 条语料零变化 | ✅ 2026-11-03 |
| **P2** | `ScenePlan` + `generateScene` + `generate_scene` 加法式前门 | 279/279 与旧工具字节相等；工具数 16；文档计数同步 | ✅ 2026-11-03 |
| **P3** | eval 场景腿：route → intent → landing → witness | gated 路径真实调用 `generate_scene`；`deriveSurfaces` 仅诊断 | ✅ 2026-11-03 |
| **P4** | artifact contract + 运行时事件/expose + composition | 三端 refresh/validate/success 见证；组合四类接线 | ✅ 2026-11-03 |
| **P5** | 单一真源收尾、scene×capability、permission 安全、artifact@1 | 变异 → 红；`pvalue` 且无函数 → 拒绝 | ✅ 2026-11-04 |

## 4. 核心接口

```ts
// packages/shared/src/scene/registry.ts
export interface SceneContract {
  id: SceneId
  version: 1
  artifactFamily: 'crud-page' | 'table' | 'form' | 'dialog'
  artifacts: readonly ArtifactKind[]
  modes: readonly (SceneMode | null)[]
  targets: readonly TargetFramework[]
  intent: { kind: SceneIntentKind; required: readonly string[] }
  entry: { tool: string; adapters: readonly string[] }
  eval: {
    corpus: string
    casePrefix?: string
    scorer: 'crud' | 'fragment'
    gate: 'definition95' | 'fragment-global'
    minCasesFor95: number
  }
  runtime: { witnesses: readonly string[] }
}
```

`ScenePlan` 只允许单节点落地到现有输入；多节点 composition 在 P4 之后才开放。

```ts
export type SceneNode =
  | { id: string; kind: 'crud-page'; intent: CrudIntent }
  | { id: string; kind: 'table'; intent: TableBlockInput }
  | { id: string; kind: 'form'; intent: FormBlockInput }
  | { id: string; kind: 'dialog'; intent: DialogBlockInput }
```

产物信封（P5）：

```ts
export interface ArtifactEnvelope {
  contract: 'es-plus.artifact@1'
  scene: SceneId
  artifact: ArtifactKind
  target: TargetFramework
  mode: string | null
  files: readonly { path: string; code: string; language: string }[]
  config: unknown
  warnings: readonly string[]
  fingerprint: string
}
```

## 5. 不可违背的约束

1. 不给 `StructuredCrudConfig` 加顶层版本键；版本进产物信封。
2. 不拓宽 `RenderPlanKey`；scene 台账平行。
3. `generate_scene` 不调用另一个工具 handler；调用 shared 纯构建器。
4. 不在 n=21 的片段场景上宣称 95%；先扩到 ≥60。
5. MCP server 不调模型；澄清由宿主发起。
6. 只修「声明了 `permissionValue` 但宿主无函数」→ 拒绝；不全局翻转默认。
7. 行尾归一单独提交；accuracy 产物不随本地批次提交。

## 6. 验收范式

每条修复必须带一个「变异 → 红」：

- 删 registry 中一个 scene → `check:scene-registry` 红。
- 把 `FRAGMENT_GENERATORS.table` 指向 form → 红。
- 新增 scene 但不加语料 → `check:scene-coverage` 红。
- `generate_scene` 与旧工具产物差一字节 → `check:scene-parity` 红。
- gated 路径改回 `deriveSurfaces` → `check-scene-eval` 红。

## 7. 本轮落地记录

（按批次追加，记录「改了什么 / 偏离了什么 / 验证命令与结果」。）

### P1 · 场景注册表单源

- 新增 `packages/shared/src/scene/registry.ts` + `index.ts`，导出 `SCENE_REGISTRY` / `SCENES` / `SCENE_TOOL` / `modesOf` / `sceneOf` / `artifactFamilyOf`。
- `scripts/eval/scenes.mjs` 改为 re-export shared 注册表，保留原有导出名与 `cellOf` / `cellName`。
- `scripts/lib/fragment-cases.mjs` 的 `FRAGMENT_GENERATORS` 从 registry 派生。
- 新增 `scripts/check-scene-registry.mjs`，接入 `check:consistency`。
- 注意：eval/guards 读取 shared build，执行前需 `npm run build:libs`（仓库既有约定）。

**验证（2026-11-03）**

- `npm run build -w @es-plus/shared` ✅
- `npx vitest run packages/shared/__tests__/scene-registry.spec.ts` → 6/6 ✅
- `npm test -w @es-plus/shared` → 858/858 ✅
- `node scripts/check-scene-registry.mjs` → 4 场景 / 279 条语料（216/21/21/21）/ 3 个片段生成器 ✅
- `node scripts/check-scene-coverage.mjs` → 覆盖无空格，63/63 片段产物可解析且进 vite build ✅
- `node scripts/check-front-door.mjs` → 216 条可表达、handler 全非 error、成员 round-trip 216/216 ✅
- `node scripts/check-fewshot-registration.mjs` / `check-readme-claims.mjs` / `check-site-claims.mjs` ✅
- 变异自检：把 `FRAGMENT_GENERATORS.table` 接到 form 生成器 → `check-scene-registry` 红（已还原）✅

**据实偏离**

- 注册表用 TypeScript 常量而非 JSON：shared `tsc` 的 JSON import 在 Node 20 需要 import attributes，json 方案会在 build 产物里引入平台差异；TS 常量 + `@es-plus/shared/scene` 子路径更稳。代价是 eval/guards 依赖 shared build，这与仓库既有 eval 约定一致。
- P1 不新增 `generate_scene`；`entry.future` 先登记为 `generate_scene`，P2 落地后再把 `entry.tool` 切过去。

### P2 · 场景路由器（加法式前门）

- 新增 `packages/shared/src/scene/emit.ts`：`ScenePlan`（crud/table/form/dialog 单节点）+ `emitScene()`。CRUD 分支是旧 `generate_crud` handler 的**整体搬迁**（对话框标题推导、rowkey、composable 名、schema/sfc 分支、preflight、warnings、格式化一字未改），片段分支复用 `formatFragmentText`。`emitScene` 只捕获异常并统一成 `Error generating …`，不改变成功路径的任何字节。
- 新增 `packages/shared/src/config-feedback.ts`：`buildSemanticWarnings` / `formatValidationError` 从 mcp-server 移入 shared，`generate-from-config.ts` 改为 re-export，旧导入路径不破。
- 新增 `packages/mcp-server/src/tools/generate-scene.ts`：`scene` 枚举从 `SCENE_IDS` 派生、缺省 `DEFAULT_SCENE`；按场景选 `SCENE_INTENT_SCHEMAS[scene]` 先做未知键检查 → zod 校验 → 再调 `emitScene`。非法意图**零产物**，错误点名场景。
- `generate-crud.ts` 重写为薄适配器（导出 `crudShape`，handler 调 `emitScene`）；注册表 `entry.tool` 切到 `generate_scene`，四个旧工具保留为 `adapters`，`entry.future` 字段移除。
- `tools/index.ts` 两个 profile 都注册 `generate_scene`（16 工具 / 前门 13）。
- 新增 `scripts/check-scene-parity.mjs`：esbuild 打包源码、捕获 5 个工具的真实 handler，对 279 条语料逐字节比较（两侧都只做一次 `.passthrough()` 解析，避免 `TableBtnSchema.transform` 二次执行扰动键序）。接入 `check:consistency`，紧随 `check:scene-registry`。
- 新增 `scripts/lib/tool-files.mjs`：工具名→文件名的唯一映射（含 `generate_crud_from_config → generate-from-config.ts` 覆盖），两个场景守卫共用。
- 文档计数 15→16（前门 12→13）：根 `docs/why-es-plus*.md`、站点 `src/docs/*`、`packages/mcp-server/README.md`、`docs/promo/*`；`npm run llms:gen` 重生成 `public/md/**` 镜像。

**验证（2026-11-03）**

- `npm run build -w @es-plus/shared` ✅
- `npm test -w @es-plus/shared` → 858/858 ✅
- `npm test -w @es-plus/mcp-server` → 353/353（含新增 `generate-scene.spec.ts` 7/7）✅
- `node scripts/check-scene-parity.mjs` → 279/279 字节等价（crud 216 / 片段 63）✅
- `check-tool-surface` → 16 full / 13 front-door ✅；`check:scene-registry` / `check:scene-coverage` / `check:front-door`（216/216）/ `check:tool-shapes` / `check:fragment-contract` / `check:entry-contract` / `check:readme-claims` / `check:site-claims` / `check:fewshot-registration` ✅
- `npm run docs:sync` + `npm run check:llms` ✅
- 变异自检：①`generate_scene` handler 在返回文本后追加一个空格 → `check:scene-parity` 红（279/279 全不等）；②`scripts/lib/tool-files.mjs` 把 `generate_table` 映射到 `generate-form.ts` → `check:scene-registry` 红（均已还原）✅
- 边界说明：parity 两侧都走同一个 `emitScene`，因此**单独改 shared 发射器不会**让 parity 变红（两侧同步变化）；发射器行为本身由 `check:front-door`（216 条）、shared 858 测试与 golden:e2e 覆盖。parity 守的是「两个入口的接线与入参投影不一致」这类回归。

**据实偏离**

- `generate_crud` 从「直接调生成器」改为「调 `emitScene`」：这是共享实现，不是跨工具调用，满足约束 3；代价是 `generate-crud.ts` 不再持有生成逻辑，读代码需跳到 shared。
- `SCENE_INTENT_SCHEMAS` 的 crud 项用 `z.object(crudShape).passthrough()`（Zod 3，mcp-server 侧），与旧工具的 SDK 校验同形；`scene/emit.ts` 内不再二次 `parse`，因此 `TableBtnSchema.transform` 只跑一次。
- 场景路由器不吞掉旧工具的错误文本：成功/失败文本都由同一个 `emitScene` 产出，`isError` 语义与旧工具一致。

### P0 · 分组全量报告 runner

- 新增 `scripts/lib/guard-groups.mjs`：14 组顺序清单，只存 `npm run` 之后的脚本名（含参数），不复制命令全文。
- 新增 `scripts/check-consistency.mjs`：启动时读取 `package.json` 的 `check:consistency:legacy`，逐项校验「组串接 == 旧链」且无重复；不一致直接退出码 2，绝不静默跑子集。运行期逐组、逐步执行，**失败不中断**，最后按组汇总并列出失败步骤；任一步失败退出码仍为 1。
- `package.json`：旧链原样保留为 `check:consistency:legacy`；`check:consistency` 指向 runner；新增 `check:consistency:list` 查看分组。支持 `--group=<id>[,<id>]` 只跑指定组（仍先做全量校验）。
- 顺序保持不变：有些守卫依赖前一步产物（如 `check:scene-*` 依赖 shared build）；分组只改变「失败后是否继续」，不改变执行次序。

**验证（2026-11-03）**

- `npm run check:consistency:list` → 14 组 / 121 步，顺序与旧链一致（P3 新增 `check:scene-eval`、P4 新增 `check:artifact-runtime`、P5 新增 `check:artifact-envelope` 后为 124 步）✅
- `node scripts/check-consistency.mjs --group=scene-front-door` → 8/8 通过（8.3s）✅
- 变异自检：把旧链与分组第 1 步同时改成不存在的 `check:__fail__` → runner 先红该步，仍继续跑完第 2–4 步，汇总 `3/4`、退出码 1（已还原）✅

**据实偏离**

- 组清单与旧链是「双写」而非从旧链自动推导：自动推导只能得到平铺顺序，得不到有语义的组名/边界；双写由 runner 的启动校验兜底，漂移会直接拒绝运行。
- 未做并行执行：守卫之间存在产物依赖，且并行会放大内存/句柄压力（参见 vite preview 端口/句柄残留的教训）。

### P3 · eval 场景腿（route → intent → landing → witness）

- `scripts/lib/front-door.mjs` 的 esbuild 入口新增 `registerGenerateScene`，导出 `captureScene()` / `callScene()`；旧 `capture()` / `callFrontDoor()` 保留（PRD 观测腿与 `check-front-door` 仍用）。
- `scripts/eval/front-door-leg.mjs` 的 gated 路径改为 `sceneCap.handler`：CRUD 行把 `pred` 投影成 `{scene:'crud', intent}` 后调用真 `generate_scene`；片段行新增 `driveSceneFragment()`，把模型 intent 喂给同一个路由器。每行产出四段观测：`route` / `intent` / `landing`（table/fragment/empty/rejected）/ `witness`（编译失败）。
- 片段腿的 gated `compiles` 改为「路由器 landing 成功 ∧ witness 为空」；直接调 `FRAGMENT_GENERATORS[scene]` 仍跑一遍作为诊断（`directCompiles` / `directCompileError`），分叉时能直接看到。
- `summarizeFrontDoor` 新增 `intentRejected` / `landing` / `witnessFailures`；`computeFragmentMetrics` 新增 `sceneLeg`（按场景计数），随产物落盘，只观测、不新增门禁。
- 新增 `scripts/check-scene-eval.mjs`：静态断言 gated 路径调用 `sceneCap.handler`、片段腿使用 `driveSceneFragment`、`deriveSurfaces` 不进评分器、注册表 canonical 仍是 `generate_scene`；接入 `check:consistency`（紧跟 `check:front-door-leg`）。
- `front-door-leg.test.mjs` 的假接口改为 `{ sceneShape, sceneCap }`，并新增「片段 intent 走同一路由器」用例。

**验证（2026-11-03）**

- `node scripts/check-scene-eval.mjs` ✅；`node scripts/eval/front-door-leg.test.mjs` ✅
- `npm run check:run-metrics` / `check:rescore` / `check:dump` / `check:replay` / `check:fragment-leg` ✅
- `node scripts/check-front-door.mjs`（216/216）/ `check-scene-parity`（279/279）/ `check-scene-coverage` ✅
- 变异自检：把 gated 调用从 `fd.sceneCap.handler` 改回 `fd.cap.handler` → `check:scene-eval` 红（已还原）✅

**据实偏离**

- `route` 目前是**语料/宿主声明**（CRUD 固定 `crud`，片段取用例的 `scene`），不是模型自己分类的分数。给模型加「先选场景」的调用会显著增加成本，且当前语料没有「路由 gold」；因此本批把 route 作为**可观测字段**落盘，等语料补上路由标签后再上闸。
- CRUD 主 `compiles`（Tier A）仍来自直接 `generateFromConfig` 的产物；场景腿的编译见证在 `frontDoor.compileFailures` 门禁，二者使用同一把编译尺子。这样不改变既有 Tier A 分母，同时让 gated 路径真实经过 `generate_scene`。
- PRD 观测腿仍驱动旧 `generate_crud`：它不参与门禁（P3 验收只针对 gated 路径），且其输出是 surfaces 而非场景选择；留待 P4/P5 统一。

### P4 · 产物运行时契约与组合接线

**问题**（源码核对的第 3 条）：片段是**自包含 SFC**，挂进页面后宿主没有任何抓手 —— 表格不会刷新、行按钮点了没反应、表单提交没有门禁也没有通知、弹窗提交成功后宿主无从得知。这四件事都不在 `StructuredCrudConfig` 里，也不是记分卡能覆盖的维度（记分卡看的是「配置里写了什么」，这里是「跑起来之后发生了什么」）。组合场景（表 + 弹窗 + 查询表单）因此根本接不起来。

- 新增 `packages/shared/src/scene/runtime.ts`：`ARTIFACT_RUNTIME` 冻结表，五种 artifact 各一行 `{ expose, emits, success }`；`runtimeOf(kind)` 对未知形态响亮抛错。**刻意与 registry 分开**：`scene/index.ts` 因此仍只导出元数据、不加载生成器实现。
  - `table`：`expose: ['refresh','reload']`、`emits: ['row-action']`、`success: none`。
  - `form`：`expose: ['model','validate','resetFields']`、`emits: ['submit','query','reset']`、`success: event('submit')`。
  - `dialog-composable`：`expose: ['open']`、`success: callback('onSuccess')`；`dialog-component` 另加 `close`。
  - `crud-page`：**空契约**（整页能力由 `CrudPageSchema` 声明）。空不是遗漏，是显式表达。
- `fragment-generator.ts` 的包装层按表发射（三端同一套名字）：
  - table 行按钮从死掉的 `triggerEvent: true` 改为库内真正消费的 `clickEvent`，包装层翻译成 `emit('row-action', { action, row })`。
  - form 的保存/查询/重置分别改为 `emit('submit', model)`（**内部 validate 通过后才发**）/ `emit('query', model)` / `emit('reset')`；`defineExpose` 透出 `model`、`validate`、`resetFields`。
  - dialog 的 `open(title, row, onSuccess)` 增加第三参回调；成功通道统一叫 `onSuccess`（component 形态内部存 `successHandler`）。
- 四类组合接线以 `runtime.ts` 头注释为准（也是 eval / 文档 / 宿主的共同口径）：
  1. table `row-action` → 宿主 `dialog.open(title, row)`
  2. form `submit`（校验通过才发）→ 宿主保存
  3. form `query` → 宿主 `table.refresh(model)`
  4. dialog `onSuccess` → 宿主 `table.refresh()`
- 新增 `scripts/check-artifact-runtime.mjs`（`check:artifact-runtime`，接在 `check:fragment` 之后）：
  - (a) 表自身：`ARTIFACT_RUNTIME` 键集 ≡ `ARTIFACT_KINDS`；`runtimeOf` 恒等且对未知形态抛错。
  - (b) 每种形态至少有一条 golden 语料产出（`crud-page` 例外，但断言其契约必须为空）。
  - (c) 逐条产物：契约里每个 `expose` 出现在 `defineExpose({...})` / vue2 `return {...}`；每个 `emits` 出现在 `defineEmits([...])` / `emits: [...]`（table 只在真的带行按钮时要求）；`success=event` → 产物里真的 `emit('<name>'`；`success=callback` → `open()` 签名带该形参且体内真的 `?.(formData)` 调用一次。
- `scripts/lib/guard-groups.mjs` 的 `contract-foundation` 同步插入，顺序与旧链逐项一致。

**验证（2026-11-03）**

- `npm test -w @es-plus/shared` → 859/859（含对话组件弹窗形参改名的断言更新）✅
- `npm test -w @es-plus/vue3` → 661/661；`npm test -w @es-plus/adapter-antdv` → 697/697 ✅
- Tier-1 新增见证：
  - vue3：table `refresh()` 真的重新取数；form 委托契约（`model` 回写、`validate` 结果原样透出、`resetFields` 复位）与 ④ 提交门禁。
  - antdv：**真实校验** —— 空必填 `validate()` reject、填好后 resolve；`resetFields` 真的清空；`open(title,row,onSuccess)` 成功后带数据回调；四类接线各一条。
- Tier-2（vue2 真实 Chromium，`vue2-fragments.spec.ts` 15/15）：`refresh()` 重新取数、行按钮派发 `row-action` 且宿主收到 `edit:张三`、`validate()` 空必填 `invalid` → 填好 `ok`、`resetFields` 复位输入框、空必填点保存宿主收不到 submit 而填好后收到一次、查询派发 `query` 载荷、弹窗 `onSuccess` 计数 0→1。
- 守卫：`check:artifact-runtime` / `check:fragment` / `check:scene-registry` / `check:generator` / `check:generator-targets` / `check:scene-parity`（279/279）/ `check:scene-coverage`（63/63）/ `fragment:smoke` / `check:fragment-scorers` / `check:dialog-scorers` / `check:composition` 全绿 ✅
- `check:consistency:list` → 14 组 / **123 步**，顺序与旧链一致 ✅
- 变异自检（均在本地实跑后还原）✅：①给 `ARTIFACT_RUNTIME.table.expose` 加一个产物没有的 `'noSuchMethod'` → `check:artifact-runtime` 红（21 处，每条 table 产物一处）；②把 form 的 `success.name` 改成 `'save'` → 红（「没有任何产物真的 emit 它」）；③把对话组件弹窗形参改回 `success` → 红（12 处，`open()` 签名与契约不一致）。

**据实偏离**

- 行按钮的可用通道是**库内 `clickEvent`**，不是给 `es-table` 新增事件：包装层已经拥有行按钮配置，改库会同时牵动三端组件契约与 `COLUMN_CONTRACT`。包装层翻译的代价是「产物多一层映射」，收益是零跨端风险。
- `form` 的 `submit` 是**门禁事件**而非「提交成功事件」：片段不负责请求（`apiUrl` 由宿主配置），包装层只能在本地做完 validate 后把模型快照交给宿主。因此 `success.kind === 'event'` 的语义是「本地流程成功」，与 dialog 的「请求成功后回调」不同层；命名上不强行统一，语义差异写进 `runtime.ts`。
- vue3 的**校验失败态在 happy-dom 下不可见**：Element Plus 2.14.2 的 form-item 在 happy-dom 环境丢失 `fields`，form 级 `validate()` 对被清空的必填返回 `true`（async-validator 本身正常 reject）。Tier-1 因此改为「stub 底层 `es-form` 的 exposed `validate`」来见证包装层的**委托与门禁逻辑**，真实拒绝态由 ADV Tier-1 与 vue2 Tier-2 见证。该限制与 `vue2-crud.spec.ts` 头部记录的同类限制同源，不是本轮引入。
- `crud-page` 不纳入片段语料见证：它由 `generate_crud` 产出，不在 `__tests__/golden/cases` 的片段目录里；门禁改为断言「它的契约必须为空」，杜绝「声明了没人见证的通道」。
- 未做：`ScenePlan` 多节点组合。四类接线证明了**通道存在且可用**，但把它们自动拼成一张组合页面需要自己的设计（节点间 props/事件装配 + 运行时见证），不在 P5 的验收行内；留待后续批次，届时另开 `composition` 契约。

### P5 · 单一真源收尾

P5 拆成四个主题批次（各自独立提交），逐项对应第 3 节里「单一真源已分裂」的四条：

#### P5a · 场景 × 能力矩阵（`e32bb65`）

- `scripts/lib/entry-keys.mjs` 新增 `readSceneIds()` / `readSceneSurfaces(reach)`：从**源码切片**读出四场景与前门可达的键面（`frontKeys` / `schemaKeys` / `sfKeys` / `fcKeys` + 片段形状），不另写清单。
- `scripts/feature-coverage.data.mjs` 的 41 个 token 全部声明 `scenes`；新增 `TOKEN_SET_DIFF` 登记**允许的单边 token**：`sortParam`（只在对账表里）与 `siteUncovered`（只在令牌表里），两者都写明原因。
- `scripts/gen-ai-capability-matrix.mjs` 校验两件事：① token 的 `scenes` 不得超出该场景的**结构可达面**（多声明 → 红）；② 两张令牌表的对称差必须逐项登记。任一红都不落盘、也不打印「一致」。
- 语义：`scenes` 是人工声明（字段级 token 在表单里语义不成立，故允许**少声明**），但**多声明**会被结构可达性拒绝 —— 这就是「声明可审计」与「声明可撒谎」的分界。
- 产物 `docs/ai/ai-capability-matrix.json` 增加 `sceneCapability` 块（场景 → 面 → token）与 `stats.scenes`，41 token / 24 声明式 / 22 前门可达 / 2 仅配置。

#### P5b · permission 门 fail-closed（`41b17a7`）

- core 新增 `checkPermissionValue(value, permission)`：无 `permissionValue` → 放行；有门且有函数 → 以函数为准；**有门但没有函数 → 拒绝**，并按权限码告警一次。`filterButtonsByPermission` / `normalizeButtonsHideState` 改为委托它。
- vue3 / vue2 / adapter-antdv 共 **12 处**本地 `checkPermission` / `hasPermission` 实现全部替换为 core 单一真源，删除各自的「没配就放行」回退。
- 作用域刻意收窄：**只翻转「声明了门」的元素**，不全局改变默认值 —— 没有 `permissionValue` 的产物行为不变。
- `preflight.ts`：permission 项的 reason / `formatPreflight` 头改为 fail-closed 口径（漏配时门后内容消失，而不是「看起来配了、谁都看得见」）；配置形状错时不再宣称「不需要权限」。
- 三站组件说明与 es-eui 配置指南同步语义；`renderer-contract.mjs` 的列级权限证据文案同步。

#### P5c · 产物信封 `es-plus.artifact@1`（`89dd95b`）

- 新增 `packages/shared/src/scene/artifact.ts`：`ARTIFACT_CONTRACT_VERSION`、`ArtifactDraft` / `ArtifactEnvelope` / `ArtifactFile`、`buildArtifactEnvelope`（唯一盖章点）与 `fingerprintArtifact`。指纹是 FNV-1a 双种子 16 位十六进制，规范化序列化（键排序、函数固定标记）⟹ 键序无关；不引 `node:crypto`（shared 可在浏览器侧 import）。
- `emit.ts` 新增 `emitSceneArtifact`：在**同一条文本路径**上附加 `envelope`；`emitScene` 改为委托并只返回 `text/isError`。CRUD 有表 = `crud-page`（schema 模式两文件）；CRUD 无表 = 片段包；table/form/dialog 各一种形态，dialog 按 `mode` 区分 composable/component。
- 新增 `check-artifact-envelope`（第 4 组 `scene-front-door`）：279 条语料逐条断言 ① `emitScene` 与 `emitSceneArtifact` 文本逐字节相等 ② 成功必有信封、失败必无 ③ 身份四元组与场景/artifact 轴自洽、`runtimeOf` 认识 ④ `files` 非空 / 路径唯一 / `language` 与扩展名自洽 / 每份 `code` 都在返回文本里 ⑤ 指纹 16 位、两次相同、279 个互不相同；另有结构守卫（空 files / 重复路径 / 未知 artifact 抛错）与指纹敏感性非空证明。
- 链路 123 → **124 步**。

#### P5d · 罐头弹窗标题单源（`55705e8`）

- 标题不只是文案：生成器把它当作提交方法 / 只读语义的判据（`'新增'` → POST、`'查看'` → 只读），评测组合打分器与组合画廊也用它展开 `surfaces.dialog`。此前 `emit.ts` 与 `eval/composition-scorers.mjs` 各抄一份。
- `registry.ts` 新增 `DIALOG_TITLES` + `dialogTitleFor`，`@es-plus/shared/scene` 导出；emit 层与打分器改为 import，`scenes.mjs` 继续 re-export。
- `check-scene-registry` 新增第 (e) 段：emit / 打分器不得自带 `DIALOG_TITLES`；三份生成器模板（`structured-generator` / `fragment-generator` / `crud-engine`）里的标题字面量必须与常量一致 —— 模板无法 import（会改变产物字节），只能由守卫反向比对。

**验证（2026-11-04）**

- `npm test -w @es-plus/shared` → 867/867（含 P5 新增 9 例）✅
- `npm test -w @es-plus/mcp-server` → 360/360 ✅
- `npm test -w @es-plus/core` → 451/451 ✅
- `npm test -w @es-plus/vue3` → 661/661；`npm test -w @es-plus/vue2` → 398/398；`npm test -w @es-plus/adapter-antdv` → 697/697 ✅
- `check:artifact-envelope` → 279/279 带信封、279 个唯一指纹 ✅
- `check:scene-parity` → 279/279 字节等价（信封与标题重构均未改变入口字节）✅
- `check:scene-registry` / `check:artifact-runtime` / `check:composition`（18 例）/ `check:composition-gallery`（6 条非空证明）✅
- `check:exports` / `check:api` / `check:contract` / `check:threeway` / `check:capability-parity` / `check:parity` / `check:feature-coverage` / `ai:matrix --check` / `check:data-schemas` ✅
- `check:consistency:list` → 14 组 / **124 步**，顺序与旧链一致 ✅
- typecheck：core / shared / vue3 / vue2 / adapter-antdv / mcp-server / cli ✅
- 变异自检（均实跑后还原）✅：①把 `checkPermissionValue` 改回 fail-open → core 3 条用例红；②指纹恒为 0 → `check-artifact-envelope` 279 条红 + 非空证明红；③表格分支文本追加一个空格 → `check:scene-parity` 红；④`DIALOG_TITLES.add` 改成 `'创建'` → `check:scene-registry` 三处红。

**据实偏离**

- **CRUD 无表支是片段包**，不是单一 artifact：信封的 `artifact` 取主产物（有弹窗 → `dialog-composable`，否则 `form`），全部文件进 `files[]`；`mode` 固定 `sfc`。这一支在 P2 被刻意保持字节不变，信封只能在旁边描述它，不能替它重新分类。
- **指纹不是安全哈希**：FNV-1a 只回答「同一份内容是否变化」，不承担防篡改职责；文件头与 `artifact.ts` 都写明这一点。
- **信封是附加视图**：`generate_scene` 的 MCP 输出字节一个都没变（`check:scene-parity` 279/279）；宿主若需要信封，应调用 shared 的 `emitSceneArtifact`，而不是期待工具文本里多一段 JSON。
- **`scenes` 声明允许少声明**：结构可达面只拒绝「多声明」。字段级 token（如 `columnStyle`）在表单/弹窗里虽然键可达、语义不成立，强行要求声明会把矩阵变成噪音。
- **两枚单边 token 是显式决定**：`sortParam` 只有矩阵侧（demo 的排序是客户端事件，没有服务端 `sortParam` 用例），`siteUncovered` 只有令牌表侧（站点未覆盖项不是能力）。两者在 `TOKEN_SET_DIFF` 里带原因，任何新增单边 token 都必须先登记。
- **生成器模板里的标题字面量刻意不 import**：改成引用常量会改变产物字节与宿主运行时依赖；P5d 选择「常量单源 + 守卫反向比对模板」而不是重写生成器。
- **多节点 composition 仍未实现**（见 P4 末条更正）：P5 的验收行不包含它，四类接线已经证明通道可用；自动装配需要新的 `composition` 契约与运行时见证，另开批次。
