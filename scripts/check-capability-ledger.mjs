#!/usr/bin/env node
/**
 * P9 —— 能力台账守卫（`es-plus.capabilities@1` vs 源码事实）。
 *
 * ## 为什么需要它
 *
 * 台账是宿主在**生成之前**判断「这个意图键会不会落地」的唯一依据。它一旦与源码
 * 分叉，宿主就会得到一份「看起来很权威、实际错误」的答复 —— 比没有台账更糟。
 * 本守卫把三处必须同源的关系钉死：
 *
 *   1. 四场景的 accepted 键集 == MCP 前门四个 Zod 形状的键集（形状漂移即红）；
 *   2. required 键 == `SCENE_REGISTRY.intent.required`（注册表单一真源）；
 *   3. CRUD 降级表 == `RENDER_PLAN_CONTRACT` 的逐键投影（不复制文案）。
 *
 * 再加两条行为断言：未知键必须判 `unsupported`；无表 CRUD 的 accepted / degraded
 * 必须互斥且并集等于 CRUD 词汇。P10 追加第三组：片段表格的每个新增词汇键都要在
 * 产物里有证据 token（「接受入参却永不注入」是本仓反复出现的失败形态）。
 *
 * 退出码：0 = 台账与源码一致；1 = 有漂移。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ROOT } from './lib/front-door.mjs'

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

const sorted = (xs) => [...xs].sort()

const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-capability-ledger-'))
try {
  const entry = join(tmp, 'entry.ts')
  writeFileSync(
    entry,
    [
      "import { capabilityLedger, assessIntent, CRUD_INTENT_KEYS, SCENE_INTENT_KEYS } from '../../packages/shared/src/scene/capability.ts'",
      "import { SCENE_REGISTRY } from '../../packages/shared/src/scene/registry.ts'",
      "import { RENDER_PLAN_CONTRACT } from '../../packages/shared/src/render-plan.ts'",
      "import { SCENE_INTENT_SCHEMAS } from '../../packages/mcp-server/src/tools/generate-scene.ts'",
      "import { generateTableBlock } from '../../packages/shared/src/fragment-generator.ts'",
      'export { capabilityLedger, assessIntent, CRUD_INTENT_KEYS, SCENE_INTENT_KEYS, SCENE_REGISTRY, RENDER_PLAN_CONTRACT, SCENE_INTENT_SCHEMAS, generateTableBlock }',
    ].join('\n'),
    'utf8',
  )

  const outfile = join(tmp, 'capability-ledger.mjs')
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })

  const mod = await import(pathToFileURL(outfile).href)
  const ledger = mod.capabilityLedger()
  const registry = mod.SCENE_REGISTRY
  const shapes = mod.SCENE_INTENT_SCHEMAS

  // ── 1. 场景集与注册表 ──────────────────────────────────────────────────
  if (ledger.contract !== 'es-plus.capabilities@1') {
    fail(`contract 应为 es-plus.capabilities@1，实际 ${ledger.contract}`)
  }
  const ledgerScenes = ledger.scenes.map((s) => s.scene)
  const registryScenes = registry.map((s) => s.id)
  if (JSON.stringify(ledgerScenes) !== JSON.stringify(registryScenes)) {
    fail(`台账场景 ${ledgerScenes.join('/')} ≠ 注册表 ${registryScenes.join('/')}`)
  }

  for (const row of ledger.scenes) {
    const contract = registry.find((s) => s.id === row.scene)
    if (!contract) continue
    if (JSON.stringify(row.required) !== JSON.stringify(contract.intent.required)) {
      fail(`${row.scene}: required=${JSON.stringify(row.required)}，注册表=${JSON.stringify(contract.intent.required)}`)
    }
    if (JSON.stringify(row.targets) !== JSON.stringify(contract.targets)) {
      fail(`${row.scene}: targets 与注册表不一致`)
    }
    if (JSON.stringify(row.modes) !== JSON.stringify(contract.modes)) {
      fail(`${row.scene}: modes 与注册表不一致`)
    }

    // ── 2. accepted 键 == 前门形状的键 ────────────────────────────────────
    const schema = shapes[row.scene]
    const shapeKeys = schema?.shape ? Object.keys(schema.shape) : []
    if (shapeKeys.length === 0) {
      fail(`${row.scene}: 前门没有可枚举的 Zod 形状（SCENE_INTENT_SCHEMAS.${row.scene}.shape 为空）`)
      continue
    }
    if (JSON.stringify(sorted(row.accepted)) !== JSON.stringify(sorted(shapeKeys))) {
      fail(
        `${row.scene}: accepted=${sorted(row.accepted).join(',')} ≠ 前门形状=${sorted(shapeKeys).join(',')}`,
      )
    }
  }

  // ── 3. CRUD 降级表 == RENDER_PLAN_CONTRACT 投影 ────────────────────────
  const contractKeys = Object.keys(mod.RENDER_PLAN_CONTRACT)
  if (JSON.stringify(ledger.crudKeys.map((k) => k.key)) !== JSON.stringify(contractKeys)) {
    fail('crudKeys 的键序/键集与 RENDER_PLAN_CONTRACT 不一致')
  }
  for (const row of ledger.crudKeys) {
    const rule = mod.RENDER_PLAN_CONTRACT[row.key]
    if (!rule) continue
    if (row.schema !== rule.schema) fail(`crudKeys.${row.key}.schema=${row.schema}，契约=${rule.schema}`)
    if (row.sfc !== rule.sfc) fail(`crudKeys.${row.key}.sfc=${row.sfc}，契约=${rule.sfc}`)
    if (row.reason !== rule.reason) fail(`crudKeys.${row.key}.reason 与契约不一致`)
  }

  // ── 4. 无表分支：互斥 + 并集 == CRUD 词汇 ──────────────────────────────
  const { accepted, degraded } = ledger.crudWithoutTable
  const overlap = accepted.filter((k) => degraded.includes(k))
  if (overlap.length) fail(`crudWithoutTable 的 accepted/degraded 重叠：${overlap.join(',')}`)
  if (JSON.stringify(sorted([...accepted, ...degraded])) !== JSON.stringify(sorted(mod.CRUD_INTENT_KEYS))) {
    fail('crudWithoutTable 的 accepted+degraded 并集 ≠ CRUD_INTENT_KEYS')
  }

  // ── 5. 行为断言 ────────────────────────────────────────────────────────
  const unknown = mod.assessIntent({
    scene: 'table',
    intent: { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], nope: 1 },
  })
  if (unknown.unsupported.length !== 1 || unknown.unsupported[0] !== 'nope') {
    fail(`不可识别的键没有判 unsupported（实际 ${JSON.stringify(unknown.unsupported)}）`)
  }
  const noTable = mod.assessIntent({
    scene: 'crud',
    intent: { name: 'X', apiUrl: '/x', surfaces: { query: [{ prop: 'a', label: 'A', formtype: 'Input' }] }, tableOptions: {} },
  })
  if (!noTable.degraded.includes('tableOptions')) {
    fail('无表 CRUD 的 tableOptions 没有判 degraded')
  }
  const dialogMode = mod.assessIntent({ scene: 'dialog', intent: { fields: [] } })
  if (dialogMode.mode !== 'composable') {
    fail(`dialog 的默认 mode 应为 composable，实际 ${dialogMode.mode}`)
  }

  // ── 6. 片段表格词汇 ↔ 发射证据（P10）────────────────────────────────────
  //
  // accepted 只证明「形状收了这个键」；这一类缺陷的真形态是「收了却永不注入产物」。
  // 词表覆盖**全部** `TABLE_INTENT_KEYS`（不是只点名 P10 新增的 5 个）：每个键都要有
  // 一份能落到产物里的证据 token；新增键若忘了登记，下面第 7 段的集合比对会红。
  const baseFields = [{ prop: 'a', label: 'A', formtype: 'Input' }]
  const TABLE_VOCABULARY = [
    ['fields', {}, "prop: 'a'"],
    ['apiUrl', { apiUrl: '/api/x' }, "apiParams: { url: '/api/x' }"],
    ['target', { target: 'vue2' }, 'export default defineComponent'],
    ['typescript', { typescript: false }, '<script setup>'],
    ['i18n', { i18n: true }, "labelKey: 'field.a'"],
    ['tableOptions', { tableOptions: { border: false } }, 'border: false'],
    ['pagination', { pagination: { pageSize: 25 } }, 'pageSize: 25'],
    ['rowButtons', { rowButtons: [{ name: '查看', key: 'view' }] }, 'row-action'],
    ['columns', { columns: [{ label: 'G', groups: [{ prop: 'b', label: 'B' }] }] }, 'groups: ['],
    ['treeConfig', { treeConfig: { childrenField: 'nodes' } }, 'childrenField'],
    ['expandConfig', { expandConfig: { fields: [{ prop: 'a' }] } }, "type: 'expand'"],
    ['mergeConfig', { mergeConfig: { rowsBy: ['dept'] } }, 'mergeConfig'],
    ['rowkey', { rowkey: 'code' }, "rowkey: 'code'"],
  ]
  const covered = new Set()
  for (const [key, extra, token] of TABLE_VOCABULARY) {
    covered.add(key)
    if (!mod.SCENE_INTENT_KEYS.table.includes(key)) {
      fail(`片段表格词汇缺少 ${key}`)
      continue
    }
    const out = mod.generateTableBlock({ fields: baseFields, ...extra })
    if (!out.code.includes(token)) {
      fail(`片段表格接受 ${key} 但产物里没有证据 token「${token}」—— 接受入参却永不注入`)
    }
  }
  const uncovered = mod.SCENE_INTENT_KEYS.table.filter((k) => !covered.has(k))
  if (uncovered.length) {
    fail(`片段表格词汇没有发射证据覆盖：${uncovered.join(', ')}（新增键必须登记 token）`)
  }
  if (mod.SCENE_INTENT_KEYS.table.includes('tableBtns')) {
    fail('片段表格不应接受 tableBtns（工具栏按钮只在 CRUD 页 schema 的按钮面）')
  }

  // ── 7. 降级替代路径 ↔ RENDER_PLAN_CONTRACT（P9 补记）────────────────────
  //
  // `alternatives` 是「换模式能否保真」的机器可读答案。它必须与契约逐条对齐：
  // 契约说 A 模式 downgrade、B 模式 emit 的键，判定必须带 `mode=B`；反过来，
  // 无表分支缺的是载体而不是模式，不能凭空给模式替代。
  const tableIntent = {
    name: 'X',
    apiUrl: '/x',
    surfaces: { table: [{ prop: 'a', label: 'A', formtype: 'Input' }] },
  }
  const assessWith = (mode, extra) =>
    mod.assessIntent({ scene: 'crud', intent: { ...tableIntent, mode, ...extra } })
  const entryOf = (cap, key) => cap.declared.find((d) => d.key === key)
  const modeAltOf = (cap, key) =>
    (entryOf(cap, key)?.alternatives ?? []).filter((a) => a.kind === 'mode').map((a) => a.value)

  const MODE_DEGRADED = [
    // [mode, intent key, extra intent, 期望替代]
    ['schema', 'permissions', { permissions: { add: 'p:add' } }, 'sfc'],
    ['sfc', 'toolbarBtns', { toolbarBtns: [] }, 'schema'],
    ['sfc', 'tableBtns', { tableBtns: [] }, 'schema'],
    ['sfc', 'operationColumn', { operationColumn: { label: '操作' } }, 'schema'],
    ['sfc', 'surfaces', { surfaces: { ...tableIntent.surfaces, dialog: ['add'] } }, 'schema'],
  ]
  for (const [mode, key, extra, target] of MODE_DEGRADED) {
    const cap = assessWith(mode, extra)
    const entry = entryOf(cap, key)
    if (!entry || entry.verdict !== 'degraded') {
      fail(`${key} 在 ${mode} 下应为 degraded，实际 ${entry?.verdict ?? '未声明'}`)
      continue
    }
    if (!modeAltOf(cap, key).includes(target)) {
      fail(`${key} 在 ${mode} 下降级，但 alternatives=${JSON.stringify(entry.alternatives)}，缺 mode=${target}`)
      continue
    }
    // 替代必须真的保真：换到目标模式后该键应是 accepted。
    const flipped = entryOf(assessWith(target, extra), key)
    if (!flipped || flipped.verdict !== 'accepted') {
      fail(`${key} 的替代 mode=${target} 不保真（实际 ${flipped?.verdict ?? '未声明'}）`)
    }
  }

  // 反向：没有降级的键不得带替代；非 degraded 的判定也不得带。
  for (const [mode, extra] of [['schema', {}], ['sfc', {}]]) {
    for (const entry of assessWith(mode, extra).declared) {
      if (entry.verdict !== 'degraded' && entry.alternatives?.length) {
        fail(`${entry.key}（${mode}）不是 degraded 却带 alternatives`)
      }
    }
  }

  // 无表分支：缺的是载体，不是模式 —— 不得给模式替代。
  const noTableAlt = entryOf(noTable, 'tableOptions')
  if (noTableAlt?.alternatives?.length) {
    fail('无表分支的 tableOptions 不应带模式替代（该键缺的是载体）')
  }

  // 不支持的键不得带替代（替代由前门的 did-you-mean 负责，台账不复制一份）。
  const unsupportedEntry = entryOf(unknown, 'nope')
  if (unsupportedEntry?.alternatives?.length) {
    fail('unsupported 判定不应带 alternatives')
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (failures.length) {
  console.error(`\n✗ check:capability-ledger —— ${failures.length} 处台账与源码不一致`)
  process.exit(1)
}
console.log('✅ check:capability-ledger：场景词汇 / 降级表 / 无表分支 / 片段词汇发射证据与源码一致。')
