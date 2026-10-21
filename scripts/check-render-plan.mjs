#!/usr/bin/env node
/**
 * RenderPlan 对账（AN-22）
 *
 * `packages/shared/src/render-plan.ts` 是「每个顶层键 × mode → 发射/派生/元数据/降级/缺席」
 * 的单一账本。本守卫保证账本不与现实脱节：
 *
 *   1. **键集**：账本键集 == `StructuredCrudConfigSchema.shape` 的键集。新增顶层键却
 *      没登记 plan → 直接红（编译期 `satisfies` 只约束 shared 的类型，这里约束运行时/Zod）。
 *   2. **快照**：账本内容（每键各 mode 的 disposition + evidence + reason）与
 *      `scripts/render-plan.baseline.json` 逐项一致。改契约必须显式 `--update`，
 *      让 diff 在评审里可见，而不是悄悄漂移。
 *   3. **行为**：对每个键构造一份最小合法配置，真跑两个 mode：
 *      - `emit`/`derive` 的键 → 产物里必须出现登记的证据 token（防「登记了但没发射」）；
 *      - `downgrade` 的键 → 告警里必须点名该键（防「静默丢弃」）；
 *      - 不声明该键 → `absent`（`always` 键除外）。
 *      另加一条 AN-06 类缺陷探针：`operationColumn:false` 在 sfc 模式必须真的抑制操作列。
 *
 * 用法：
 *   node scripts/check-render-plan.mjs            # 校验
 *   node scripts/check-render-plan.mjs --update   # 重写快照（评审时单独提交）
 * 退出码：0 = 一致；1 = 有漂移/漏发射/静默丢弃。
 */
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASELINE = join(__dirname, 'render-plan.baseline.json')
const UPDATE = process.argv.includes('--update')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** 各键的最小声明（base 里已有 name/apiUrl/fields/actions）。 */
const KEY_PROBES = {
  name: {},
  apiUrl: {},
  fields: {},
  actions: {},
  tableOptions: { tableOptions: { stripe: true } },
  pagination: { pagination: { pageSize: 20 } },
  mode: {},
  target: {},
  typescript: { typescript: true },
  permissions: { permissions: { add: 'p:add' } },
  i18n: { i18n: true },
  formLayout: { formLayout: { labelWidth: '100px' } },
  toolbarBtns: { toolbarBtns: [{ name: '导入', actionType: 'import', position: 'left' }] },
  tableBtns: { tableBtns: [{ name: '导出', actionType: 'export' }] },
  operationColumn: {
    operationColumn: { label: '操作', btns: [{ name: '查看', dialogKey: 'view' }] },
  },
  dialogs: { dialogs: { add: { title: '新增' } } },
  columns: { columns: [{ prop: 'name', label: '名称' }] },
  expandConfig: { expandConfig: { title: '详情', fields: [{ prop: 'name', label: '名称' }] } },
  treeConfig: { treeConfig: { childrenField: 'children' } },
  mergeConfig: { mergeConfig: { rowsBy: ['name'] } },
}

const field = (prop) => ({ prop, label: prop, formtype: 'Input' })
const base = (extra = {}) => ({
  name: 'Demo',
  apiUrl: '/api/demo',
  fields: [field('name')],
  actions: ['add', 'edit', 'delete'],
  ...extra,
})

async function loadShared() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'es-render-plan-'))
  const bundle = join(tmpDir, 'shared.mjs')
  await build({
    entryPoints: [join(ROOT, 'packages/shared/src/index.ts')],
    bundle: true,
    format: 'esm',
    outfile: bundle,
    platform: 'node',
    logLevel: 'silent',
    // shared/src 传递性引入 esbuild（CJS），动态 require 需要真 require 兜底。
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })
  return import(pathToFileURL(bundle).href)
}

function snapshotOf(contract) {
  const out = {}
  for (const key of Object.keys(contract).sort()) {
    const r = contract[key]
    out[key] = {
      schema: r.schema,
      sfc: r.sfc,
      ...(r.evidence ? { evidence: { schema: r.evidence.schema, sfc: r.evidence.sfc } } : {}),
      ...(r.reason ? { reason: r.reason } : {}),
    }
  }
  return out
}

async function main() {
  const shared = await loadShared()
  const contract = shared.RENDER_PLAN_CONTRACT
  const schemaShape = shared.StructuredCrudConfigSchema.shape
  if (!contract) fail('shared 未导出 RENDER_PLAN_CONTRACT')
  if (!schemaShape) fail('StructuredCrudConfigSchema 没有 .shape（Zod 形状不可读）')
  if (failed) return finish()

  // 1) 键集
  const planKeys = Object.keys(contract).sort()
  const schemaKeys = Object.keys(schemaShape).sort()
  for (const k of schemaKeys) {
    if (!planKeys.includes(k)) fail(`StructuredCrudConfig 有顶层键 "${k}"，但 RENDER_PLAN_CONTRACT 未登记（新增键必须落账）`)
  }
  for (const k of planKeys) {
    if (!schemaKeys.includes(k)) fail(`RENDER_PLAN_CONTRACT 登记了不存在的顶层键 "${k}"（拼写错误或键已删除）`)
  }

  // 2) 快照
  const snapshot = snapshotOf(contract)
  if (UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(snapshot, null, 2)}\n`)
    console.log(`📝 已重写 ${BASELINE}`)
  } else if (!existsSync(BASELINE)) {
    fail(`缺少快照 ${BASELINE} —— 首次运行请加 --update 生成并提交`)
  } else {
    const expected = JSON.parse(readFileSync(BASELINE, 'utf8'))
    const expKeys = Object.keys(expected).sort()
    for (const k of expKeys) {
      if (!snapshot[k]) {
        fail(`快照里的键 "${k}" 已从账本删除（若确认删除，请 --update）`)
        continue
      }
      const a = JSON.stringify(expected[k])
      const b = JSON.stringify(snapshot[k])
      if (a !== b) fail(`键 "${k}" 的账本与快照不一致\n     快照: ${a}\n     现状: ${b}`)
    }
    for (const k of planKeys) {
      if (!expected[k]) fail(`账本新增键 "${k}" 未进快照（确认后 --update）`)
    }
  }

  // 3) 行为探针
  const modes = ['schema', 'sfc']
  for (const key of planKeys) {
    if (!(key in KEY_PROBES)) {
      fail(`键 "${key}" 缺少行为探针（KEY_PROBES）`)
      continue
    }
    const extra = KEY_PROBES[key]

    // 3a) 未声明 → absent（always 键除外）
    const rule = contract[key]
    if (!rule.always && extra && Object.keys(extra).length) {
      const bare = shared.buildRenderPlan(base(), { mode: 'schema' })
      if (bare.entries[key].disposition !== 'absent') {
        fail(`键 "${key}" 未声明时 disposition=${bare.entries[key].disposition}，应为 absent`)
      }
    }

    for (const mode of modes) {
      const config = base({ ...extra, mode })
      const plan = shared.buildRenderPlan(config, { mode })
      const entry = plan.entries[key]
      const result = shared.generateFromConfig(config)
      const code = result.code
      const warnings = result.warnings.join('\n')

      if (entry.disposition === 'downgrade') {
        // 生成器必须显式点名被降级的键 —— 「登记降级但不告警」= 静默丢弃
        if (!warnings.includes(key)) {
          fail(`键 "${key}" 在 ${mode} 被登记为 downgrade，但告警里没有点它的名\n     告警：${warnings || '(无)'}`)
        }
        continue
      }

      if (entry.disposition === 'emit' || entry.disposition === 'derive') {
        if (entry.evidence && !code.includes(entry.evidence)) {
          fail(`键 "${key}" 在 ${mode} 应是 ${entry.disposition}，但产物里找不到证据 token "${entry.evidence}"`)
        }
      }
    }
  }

  // 4) AN-06 类缺陷探针：同一份 config 换 mode 不得静默多/少一整列
  //
  // schema 模式的默认操作列由运行时按 `/actions` 派生（pageSchema 里没有该列），
  // 所以只能断言 `operationColumn:false` 被**显式发射**为 `false`（抑制信号），
  // 否则宿主无从知道「不要派生」。sfc 模式由生成器派生操作列，两态都必须可区分。
  {
    const schemaOff = shared.generateFromConfig(base({ mode: 'schema', operationColumn: false }))
    if (!schemaOff.code.includes('"operationColumn": false')) {
      fail('schema + operationColumn:false 未把 `"operationColumn": false` 发射进 pageSchema —— 运行时仍会派生操作列')
    }

    const sfcOn = shared.generateFromConfig(base({ mode: 'sfc' }))
    const sfcOff = shared.generateFromConfig(base({ mode: 'sfc', operationColumn: false }))
    if (!sfcOn.code.includes("prop: 'operate'")) {
      fail('sfc 模式未声明 operationColumn 时应派生默认操作列（未找到 operate 列）')
    }
    if (sfcOff.code.includes("prop: 'operate'")) {
      fail('sfc + operationColumn:false 仍在产物里出现操作列 —— 抑制没有生效')
    }
    if (sfcOff.code === sfcOn.code) {
      fail('sfc 模式下 operationColumn:false 与未声明产出一模一样 —— 该键没有生效')
    }
  }

  finish()
}

function finish() {
  if (failed) {
    console.error('\nRenderPlan 与现实脱节（新增键漏登记 / 漏发射 / 静默降级）。')
    process.exit(1)
  }
  console.log('✅ RenderPlan：键集与 StructuredCrudConfig 一致，快照未漂移，emit/derive 有产物证据，downgrade 有告警')
  console.log('   （operationColumn:false 在 sfc 真的抑制操作列）')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
