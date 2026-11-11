import { describe, it, expect } from 'vitest'
import {
  generateFromConfig,
  projectColumnDataOptions,
  sanitizeExplicitColumns,
} from '../src/structured-generator.js'
import type { StructuredCrudConfig } from '../src/structured-config.schema.js'

/**
 * 字段级 `dataOptions` 与列级 `dataOptions` 是**两个契约**：
 *   - 字段面（`DataOptionSchema`）：`label / value / disabled? / children? / tagType?`
 *     —— Cascader / TreeSelect 需要 `children`；
 *   - 列面（core `TableColumnDataOption`）：`label / value / tagType?`
 *     —— 表格单元格不级联。
 *
 * 生成器此前把字段数组原样复制到列上，于是「字段是 Cascader、表格里也露一列」的配置
 * 会产出 `TS2353: 'children' does not exist in type 'TableColumnDataOption'`
 * （2026-11-10 的 `13-all-formtypes [vue3]` 就是这么红的）。
 */

const richOptions = [
  { label: '浙江省', value: 'zj', children: [{ label: '杭州市', value: 'hz' }] },
  { label: '江苏省', value: 'js', disabled: true, tagType: 'info' as const },
]

function schemaConfig(extra: Record<string, unknown> = {}): StructuredCrudConfig {
  return {
    name: 'RegionManage',
    apiUrl: '/api/regions',
    target: 'vue3',
    mode: 'schema',
    fields: [
      { prop: 'region', label: '地区', formtype: 'Cascader', dataOptions: richOptions },
      { prop: 'name', label: '名称', formtype: 'Input' },
    ],
    actions: ['add'],
    ...extra,
  } as StructuredCrudConfig
}

/** JS 模式的产物 = `export const pageSchema = {…}`；从第一个 `{` 切即可 JSON.parse。 */
function schemaOf(code: string): any {
  return JSON.parse(code.slice(code.indexOf('{')))
}

describe('projectColumnDataOptions — 字段面 → 列面', () => {
  it('只保留 label / value / tagType', () => {
    expect(projectColumnDataOptions(richOptions)).toEqual([
      { label: '浙江省', value: 'zj' },
      { label: '江苏省', value: 'js', tagType: 'info' },
    ])
  })

  it('空数组/缺省返回 undefined（不发射空键）', () => {
    expect(projectColumnDataOptions([])).toBeUndefined()
    expect(projectColumnDataOptions(undefined)).toBeUndefined()
  })
})

describe('派生列（schema 模式）', () => {
  it('字段 dataOptions.children 不会出现在列上', () => {
    const schema = schemaOf(generateFromConfig(schemaConfig({ typescript: false })).code)
    const col = schema.columns.find((c: any) => c.prop === 'region')
    expect(col.dataOptions).toEqual([
      { label: '浙江省', value: 'zj' },
      { label: '江苏省', value: 'js', tagType: 'info' },
    ])
    expect(JSON.stringify(col)).not.toContain('children')
  })
})

describe('显式 columns', () => {
  it('列上缺 dataOptions 时继承字段值，但同样按列契约投影', () => {
    const cfg = schemaConfig({
      typescript: false,
      columns: [{ prop: 'region', label: '地区' }, { prop: 'name', label: '名称' }],
    })
    const schema = schemaOf(generateFromConfig(cfg).code)
    const col = schema.columns.find((c: any) => c.prop === 'region')
    expect(col.dataOptions).toEqual([
      { label: '浙江省', value: 'zj' },
      { label: '江苏省', value: 'js', tagType: 'info' },
    ])
  })

  it('显式列自己写的 children 也会被剥（防御性）', () => {
    const [col] = sanitizeExplicitColumns([
      { prop: 'region', label: '地区', dataOptions: richOptions },
    ])
    expect(col.dataOptions).toEqual([
      { label: '浙江省', value: 'zj' },
      { label: '江苏省', value: 'js', tagType: 'info' },
    ])
  })
})

describe('SFC 模式', () => {
  it('列里的 dataOptions 同样不含 children', () => {
    const code = generateFromConfig(schemaConfig({ mode: 'sfc' })).code
    const regionLine = code
      .split('\n')
      .find((l) => l.includes("prop: 'region'") && l.includes('dataOptions'))
    expect(regionLine).toBeTruthy()
    expect(regionLine).not.toContain('children')
    expect(regionLine).toContain('"label":"浙江省"')
  })
})
