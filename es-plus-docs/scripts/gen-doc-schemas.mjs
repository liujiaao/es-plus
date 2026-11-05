#!/usr/bin/env node
/**
 * 从单源生成文档站 JSON Schema 副本。
 *
 * 单源：packages/shared/schemas/{form-item,table-column,api-params}.schema.json
 * 产物（src 与 public 两处保持一致）：
 *   - es-form.schema.json          : form-item 数组包装（formItemList prop）
 *   - es-table-columns.schema.json : table-column 数组包装（columns prop）
 *   - es-table-data.schema.json    : 非派生文件（自由形态行数组），但同样由本脚本发射并纳入 `--check`
 *
 * 背景：文档站 Playground 把 src/schemas 喂给 monaco 做 JSON 校验，
 * 手写副本长期缺字段（props/required/rules/render/httpRequest/width/isInitRun…），
 * 导致合法配置被标红、也无自动补全。此脚本把副本收敛到单源。
 *
 * 若单源目录缺失（如仅部署文档站的受限环境），打印警告并退出 0，
 * 保留仓库里已提交的产物，不让构建失败。
 *
 * ## `--check`（进 `check:consistency`）
 *
 * 产物只在 `prebuild` 时重算 —— 改了单源（或换了生成逻辑）却没人构建文档站时，
 * 仓库里的副本会静默过期，而 Playground 正是拿它做校验：合法配置被标红、新字段
 * 没有补全，构建与测试全绿。`--check` 重算一遍**但不写盘**，逐字节比对 src 与
 * public 两处副本（行尾归一化，避免 autocrlf 造成的纯 CRLF churn），过期即红。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHECK = process.argv.includes('--check')

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..') // es-plus-docs/
const sharedDir = resolve(root, '../packages/shared/schemas')

const SRC_DIR = resolve(root, 'src/schemas')
const PUBLIC_DIR = resolve(root, 'public/schemas')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

/** 去掉单源里的 $id/$schema，避免内联后污染引用根 */
const stripMeta = (schema) => {
  const copy = JSON.parse(JSON.stringify(schema))
  delete copy.$id
  delete copy.$schema
  return copy
}

/**
 * 把内联 schema 的 `$ref` 从「单源根」重定位到「数组包装的 items」。
 *   '#'            -> '#/items'
 *   '#/properties' -> '#/items/properties'
 */
const rewriteRefs = (node) => {
  if (Array.isArray(node)) {
    node.forEach(rewriteRefs)
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        if (value === '#') node[key] = '#/items'
        else if (value.startsWith('#/')) node[key] = '#/items' + value.slice(1)
      } else {
        rewriteRefs(value)
      }
    }
  }
}

const buildArraySchema = ({ source, id, title, description }) => {
  const item = stripMeta(source)
  // 内联被引用的 api-params，保证产物自包含（monaco 不能解析外部相对 $ref）。
  if (item.properties && item.properties.apiParams) {
    item.properties.apiParams = {
      ...apiParams,
      description: item.properties.apiParams.description || apiParams.description,
    }
  }
  rewriteRefs(item)
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: id,
    title,
    description,
    type: 'array',
    items: item,
  }
}

let formItem
let tableColumn
let apiParams
try {
  formItem = readJson(resolve(sharedDir, 'form-item.schema.json'))
  tableColumn = readJson(resolve(sharedDir, 'table-column.schema.json'))
  apiParams = stripMeta(readJson(resolve(sharedDir, 'api-params.schema.json')))
} catch (err) {
  console.warn(`[gen-doc-schemas] 找不到单源 schema，跳过生成（保留现有副本）：${err.message}`)
  process.exit(0)
}

const outputs = [
  {
    name: 'es-form.schema.json',
    schema: buildArraySchema({
      source: formItem,
      id: 'https://liujiaao.github.io/es-plus/schemas/es-form.schema.json',
      title: 'ES-Plus EsForm formItemList',
      description:
        'Schema for the formItemList prop passed to <es-form />. GENERATED from packages/shared/schemas/form-item.schema.json by scripts/gen-doc-schemas.mjs — do not hand-edit.',
    }),
  },
  {
    name: 'es-table-columns.schema.json',
    schema: buildArraySchema({
      source: tableColumn,
      id: 'https://liujiaao.github.io/es-plus/schemas/es-table-columns.schema.json',
      title: 'ES-Plus EsTable columns',
      description:
        'Schema for the columns prop passed to <es-table />. GENERATED from packages/shared/schemas/table-column.schema.json by scripts/gen-doc-schemas.mjs — do not hand-edit.',
    }),
  },
  {
    name: 'es-table-data.schema.json',
    // 非派生文件：dataSource 是自由形态的行数组，单源里没有对应 schema。
    // 仍由本脚本发射，与另两份一起纳入 `--check` —— 否则它会成为唯一一份
    // 「谁都能手改、没有任何守卫」的产物，和 Playground 的校验口径悄悄分叉。
    schema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://liujiaao.github.io/es-plus/schemas/es-table-data.schema.json',
      title: 'ES-Plus EsTable dataSource',
      description:
        'Schema for the dataSource array — table rows, freeform but should be an array of plain objects',
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  },
]

const json = (obj) => JSON.stringify(obj, null, 2) + '\n'
const stale = []
for (const { name, schema } of outputs) {
  const text = json(schema)
  for (const dir of [SRC_DIR, PUBLIC_DIR]) {
    const target = resolve(dir, name)
    if (CHECK) {
      // 行尾归一化后再比：工作区因 core.autocrlf 检出为 CRLF，生成物是 LF。
      let current = null
      try {
        current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
      } catch {
        current = null
      }
      if (current !== text) stale.push(target)
      continue
    }
    writeFileSync(target, text)
  }
  if (!CHECK) console.log(`[gen-doc-schemas] wrote ${name} (src + public)`)
}

if (CHECK) {
  if (stale.length) {
    console.error(
      `\n✗ 文档站 JSON Schema 副本与单源不一致（${stale.length} 处）：\n` +
        stale.map((p) => `  - ${p}`).join('\n') +
        '\n\n修法：运行 `node es-plus-docs/scripts/gen-doc-schemas.mjs` 重新生成并提交；' +
        '不要手改这些文件（Playground 用它们做校验）。'
    )
    process.exit(1)
  }
  console.log(`✅ ${outputs.length} 份文档站 Schema 与单源逐字节一致（src + public）`)
}
