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
| **Entry** | 由哪个工具承载 | 15 个 MCP 工具 + CLI | `generate_scene` 为 canonical；旧工具为 adapter；CLI 后续接入 |

## 2. 源码核对结论（决定顺序）

1. **场景概念只活在 eval**：`packages/shared`、`packages/mcp-server` 源码 grep 无 `Scene` 抽象；`SCENE_TOOL` 在 `scripts/eval/scenes.mjs:55`。
2. **`generate_crud` 被钉死**：216 条 CRUD 语料 + `check:front-door` / `check:tool-surface` / `check:tool-shapes` / `check:entry-contract` 都以它为唯一前门。只能加法改造。
3. **片段运行时不具备编排契约**：`es-form` 无 emits（`packages/vue3/src/components/es-form/src/es-form.vue:153-156`）；片段 table 不发 refresh/row-action；片段 dialog 未接 success/error。组合场景必须后置。
4. **eval 测错路径**：门禁是 NL→完整 `StructuredCrudConfig`（`scripts/eval-llm.mjs:326-333`），再 `deriveSurfaces` 反向调用前门（`scripts/eval/front-door-leg.mjs:57`）。路由与 surfaces 首程未计分。
5. **单一真源已分裂**：场景/工具映射 5 份；token 表 2 份；shared Zod 4 vs mcp Zod 3；dialog 类型 3 份。
6. **守卫链会互相遮蔽**：`check:consistency` 是 119 段 `&&`；`check-feature-coverage.mjs:164-165` 会 `process.exit(1)` 终止后续检查。

## 3. 实施批次（依赖驱动）

| 批次 | 内容 | 验收 | 状态 |
|---|---|---|---|
| **P0** | 守卫分组全量报告 runner；旧链保留回退 | 组内第 2 个失败仍打印第 3–N 组结果 | ⬜ |
| **P1** | 场景注册表单一真源 + `check:scene-registry` | 删 scene / 改生成器映射 / 缺语料 → 红；279 条语料零变化 | ✅ 2026-11-03 |
| **P2** | `ScenePlan` + `generateScene` + `generate_scene` 加法式前门 | 279/279 与旧工具字节相等；工具数 16；文档计数同步 | ⬜ |
| **P3** | eval 场景腿：route → intent → landing → witness | gated 路径真实调用 `generate_scene`；`deriveSurfaces` 仅诊断 | ⬜ |
| **P4** | artifact contract + 运行时事件/expose + composition | 三端 refresh/validate/success 见证；组合四类接线 | ⬜ |
| **P5** | 单一真源收尾、scene×capability、permission 安全、artifact@1 | 变异 → 红；`pvalue` 且无函数 → 拒绝 | ⬜ |

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
  entry: { tool: string; future?: string; adapters: readonly string[] }
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
