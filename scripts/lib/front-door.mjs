/**
 * 前门（`generate_crud`）驱动原语 —— 共享单源。
 *
 * 两个消费者，各写一份必然漂移：
 *   1. `scripts/check-front-door.mjs` —— **确定性**冒烟：把**语料**喂进真 handler，断言可表达 /
 *      路由 / 编译 / 成员关系 round-trip；
 *   2. `scripts/eval-llm.mjs` —— 付费 eval 的「前门腿」：把**模型产出**喂进**同一个** handler，
 *      断言它是可路由且可编译的（W1.3「前门进 eval」的落点）。
 *
 * ## 为什么必须 esbuild 打包，而不是直接 import
 *
 * `generate_crud` 的注册写在 TS 源码里（`packages/mcp-server/src/tools/generate-crud.ts`），
 * 而两个消费者都是 `.mjs`，Node 不能直接 import TS。两条路：
 *   · 读 `packages/mcp-server/build/` —— 陈旧构建会让守卫/eval **静默失明**（测的是旧代码）；
 *   · esbuild 现打包源码 —— 本次实现，`metafile` 自证输入来自 `shared/src`、`shared/build` 零命中。
 *
 * 临时入口必须放在**仓库内**的 `node_modules/` 下：ESM 说明符要相对解析，放系统临时目录会在
 * `import 'esbuild'` 处炸（找不到包）。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { fencedBlocks } from './compile-check.mjs'
import { compileFences } from '../eval/compile-leg.mjs'

// 围栏抽取的实现在共享尺子里（`compile-check.mjs`）；这里 re-export 保持既有导入面不破。
export { fencedBlocks }

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * 打包并捕获前门的真 handler / 真形状。
 * `metafile` 用于自证打包拉的是 `shared/src`（见文件头注）。
 *
 * 返回 `{ mod, tmp, fromBuild, fromSrc }`；调用方**必须**在 finally 里
 * `rmSync(tmp, { recursive: true, force: true })`（`cleanup()` 是同一件事的糖）。
 */
export async function captureFrontDoor() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-front-door-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "import { registerGenerateCrud } from '../../packages/mcp-server/src/tools/generate-crud.ts'",
        "import { surfaceFieldSchema } from '../../packages/mcp-server/src/tools/_fragment-shapes.ts'",
        "import { z } from 'zod'",
        // AN-19: bundle the published extraction resource so the paid PRD leg uses
        // the SAME text a client reads (no second hand-written contract).
        "import { buildDesignExtractionContent } from '../../packages/mcp-server/src/resources/design-extraction.ts'",
        "export { composeCrudConfig } from '@es-plus/shared'",
        "export { generateFromConfig } from '@es-plus/shared'",
        // AN-21: `check-tool-shapes.mjs` introspects the front-door (zod 3) knobs and
        // the shared authoritative (zod 4) schema in ONE bundle, so each side is read
        // with its own Zod generation — no cross-version object reuse.
        "export { StructuredCrudConfigSchema } from '@es-plus/shared'",
        // AN-09 三端能力矩阵：AI 展示案例的 claim 边界（capability-matrix 生成器与 check-ai-cases 共用）
        "export { CAPABILITIES } from '@es-plus/shared'",
        // 前门生成前的确定性校验（与 generate_crud / validate_config 同一条闸门）
        "export { validateAndRepair } from '@es-plus/shared'",
        "export { z } from 'zod'",
        'export { buildDesignExtractionContent }',
        'export function capture() {',
        '  let cap = null',
        '  const fake = { tool: (name, desc, shape, handler) => { cap = { name, desc, shape, handler } } }',
        '  registerGenerateCrud(fake)',
        '  return { cap, surfaceFieldSchema }',
        '}',
        '/**',
        ' * 用**真** handler 跑一遍前门（入参先用真 crudShape 解析，与客户端走同一条校验）。',
        ' * `check-ai-cases` 的 surfaces 重放与「冻结入参仍被前门接受」都用它 —— 只读捕获的',
        ' * `cap` 复制一份校验逻辑，会让守卫断言的输入语言与真实客户端漂移。',
        ' */',
        'export async function callFrontDoor(args) {',
        '  let cap = null',
        '  const fake = { tool: (name, desc, shape, handler) => { cap = { name, desc, shape, handler } } }',
        '  registerGenerateCrud(fake)',
        '  return cap.handler(z.object(cap.shape).parse(args))',
        '}',
      ].join('\n'),
      'utf8'
    )
    const outfile = join(tmp, 'front-door.mjs')
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      outfile,
      platform: 'node',
      logLevel: 'silent',
      metafile: true,
      alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
      },
    })
    const inputs = Object.keys(result.metafile.inputs)
    const fromBuild = inputs.filter((p) => /shared[\\/]build[\\/]/.test(p))
    const fromSrc = inputs.filter((p) => /shared[\\/]src[\\/]/.test(p))
    return {
      mod: await import(pathToFileURL(outfile).href),
      tmp,
      fromBuild,
      fromSrc,
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    }
  } catch (err) {
    // 打包/导入失败也要清干净临时目录，别在 node_modules 里留垃圾。
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

/** 把 config 的一个字段投影成前门字段词汇（只保留 `surfaceFieldSchema` 认识的键）。 */
export function fieldProjector(surfaceKeys) {
  return (f) => {
    const o = {}
    for (const k of Object.keys(f)) if (surfaceKeys.has(k)) o[k] = f[k]
    return o
  }
}

/**
 * config → 前门 `surfaces`。
 * 面成员由 `inQuery/inTable/inForm !== false` 决定（与 `compose-crud-config.ts:178-180`
 * 的写入方向相反、语义相同）；dialog 用「全参对象」形式，只带前门形状接受的键。
 */
export function deriveSurfaces(config, project) {
  const query = config.fields.filter((f) => f.inQuery !== false).map(project)
  const table = config.fields.filter((f) => f.inTable !== false).map(project)
  const form = config.fields.filter((f) => f.inForm !== false).map(project)
  const dialog = config.dialogs
    ? Object.entries(config.dialogs).map(([key, d]) => ({
        key,
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.width !== undefined ? { width: d.width } : {}),
        ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
        ...(d.formItems !== undefined ? { formItems: d.formItems.map(project) } : {}),
      }))
    : undefined
  return { query, table, form, dialog }
}

/** 前门形状里没有的 dialog 子键（前门表达不了，报告用）。 */
export const DIALOG_ACCEPTED = new Set(['key', 'title', 'width', 'fullscreen', 'formItems'])

/**
 * config + surfaces → 前门 handler 的入参。
 *
 * 顶层键是 config 的**透传面**（前门 `crudShape` 里 name/apiUrl/…/mergeConfig 与
 * `StructuredCrudConfigSchema` 同名），故 check（语料）与 eval（模型产出）用同一份装配，
 * 不会出现「守卫测的入参与 eval 测的入参不是一回事」。
 */
export function frontDoorArgs(config, surfaces) {
  return {
    name: config.name,
    apiUrl: config.apiUrl,
    surfaces,
    target: config.target,
    mode: config.mode,
    typescript: config.typescript,
    i18n: config.i18n,
    actions: config.actions,
    permissions: config.permissions,
    pagination: config.pagination,
    tableOptions: config.tableOptions,
    formLayout: config.formLayout,
    operationColumn: config.operationColumn,
    tableBtns: config.tableBtns,
    toolbarBtns: config.toolbarBtns,
    expandConfig: config.expandConfig,
    treeConfig: config.treeConfig,
    mergeConfig: config.mergeConfig,
  }
}

/**
 * 用 Tier A 编译腿（AN-12）校验产物里每个围栏块；返回失败描述（空数组 = 全过）。
 *
 * 与 eval 的 `compiles` **同一把尺子**：SFC 过 `compileScript` + `compileTemplate`
 * （模板真的编译），模块过 esbuild。此前这里只解析 `<script>` 块 —— 前门的
 * `compileFailures` 是门禁判据，模板坏掉的产物不该因为「脚本能解析」而放行。
 * 围栏为空时返回 []：调用方（front-door-leg）已把「没有任何围栏」单独记成 rejected。
 */
export function compileBlocks(text, label) {
  if (fencedBlocks(text).length === 0) return []
  return compileFences(text, label)
}
