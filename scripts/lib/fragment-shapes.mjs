#!/usr/bin/env node
/**
 * 捕获片段工具（`generate_table` / `generate_form` / `generate_dialog`）的**真实注册信息**：
 * 工具名、给宿主 LLM 看的 description、以及 zod3 入参形状。
 *
 * ## 为什么用 esbuild 现打包（与 `./front-door.mjs` 同因）
 *
 * 三个工具注册在 TS 源码里，而消费方（eval 驱动、prompt 守卫）是 `.mjs`，Node 不能直接
 * import TS。读 `build/` 则会让评测/守卫**静默测旧代码**。故：现打包 `packages/mcp-server/src`，
 * `metafile` 自证输入来自 `shared/src`（`shared/build` 零命中）。
 *
 * 临时入口放在仓库内 `node_modules/` 下 —— ESM 说明符要相对解析，系统临时目录会找不到 esbuild。
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * 打包并捕获三个片段工具的注册。
 *
 * 返回 `{ tools, tmp, fromBuild, fromSrc, cleanup }`，`tools` 形如
 * `{ generate_table: { name, description, shape }, ... }`（`shape` 是工具注册时的**裸 shape 对象**，
 * 即 `{ fields: ZodType, apiUrl: ZodType, ... }`）。
 *
 * 调用方**必须**在 finally 里 `cleanup()`（糖：`rmSync(tmp, {recursive:true, force:true})`）。
 */
export async function captureFragmentTools() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-frag-shapes-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "import { registerGenerateTable } from '../../packages/mcp-server/src/tools/generate-table.ts'",
        "import { registerGenerateForm } from '../../packages/mcp-server/src/tools/generate-form.ts'",
        "import { registerGenerateDialog } from '../../packages/mcp-server/src/tools/generate-dialog.ts'",
        'export function capture() {',
        '  const tools = {}',
        '  const fake = { tool: (name, description, shape) => { tools[name] = { name, description, shape } } }',
        '  registerGenerateTable(fake)',
        '  registerGenerateForm(fake)',
        '  registerGenerateDialog(fake)',
        '  return tools',
        '}',
      ].join('\n'),
      'utf8'
    )
    const outfile = join(tmp, 'fragment-shapes.mjs')
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
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

/**
 * 捕获 + 纯度断言 + 进程退出清理（eval 与守卫共用，避免两处各写一遍）。
 * @returns {Promise<Record<string, {name:string, description:string, shape:Record<string, unknown>}>>}
 */
export async function setupFragmentTools() {
  const captured = await captureFragmentTools()
  if (captured.fromBuild.length > 0 || captured.fromSrc.length === 0) {
    captured.cleanup()
    throw new Error(
      `片段形状捕获：打包输入不纯（shared/src ${captured.fromSrc.length} / shared/build ${captured.fromBuild.length}）—— ` +
        `陈旧构建会让评测/守卫测旧代码`
    )
  }
  process.once('exit', () => captured.cleanup())
  const tools = captured.mod.capture()
  for (const name of ['generate_table', 'generate_form', 'generate_dialog']) {
    if (!tools[name]) {
      captured.cleanup()
      throw new Error(`片段形状捕获：没有捕获到 ${name} 的注册`)
    }
  }
  return tools
}
