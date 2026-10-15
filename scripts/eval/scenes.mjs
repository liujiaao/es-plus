#!/usr/bin/env node
/**
 * 生成场景分类法（单源）。
 *
 * ## 为什么需要它
 *
 * `AI-SCENE-COVERAGE-PLAN.md` §1.2 实测出**被测集合 ⊊ 宣称集合**：186 条 golden 语料
 * 全是 CRUD 组合，独立 `es-table` / `es-form` / `useDialog` **零语料、零 LLM eval**，
 * 只有 `toContain` 字符串断言 + esbuild 语法解析（`compile-smoke.mjs`，且当时不在
 * `check:consistency`）。形态冒烟不是可达性见证。
 *
 * 本模块把「有哪些场景」变成可枚举的单源，供三类消费者共用：
 *   - 语料侧：`score-golden.mjs` / `eval-llm.mjs` 等按 `sceneOf()` 过滤（它们全都
 *     假定 `raw.config` 是 StructuredCrudConfig，片段用例混入后 Zod parse 会抛）；
 *   - 门禁侧：`check-scene-coverage.mjs` 断「每场景 × 每端 × 每模式」无空格；
 *   - 文档侧：计划表与 §5 的验收口径引本文件的常量，避免两处各写一份清单。
 *
 * 抽成独立模块的理由同 `./fewshot-derived.mjs`：`eval-llm.mjs` 在模块顶层就 `main()`，
 * 一 import 就跑真钱跑批，所以任何要被守卫/单测引用的清单必须住在这里。
 *
 * ## 关键约定
 *
 * 1. **`scene` 缺省即 `'crud'`**（向后兼容）：186 条既有用例一个字节都不用改。
 *    漏标非-crud 用例**不会静默变成 crud** —— 它的 `config` 不是合法 StructuredCrudConfig，
 *    会在 `StructuredCrudConfigSchema.parse` 处**响亮抛错**（eval-llm / check:scorers 双方）。
 *    即「忘记标注」是响的，「标错」才会静默，故另有 `check-scene-coverage` 的形状校验兜底。
 *
 * 2. **`mode` 是 CRUD 独有的轴**，片段场景没有（见 `modesOf`）。这不是遗漏而是事实：
 *    `packages/shared/src/fragment-generator.ts` 里 `\bmode\b` 零匹配，三个片段工具
 *    （generate-form/table/dialog）的输入形状里没有 `mode`，前门 `generate-crud.ts`
 *    的 no-table 分支也从不传 `mode`。片段产物恒为单件（form/table 一个 SFC，dialog
 *    一个 tsx/jsx 模块），没有 schema-vs-sfc 之分。
 *    ⚠️ 故计划的验收语「四场景 × 三端 × **两模式**」在算术上不成立，真实矩阵是
 *    `crud` 3 端 × 2 模式、`table|form|dialog` 3 端 × 1。`MODELESS` 用 `null` 表示
 *    「该场景根本没有这条轴」，与「这一格缺语料」区分开 —— 后者才该翻红。
 */

/** 未标 `scene` 时的默认场景。 */
export const DEFAULT_SCENE = 'crud'

/** 场景全集（顺序冻结：门禁的矩阵输出按此序，便于人眼比对历史）。 */
export const SCENES = Object.freeze(['crud', 'table', 'form', 'dialog'])

/**
 * 每个场景由哪个 MCP 工具承载。
 * `check-scene-coverage.mjs` 用它断言「声称支持的场景」在工具注册表里真实存在。
 */
export const SCENE_TOOL = Object.freeze({
  crud: 'generate_crud',
  table: 'generate_table',
  form: 'generate_form',
  dialog: 'generate_dialog',
})

/** 仅 CRUD 有的模式轴（`generateFromConfig` 的 schema / sfc 两条发射路径）。 */
export const MODES = Object.freeze(['schema', 'sfc'])

/** 表示「该场景没有这条轴」（区别于「这条轴上缺一格语料」）。 */
export const MODELESS = null

/** 该场景的语料应覆盖哪些 mode；片段场景返回 `[null]`（单格，表示无此轴）。 */
export function modesOf(scene) {
  return scene === 'crud' ? MODES : [MODELESS]
}

export function isScene(value) {
  return SCENES.includes(value)
}

/**
 * 取一条用例的场景；未标或标了非法值都落到 `DEFAULT_SCENE`。
 * 注意：非法值这里宽容处理（不当场抛），因为语料的**形状校验**由
 * `score-golden.mjs` 与 `check-scene-coverage.mjs` 负责给出可读报错；
 * 运行时消费者只需一个可用的过滤谓词，不该在遍历语料时炸。
 */
export function sceneOf(caseObj) {
  const v = caseObj?.scene
  return isScene(v) ? v : DEFAULT_SCENE
}

/** 该用例是否走 CRUD 配置路径（`config` 是 StructuredCrudConfig）。 */
export function isCrudCase(caseObj) {
  return sceneOf(caseObj) === DEFAULT_SCENE
}

/**
 * 一条用例在「场景 × 端 × 模式」矩阵里的格坐标。
 * - 片段场景：`target` 在**用例顶层**（片段输入本身不含 target）。
 * - CRUD 场景：`target`/`mode` 在 `config` 内（schema 有默认值，故解析后恒有值）。
 *   `config.target`/`config.mode` 可能被省略 —— 调用方若传的是**未经 Zod 解析**的
 *   raw config，这里落到与 schema 一致的默认值（vue3 / schema）。
 */
export function cellOf(caseObj) {
  const scene = sceneOf(caseObj)
  const config = caseObj?.config || {}
  const target = scene === DEFAULT_SCENE ? config.target || 'vue3' : caseObj?.target
  const mode = scene === DEFAULT_SCENE ? config.mode || 'schema' : MODELESS
  return { scene, target, mode }
}

/** 矩阵格的可读名字，报错与统计输出共用。 */
export function cellName({ scene, target, mode }) {
  return `${scene} × ${target ?? '(无 target)'}${mode ? ` × ${mode}` : ''}`
}
