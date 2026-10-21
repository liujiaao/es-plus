#!/usr/bin/env node
/**
 * AN-21：前门旋钮形状 ↔ shared 权威 Zod **逐键对账**。
 *
 * ## 为什么需要它
 *
 * `generate_crud`（前门）用 zod 3，`StructuredCrudConfigSchema`（shared 权威）用 zod 4，
 * 两代 ZodObject 不能互相复用，只能镜像。镜像一旦漏键，症状是**静默 strip**：
 * 解析成功、无告警，而传进来的旋钮在生成物里凭空消失（`tableOptions.heightType` /
 * `tableBtns.position` 都真出过这个 bug）。类型检查看不出来（`z.any()` 什么都接受），
 * 只有逐键对账能看出来。
 *
 * ## 怎么对账
 *
 * `scripts/lib/front-door.mjs` 把前门源码现打包成 ESM，同时导出：
 *   · `capture()` → 真 `crudShape`（zod 3）
 *   · `StructuredCrudConfigSchema`（zod 4，经 `@es-plus/shared` 别名进 shared/src）
 *   · `z`（root zod 3）
 * 于是**同一个进程里**两代 Zod 各用各的 API 读取，不跨版本复用对象。
 *
 * 比较的是「键树」而不是键集：`expandConfig.fields[].prop` 这类嵌套键也必须对上，
 * 否则外层形状再完整，内层仍会被 strip。值类型 / describe / default **不比较** ——
 * 前门有意不写 `.default()`（见 `_front-door-knobs.ts` 头注）。
 *
 * 另外两条验收（AN-21）：
 *   1. 未知旋钮/未知子键 → `.strict()` 在工具层报错，而不是静默 strip；
 *   2. 旋钮不能退回 `z.any()` / 裸 `z.record(...)`（那正是本项要消灭的形态）。
 */
import { captureFrontDoor } from './lib/front-door.mjs'

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

/** 前端旋钮 → shared 顶层键（同名，集中列在这里以便报错信息可读）。 */
const KNOBS = [
  'tableOptions',
  'formLayout',
  'operationColumn',
  'tableBtns',
  'toolbarBtns',
  'expandConfig',
  'treeConfig',
  'mergeConfig',
]

/** 未知键必须失败的探针（旋钮层 + 嵌套层各一条）。 */
const UNKNOWN_KEY_PROBES = [
  ['tableOptions', { bogusKnob: 1 }],
  ['tableOptions', { editConfig: { bogusNested: 1 } }],
  ['formLayout', { span: 12 }],
  ['operationColumn', { bogusKnob: 1 }],
  ['expandConfig', { bogusKnob: 1 }],
  ['treeConfig', { bogusKnob: 1 }],
  ['mergeConfig', { bogusKnob: 1 }],
]

/** 合法最小值：确认收紧后没有误杀正常形状。 */
const VALID_PROBES = [
  ['tableOptions', { border: true, engine: 'vxe', editConfig: { mode: 'cell' } }],
  ['formLayout', { labelWidth: 100, minFoldRows: 2 }],
  ['operationColumn', false],
  ['operationColumn', { label: '操作', btns: [{ name: '删除' }] }],
  ['expandConfig', { title: '详情', fields: [{ prop: 'id', label: 'ID' }] }],
  ['treeConfig', { childrenField: 'kids', expandAll: true }],
  ['mergeConfig', { rowsBy: ['dept'] }],
]

/** zod3 / zod4 共用的包装层解包（只走公开/稳定的 `_def` 与 `.unwrap()`）。 */
function unwrap(schema) {
  let t = schema
  for (let i = 0; i < 20 && t; i++) {
    const d = t._def ?? {}
    const kind = d.typeName ?? d.type
    if (
      kind === 'ZodOptional' ||
      kind === 'ZodNullable' ||
      kind === 'ZodDefault' ||
      kind === 'ZodPrefault' ||
      kind === 'optional' ||
      kind === 'nullable' ||
      kind === 'default' ||
      kind === 'prefault'
    ) {
      if (typeof t.unwrap === 'function') {
        t = t.unwrap()
        continue
      }
      if (d.innerType) {
        t = d.innerType
        continue
      }
    }
    // zod3 的 superRefine/transform → ZodEffects；zod4 的 transform → ZodPipe。
    if (kind === 'ZodEffects' || kind === 'effects') {
      if (d.schema) {
        t = d.schema
        continue
      }
    }
    if (kind === 'pipe') {
      t = d.in
      continue
    }
    break
  }
  return t
}

function kindOf(schema) {
  const d = schema?._def ?? {}
  const k = d.typeName ?? d.type ?? ''
  return k.replace(/^Zod/, '').toLowerCase()
}

function shapeOf(schema) {
  const s = schema?.shape
  if (s && typeof s === 'object') return s
  if (typeof schema?.shape === 'function') return schema.shape()
  return null
}

function elementOf(schema) {
  return schema?.element ?? schema?._def?.element ?? schema?._def?.type
}

function optionsOf(schema) {
  return schema?.options ?? schema?._def?.options ?? null
}

/**
 * 键树：object → `{ key: 子树 }`；array → 元素键树；union → 各分支合并；
 * 标量 / record（无固定键）→ `null`。
 */
function keyTree(schema) {
  const t = unwrap(schema)
  if (!t) return null
  const kind = kindOf(t)
  if (kind === 'object' || kind === 'strictobject') {
    const shape = shapeOf(t)
    if (!shape) return null
    const out = {}
    for (const k of Object.keys(shape).sort()) out[k] = keyTree(shape[k])
    return out
  }
  if (kind === 'array') return keyTree(elementOf(t))
  if (kind === 'union') {
    const opts = optionsOf(t) ?? []
    const trees = opts.map(keyTree).filter((x) => x && Object.keys(x).length > 0)
    if (trees.length === 0) return null
    return Object.assign({}, ...trees)
  }
  return null
}

function sortTree(tree) {
  if (tree === null || typeof tree !== 'object') return tree
  return Object.fromEntries(Object.keys(tree).sort().map((k) => [k, sortTree(tree[k])]))
}

function diffTrees(a, b, path = '') {
  const out = []
  const ak = a && typeof a === 'object' ? Object.keys(a) : []
  const bk = b && typeof b === 'object' ? Object.keys(b) : []
  for (const k of ak) if (!(k in (b ?? {}))) out.push(`${path}${k}（前门有、shared 无）`)
  for (const k of bk) if (!(k in (a ?? {}))) out.push(`${path}${k}（shared 有、前门无）`)
  for (const k of ak) {
    if (k in (b ?? {}) && a[k] !== null && b[k] !== null) {
      out.push(...diffTrees(a[k], b[k], `${path}${k}.`))
    }
  }
  return out
}

const SHARED = {
  tableOptions: (s) => s.shape.tableOptions,
  formLayout: (s) => s.shape.formLayout,
  operationColumn: (s) => s.shape.operationColumn,
  tableBtns: (s) => s.shape.tableBtns,
  toolbarBtns: (s) => s.shape.toolbarBtns,
  expandConfig: (s) => s.shape.expandConfig,
  treeConfig: (s) => s.shape.treeConfig,
  mergeConfig: (s) => s.shape.mergeConfig,
}

const { mod, cleanup } = await captureFrontDoor()
try {
  const { cap } = mod.capture()
  const frontShape = cap.shape

  // 1) 逐键对账
  for (const knob of KNOBS) {
    const front = frontShape[knob]
    if (!front) {
      fail(`前门 crudShape 缺旋钮 ${knob}`)
      continue
    }
    const ft = sortTree(keyTree(front))
    const st = sortTree(keyTree(SHARED[knob](mod.StructuredCrudConfigSchema)))
    if (!ft) {
      fail(`前门 ${knob} 没有可比较的键树（退回了 z.any()/裸 record？）—— AN-21 要求显式形状`)
      continue
    }
    if (!st) {
      fail(`shared ${knob} 读取不到键树（读取器需随 zod 4 API 更新）`)
      continue
    }
    const diffs = diffTrees(ft, st, `${knob}.`)
    for (const d of diffs) fail(`旋钮键不一致：${d}`)
  }

  // 2) 形态：不得退回 z.any() / 裸 z.record(...)
  for (const knob of KNOBS) {
    const t = unwrap(frontShape[knob])
    const kind = kindOf(t)
    if (kind === 'any' || kind === 'unknown') {
      fail(`前门 ${knob} 仍是 z.${kind}() —— 必须显式形状`)
    } else if (kind === 'record') {
      fail(`前门 ${knob} 是裸 z.record(...) —— 未知键会被静默放行，必须显式形状`)
    }
  }

  // 3) 未知键必须报错（工具层，而不是静默 strip）
  for (const [knob, value] of UNKNOWN_KEY_PROBES) {
    const schema = mod.z.object({ [knob]: frontShape[knob] })
    if (schema.safeParse({ [knob]: value }).success) {
      fail(`未知键未报错：${knob} = ${JSON.stringify(value)}（应被 .strict() 拒绝）`)
    }
  }

  // 4) 合法最小值不得误杀
  for (const [knob, value] of VALID_PROBES) {
    const schema = mod.z.object({ [knob]: frontShape[knob] })
    const r = schema.safeParse({ [knob]: value })
    if (!r.success) {
      fail(`合法值被拒：${knob} = ${JSON.stringify(value)} —— ${r.error.issues.map((i) => i.message).join('; ')}`)
    }
  }

  // 5) 别名归一化（tableBtns 的 label/action → name/actionType）在工具层必须生效
  const btnParse = mod.z
    .object({ tableBtns: frontShape.tableBtns })
    .safeParse({ tableBtns: [{ label: '导出', action: 'export', position: 'right' }] })
  if (!btnParse.success) {
    fail('tableBtns 的 { label, action } 别名形状被拒 —— 前门必须接受旧示例形状并归一化')
  } else {
    const btn = btnParse.data.tableBtns[0]
    if (btn.name !== '导出' || btn.actionType !== 'export' || btn.code !== 2) {
      fail(
        `tableBtns 别名未归一化：得到 ${JSON.stringify(btn)}，期望 name=导出 / actionType=export / code=2`
      )
    }
    if ('label' in btn || 'action' in btn) {
      fail(`tableBtns 别名键未删除：${JSON.stringify(btn)}（下游不应同时看到两套键）`)
    }
  }

  if (failures.length > 0) {
    console.error(`\n工具旋钮形状检查失败：${failures.length} 处`)
    process.exitCode = 1
  } else {
    console.log(`✅ 前门 ${KNOBS.length} 颗旋钮与 shared 权威 Zod 逐键一致（含嵌套键）`)
    console.log(`✅ 未知旋钮/子键在工具层报错（${UNKNOWN_KEY_PROBES.length} 条探针）`)
    console.log(`✅ 无 z.any() / 裸 z.record() 回退；tableBtns 别名归一化生效`)
  }
} finally {
  cleanup()
}
