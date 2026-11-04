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
| **P5** | 单一真源收尾、scene×capability、permission 安全、artifact@1（P9 升 @2） | 变异 → 红；`pvalue` 且无函数 → 拒绝 | ✅ 2026-11-04 |
| **P6** | composition 契约（多节点装配）+ 见证锚点收尾 | 四类接线由契约派生；每个接线/缺口都有运行时见证 | ✅ 2026-11-04 |

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

`ScenePlan` 只允许单节点落地到现有输入；多节点装配走 P6b 的 `emitComposition`（见下）。

```ts
export type SceneNode =
  | { id: string; kind: 'crud-page'; intent: CrudIntent }
  | { id: string; kind: 'table'; intent: TableBlockInput }
  | { id: string; kind: 'form'; intent: FormBlockInput }
  | { id: string; kind: 'dialog'; intent: DialogBlockInput }
```

产物信封（P5，P9 升到 @2）：

```ts
export interface ArtifactEnvelope {
  contract: 'es-plus.artifact@2'
  scene: SceneId
  artifact: ArtifactKind
  target: TargetFramework
  mode: string | null
  files: readonly { path: string; code: string; language: string }[]
  config: unknown
  warnings: readonly string[]
  fingerprint: string
  // P9：`emitSceneArtifact` 成功分支必带；指纹不覆盖它（身份 = 字节，不是解释）。
  capability?: IntentCapability
}
```

组合信封（P6b @1 → P7 @2 → P11 @3）—— 多节点装配：节点保持各自信封身份，组合只在外面再加一层

```ts
export interface CompositionPlan {
  name?: string
  target?: TargetFramework          // 缺省取第一个节点显式 target，再缺省 vue3
  behavior?: 'data-wiring' | 'ui-only'   // P11：data-wiring = 派生表格取数/刷新（不发 HTTP）；ui-only = 数据通道升级为页面事件
  nodes: readonly { id: string; role?: string; plan: ScenePlan }[]  // form ≤1；table/dialog 可多个
  wires?: readonly CompositionWire[]        // P11：显式接线（同 from 覆盖派生）
}

export interface CompositionWire {
  from: { node: string; channel: string }             // 通道名必须 ∈ ARTIFACT_RUNTIME
  to:
    | { node: string; channel: string; model?: Record<string, string> }  // P11 复核：模型 '$row.字段' 映射
    | { page: 'emit'; event: string }
  when?: { rowAction: string }                        // row-action 源必填，且必须是已声明的按钮 key
}

export interface CompositionEnvelope {
  contract: 'es-plus.composition@3'
  name: string
  target: TargetFramework
  behavior: 'data-wiring' | 'ui-only'
  nodes: readonly ArtifactEnvelope[]
  roles: Readonly<Record<string, string>>
  wires: readonly CompositionWire[]
  faces: { expose: readonly string[]; emit: readonly string[] }
  page: { path: 'Page.vue'; code: string; language: 'vue' }
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

- 新增 `packages/shared/src/scene/runtime.ts`：`ARTIFACT_RUNTIME` 冻结表，五种 artifact 各一行 `{ expose, invokable, emits, success }`；`runtimeOf(kind)` 对未知形态响亮抛错。**刻意与 registry 分开**：`scene/index.ts` 因此仍只导出元数据、不加载生成器实现。
  - `expose` = 宿主能拿到的一切（含数据），`invokable` = 其中可当方法调用的子集（P11 复核新增；`invokable ⊆ expose` 由 `check:artifact-runtime` 断言，组合接线只认它）。
  - `table`：`expose: ['refresh','reload']`、`invokable: ['refresh','reload']`、`emits: ['row-action']`、`success: none`。
  - `form`：`expose: ['model','validate','resetFields']`、`invokable: ['validate','resetFields']`（`model` 是 reactive 数据）、`emits: ['submit','query','reset']`、`success: event('submit')`。
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
- **P9 补记**：信封追加派生视图 `capability`（逐键 accepted/degraded/unsupported + 降级替代路径），协议升到 `es-plus.artifact@2`。加法字段本身兼容，但 @1 的「指纹覆盖全部字段」承诺不再成立（capability 刻意不参与身份），且宿主需要按版本判断「能力判定必在」而不必探测。`emitSceneArtifact` 成功分支由 `check:artifact-envelope` 断言必带 `capability`；直接 `buildArtifactEnvelope` 的草稿仍不带（没有意图可评估）。

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
- **多节点 composition 仍未实现**（见 P4 末条更正）：P5 的验收行不包含它，四类接线已经证明通道可用；自动装配需要新的 `composition` 契约与运行时见证，另开批次（P6b 已实现，见下）。

### P6 · composition 契约与见证锚点

P6 拆为两个主题批次：P6a 先堵住「声明了但没人跑」，P6b 再做多节点装配本体。

#### P6a · 见证锚点与标题单源收尾

**问题**（源码核对）：`SceneContract.runtime.witnesses` 登记了 4 条**不存在的路径** —— crud 指向 `__tests__/e2e/vue2-crud`，table/form/dialog 指向 `__tests__/e2e/vue2-fragments`；真实文件在 `__tests__/e2e-runtime/tests/` 下。P4 写这条字段时立的规矩是「只登记已存在的，避免声明了但没人跑」，但没有任何守卫在验它，于是四处死链静默存活。同一类问题：`DIALOG_TITLES` 在 P5d 之后仍有 **3 份测试内手抄**（vue3 / antdv 的 `composition-runtime.spec.ts`、mcp-server 的 `surfaces-examples.spec.ts`）。

- `registry.ts` 四条 witness 路径改到真实文件（`__tests__/e2e-runtime/tests/vue2-crud.spec.ts` / `vue2-fragments.spec.ts`）。
- `check-scene-registry` 新增第 (f) 段：每条 `runtime.witnesses` 必须 `existsSync`，否则红。
- 第 (e) 段扩展到测试：递归扫 `packages/**/__tests__/**/*.spec.*`，任何 `const DIALOG_TITLES = …` 都判红（测试同样是消费者，手抄一份会在常量改名时静默错位）。
- 三处测试改为从单一真源导入：vue3/antdv 走 `../../shared/src/scene/registry`（与它们既有的 `compose-crud-config` 相对导入同口径），mcp-server 走 `@es-plus/shared`（与该文件既有导入同口径）。

**验证（2026-11-04）**

- `check:scene-registry` → 4 场景 / 279 条语料 / 3 个片段生成器 ✅
- `npm test -w @es-plus/shared` → 868/868；vue3 / antdv `composition-runtime.spec` → 3/3；mcp `surfaces-examples.spec` → 46/46 ✅
- typecheck：mcp-server / vue3 / adapter-antdv ✅
- 变异自检（实跑后还原）✅：①把 crud 的一条 witness 改成不存在的路径 → `check:scene-registry` 红（点名场景与路径）；②在 vue3 的 `composition-runtime.spec` 里加一行 `const DIALOG_TITLES = …` → 红（点名文件）。

**据实偏离**

- 只做**存在性**断言，不代替真的跑测试：守卫能证明「路径没断」，不能证明「那条用例仍覆盖该场景」——后者由 vitest / e2e 自己负责。这条边界写进守卫注释，避免被当成「见证已跑过」的证据。
- 测试导入路径按各自包的既有惯例：vue3/antdv 读 `shared/src`（不依赖 `build:libs`），mcp-server 读包入口（该文件本来就读 build）。不一致是历史事实，不为统一而改。

#### P6b · composition 契约 `es-plus.composition@1`

**问题**（回到 P4 的最后一公里）：P4 把四类接线写进了 `ARTIFACT_RUNTIME` 的注释，但「宿主」此前只有人 —— 一张同时要表格 + 查询表单 + 弹窗的页面必须自己写胶水，写错一处（漏 `onSuccess`、按 `name` 而不是 `key` 分派行动作）产物照样编译、页面照样能打开，只是行为悄悄不对。而且没有任何东西能回答「每个声明过的通道是不是都有人消费」：契约里写着 `form.reset` / `dialog.onSuccess`，无人接线也没人发现。

- `packages/shared/src/scene/composition.ts`（新）：
  - `planComposition(plan)` —— 纯分析，不生成代码。接线**只**从 `ARTIFACT_RUNTIME` 派生：行动作 key 命中同名 dialog 节点 → `dialog.open`（标题取 `dialogTitleFor(id)`），否则升级为页面事件 `row-action`；`form.query` 有表格 → `table.refresh(model)`，否则 → 页面事件 `query`；`form.submit` → 页面事件 `save`；`dialog.onSuccess` 有表格 → `table.refresh()`，否则 → 页面事件 `success`。派生完再自检一遍两端通道都在契约表里。
  - `emitComposition(plan)` —— 节点一律经 `emitSceneArtifact` 原样产出（**不改片段字节**，只重命名为 `${id}.${ext}`），再生成 `Page.vue`：vue3/antdv 是 `<script setup>`，vue2 是 Options API + `$refs`；`defineEmits`/`defineExpose` 与 `faces` 同源。
  - 结构化拒绝：空计划、`crud` 节点、每场景第二个节点、混装 target、vue2 + composable 弹窗、id 非 kebab-case / 保留字 `page` / 组件名碰撞（如 `a1` 与 `a-1` 都推导出 `A1`）。失败分支只有错误正文，无文件、无信封。
  - 信封 `es-plus.composition@1`：节点各自信封身份不变，外面加 `wires` / `faces` / `page` / `fingerprint`。
- `artifact.ts`：把指纹算法抽成 `fingerprintPayload(contract, payload)`，`fingerprintArtifact` 改为委托 —— 两种信封共用同一算法，避免各写一份 FNV。
- 导出面：只从 barrel（`@es-plus/shared`）导出，**不**进 `@es-plus/shared/scene` —— 与 `emit.ts` 同一条理由，常量消费者不该被拉进生成器。
- `scripts/check-composition-contract.mjs`（新，第 125 步，落在 `scene-front-door` 组）：esbuild 现打包源码（命中 `shared/build` 即红），用 golden 片段语料组 14 组组合（4 形态 × 3 端 + 2 组 composable 弹窗）+ 5 例结构化拒绝，逐组断言六件事：接线通道 ∈ 契约、无静默丢弃、页面与 `faces` 自洽（含标题字面量与 `onTableSuccess` 的有无）、片段字节与单独发射相等、信封自洽与指纹稳定/敏感、拒绝例无产物。
- `packages/vue3/__tests__/composition-page-runtime.spec.ts`（新，Tier-1）：把 `emitComposition` 产物写到 `__tests__/.tmp-composition/`，**变量**动态 import `Page.vue` 真挂载，断言四条只有胶水接对才会发生的事：查询 model 进到表格请求参数；行按钮 `edit` 以注册表标题开窗且带该行数据；弹窗提交成功 → 表格重新取数；无 dialog 的 `view` 升级为页面事件 `row-action`；另有一例见证提交表单 → `save` 事件带 model。

**验证（2026-11-04）**

- `npm test -w @es-plus/shared` → 886/886（新增 18 条组合契约用例）✅
- `check:composition-contract` → 14 组组合 / 接线全部来自 `ARTIFACT_RUNTIME` / 拒绝 5 例 ✅
- `check:consistency:list` → 14 组 / **125 步**（124 → 125）✅
- `check:scene-registry` / `check:artifact-envelope` 仍绿（279/279）✅
- typecheck：shared / vue3（含测试，`typecheck:all`）✅
- vue3 `composition-page-runtime.spec` → 4/4 ✅
- 变异自检（实跑后还原）✅：①删掉 `dialog.onSuccess → table.refresh` 的派生 → 守卫红 **16 处**（每个相关组合各点名「静默丢弃」与「没有成功接线却生成了 onTableSuccess」）；②把页面 `onQuery` 里的 `refresh(model)` 改成 `refresh()` → 守卫**仍绿**（静态上通道名没变），Tier-1 见证红（`lastListParams.keyword` 为 undefined）—— 这正是两层见证各管一段的实证。

**据实偏离**

- **`form.reset` 不接线**：它是片段内部通道（清空自己的 model），组合页替它刷表格会凭空多一次请求。守卫里显式登记 `INTERNAL_CHANNELS` 并写明理由 —— 「确认过不是遗漏」，不是静默放过。
- **成功回调的兜底不是原设计**：初版在「有弹窗、无表格」时把 `onSuccess` 直接丢掉了。守卫第一条实跑就点出来了（14 处漂移里的 9 处），改成升级为页面事件 `success` 并携带 `{ id, data }`。同类被守卫当场抓住的还有两处：有表格但无弹窗时仍生成 `onTableSuccess`、vue2 页面从不派发自己声明过的 `success`。
- **节点 id 是承重墙**：它同时是文件名、行动作绑定键和标题键。因此强制 kebab-case、保留字 `page` 拒绝、组件名碰撞拒绝 —— 三个限制都是为了不让「两个节点悄悄覆盖同一个符号」。
- **每场景一个节点**：两张表无法按 ref 区分，多弹窗没有分派依据。需要多弹窗时回到 crud 场景的 `surfaces.dialog`，而不是在这里放宽。
- **本批不新增 MCP 工具 / 入口**：P6 的范围是「契约 + 守卫 + 运行时见证」；把 `emitComposition` 接到工具面会改动工具清单（`check:tool-surface` 等）与 prompt 语料，属于另一个主题批次。
- **指纹不是安全哈希**：与 `artifact@1` 共用 FNV-1a 双种子，只回答「同一份输入是否仍产出同一份页面」。

#### P6b 补记 · 契约升到 `es-plus.composition@2`（P7 内完成）

`@1` 有三处「编译得过、行为悄悄错」的缺陷，由 P7 审计逐条核对源码后修掉并升版（详见 P7）：

- `id: 'table'` 的弹窗节点与表格节点撞出同一个 `const tableRef` → 生成不可编译页面。`@2` 起 ref 变量按**节点**派生（`usersRef` / `tableRef` 各自的 camelCase 组件名），弹窗不再复用表格的 ref 名。
- 弹窗 `intent.defaultTitle` 被组合静默覆盖：片段两个模式（composable / component）都认 `defaultTitle`，组合页却只按 id 派生标题。`@2` 起页面 `open()` 的兜底标题取 `intent.defaultTitle ?? dialogTitleFor(id)`，宿主传入的 `options.title` 仍优先。
- `open()` 从 `(title, row?, onSuccess?)` 改为 `open(id, options = { title?, row?, onSuccess? }): boolean`：组合页里 id 才是分派键，title 降为可选项；未命中返回 `false`，宿主能区分「没这个弹窗」和「弹窗没打开」。

### P7 · 审计问题逐条修复（入口与接线收敛）

P6 之后做了一轮「未完成 / 遗留 / 隐患 / 设计缺陷」审计，逐条回源码核对后按主题修复。总原则仍是 P2 的那句：**入口是被测的、也是被宣称的那一个**。

**① 组合页接线（shared，契约 `@2`）**

- ref 变量按节点派生（`refVar(node)`），表格与弹窗共用一个规则；`table+dialog(id:'table')` 成为守卫里的回归组合。
- `open(id, options)` + `title = options.title || (intent.defaultTitle ?? dialogTitleFor(id))`；`options.onSuccess` 与内部 `onTableSuccess` 并列调用。
- 查询 → `table.reload(model)`（新搜索回第 1 页）、重置 → `table.reload()`（es-form 的 `rest` 按钮**先** `resetFields()` 再回调，故这里拿到的是已清空的 model）；无表格时两者升级为页面事件 `query` / `reset`。`form.submit` → 页面事件 `save`（此前只接 `form.query`，提交面永远静默）。
- `scripts/check-composition-contract.mjs`：组合 14 → **26** 组（补单节点 table / form / dialog 与 `table+dialog(id:'table')`），并新增**真实编译**腿 —— vue2 用 `packages/vue2` 内的 `vue/compiler-sfc`（2.x），vue3/antdv 用根 `@vue/compiler-sfc` 的 `compileScript` + `compileTemplate`；编译器不可用即判红（不允许静默跳过）。
- 新增 antdv 运行时见证 `packages/adapter-antdv/__tests__/composition-page-runtime.spec.ts`：查询参数、重置重载、`intent.defaultTitle`（golden `frag-dialog-02-component-antdv.json` 的「用户编辑」）、PUT + 列表刷新、`open` 布尔面。

**② 组合页入口（MCP）**

- 新增 `generate_composition`（`{ name?, target?, nodes: [{ id, scene, intent }] }`）：每个节点按所属场景的**同一份** `SCENE_INTENT_SCHEMAS` 校验，未知键带节点 id 点名；产物文本与直接调 `emitComposition` 逐字节一致。
- `crud` 节点在 handler 里先被可组合场景名单拒绝 —— `SCENE_INTENT_SCHEMAS` 含 `crud`，直接查表会让它落进整页意图校验、报「缺 apiUrl/surfaces」，把「不能二次装配」说成「字段没填」。单测钉住这条防御分支。

**③ 工具面标签收敛**

- 唯一 `FRONT DOOR` = `generate_scene`（场景路由器）；`generate_crud` = `COMPAT ENTRY (adapter)`，两条路径共用 `emitScene`、字节相同。
- 工具总数 16 → **17**；`front-door` profile 13 → **14**；`check-tool-surface` / `tool-surface.spec` / `arg-guard.spec` / `front-door-profile.spec` / 五处文档与 `llms.txt`、`public/md/**` 同批更新。

**③b 引导面同批对齐（instructions / prompts / resources）**

改标签时只有 tools/list 变了，宿主实际还会读 initialize 的 `instructions`、三个 prompt、五个 resource —— 它们仍写「入口是 generate_crud」，与工具面互相打脸（与 AN-26 同一类契约分叉）：

- `instructions`：清单补 `generate_scene` / `generate_composition`；入口段改指场景路由器；front-door 档「唯一代码生成入口」的假话改为事实。
- `crud-page` / `spec-to-surfaces` prompt、`design-extraction` / `surfaces-examples` / `conventions` / `nl-to-config` resource、`ingest_schema` / `refine_config` / `detect_project_target` / `generate_crud_from_config` 的下一步指引：统一到 `generate_scene`（scene='crud'），`generate_crud` 保留为兼容名。
- `front-door-profile.spec` 断言改为钉住新口径；`ai-workflows` 产物随文档内容重新生成（4 份站点副本）。

**④ eval 被测路径**

- PRD 腿（`scripts/eval/prd-leg.mjs`、`scripts/check-prd.mjs`）改走 `sceneCap.handler({ scene: 'crud', intent })`；prompt 明写「宿主会把你的对象包成 `{scene:'crud', intent}`」，工具名/描述取场景路由器。模型产物仍是**意图表**，落盘与 rescore 口径不变。
- `check:scene-eval` 新增 (f) 段：两条 PRD 路径必须调用 `sceneCap.handler`、不得出现 `cap.handler`。

**⑤ 语料规模与宣称挂钩**

- `check-scene-registry`：声明 `definition95` 的场景，语料条数必须 ≥ `minCasesFor95`（此前只校验常量存在）。变异自检把 `minCasesFor95` 改成 300 即红。

**验证（2026-11-04）**

- `npm test -w @es-plus/shared` → 889/889（组合用例 21 条）✅
- `npm test -w @es-plus/mcp-server` → 365/365（22 文件，新增 `generate-composition.spec` 5 条）✅
- `check:tool-surface` → 唯一 FRONT DOOR（`generate_scene`）；full 17 / front-door 14 ✅
- `check:composition-contract` → 26 组组合 + 5 例拒绝 + 编译腿 ✅
- `check:scene-registry` / `check:scene-eval` / `check:prd`（22 条可表达·可路由·可编译）✅
- vue3 `composition-page-runtime.spec` 5/5；antdv 4/4 ✅
- 变异自检（实跑后还原）✅：①`refVar` 固定返回 `tableRef` → 编译腿红（`Identifier 'tableRef' has already been declared`）；②`minCasesFor95` 改 300 → registry 守卫红；③PRD 腿改回 `fd.cap.handler` → scene-eval 守卫红（点名两处）。

**据实偏离**

- **两套编译器不同源**：vue2 只能读 `packages/vue2` 的 2.x compiler，vue3/antdv 读根 3.x —— 编译腿证明的是「各自宿主编译器能过」，不是「同一编译器下字节相同」。
- **标题兜底取 `dialogTitleFor(id)` 而非片段的 `'新增'`**：组合页常有两个弹窗，统一兜底会让标题失去区分度；片段里 `open(title, …)` 的标题参数语义不变。
- **PRD 腿不要求模型输出 `{scene,intent}` 外壳**：外壳是宿主职责（生产里同样由宿主组装）；让模型多包一层只会把「格式记忆」混进第一英里分数。
- **CLI 不改**：`packages/cli` 从不以 MCP 工具名对外（`create` 是正则/结构化配置入口，`--config` 走 `generateFromConfig`），不存在「宣称入口 vs 调用入口」的分叉，故不新增 `--scene` 旋钮。
- **守卫仍是 Tier A**：编译腿不跑类型检查，模板里的 prop 拼错这类问题仍由 `typecheck` / e2e 见证兜底。

### P11 · 组合契约 `@3` 与接线可达性复核

P11 把组合页从「一个表 / 一个弹窗 / 接线不可改」扩到多表、多弹窗、显式 `wires` 与
`behavior` 档位（契约升到 `es-plus.composition@3`；实现见 `d0300f7`）。随后的复核逐条
回源码核对生成产物，修掉三类「编译得过、行为悄悄错」的接线缺口 —— **不升协议版本**：
字段形状不变，变的是校验与页面发射。

**① 幽灵页面事件**

`faces.emit` 此前是「派生时顺手 push」。显式接线覆盖派生后（如
`form.submit → page "saved"`），派生的 `"save"` 仍留在 `defineEmits` 里 —— 页面声明了
一个永远没人派发的事件。修法：`faces.emit` **只从最终 wires 投影**（显式在前），
声明与派发同源。

**② 接线目标必须真的可调用**

派生接线只碰表格 ref，显式接线却能指向任意 `expose`。产物核对发现三处断头路：

- **表单节点没有模板 ref**：`form.validate` / `resetFields` 写在契约里，页面却从未声明
  `filterRef`，接线会生成一个指向不存在符号的调用。修法：表单节点也生成模板 ref
  （vue2 `ref="…"`、vue3/antdv `const … = ref(null)` 且模板带 `ref`）。
- **`expose` 里混着数据**：`form.model` 是 reactive 对象，接线按 `expose` 校验会生成
  `filterRef.value?.model?.()`（编译过、运行即 TypeError）。修法：运行时契约新增
  `invokable`（可调用子集，`invokable ⊆ expose` 由 `check:artifact-runtime` 断言），
  组合接线只认它。
- **composable 弹窗没有 ref**：页面只经行按钮分派（`openCall` 用解构出的 `open`，带
  标题/行）调用它。其它来源的显式接线一律拒绝；`open` 也只接受 `row-action` 源（需要
  行数据），宿主入口是页面暴露的 `open(id, options)`。

**③ 死分支与形状含混**

- `when.rowAction` 原来只校验非空字符串：指向该表没声明的按钮 key 会生成永远不触发的
  `if`。现在按源表 `rowButtons`（`key ?? name`）校验成员资格。
- `to` 的两种形状改为严格互斥（同时给 `node` 与 `page` 拒绝），`page` 必须是字面量
  `'emit'`；wire / from / when 的未知键不再静默忽略。
- 行按钮接向弹窗 `close` 通道时，旧实现无条件生成 `open(...)`（静默改写目标通道）；
  现在按 `wire.to.channel` 分派。

**验证（2026-11-04）**

- `npm test -w @es-plus/shared` 组合 spec 48/48（新增 3 条产物用例 + 7 条结构化拒绝 + 4 条主从映射/改名用例）✅
- `check:composition-contract` → **44 组组合**（新增 `table+table(master-detail model)` 与
  `table+form+dialog(explicit wires)`，三端各跑）/ **结构化拒绝 18 例** / 编译腿 ✅
- `check:artifact-runtime` → `invokable ⊆ expose` 断言 ✅
- `npm test -w @es-plus/mcp-server` → 新增可调用性/按钮 key 的透出用例 ✅
- 变异自检（实跑后还原）✅：①删掉表单模板 ref → 守卫点名 `queryFormRef`（2 处）；
  ②把派生的 `save` 事件强行塞回 `faces.emit` → 守卫在每端都红（30 处）；
  ③关掉 `invokable` 校验 → 拒绝用例「form.model 是数据」失效即红；
  ④关掉 `to.model` 分支 → 主从映射组合在三端点名缺失 `userId` 映射。

**据实偏离**

- **不升 `composition@4`**：宿主可见的字段形状没变，`wires` 的合法性只会从「接受」
  变「拒绝」，旧计划里本来合法的接线仍合法。
- **表单 ref 是新增的页面内部符号**，不进 `faces.expose`：页面仍只暴露表格命令面与
  `open(id, options)`；表单 ref 只服务显式接线。
- **composable 弹窗不支持被 `onSuccess`/`submit` 直接打开**：`open(title, row)` 需要
  行与标题上下文，放弃这条路径而不是生成一个不带数据的调用；需要这种编排时改用
  `mode: 'component'` 或页面事件。

#### P11 复核（第二批）· 主从参数映射与 `behavior` 正名

计划原文第 3、5 条在第一批里只落了一半，逐条回源码后补齐/裁决：

1. **主从参数映射**（计划：`reload({ [param]: row[rowkey] })`，要求显式 rowkey 映射）。
   旧行为把**整行**塞进 `reload(model)`；`es-table` 会把 model 合并进请求参数，主从接口
   因此收到 `id/name/status/...` 一整套无关参数。新增 `to.model`：
   `{ departmentId: '$row.departmentId' }` → `reload({ departmentId: row.departmentId })`。
   校验只允许 `row-action` 源 + `reload` 目标（其它通道没有查询参数语义）、值必须是单层
   `$row.<字段>`（不猜常量/多级路径）；空对象拒绝（省略即整行透传，保持兼容）。
2. **`behavior` 改名 `crud-requests` → `data-wiring`**（计划要求生成 add/edit/delete
   请求，或「改名/降级并如实描述」——取后者并论证）。组合节点的意图表里没有
   `apiUrl` / `actions`，生成 POST/PUT/DELETE/GET 只能先把片段意图升级成
   `StructuredCrudConfig`，等于在组合层复制一份 CRUD 动作语义，直接违反反目标 5
   （「不另写第二份」）。组合层实际只调表格 `reload` / `refresh`，旧名字承诺了它做不到
   的事。内建请求语义留在 `scene='crud'`；`@3` 尚未对外发布，改名不留兼容别名。
   这是**对计划字面的偏离**：交付的是「名字与行为一致」，不是「组合页内建 CRUD 请求」。

3. **多表无 master 的静默升级 → 显式告警**：派生数据接线在没有唯一默认表时升级为页面
   事件，产出面只字不提。宿主会以为 `data-wiring` 仍在接表。现在在产物正文与信封
   `warnings` 里点名，并给出两条出路（每个节点的 `<节点camel>Refresh` / `<节点camel>Reload`，或声明
   `role: 'master'`）。`ui-only` 本就把数据通道全部交给宿主，不重复告警。
4. **悬空 `@row-action` 监听**：模板对每张表都绑定 `@row-action`，但处理器只为「有行按钮
   接线」的表发射。明细表（无 `rowButtons`）因此得到一个指向未定义方法的监听 —— vue3
   运行时实测有 `Property "onRowActionXxx" was accessed during render` 告警，点击即
   TypeError。现在两边同源：没有处理器就不绑定。此缺陷由新增的主从运行时见证发现。
5. **主从运行时见证**：`vue3` / `adapter-antdv` 的 `composition-page-runtime.spec.ts`
   新增「主表 查看 → 明细表 reload，只带 `{ userId: row.id }`」用例，从真实片段语料
   装配页面、点按钮、断言明细请求参数（整行的 `name/status` 不出现）。此前只有编译见证。

**验证**：shared 979/979（组合 50）；MCP 391/391；`check:composition-contract`
44 组 / 拒绝 18 例（三端）；vue3 组合运行时 6/6、antdv 5/5；`to.model` 变异
（关掉映射分支）→ 三端点名缺映射；悬空监听由 vue3 运行时的 Vue warn 实证。

**据实偏离（计划 P11 字面）**

- **`dialogs[] + trigger` 不落独立字段**：节点 id 本身就是触发器（行按钮 key 命中
  dialog 节点 id 即开窗），任意映射用 `wires` 表达。再加一个 `dialogs[]` 数组会让
  「哪些弹窗存在」有两份真源，与反目标 5（不另写第二份）冲突；能力上等价。
- **「@2 的 26 组旧组合逐字节不变」不再作为验收**：`@3` 有意改变页面代码
  （移除 `onTableSuccess`、`open` 改选项对象、ref 按节点派生）。冻结旧页面字节
  等于禁止这些修复。现在守护的是**真正要求稳定的那一半**：节点片段与单独发射逐字节
  相同（复用同一生成器），页面代码由 `check:composition-contract` 逐通道断言
  （通道可达、faces 与接线同源、三端编译）。
- **无 `role` 时允许出现多张 table**：@2 的「每种场景至多一个」在 `table` 上被
  `@3` 显式放宽（主从本来就需要多表）。没有 master 也没有唯一表时不再静默：数据
  接线升级为页面事件并在 `warnings` 点名（见上）。
文档尾巴（P8 复核）与本批同批修复：ASCII 图 / 文件地图计数改为从源码数出来，
信封适用范围从 `withEnvelope` 的真实调用点反推，并给三个信封工具声明 `outputSchema`。

### P12 复核 · gold 自评分（尺子的自证）

计划第 1 条的「CRUD 腿」此前缺位：PRD 腿已逐例自评，CRUD 216 例与片段 69 例
只有合成样例单测。补上守卫后**当场抓到两条 gold 用例自评判负**（`12-role-form-layout` /
`18-notice-custom-dialog`）。当时的归因与修法**被 2026-11-04 复审推翻**，据实更正如下：

- **首版归因（错误，已回退）**：认为「`dialogs.add` 省略 `formItems` ⟹ 渲染期按
  `inForm !== false` 字段回填」，于是把 gold 与 pred 都套上 `effectiveDialogEntry`
  回填。回源码核对：三端 `normalizedDialogs` 都是
  `if (props.schema.dialogs) return props.schema.dialogs`（**原样**），生成器也只在
  `dlg.formItems` 真声明时才拷贝 —— 运行时**从不**回填。这个「对称」修复的真实效果是
  给「声明了弹窗却漏写表单」的白卷判对（运行时是点开没有任何字段的空弹窗），并把
  gold 语料自身的同类错误合法化。
- **真实缺陷一分为二**：`dialogs` 的 `formItems` 只由 **legacy 模式**派生（`schema.dialogs`
  缺席时由 `dialogFormItems` + `actions` 合成 add/edit/view）。尺子现在的模型是
  `effectiveDialogs(cfg)`：显式模式（`dialogs` 非空 record，或声明了
  `toolbarBtns`/`tableBtns`/`operationColumn`）条目**原样**；legacy 模式才按
  `inForm !== false` + `actions` 派生（与 `render-plan` 的 `anyRenders` 逐字对齐，
  空 record 等同省略）。gold 侧不再有任何回填。
- **`12-role-form-layout` 是语料错误，不是尺子错误**：它声明 `dialogs.add/edit`
  只为写 `width: 720`（AI 契约里弹窗宽度的唯一出口就是 `dialogs[k].width`），却没写
  `formItems` —— 与本例 NL「弹窗里的表单也分 2 列」自相矛盾。补上三个字段的
  `formItems`（含 `formSpan: 12`，显式模式的 span 来自条目自己，不再从顶层字段派生）。
  `18-notice-custom-dialog` 的 `edit` 带 `hasCustomRender: true`（弹窗体由宿主 render
  提供），省略 formItems 本就合法，无需改。
- 新增 `scripts/check-gold-self-score.mjs`（`check:gold-self`，进 `scoring-eval` 组与
  旧链）：CRUD 用 `scoreAll(gold, gold, mask)`，片段用 `scoreFragment(scene, gold, gold, mask)`，
  要求 `core / full / scoped / stated` 全真且每个 applicable 维度 pass。纯离线、不调模型、
  不读写 accuracy 产物。
- `scorers.test.mjs` 的断言换成钉运行时事实的四条：gold/pred 任一侧在显式模式下省略
  `formItems` 都判负；整键省略走 legacy 派生且与显式写全渲染等价；声明按钮面后不再
  退回 legacy；legacy 派生按 `inForm !== false` 过滤。变异（把显式模式的条目重新
  按字段回填）→ 两条断言红，恢复后绿。

**验证**：`check:gold-self` → CRUD 216 + 片段 69 全绿；`check:scorers` /
`check:rescore` / `check:ratchet` / `check:unknown-keys` 绿。

**仍未完成（运营项，代码侧已就绪）**：计划第 6 条「重跑一次完整评测」受中继与额度
约束，当前分支产物仍是 `measurement: failed`（407 行未测到），因此**不得引用任何
当前准确率数字**；2026-10-22 的 22.7% 只能作历史基线。该动作不产生代码提交，
不属于本批。

### P9 / P10 复核 · 据实裁决（补记）

- **`tableBtns` 刻意不进片段词汇**：片段表格没有工具栏渲染通道（`tableBtns` 是
  CRUD 页的工具栏按钮，不是列词汇）。P8 要求文档如实写「不支持」、P10 要求片段
  接受同一组键，两条只在字面上冲突；裁决是「按渲染通道分域」，`check:capability-ledger`
  反向断言它不得出现在片段 accepted 键集里。这是故意边界，不是遗漏。
- **片段词汇 golden 拆成两条而不是一条**：`treeConfig`（树表）与 `mergeConfig`
  （相邻行合并）在同一张表上语义互斥，硬塞进一例会得到自相矛盾的 NL。`frag-table-08`
  覆盖 groups + index + expand + merge + 顶层 rowkey，`frag-table-09` 覆盖
  treeConfig + expand + rowkey；两例都三端跑，`check:vocabulary-parity` 断言同一份
  `columns` 在片段与 CRUD SFC 两路径的列字面量逐字节相同。
- **`unsupported` 在生成边界不可达是形状拒绝的必然结果**：`accepted == Zod shape keys`
  由守卫钉死，未知键在进入 `assessIntent` 前就被 `collectUnknownKeys` 拒掉。因此
  `unsupported` 的价值在 `validate_intent` / `coverage_report`（先判后改）与资源文档，
  而不是「生成时再报一次」。这一点写进 capability 头注，而不是制造第二份形状校验。

