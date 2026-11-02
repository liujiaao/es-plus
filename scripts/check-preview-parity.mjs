#!/usr/bin/env node
/**
 * check:preview-parity —— 「预览展示的必须是生成物本身」的行为守卫。
 *
 * 背景：站点预览曾经有两套手写字段白名单（AI 路径一套、离线路径一套），都只挑
 * prop/label/width/align —— 于是配置里的 dialogs、toolbarBtns、tableOptions.virtual、
 * editRender、expandConfig 在预览里全部消失，而「生成代码」里明明有。当时没有任何
 * 守卫覆盖这条链路：生成器有 golden，预览没有。
 *
 * 本守卫**不读源码文本猜实现**，而是直接把站点用的 `mcpFlow` 打包进 node 跑一遍：
 *   - 离线路径：预览 payload 必须与 `generateCrudSchema` 的 schema 逐值相同；
 *   - AI 路径：配置里的 virtual / dialogs / actions 必须出现在预览 payload 里；
 *   - 片段路径：必须返回 fragment 载荷与片段工具产物，而不是被塞进整页预览。
 * 另加三条静态规则，防止有人再把「字段白名单」加回来。
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

const fail = (msg) => failures.push(msg)

// 打到磁盘再 import（data: URL 在 6MB 级 bundle 上会让 node 把整个 URL 抛进错误信息）。
const OUT_DIR = path.join(ROOT, '.tmp-guard')
fs.mkdirSync(OUT_DIR, { recursive: true })

async function bundle(entry, alias, name, external = []) {
  const outfile = path.join(OUT_DIR, `${name}.mjs`)
  await build({
    entryPoints: [path.join(ROOT, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    alias,
    external,
  })
  return import(`file://${outfile.replace(/\\/g, '/')}?t=${Date.now()}`)
}

// 站点侧：`@es-plus/shared` 的浏览器门面（vite alias 指向它）。
// 用门面而不是 shared/index，顺带证明「站点要用的东西门面都导出得出来」。
// `esbuild` 也要跟着换成站点用的浏览器近似闸（vite.config 里同一条 alias），
// 否则会把 Node 原生包一起打进 bundle。
const site = await bundle(
  'es-plus-docs/src/utils/mcp-flow.ts',
  {
    '@es-plus/shared': path.join(ROOT, 'es-plus-docs/src/utils/shared-browser.ts'),
    esbuild: path.join(ROOT, 'es-plus-docs/src/utils/esbuild-browser-shim.ts'),
  },
  'site'
)
// 基准侧：直接打包 shared 源码（不读 build/，避免陈旧产物掩盖差异）。
// esbuild 保持外置 —— 这侧要的是 MCP/CLI 消费者看到的真生成器。
const shared = await bundle('packages/shared/src/index.ts', {}, 'shared', ['esbuild'])

const noop = () => {}
const NL =
  '商品列表，10 万行数据，启用虚拟滚动。查询条件：商品名（模糊）、分类、价格区间。列：商品名、分类、价格、库存、上架状态。支持批量上下架。'

// ── 1. 离线路径：预览 payload === 生成物 ─────────────────────────────────
{
  const expected = shared.generateCrudSchema(NL, 'vue3')
  const res = await site.mcpFlow(NL, [], { onTrace: noop, target: 'vue3' })

  if (res.kind !== 'crud') fail(`离线路径 kind=${res.kind}，应为 crud`)
  if (res.engine !== 'rule') fail(`离线路径 engine=${res.engine}，应为 rule`)
  if (!res.previewSchema) fail('离线路径没有 previewSchema —— 预览拿不到生成物')
  else if (JSON.stringify(res.previewSchema) !== JSON.stringify(expected.schema)) {
    fail('离线路径 previewSchema 与 generateCrudSchema().schema 不一致（预览被二次裁剪）')
  }
  if (res.previewSchema?.tableOptions?.virtual !== true) {
    fail('离线预览丢了 tableOptions.virtual（虚拟滚动是产物里的能力）')
  }
  if (JSON.stringify(res.featureHints) !== JSON.stringify(expected.featureHints ?? [])) {
    fail('离线路径 featureHints 与生成器不一致')
  }
  if (!res.warnings?.some((w) => w.includes('render'))) {
    fail('离线路径丢掉了 render 剥离告警（生成器给了，预览侧没说）')
  }
  if (res.code !== expected.wrapperCode) fail('离线路径 code 与 wrapperCode 不一致')
}

// ── 2. AI 路径：配置里的能力必须出现在预览 payload 里 ──────────────────
const AI_CONFIG = {
  name: 'product',
  apiUrl: '/api/product',
  fields: [
    { prop: 'name', label: '商品名', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select' },
  ],
  actions: ['add', 'edit', 'delete'],
  dialogs: { add: { title: '新增商品', formItems: [] } },
  tableOptions: { virtual: true, multiSelect: true, rowkey: 'id' },
}

const realFetch = globalThis.fetch
async function runAi(canned) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(canned) } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  try {
    return await site.mcpFlow('随便描述', [], {
      ai: { apiKey: 'sk-test', baseUrl: 'https://fake.local/v1', model: 'x' },
      onTrace: noop,
      target: 'vue3',
    })
  } finally {
    globalThis.fetch = realFetch
  }
}

{
  const res = await runAi(AI_CONFIG)
  if (res.engine !== 'ai') fail(`AI 路径 engine=${res.engine}，应为 ai`)
  if (res.kind !== 'crud') fail(`AI 路径 kind=${res.kind}，应为 crud`)
  const schema = res.previewSchema
  if (!schema) fail('AI 路径没有 previewSchema')
  else {
    if (schema.tableOptions?.virtual !== true) fail('AI 预览丢了 tableOptions.virtual')
    if (schema.tableOptions?.multiSelect !== true) fail('AI 预览丢了 tableOptions.multiSelect')
    if (!schema.dialogs || !schema.dialogs.add) fail('AI 预览丢了 dialogs（弹窗在产物里存在）')
    if (!(schema.actions ?? []).includes('add')) fail('AI 预览丢了 actions')
  }
  // featureHints 必须来自 shared 的配置判据（virtual → 一条提示）
  if (!res.featureHints?.some((h) => h.includes('虚拟滚动'))) {
    fail('AI 路径 featureHints 未点名 virtual（shared 的判据说该报）')
  }
}

// ── 3. 片段路径：不能被塞进整页预览 ─────────────────────────────────────
{
  const res = await runAi({
    tool: 'generate_table',
    args: {
      fields: [
        { prop: 'orderNo', label: '订单号' },
        { prop: 'status', label: '状态', formtype: 'Select' },
      ],
    },
  })
  if (res.kind !== 'fragment') fail(`片段信封 kind=${res.kind}，应为 fragment`)
  if (res.fragment?.kind !== 'table') fail(`片段 kind=${res.fragment?.kind}，应为 table`)
  if (!res.fragment?.code?.includes('<es-table')) fail('片段产物不是 es-table SFC')
  if (res.previewSchema) fail('片段路径不应再返回 previewSchema（互斥）')
  if (res.engine !== 'ai') fail(`片段路径 engine=${res.engine}，应为 ai`)
}

// ── 4. 静态规则：禁止把「字段白名单」加回来 ─────────────────────────────
const mcpFlowSrc = fs.readFileSync(path.join(ROOT, 'es-plus-docs/src/utils/mcp-flow.ts'), 'utf8')
if (/\[\s*['"]prop['"]\s*,\s*['"]label['"]/.test(mcpFlowSrc)) {
  fail("mcp-flow.ts 出现 ['prop','label',…] 式字段白名单 —— 预览必须渲染生成物，不能挑字段")
}

const aiCrudSrc = fs.readFileSync(path.join(ROOT, 'es-plus-docs/src/views/AiCrud.vue'), 'utf8')
if (!aiCrudSrc.includes(':schema="previewSchema"')) {
  fail('AiCrud.vue 没有把 previewSchema 交给 es-crud-page')
}
if (/\.map\(\s*\(?\w+\)?\s*=>\s*\(\{\s*prop:/.test(aiCrudSrc)) {
  fail('AiCrud.vue 又出现了浏览器端字段映射（preview 不应二次裁剪产物）')
}

const fragmentSrc = fs.readFileSync(
  path.join(ROOT, 'es-plus-docs/src/components/ai-crud/FragmentPreview.vue'),
  'utf8',
)
for (const fn of ['buildFormItem', 'buildTableColumn']) {
  if (!fragmentSrc.includes(fn)) {
    fail(`FragmentPreview 未使用共享的 ${fn}（片段预览会与产物分叉）`)
  }
}

if (failures.length > 0) {
  console.error(`\n✗ check:preview-parity — ${failures.length} 处「预览 ≠ 生成物」：\n`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error(
    '\n预览只能渲染生成物本身：整页交给 es-crud-page 的 CrudPageSchema，片段交给共享的字段映射。\n'
  )
  process.exit(1)
}

console.log('✓ check:preview-parity — 预览 payload 与生成物逐值一致（离线 / AI / 片段三路）')
