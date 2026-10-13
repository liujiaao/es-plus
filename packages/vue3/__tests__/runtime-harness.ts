/**
 * Tier-1 运行时 harness —— 供 crud-runtime.spec.ts（手写 schema）与
 * generated-runtime.spec.ts（golden config → generateFromConfig → 挂载）共用。
 *
 * 抽出来的原因是：两个 spec 需要**同一个**内存后端契约（按 url 路由
 * create/update/delete/list，列表返回 {records, rows}）。若各写一份，后端语义一分叉，
 * 两边的绿就没有可比性。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 从 **源码** 导入生成器，而非构建产物 @es-plus/shared：
//   1) 运行时层必须反映「当前」生成器，构建产物可能是旧的（eval 已有此坑）；
//   2) `npm test`（`--workspaces`）不会先跑 build:libs，读 build/ 会让干净检出即红。
// shared/src 无跨包依赖（仅 zod + 本地文件），vitest 直接转译即可。
import { generateFromConfig, type StructuredCrudConfig } from '../../shared/src/structured-generator'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'

/** 内存后端：唯一的 httpRequest 缝，路由靠 url，替代真实服务端。 */
export function createInMemoryBackend(seed: Array<Record<string, unknown>>) {
  let store = seed.map((r) => ({ ...r }))
  let nextId = Math.max(0, ...store.map((r) => Number(r.id) || 0)) + 1
  const calls = { list: 0, create: 0, update: 0, remove: 0 }
  // 最近一次列表请求的入参——供「查询表单填入的值确实下发到后端」这类断言使用。
  let lastListParams: Record<string, unknown> | null = null

  const httpRequest = async (req: Record<string, any>) => {
    const { url = '', formParams = {}, pageIndex = 1, pageSize = 10 } = req
    if (url === '/api/create') {
      calls.create++
      store.push({ id: nextId++, ...formParams })
      return { code: 0 }
    }
    if (url === '/api/update') {
      calls.update++
      const i = store.findIndex((r) => r.id === formParams.id)
      if (i >= 0) store[i] = { ...store[i], ...formParams }
      return { code: 0 }
    }
    if (url === '/api/delete') {
      calls.remove++
      store = store.filter((r) => r.id !== formParams.id)
      return { code: 0 }
    }
    // 默认：列表查询（default configTableField 映射 records→total, rows→tableData）
    calls.list++
    lastListParams = { ...formParams }
    const start = (Number(pageIndex) - 1) * Number(pageSize)
    return { records: store.length, rows: store.slice(start, start + Number(pageSize)) }
  }

  return {
    httpRequest,
    calls,
    get store() {
      return store
    },
    get lastListParams() {
      return lastListParams
    },
  }
}

/** 在给定根节点（如 document.body，弹窗 teleport 目标）内按可见文字找按钮。 */
export function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  const btns = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  return btns.find((b) => (b.textContent || '').trim().includes(text)) || null
}

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '__tests__', 'golden', 'cases')

/** 读一个 golden 用例的 `config`（与 score-golden / eval 同一份语料）。 */
export function loadGoldenConfig(fileName: string): StructuredCrudConfig {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, fileName), 'utf-8')) as { config: StructuredCrudConfig }
  return raw.config
}

/**
 * 把 config 过一遍生成器，拿回**运行时**的 CrudPageSchema 对象。
 *
 * schema 模式产出的是 `export const pageSchema: CrudPageSchema = {<JSON>}`。
 * 提取方式与 `__tests__/golden/scripts/score-golden.mjs` 的 checkSyntax 一致——
 * 两处必须用同一条正则，否则一处认的产物另一处认不出。
 */
export function generatePageSchema(config: StructuredCrudConfig): CrudPageSchema {
  const { code } = generateFromConfig({ ...config, mode: 'schema' })
  const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
  if (!m) throw new Error(`生成物里找不到 pageSchema 对象字面量：\n${code.slice(0, 200)}`)
  return JSON.parse(m[1]) as CrudPageSchema
}

/**
 * 按 schema 的列派生种子数据：每个列 prop 填 `R{i}-{prop}`，另附 `id` 供行操作定位。
 * 断言锚点即第一列的值（`R1-<col1>`），不依赖任何具体用例的字段名。
 */
export function seedFromSchema(schema: CrudPageSchema, n = 2): Array<Record<string, unknown>> {
  const props = (schema.columns || [])
    .map((c) => c.prop)
    .filter((p): p is string => !!p && p !== 'operate')
  return Array.from({ length: n }, (_, i) => {
    const row: Record<string, unknown> = { id: i + 1 }
    for (const p of props) row[p] = `R${i + 1}-${p}`
    return row
  })
}

/** 第一列 prop —— 种子数据与断言共用的锚点。 */
export function firstColumnProp(schema: CrudPageSchema): string {
  const p = (schema.columns || []).find((c) => c.prop && c.prop !== 'operate')?.prop
  if (!p) throw new Error('schema 无可断言的列 prop')
  return p
}
