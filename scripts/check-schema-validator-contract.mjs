#!/usr/bin/env node
/**
 * schema 校验器的**文件集契约**守卫
 *
 * 背景：`packages/shared/src/schema-validator.ts` 的 `listAvailableSchemas()` 曾经是一张
 * **硬编码**的名字表，与实际 `schemas/*.schema.json` 各写一份 —— 于是两者静默漂移：表里
 * 有目录里没有的名字（调用方按它去校验必然 not found），目录里有表外的名字（拼写正确的
 * 调用反而被判「未找到」）。B4 已把它改成与 `readdirSync` 同源，本守卫就是那次修复的常驻断言。
 *
 * 但「与 readdir 同源」只是其中一条。这个目录里还有两条**互相独立**的漂移通道，没有任何
 * 既有门禁看得见：
 *
 *   1. **`$ref` 悬空**：`index.schema.json` 是各 schema 的 `$ref` 汇总容器，而它**刻意不在**
 *      `listAvailableSchemas()` 里（它只是 definitions，不能施加于配置）。于是某个 schema 文件
 *      被改名/删除时，index 里那条 `$ref` 会静默指向空气 —— 谁都不会报错，直到有人真正去解析它。
 *      本守卫扫描**全部** `.schema.json` 的相对 `$ref`，要求目标文件都存在。
 *   2. **文件存在但读不出来**：`ensureSchemasLoaded` 里 JSON.parse 失败是**静默吞掉**的
 *      （单个坏文件不拖垮校验器，这个取舍本身合理）。代价是「文件列在可用名里、实际加载返回
 *      null」这种半死状态没有声音。本守卫对每个可用名跑一次真校验，要求它既不是 not found、
 *      也不是 could-not-be-applied。
 *
 * 判据全部走**运行时公开 API**（`createSchemaValidator` 返回的 `validateConfig` /
 * `listAvailableSchemas`），不复制实现里的任何判断 —— 复制实现就只能验证「两份代码一样」，
 * 验证不了「行为对」。
 *
 * **非空证明（守在自己身上）**：判据必须能红，且要**每条**都能红。跑完正向检查后用三种
 * 注入各跑一遍同一套判据，任何一种没变红就直接 exit 1：
 *   - 目录里放一个语法坏掉的 `.schema.json`      → 「每个名字都能加载」必须红
 *   - 目录里的 index 指向一个不存在的文件        → 「`$ref` 不悬空」必须红
 *   - 把模块的白名单换成硬编码小表（复原 B4 前） → 「集合同一」必须红
 *
 * 用法：node scripts/check-schema-validator-contract.mjs
 * 退出码：0 = 文件集/加载/引用三者皆自洽且守卫自证有效；1 = 发现漂移或守卫失效。
 */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VALIDATOR_SRC = join(ROOT, 'packages/shared/src/schema-validator.ts')
const SCHEMAS_DIR = join(ROOT, 'packages/shared/schemas')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** 目录里实际存在的 schema 名（与目录同源，不含 index —— 它是 definitions 容器）。 */
function schemaNamesOnDisk(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.schema.json'))
    .filter((f) => f !== 'index.schema.json')
    .map((f) => f.replace('.schema.json', ''))
    .sort()
}

/**
 * 扫出目录里全部**相对** `$ref`（形如 `"$ref": "x.schema.json"`）以及它们的来源文件。
 * 不解析 `#` 开头的内部引用：那是同一份文档内的指针，与文件集无关。
 */
function relativeRefs(dir) {
  const out = []
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.schema.json'))) {
    let raw
    try {
      raw = readFileSync(join(dir, f), 'utf-8')
    } catch {
      continue // 读不到由「每个名字都能加载」那条负责
    }
    for (const m of raw.matchAll(/"\$ref"\s*:\s*"([^"#][^"]*)"/g)) {
      out.push({ from: f, target: m[1] })
    }
  }
  return out
}

/**
 * 对一份 (校验器, 目录) 跑全部判据，返回失败描述数组（空 = 全绿）。
 * 正向与三种注入共用这一个函数 —— 注入必须走**同一套判据**才叫「判据有约束力」。
 */
function checkSuite({ validateConfig, listAvailableSchemas }, dir, where) {
  const problems = []

  // A. 集合同一：API 报的可用名 == 目录里实际的 schema 文件集
  const onDisk = schemaNamesOnDisk(dir)
  const reported = [...listAvailableSchemas()].sort()
  if (reported.join(',') !== onDisk.join(',')) {
    const phantom = reported.filter((n) => !onDisk.includes(n))
    const hidden = onDisk.filter((n) => !reported.includes(n))
    problems.push(
      `${where}：listAvailableSchemas() 与目录文件集不一致` +
        `${phantom.length ? `；表里多出（目录里没有）：${phantom.join(', ')}` : ''}` +
        `${hidden.length ? `；目录里有但表里没有：${hidden.join(', ')}` : ''}` +
        `（硬编码名单会这样与 readdir 漂移）`
    )
  }

  // B. 每个可用名都必须真能加载：既不能 not found，也不能 could-not-be-applied
  for (const name of reported) {
    const r = validateConfig({}, name)
    const internal = r.errors.find((e) => /could not be applied/i.test(e))
    if (internal) {
      problems.push(`${where}："${name}" 列在可用名里却无法施加 —— schema 自身有病（${internal}）`)
      continue
    }
    if (r.errors.some((e) => /not found/i.test(e))) {
      problems.push(
        `${where}："${name}" 列在可用名里，加载却返回 null（文件缺失或 JSON 解析失败）—— ` +
          `ensureSchemasLoaded 的 try/catch 把解析错误吞掉了，只有这里能发声`
      )
    }
  }

  // C. 相对 $ref 不得悬空（index.schema.json 不在可用名里，悬空后无人报错）
  for (const { from, target } of relativeRefs(dir)) {
    if (!readdirSync(dir).includes(target)) {
      problems.push(`${where}：${from} 里的 $ref "${target}" 指向不存在的文件 —— 解析时才炸，此刻无声`)
    }
  }

  // D. 未知名 / 路径穿越必须走同一条「未找到」路径，且错误里列出全部可用名
  const notFound = validateConfig({}, 'definitely-not-a-schema')
  if (!notFound.errors.some((e) => /not found/i.test(e))) {
    problems.push(`${where}：拼错的名字没有被判为 not found（错误：${notFound.errors.join(' | ')}）`)
  }
  const missing = reported.filter((n) => !notFound.errors.join(' ').includes(n))
  if (missing.length) {
    problems.push(`${where}：not found 的错误信息没有列出可用名：${missing.join(', ')}（调用方无法自救）`)
  }
  // 目录之外的**真实存在**的 schema 文件：白名单失效时会被真的读进来当 schema 用。
  // （packages/mcp-server/schemas/ 下有同名副本，经 ../../ 可达 —— 这正是 B4 前的行为。）
  const traversal = validateConfig({}, '../../mcp-server/schemas/table-column')
  if (!traversal.errors.some((e) => /not found/i.test(e))) {
    problems.push(
      `${where}：路径穿越名 '../../mcp-server/schemas/table-column' 没有被白名单挡住 —— ` +
        `loadSchema 读到了 schemas/ 之外的文件并当成 schema 施加（错误：${traversal.errors.join(' | ')}）`
    )
  }

  return problems
}

/** 从 TS 源码直接打包校验器（CI 的 consistency job 不 build，守卫一律运行时 bundling）。 */
async function loadValidator(cripple = null) {
  const tmp = mkdtempSync(join(tmpdir(), 'es-val-'))
  const outfile = join(tmp, 'validator.mjs')
  const plugin = {
    name: 'cripple-white-list',
    setup(b) {
      if (!cripple) return
      b.onLoad({ filter: /schema-validator\.ts$/ }, (args) => ({
        contents: cripple(readFileSync(args.path, 'utf-8')),
        loader: 'ts',
      }))
    },
  }
  await build({
    entryPoints: [VALIDATOR_SRC],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    plugins: [plugin],
  })
  return import(pathToFileURL(outfile).href)
}

/** 建一个只含给定文件的临时 schemas 目录。 */
function tempSchemas(files) {
  const dir = mkdtempSync(join(tmpdir(), 'es-schemas-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  return dir
}

async function main() {
  const mod = await loadValidator()

  // 正向：真实目录 + 真实模块必须全绿
  const real = mod.createSchemaValidator(SCHEMAS_DIR)
  const problems = checkSuite(real, SCHEMAS_DIR, '真实 schemas/')
  for (const p of problems) fail(p)
  if (!problems.length) {
    const names = real.listAvailableSchemas()
    const refs = relativeRefs(SCHEMAS_DIR).length
    console.log(
      `✅ schema 文件集契约一致（${names.length} 个可用 schema：${names.join(', ')}；` +
        `${refs} 条相对 $ref 全部有目标；未知名与路径穿越均走 not found）`
    )
  }

  // ── 非空证明：三种注入，每一种都必须让对应判据变红 ──
  const proofs = []

  // P1 坏掉的 JSON → 「每个名字都能加载」必须红
  {
    const dir = tempSchemas({
      'form-item.schema.json': '{ "type": "object" }',
      'broken.schema.json': '{ "type": "object",, }',
    })
    const v = mod.createSchemaValidator(dir)
    const probs = checkSuite(v, dir, 'P1 临时目录')
    proofs.push(['P1 目录含语法坏掉的 schema → 「每个可用名都能加载」', probs, /加载却返回 null/])
  }

  // P2 index 的 $ref 悬空 → 「$ref 不悬空」必须红
  {
    const dir = tempSchemas({
      'form-item.schema.json': '{ "type": "object" }',
      'index.schema.json': '{ "definitions": { "X": { "$ref": "does-not-exist.schema.json" } } }',
    })
    const v = mod.createSchemaValidator(dir)
    const probs = checkSuite(v, dir, 'P2 临时目录')
    proofs.push(['P2 index 的 $ref 悬空 → 「$ref 不得悬空」', probs, /指向不存在的文件/])
  }

  // P3 白名单换成硬编码小表（复原 B4 前）→ 「集合同一」必须红
  {
    const crippled = await loadValidator((src) => {
      const from = `    availableNames = files
      .filter((f) => f !== "index.schema.json")
      .map((f) => f.replace(".schema.json", ""))`
      const crlf = from.replace(/\n/g, '\r\n')
      const needle = src.includes(from) ? from : src.includes(crlf) ? crlf : null
      if (!needle) throw new Error('P3 注入锚点未命中：schema-validator.ts 的白名单赋值已变')
      return src.replace(needle, '    availableNames = ["form-item", "table-column"]')
    })
    const v = crippled.createSchemaValidator(SCHEMAS_DIR)
    const probs = checkSuite(v, SCHEMAS_DIR, 'P3 注入模块')
    proofs.push(['P3 白名单硬编码（复原 B4 前）→ 「集合同一」', probs, /与目录文件集不一致/])
  }

  for (const [label, probs, expect] of proofs) {
    if (!probs.length) {
      fail(`非空证明失败：${label} —— 判据没有变红，说明它不具约束力`)
    } else if (!probs.some((p) => expect.test(p))) {
      fail(`非空证明失败：${label} —— 变红了，但不是预期的那条判据（实得：${probs[0]}`)
    } else {
      console.log(`✅ 非空证明：${label} 变红（${probs.length} 条）`)
    }
  }

  if (failed) {
    console.error('\n校验器文件集契约守卫失败 —— 可用名表、schema 加载、$ref 三者之间存在漂移，或守卫自身失效。')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(`❌ 守卫自身抛错：${e.stack || e.message}`)
  process.exit(1)
})
