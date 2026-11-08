#!/usr/bin/env node
/**
 * 能力矩阵「人证」守卫：`CAPABILITIES` 的每一格都必须指向一段可失效的证据。
 *
 * ## 守什么
 *
 * `packages/shared/src/capability.ts` 的每格都是一条对外主张。修前只有散文 `note`：
 * 写得出来、没人核对、漂了也看不出来 —— `antdv + tableOptions.virtual = full` 就是
 * 这么留下的（a-table 从来没有虚拟滚动）。本守卫把主张接上锚点：
 *
 *   A. **覆盖**：`full` 格必须有 spec 或 source 人证；`none` 格必须有 **source** 人证
 *      （证明运行时确实降级 / 明确不绑定，而不是只写了句告警文案）；
 *      `partial` 不强制（它本来就是「部分生效」的弱主张）。
 *   B. **有效性**：人证文件存在、正则可编译、正则在文件里真的命中。
 *      spec 人证必须是 `*.spec.ts`；source 人证必须在 `src/` 下 —— 两类不混用。
 *   C. **无孤儿**：登记表里的 key/target 必须存在于矩阵；不能给 partial 格登记人证。
 *
 * ## 非空证明（每次跑都验）
 *
 *   P1 删掉一格的 full 人证            → A 必须红
 *   P2 把命中文件读成空串              → B（pattern 未命中）必须红
 *   P3 指向不存在的文件                → B（文件不存在）必须红
 *   P4 登记矩阵里没有的 key/target     → C 必须红
 *   P5 给 partial 格登记人证           → C 必须红
 *
 * 退出码：0 = 全绿且五种注入各自变红；1 = 有缺口 / 守卫失效。
 *
 * 用法：node scripts/check-capability-witnesses.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { WITNESSES } from './capability-witnesses.data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CAPABILITY_SRC = join(ROOT, 'packages/shared/src/capability.ts')

const realReadSource = (rel) => readFileSync(join(ROOT, rel), 'utf-8')
/** 真实磁盘存在性（注入时也用它：P3 的「文件不存在」才测得出来）。 */
const realFileExists = (rel) => {
  try {
    readFileSync(join(ROOT, rel))
    return true
  } catch {
    return false
  }
}

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

const tempDirs = []
function cleanup() {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true })
  tempDirs.length = 0
}

/** 从 TS 源码打包出 `CAPABILITIES`（不复制实现）。 */
async function loadCapabilities() {
  const cacheRoot = join(ROOT, 'node_modules/.cache')
  mkdirSync(cacheRoot, { recursive: true })
  const outDir = mkdtempSync(join(cacheRoot, 'es-capability-witnesses-'))
  tempDirs.push(outDir)
  const outfile = join(outDir, 'capability.mjs')
  await build({
    stdin: {
      contents: `export { CAPABILITIES } from ${JSON.stringify(CAPABILITY_SRC)}`,
      resolveDir: ROOT,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
  })
  return (await import(pathToFileURL(outfile).href)).CAPABILITIES
}

const LEVELS = new Set(['full', 'partial', 'none'])

/**
 * 核心判据。正向与注入共用；返回失败描述数组（空 = 全绿）。
 *
 * @param {object} args
 * @param {ReadonlyArray<{key:string,targets:Record<string,{level:string}>}>} args.capabilities
 * @param {ReadonlyArray<object>} args.witnesses
 * @param {(rel:string)=>string} args.readSource 命中文件的内容（注入时可伪造）
 * @param {(rel:string)=>boolean} args.fileExists
 */
export function checkSuite({ capabilities, witnesses, readSource, fileExists }) {
  const problems = []
  const cells = new Map()
  for (const entry of capabilities) {
    for (const [target, cell] of Object.entries(entry.targets || {})) {
      const level = cell?.level
      if (!LEVELS.has(level)) continue
      cells.set(`${entry.key}::${target}`, level)
    }
  }

  const seen = new Set()
  for (const w of witnesses) {
    const id = `${w.key}::${w.target}`
    const where = `${w.key}/${w.target}/${w.kind}/${w.file}`

    // ── C. 孤儿 / 层级 ──
    const level = cells.get(id)
    if (level === undefined) {
      problems.push(`C1 ${where}：矩阵里没有这个 key/target —— 人证不能凭空存在`)
      continue
    }
    if (level === 'partial') {
      problems.push(`C2 ${where}：partial 格不登记人证（弱主张无需证明，登记会制造维护负担）`)
      continue
    }
    if (w.kind !== 'spec' && w.kind !== 'source') {
      problems.push(`C3 ${where}：kind 必须是 spec 或 source，实得 ${String(w.kind)}`)
      continue
    }
    if (level === 'none' && w.kind !== 'source') {
      problems.push(`C4 ${where}：none 格必须用 source 人证（spec 证明「支持」，证明不了「不支持」）`)
      continue
    }
    if (w.kind === 'spec' && !/\.spec\.[cm]?tsx?$/.test(w.file)) {
      problems.push(`C5 ${where}：spec 人证必须指向 *.spec.ts`)
      continue
    }
    if (w.kind === 'source' && !/\/src\//.test(w.file)) {
      problems.push(`C6 ${where}：source 人证必须指向 src/ 下的实现`)
      continue
    }
    if (!w.pattern || typeof w.pattern !== 'string') {
      problems.push(`C7 ${where}：缺 pattern（正则源码）`)
      continue
    }

    const dup = `${id}::${w.kind}::${w.file}::${w.pattern}`
    if (seen.has(dup)) problems.push(`C8 ${where}：重复登记（同一锚点写了两遍）`)
    seen.add(dup)

    // ── B. 有效性 ──
    if (!fileExists(w.file)) {
      problems.push(`B1 ${where}：文件不存在（${w.file}）—— 路径漂移，无法证明该格`)
      continue
    }
    let re
    try {
      re = new RegExp(w.pattern)
    } catch (err) {
      problems.push(`B2 ${where}：pattern 不是合法正则（${err?.message ?? err}）`)
      continue
    }
    let content
    try {
      content = readSource(w.file)
    } catch (err) {
      problems.push(`B3 ${where}：读取失败（${err?.message ?? err}）`)
      continue
    }
    if (!re.test(content)) {
      problems.push(
        `B4 ${where}：锚点未命中 /${w.pattern}/ —— 代码已改写，请重新核对这条主张后更新人证`,
      )
    }
  }

  // ── A. 覆盖：full / none 每一格都要有人证 ──
  const covered = new Set()
  for (const w of witnesses) {
    const level = cells.get(`${w.key}::${w.target}`)
    if (level === 'full' || level === 'none') covered.add(`${w.key}::${w.target}`)
  }
  for (const [id, level] of cells) {
    if (level === 'partial') continue
    if (covered.has(id)) continue
    const [key, target] = id.split('::')
    problems.push(
      `A1 ${key}/${target}（${level}）没有任何人证 —— ${level} 是对外主张，必须指向 spec 或 source`,
    )
  }

  return problems
}

function main() {
  return (async () => {
    const capabilities = await loadCapabilities()

    const run = (witnesses, overrides = {}) =>
      checkSuite({
        capabilities,
        witnesses,
        readSource: overrides.readSource ?? realReadSource,
        fileExists: overrides.fileExists ?? realFileExists,
      })

    // ── 正跑 ──
    const problems = run(WITNESSES)
    if (problems.length) for (const p of problems) fail(p)
    else {
      const total = capabilities.length * 3
      console.log(
        `✅ 能力矩阵人证通过（${total} 格中 ${WITNESSES.length} 条锚点；full/none 全覆盖，锚点全部命中）`,
      )
    }

    // ── 非空证明：每种注入都必须让对应判据变红 ──
    const injections = [
      {
        name: 'P1 删掉 tableOptions.multiSelect/vue3 的 full 人证',
        expect: /A1 tableOptions\.multiSelect\/vue3/,
        witnesses: WITNESSES.filter(
          (w) => !(w.key === 'tableOptions.multiSelect' && w.target === 'vue3'),
        ),
      },
      {
        name: 'P2 把被证明文件读成空串（代码消失）',
        expect: /B4 tableOptions\.multiSelect\/vue3/,
        witnesses: WITNESSES,
        overrides: {
          readSource: (rel) =>
            rel === 'packages/vue3/__tests__/es-table.spec.ts' ? '' : realReadSource(rel),
        },
      },
      {
        name: 'P3 指向不存在的文件',
        expect: /B1 tableOptions\.multiSelect\/vue3/,
        witnesses: WITNESSES.map((w) =>
          w.key === 'tableOptions.multiSelect' && w.target === 'vue3'
            ? { ...w, file: 'packages/vue3/__tests__/does-not-exist.spec.ts' }
            : w,
        ),
      },
      {
        name: 'P4 登记矩阵里没有的 key',
        expect: /C1 tableOptions\.phantomFlag\/vue3/,
        witnesses: [
          ...WITNESSES,
          {
            key: 'tableOptions.phantomFlag',
            target: 'vue3',
            kind: 'source',
            file: 'packages/vue3/src/index.ts',
            pattern: 'export',
            why: '注入',
          },
        ],
      },
      {
        name: 'P5 给 partial 格登记人证',
        expect: /C2 tableOptions\.rowHeight\/vue3/,
        witnesses: [
          ...WITNESSES,
          {
            key: 'tableOptions.rowHeight',
            target: 'vue3',
            kind: 'source',
            file: 'packages/vue3/src/components/es-table/src/engines/virtual-engine.vue',
            pattern: 'row-height',
            why: '注入',
          },
        ],
      },
    ]

    for (const inj of injections) {
      const got = run(inj.witnesses, inj.overrides)
      const hit = got.find((p) => inj.expect.test(p))
      if (hit) console.log(`✅ 非空证明 ${inj.name} → 判据变红`)
      else
        fail(
          `非空证明失效：${inj.name} 之后没有命中 ${inj.expect}（实得：${got.length ? got.slice(0, 3).join(' | ') : '（空）'}）`,
        )
    }

    // P1 的 fileExists 走真实磁盘：注入里换文件后必须由 B1 而不是 B4 先命中。
    cleanup()
    if (failed) process.exit(1)
    console.log('✅ 能力矩阵人证守卫（含 5 条非空证明）全绿')
  })()
}

main().catch((err) => {
  cleanup()
  console.error(`❌ 守卫自身异常：${err?.stack ?? err}`)
  process.exit(1)
})
