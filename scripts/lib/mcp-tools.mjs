/**
 * MCP 工具的**确定性调用器** —— S3 工作流页的驱动原语。
 *
 * ## 为什么是「打包 + 假 server」而不是起传输层
 *
 * 工作流页要展示的是「某个工具的入参 → 出参」，而工具的真实逻辑活在
 * `packages/mcp-server/src/tools/*.ts` 的注册函数里。两条路：
 *   · 起 stdio MCP server，用 SDK client 发 JSON-RPC —— 更「端到端」，但要先 build，
 *     且守卫会变成「测构建产物」（陈旧 build 让它静默失明，与本仓既有纪律相反）；
 *   · esbuild 现打包源码 + 假 server 捕获 handler —— 与 `scripts/lib/front-door.mjs`
 *     同一条路，入参仍用工具自己的 zod shape 解析（与客户端同一道校验）。
 *
 * 入参解析**必须**走 `z.object(shape).parse()`：客户端是这么做的，跳过它就会记录出
 * 一份「客户端不可能发出去」的调用（例如省略必填项、类型不对），页面上的证据就是假的。
 *
 * 刻意只注册工作流用到的 9 个工具（前门档公开面），不注册 legacy 三个；且**按
 * `front-door` 档注册** —— 那是面向宿主的公开工具面，工具描述里的「下一步」也按该档
 * 换指代（legacy 工具不注册时，指向它们就是 dead-end 指针）。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const TOOL_MODULES = [
  ['detect_project_target', 'detect-project-target.ts', 'registerDetectProjectTarget'],
  ['generate_crud', 'generate-crud.ts', 'registerGenerateCrud'],
  ['validate_config', 'validate-config.ts', 'registerValidateConfig'],
  ['refine_config', 'refine-config.ts', 'registerRefineConfig'],
  ['scaffold_page', 'scaffold-page.ts', 'registerScaffoldPage'],
  ['doctor_page', 'doctor-page.ts', 'registerDoctorPage'],
  ['ingest_schema', 'ingest-schema.ts', 'registerIngestSchema'],
  ['list_form_types', 'list-form-types.ts', 'registerListFormTypes'],
  ['get_component_api', 'get-component-api.ts', 'registerGetComponentApi'],
  // 片段三件套：与 generate_crud 同一份字段词表，产物是独立 SFC / composable。
  ['generate_form', 'generate-form.ts', 'registerGenerateForm'],
  ['generate_table', 'generate-table.ts', 'registerGenerateTable'],
  ['generate_dialog', 'generate-dialog.ts', 'registerGenerateDialog'],
]

/**
 * 工作流页承诺覆盖的工具集 = **前门公开面全部 12 个**（断言用；缺失/多余都该红）。
 * `generate_crud` 走 surfaces 路径，片段三件套来自各自独立工具 —— 这样「12 个工具全部
 * 至少有一次真调用」是页面上看得见的事实，而不是台账里的断言。
 */
export const WORKFLOW_TOOLS = TOOL_MODULES.map(([name]) => name)

function entrySource() {
  const imports = TOOL_MODULES.map(
    ([, file, fn]) => `import { ${fn} } from '../../packages/mcp-server/src/tools/${file}'`,
  )
  const registers = TOOL_MODULES.map(([, , fn]) => `  ${fn}(fake, 'front-door')`)
  return [
    "import { z } from 'zod'",
    ...imports,
    'function collect() {',
    '  const tools = {}',
    '  const fake = { tool: (name, desc, shape, handler) => { tools[name] = { desc, shape, handler } } }',
    ...registers,
    '  return tools',
    '}',
    'export function registeredNames() { return Object.keys(collect()).sort() }',
    '/**',
    ' * 调一个真 handler。入参先按工具自己的 shape 解析（与客户端同一道校验）。',
    ' * 返回 `{ ok, text }`：`ok` 取工具的 `isError`，`text` 是**逐字节**的返回文本。',
    ' */',
    'export async function callTool(name, args) {',
    '  const tools = collect()',
    '  const t = tools[name]',
    '  if (!t) throw new Error(`unknown tool: ${name} (have: ${Object.keys(tools).join(", ")})`)',
    '  const parsed = z.object(t.shape ?? {}).parse(args ?? {})',
    '  const res = await t.handler(parsed)',
    '  return { ok: !res.isError, text: res.content.map((c) => c.text).join("\\n") }',
    '}',
  ].join('\n')
}

/**
 * 打包工具集并返回调用器。调用方**必须**在 finally 里 `cleanup()`（临时目录落在
 * 仓库 node_modules/ 下 —— ESM 说明符要相对解析，放系统临时目录会找不到 esbuild）。
 */
export async function createToolCaller() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-mcp-tools-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(entry, entrySource(), 'utf8')
    const outfile = join(tmp, 'tools.mjs')
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      outfile,
      platform: 'node',
      logLevel: 'silent',
      metafile: true,
      // 与 front-door 同一理由：打 shared/src，避免陈旧 build 让守卫失明。
      alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
      },
    })
    const inputs = Object.keys(result.metafile.inputs)
    const fromBuild = inputs.filter((p) => /shared[\\/]build[\\/]/.test(p))
    const fromSrc = inputs.filter((p) => /shared[\\/]src[\\/]/.test(p))
    const mod = await import(pathToFileURL(outfile).href)
    return {
      call: mod.callTool,
      names: mod.registeredNames(),
      fromBuild,
      fromSrc,
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    }
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}
