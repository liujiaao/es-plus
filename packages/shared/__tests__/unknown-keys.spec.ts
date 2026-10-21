import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  collectUnknownKeys,
  suggestKey,
  levenshtein,
  formatUnknownKey,
  isExtensionKey,
} from '../src/unknown-keys.js'
import { StructuredCrudConfigSchema } from '../src/structured-config.schema.js'
import { validateAndRepair } from '../src/validate-and-repair.js'

/**
 * AN-08 — 未知键判定。
 *
 * 这些用例的存在理由：Zod 的 `z.object()` 默认**静默剥掉**未知键。若判定器自己也
 * 「什么都没发现」，行为与修前完全一样（校验绿灯、产物少键），只是一段好看的代码。
 * 故每条用例都断言**具体路径 + 具体建议键**，而不是「返回了非空数组」。
 */

const base = () => ({
  name: 'DemoManage',
  apiUrl: '/api/demo',
  fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
  actions: ['add'],
})

describe('collectUnknownKeys — 形状遍历', () => {
  it('顶层拼写错：报 /name，且建议 name', () => {
    const { name: _name, ...rest } = base()
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, { ...rest, nme: 'X' })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ path: [], key: 'nme', suggestion: 'name' })
  })

  it('层级错（tableOptions.rowKey）：报具体路径 + did you mean rowkey', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      tableOptions: { rowKey: 'id' },
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].path).toEqual(['tableOptions'])
    expect(findings[0].key).toBe('rowKey')
    // 大小写不敏感：正是验收点名的那条
    expect(findings[0].suggestion).toBe('rowkey')
    expect(formatUnknownKey(findings[0])).toContain('did you mean "rowkey"')
  })

  it('数组元素未知键：报 /fields/0/widht → width', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      fields: [{ prop: 'name', label: '名称', formtype: 'Input', widht: 100 }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].path).toEqual(['fields', 0])
    expect(findings[0].key).toBe('widht')
    expect(findings[0].suggestion).toBe('width')
  })

  it('dialogs 是 record：record 的键（弹窗 ID）不判未知，但值形状照样下钻', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      dialogs: {
        // 弹窗 ID 是动态键，不能当未知键
        anyDialogId: { title: 'X', titel: '拼错' },
      },
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].path).toEqual(['dialogs', 'anyDialogId'])
    expect(findings[0].key).toBe('titel')
    expect(findings[0].suggestion).toBe('title')
  })

  it('record 值本身是不透明对象（attrs）时不下钻', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      fields: [{ prop: 'name', label: '名称', formtype: 'Input', attrs: { whatever: 1, 'data-x': true } }],
    })
    expect(findings).toEqual([])
  })

  it('x-* 扩展键放行；但 xmeta（没有连字符）仍判未知', () => {
    expect(collectUnknownKeys(StructuredCrudConfigSchema, { ...base(), 'x-meta': { a: 1 } })).toEqual([])
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, { ...base(), xmeta: 1 })
    expect(findings.map((f) => f.key)).toEqual(['xmeta'])
    expect(isExtensionKey('X-Trace')).toBe(true)
    expect(isExtensionKey('xtrace')).toBe(false)
  })

  it('联合类型：operationColumn 的对象分支判键，false 分支不参与', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      operationColumn: { btns: [{ name: '编辑' }], widht: 100 },
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].key).toBe('widht')
  })

  it('联合类型：isHidden 的表达式分支不会把 field/op/value 误报成未知键', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      fields: [
        {
          prop: 'name',
          label: '名称',
          formtype: 'Input',
          isHidden: { field: 'status', op: 'eq', value: 1 },
        },
      ],
    })
    expect(findings).toEqual([])
  })

  it('透明包装（optional/default/effects/lazy）逐层解包后仍能看见内层形状', () => {
    // tableBtns 的元素是 ZodEffects（superRefine + transform）包着 ZodObject
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      tableBtns: [{ name: '导出', actionTpye: 'export' }],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].path).toEqual(['tableBtns', 0])
    expect(findings[0].key).toBe('actionTpye')
    expect(findings[0].suggestion).toBe('actionType')
  })

  it('嵌套容器（dataOptions.children 递归 lazy）也走得到', () => {
    const findings = collectUnknownKeys(StructuredCrudConfigSchema, {
      ...base(),
      fields: [
        {
          prop: 'region',
          label: '地区',
          formtype: 'Cascader',
          dataOptions: [{ label: '浙江', value: 'zj', childern: [{ label: '杭州', value: 'hz' }] }],
        },
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].path).toEqual(['fields', 0, 'dataOptions', 0])
    expect(findings[0].key).toBe('childern')
    expect(findings[0].suggestion).toBe('children')
  })

  it('非对象输入返回空（类型错误由 Zod 自己报，不重复）', () => {
    expect(collectUnknownKeys(StructuredCrudConfigSchema, null)).toEqual([])
    expect(collectUnknownKeys(StructuredCrudConfigSchema, 'x')).toEqual([])
    expect(collectUnknownKeys(StructuredCrudConfigSchema, [])).toEqual([])
  })

  it('原生 zod 小形状：optional/union/intersection 的语义', () => {
    const s = z.object({
      a: z.object({ b: z.string() }).optional(),
      u: z.union([z.literal(false), z.object({ c: z.string() })]).optional(),
    })
    expect(collectUnknownKeys(s, { a: { b: 'x', zz: 1 }, u: { c: 'x', yy: 1 } }).map((f) => `${f.path.join('.')}.${f.key}`)).toEqual([
      'a.zz',
      'u.yy',
    ])
    // 联合里只有一个对象候选时，另一分支（literal false）不把键“洗白”
    expect(collectUnknownKeys(s, { u: { c: 'x', yy: 1 } }).map((f) => f.key)).toEqual(['yy'])
  })
})

describe('suggestKey / levenshtein', () => {
  it('大小写差异视为同一键', () => {
    expect(levenshtein('rowkey', 'rowkey')).toBe(0)
    expect(suggestKey('rowKey', ['rowkey', 'rowstyle'])).toBe('rowkey')
  })

  it('短键只接受距离 1（不值得为 2 个字母乱猜）', () => {
    expect(suggestKey('nme', ['name'])).toBe('name') // 距离 1
    expect(suggestKey('nm', ['name'])).toBeUndefined() // 距离 2，但长度 2 → 阈值 1
  })

  it('完全不相干时不给建议', () => {
    expect(suggestKey('foo', ['bar', 'baz'])).toBeUndefined()
  })

  it('空候选返回 undefined', () => {
    expect(suggestKey('name', [])).toBeUndefined()
  })
})

describe('validateAndRepair — 未知键 = error', () => {
  it('合法配置仍然合法（不误杀）', () => {
    const r = validateAndRepair(base())
    expect(r.valid).toBe(true)
    expect(r.unknownKeys).toEqual([])
  })

  it('Zod 认为“成功”但剥掉了键时，判定必须为不合法', () => {
    // 这是本项的核心：修前这里 valid: true（Zod 静默 strip）
    const r = validateAndRepair({ ...base(), tableOptions: { rowKey: 'id' } })
    expect(r.valid).toBe(false)
    expect(r.errors.join('\n')).toContain('未知键 "rowKey"')
    expect(r.errors.join('\n')).toContain('did you mean "rowkey"')
    expect(r.suggestions.join('\n')).toContain('did you mean "rowkey"')
    expect(r.unknownKeys).toHaveLength(1)
  })

  it('x-* 扩展键不拦（合法）', () => {
    const r = validateAndRepair({ ...base(), 'x-owner': 'team-a' })
    expect(r.valid).toBe(true)
  })

  it('未知键与真实字段错误同时存在时两者都报', () => {
    const { apiUrl: _omitted, ...rest } = base()
    const r = validateAndRepair({ ...rest, nmae: 'X' })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('/apiUrl: '))).toBe(true)
    expect(r.errors.some((e) => e.includes('未知键 "nmae"'))).toBe(true)
  })
})
