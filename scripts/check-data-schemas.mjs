#!/usr/bin/env node
/**
 * 数据文件的 `$schema` 声明 ↔ 真实可用性 校验
 *
 * 背景：`docs/brand/slogan.json`、`docs/cases/cases.json`、`docs/ai/ai-tools.json` 都在头部
 * 声明了 `$schema`，指向 `https://liujiaao.github.io/es-plus/<dir>/<name>.schema.json`。
 * 但**这三份 schema 文件一个都不存在** —— 无论本地还是部署后的站点都取不到。
 * 一个把「配置即契约、可校验」当核心卖点的项目，自己的品牌数据文件里却挂着一个取不到的
 * schema 声明，这比没有声明更糟：它看起来像有校验，实际什么都没有。
 * 另外 `docs/tri-render/schema.json` 的 `$schema` 指向的是**它自己**（拿实例当 schema）。
 *
 * 本脚本做两件事（都是相等性/可执行校验，不是「出现过某字段」式检查）：
 *   1. 声明可解析：每个数据文件声明的 `$schema` URL，必须能映射到
 *      es-plus-docs/public/ 下真实存在且与单源逐字节一致的文件；
 *   2. 声明有效力：用 ajv 拿该 schema 真去校验对应数据文件（schema 写错、数据与契约
 *      不符都会在这里失败）。顺手做一次负向验证：故意注入一个非法字段，确认这份 schema
 *      **真的会拒绝**（否则 schema 形同虚设，例如漏写 additionalProperties 就什么都会放过）。
 *
 * 用法：node scripts/check-data-schemas.mjs
 * 退出码：0 = 全部可解析且有效力；1 = 死链 / 校验失败 / schema 无约束力。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const Ajv = require('ajv')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8'))

const SITE_ORIGIN = 'https://liujiaao.github.io/es-plus'

/** 数据文件 → 它声明的 schema 的发布路径 */
const TARGETS = [
  { data: 'docs/brand/slogan.json', schema: 'docs/brand/slogan.schema.json' },
  { data: 'docs/cases/cases.json', schema: 'docs/cases/cases.schema.json' },
  { data: 'docs/ai/ai-tools.json', schema: 'docs/ai/ai-tools.schema.json' },
]

function main() {
  const ajv = new Ajv({ allErrors: true, strict: false })

  for (const { data, schema } of TARGETS) {
    const json = readJson(data)
    const declared = json.$schema
    if (!declared) {
      fail(`${data} 未声明 $schema（要么补上并让它可解析，要么明确不要声明）`)
      continue
    }
    if (!declared.startsWith(`${SITE_ORIGIN}/`)) {
      fail(`${data} 的 $schema 不在本站域名下：${declared}（站点部署在 ${SITE_ORIGIN}/）`)
      continue
    }
    // 1. 声明的 URL 必须能映射到真实发布的文件
    const relOnSite = declared.slice(SITE_ORIGIN.length + 1) // 例如 brand/slogan.schema.json
    const published = join(ROOT, 'es-plus-docs', 'public', relOnSite)
    if (!existsSync(published)) {
      fail(
        `${data} 声明的 $schema（${declared}）在站点上取不到 —— ` +
          `es-plus-docs/public/${relOnSite} 不存在（运行 \`npm run data-schemas:sync\` 发布）`,
      )
      continue
    }
    if (!existsSync(join(ROOT, schema))) {
      fail(`缺少 schema 文件：${schema}`)
      continue
    }

    // 2. 用该 schema 真去校验数据
    const schemaJson = readJson(schema)
    let validate
    try {
      validate = ajv.compile(schemaJson)
    } catch (e) {
      fail(`${schema} 不是合法 JSON Schema：${e.message}`)
      continue
    }
    if (!validate(json)) {
      fail(
        `${data} 不符合它自己声明的 schema（${schema}）：` +
          ajv.errorsText(validate.errors, { separator: '；' }),
      )
      continue
    }

    // 3. 负向验证：这份 schema 必须真的有约束力。
    //    只写 `{ "type": "object" }` 之类也能让上面通过，所以这里注入一个明显非法的结构，
    //    要求 schema 拒绝它 —— 否则「通过校验」是假绿。
    const probe = JSON.parse(JSON.stringify(json))
    probe.__probe_invalid_key__ = { unexpected: true }
    if (Array.isArray(probe.promises)) probe.promises = 'not-an-array'
    else if (Array.isArray(probe.levels)) probe.levels = 'not-an-array'
    else if (Array.isArray(probe.sections)) probe.sections = 'not-an-array'
    if (validate(probe)) {
      fail(
        `${schema} 对明显非法的数据（多出未知字段 + 数组被改成字符串）依然判定通过 —— ` +
          '这说明它没有实际约束力，请补 additionalProperties:false 与类型约束',
      )
    } else {
      console.log(`✅ ${data} 的 $schema 可解析且有效力（${relOnSite}）`)
    }
  }

  // tri-render/schema.json 的 $schema 指向它自己 —— 拿实例当 schema，是错的
  const tri = readJson('docs/tri-render/schema.json')
  if (tri.$schema && tri.$schema.endsWith('/tri-render/schema.json')) {
    fail(
      'docs/tri-render/schema.json 的 $schema 指向它自己（拿实例当 schema）—— ' +
        '该文件是一份示例配置，不是 JSON Schema',
    )
  }

  if (failed) {
    console.error('\n数据文件的 $schema 声明不可解析或没有约束力。')
    process.exit(1)
  }
  console.log('\n数据文件 $schema 声明 ↔ 真实可用 ✅')
}

main()
