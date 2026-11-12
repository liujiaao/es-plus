/**
 * Tier B 类型腿（AN-14；A5 起默认**全量**，抽样降级开关保留）：捕获「语法正确但类型不正确」的产物。
 *
 * ## 与 Tier A 的分工
 *
 *   - Tier A（`compile-leg.mjs`）：`@vue/compiler-sfc` / esbuild 把产物**编译**一遍。
 *     它证明模板能编译、脚本能解析，但对「类型」一无所知 ——
 *     `const formItems = [{ formtype: 'Input' }]` 编译得过，赋给 `FormItemOption[]`
 *     却是错的；引用了不存在的类型名、事件处理器签名不对，也全都编译得过。
 *   - Tier B（本文件）：把产物放进一个**临时工程**（`vue` + 对应 UI 库 +
 *     `@es-plus/<target>`），用 `vue-tsc --noEmit` 做类型检查。Volar 会把模板里的
 *     `:schema` / `@btn-click` 也按组件的 prop/emit 类型检查 —— 这正是
 *     「事件签名写错」能红的机制（全局组件通过 `shims.d.ts` 的 `GlobalComponents` 映射）。
 *
 * ## 为什么用「TS 投影」而不是原样产物
 *
 * 当前 216 条金标语料全是 JS（`typescript: false`），而 Volar **只在 TS SFC
 * （`lang="ts"`）里做模板类型检查**；JS 产物在类型腿上等于恒定通过 —— 一条看不见的
 * 红盲。本腿因此对每个 config 重新生成 `{ ...config, typescript: true }` 的产物再检查：
 * 同一份发射器、同一份配置，只是让它产出类型化的那一版。这样：
 *   1. 金标也能被度量（否则 216 条全是「跳过」，腿等于不存在）；
 *   2. 验收条件（缺 `import type { CrudPageSchema }`、事件签名错误）本身就是 TS 属性，
 *      在 JS 产物里无从谈起。
 * 这是对计划字面（「抽样 N=10 模型产物 + 全部金标」）的**偏差**，记入落地记录。
 * A5 起模型产物也改为**全量**（`eval-llm.mjs` 的 `TYPECHECK_FULL`）：抽样每端 10 条时，
 * 带 `expandConfig` / 自定义 `render` 的那类产物大概率一条都没被抽到，而「类型腿 100%」
 * 印在产物里读起来像全量结论。`sampleTypecheckCases` 保留为降级开关。
 * 注意方向：全量让这条腿**更容易**红（样本多了、覆盖的产物形态全了），不是更宽松。
 *
 * ## 依赖
 *
 * 临时工程从仓库根的 `node_modules` 解析 `vue` / UI 库 / `@es-plus/<target>`；后者按
 * `dist/index.d.ts` 解析，故运行前必须有**新鲜的**组件构建产物（根脚本
 * `npm run build:components`）。缺 dist 时本腿**抛错**而不是静默跳过 —— 跳过就是红盲。
 *
 * ## 与 `check-generated-typecheck.mjs` 的分工
 *
 * 工程搭建 / 运行 / 诊断解析 / 汇总都在 `scripts/lib/typecheck-project.mjs`，两条腿
 * 共用同一把尺子。本文件只保留**eval 特有**的一层：把金标/模型 config 变成 TS 投影
 * 产物（需要 `@es-plus/shared` 的 `generateFromConfig`）。
 */
import { generateFromConfig } from '@es-plus/shared'
import {
  TYPECHECK_TARGETS,
  typecheckTsconfig,
  typecheckShims,
  productFiles,
  safeId,
  sampleTypecheckCases,
  defaultTypecheckDir,
  writeTypecheckProject,
  parseTypecheckDiagnostics,
  missingComponentDists,
  runTypecheck,
  fmtTypecheckDiagnostic,
  summarizeTypecheck,
} from '../lib/typecheck-project.mjs'

export {
  TYPECHECK_TARGETS,
  typecheckTsconfig,
  typecheckShims,
  productFiles,
  safeId,
  sampleTypecheckCases,
  defaultTypecheckDir,
  writeTypecheckProject,
  parseTypecheckDiagnostics,
  missingComponentDists,
  runTypecheck,
  fmtTypecheckDiagnostic,
  summarizeTypecheck,
}

/**
 * 把 config 列表变成可检查的 case（生成 TS 投影产物）。
 * 生成器抛错的条目保留为 `{ error }`（与 Tier A 的分母纪律一致：没有产物 ⟹ 不计入类型分母）。
 *
 * ## 为什么必须用**用例 target** 覆盖 config.target
 *
 * 临时工程按 `case.target` 装依赖（`@es-plus/vue3|vue2|antdv`）与 GlobalComponents 类型。
 * 此前这里生成 `{ ...config, typescript: true }`，用的是**模型自报的** `config.target`：
 * 模型把 antdv 用例写成 vue3 时，产物 import 的是 `@es-plus/vue3`、却被放进 antdv 工程里
 * 按 antdv 的 `CrudPageSchema` 检查 ⟹ 报一条与模型产出无关的 TS2322（078 批次实测命中
 * 「99-sku 系列」一条）。这既把 `target` 维度**重复计分**（它已有独立维度），又让类型腿
 * 的数字随 target 命名错误漂移。类型腿要量的是「这份配置发射出的产物类型是否成立」，
 * 目标端由用例决定。
 */
export function buildTypecheckCases(configs, { generate = generateFromConfig } = {}) {
  return (Array.isArray(configs) ? configs : []).map(({ id, target, config }) => {
    // 省略 target 即 vue3（scenes.mjs 的口径）；不能让 undefined 流到 runTypecheck。
    const t = target || config?.target || 'vue3'
    try {
      const product = generate({ ...config, target: t, typescript: true })
      const files = productFiles(product)
      if (files.length === 0) {
        return { id, target: t, error: '生成器没有返回产物' }
      }
      return { id, target: t, files }
    } catch (e) {
      return { id, target: t, error: e instanceof Error ? e.message : String(e) }
    }
  })
}
