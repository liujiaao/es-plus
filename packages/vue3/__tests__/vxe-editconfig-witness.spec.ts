/**
 * AI-09 子项④ 端到端见证 —— vxe 行内编辑（editConfig + 列 editRender）
 * ────────────────────────────────────────────────────────────────────────
 * shared 单测证明「生成器把 editConfig/editRender 发出去了」，mcp 保留测试证明
 * 「Zod 没把它们剥掉」。但都**没有**证明「生成物喂进真正的 vxe 构建器后，行内编辑
 * 真的接通」。本 spec 补上这一环（纯函数，非 DOM —— vxe-table 无法在 jsdom 挂载，
 * 与 ①②③ 一致）：
 *
 *   golden config ──generatePageSchema──▶ pageSchema
 *     ├─ schema.tableOptions.editConfig 深等输入（透传无损）
 *     ├─ schema.columns[].editRender 存活（列级编辑器没被吞）
 *     └─ schema.tableOptions ──buildFirstClassGridOptions──▶
 *          result.editConfig 直传 + result.keepSource === true（运行时自动开跟踪）
 *
 * 用例取 golden 92（vue3/schema，editConfig trigger:click/mode:cell + 列 $input）。
 */
import { describe, it, expect } from 'vitest'
import { buildFirstClassGridOptions } from '../src/components/es-table/src/engines/use-vxe-grid-config'
import { loadGoldenConfig, generatePageSchema } from './runtime-harness'

interface LooseSchema {
  tableOptions?: Record<string, unknown>
  columns?: Array<Record<string, unknown>>
}

describe('vxe 行内编辑端到端见证（AI-09 子项④）', () => {
  const config = loadGoldenConfig('92-sku-price-edit-vue3.json')
  const schema = generatePageSchema(config) as unknown as LooseSchema

  it('生成物 schema.tableOptions.editConfig 与输入深等（透传无损）', () => {
    expect(schema.tableOptions?.engine).toBe('vxe')
    expect(schema.tableOptions?.editConfig).toEqual({ trigger: 'click', mode: 'cell' })
  })

  it('生成物 columns[].editRender 存活（列级编辑器没被吞）', () => {
    const renders = (schema.columns || []).map((c) => c.editRender).filter(Boolean)
    expect(renders.length).toBeGreaterThan(0)
    expect(renders[0]).toMatchObject({ name: '$input' })
  })

  it('喂进 vxe 构建器：editConfig 直传 + keepSource 自动置 true', () => {
    const result = buildFirstClassGridOptions(schema.tableOptions || {})
    expect(result.editConfig).toEqual({ trigger: 'click', mode: 'cell' })
    // build-grid-config.ts:20-24 —— editConfig 存在时自动开 keepSource，否则
    // getUpdateRecords()/getInsertRecords() 永远返回空数组（行内编辑形同虚设）。
    expect(result.keepSource).toBe(true)
  })
})
