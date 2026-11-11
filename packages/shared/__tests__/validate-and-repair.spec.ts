import { describe, it, expect } from 'vitest'
import { validateAndRepair, formatIssuePath, zodIssuesToResult, type ZodIssueLike } from '../src/validate-and-repair.js'

// validateAndRepair 是 C2·A3 的确定性前门校验内核：权威 Zod 判定 + 结构化 errors/suggestions，
// 只判不改、无模型。mcp 前门、CLI --from-config、eval 共用它。这里钉住判定与 /path: message 形态。
// （经 mcp 包装器 validateStructuredConfig 的集成路径另见 mcp-server/validate-config.spec.ts。）

const validConfig = () => ({
  name: 'UserManage',
  apiUrl: '/api/users',
  fields: [{ prop: 'userName', label: '用户名', formtype: 'Input' }],
  actions: ['add', 'edit'],
})

describe('validateAndRepair — 确定性校验', () => {
  it('合法配置判为合法，无 errors/suggestions', () => {
    const r = validateAndRepair(validConfig())
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.suggestions).toEqual([])
  })

  it('校验通过不改写输入（不落 schema 默认，与 assertValidConfig 的「只判不改」一致）', () => {
    // 回归守卫：validateAndRepair 返回 ValidationResult（无 config 字段），刻意不回传
    // safeParse 的解析结果，避免把省略的 inQuery 等落成显式 true。
    const r = validateAndRepair(validConfig()) as Record<string, unknown>
    expect('config' in r).toBe(false)
  })

  it('缺必填字段 → 错误串按 /path: message 形态，建议点出期望类型', () => {
    const { apiUrl: _omit, ...rest } = validConfig()
    const r = validateAndRepair(rest)
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringMatching(/^\/apiUrl: /))
    expect(r.suggestions).toContain('/apiUrl should be type "string"')
  })

  it('嵌套路径用 / 连接；枚举不符 → 建议列出合法取值', () => {
    const r = validateAndRepair({
      ...validConfig(),
      fields: [{ prop: 'u', label: 'U', formtype: 'Nope' }],
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('/fields/0/formtype: '))).toBe(true)
    const hint = r.suggestions.find((s) => s.startsWith('Valid values for /fields/0/formtype:'))
    expect(hint).toBeDefined()
    expect(hint).toContain('Select')
  })

  it('数组过短 → 建议给出下限', () => {
    const r = validateAndRepair({ ...validConfig(), fields: [] })
    expect(r.valid).toBe(false)
    expect(r.suggestions).toContain('/fields must have at least 1')
  })

  it('根部错误（非对象入参）落到 (root)', () => {
    const r = validateAndRepair('not an object')
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('(root): '))).toBe(true)
  })
})

describe('formatIssuePath', () => {
  it('空路径 → (root)', () => {
    expect(formatIssuePath(undefined)).toBe('(root)')
    expect(formatIssuePath([])).toBe('(root)')
  })
  it('非空路径 → 前导斜杠、/ 连接、数字段原样', () => {
    expect(formatIssuePath(['fields', 0, 'formtype'])).toBe('/fields/0/formtype')
  })
})

describe('zodIssuesToResult — 建议渲染分支', () => {
  it('invalid_value 列出合法取值（截断 12 + …）', () => {
    const issues: ZodIssueLike[] = [
      { path: ['fields', 1, 'formtype'], message: 'bad', code: 'invalid_value', values: ['Input', 'Select'] },
    ]
    const r = zodIssuesToResult(issues)
    expect(r.valid).toBe(false)
    expect(r.suggestions).toContain('Valid values for /fields/1/formtype: Input, Select')
  })

  it('invalid_type 点出期望类型', () => {
    const r = zodIssuesToResult([{ path: ['apiUrl'], message: 'x', code: 'invalid_type', expected: 'string' }])
    expect(r.suggestions).toContain('/apiUrl should be type "string"')
  })

  it('too_small / too_big 给出上下限', () => {
    expect(zodIssuesToResult([{ path: ['fields'], message: 'x', code: 'too_small', minimum: 1 }]).suggestions)
      .toContain('/fields must have at least 1')
    expect(zodIssuesToResult([{ path: ['n'], message: 'x', code: 'too_big', maximum: 9 }]).suggestions)
      .toContain('/n must have at most 9')
  })

  it('invalid_union 说明没有任何形状匹配', () => {
    expect(zodIssuesToResult([{ path: ['fields', 0, 'fixed'], message: 'x', code: 'invalid_union' }]).suggestions)
      .toContain('/fields/0/fixed does not match any of the allowed shapes')
  })

  it('无 issues → {valid:false, errors:[], suggestions:[]}', () => {
    expect(zodIssuesToResult([])).toEqual({ valid: false, errors: [], suggestions: [] })
  })
})

// D3（127/132）：reactions 拿中文标签当分支依据、却没有同值 dataOptions。
// 这是「配置合法但运行时永不触发」的软缺陷 —— 只告警，不改变 valid。
describe('codeTableWarnings — reactions 的码表身份', () => {
  const withReaction = (when: unknown, withOptions: boolean) => ({
    name: 'SettleManage',
    apiUrl: '/api/settlements',
    fields: [
      {
        prop: 'settleType',
        label: '结算方式',
        formtype: 'Select',
        ...(withOptions
          ? { dataOptions: [{ label: '境内结算', value: 'domestic' }, { label: '跨境结算', value: 'cross' }] }
          : {}),
        inQuery: false,
      },
      {
        prop: 'currency',
        label: '结算币种',
        formtype: 'Select',
        inQuery: false,
        reactions: [{ dependencies: ['settleType'], when, fulfill: { value: { if: [when, 'USD', 'CNY'] } } }],
      },
    ],
    actions: ['add', 'edit'],
  })

  it('比较中文标签且无 dataOptions → 告警点名该字面量与修法（仍 valid）', () => {
    const r = validateAndRepair(withReaction({ '==': [{ var: 'settleType' }, '跨境结算'] }, false))
    expect(r.valid).toBe(true)
    expect(r.warnings?.length).toBe(1)
    expect(r.warnings![0]).toContain('跨境结算')
    expect(r.warnings![0]).toContain('dataOptions')
  })

  it('同配置但按码表比较（value）→ 无告警', () => {
    const r = validateAndRepair(withReaction({ '==': [{ var: 'settleType' }, 'cross'] }, true))
    expect(r.valid).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('字面量等于某个 dataOptions 的 label → 不告警（可能是合法的标签常量）', () => {
    const r = validateAndRepair(withReaction({ '==': [{ var: 'settleType' }, '跨境结算'] }, true))
    expect(r.warnings).toEqual([])
  })

  it('条件只写在 value.if[0]（无 when）也告警 —— Excel 式写法同样常见', () => {
    const config = {
      name: 'SettleManage',
      apiUrl: '/api/settlements',
      fields: [
        { prop: 'settleType', label: '结算方式', formtype: 'Select', inQuery: false },
        {
          prop: 'currency',
          label: '结算币种',
          formtype: 'Select',
          inQuery: false,
          reactions: [
            {
              dependencies: ['settleType'],
              fulfill: { value: { if: [{ '==': [{ var: 'settleType' }, '跨境结算'] }, 'USD', 'CNY'] } },
            },
          ],
        },
      ],
      actions: ['add', 'edit'],
    }
    const r = validateAndRepair(config)
    expect(r.valid).toBe(true)
    expect(r.warnings?.join('\n')).toContain('跨境结算')
  })

  it('中文只出现在结果槽（value.if 的 then/else）→ 不告警', () => {
    // 边界：`fulfill.value` 里的中文可能是合法目标值（命中后自动填成某状态），不能误伤。
    const config = {
      name: 'SettleManage',
      apiUrl: '/api/settlements',
      fields: [
        {
          prop: 'settleType',
          label: '结算方式',
          formtype: 'Select',
          dataOptions: [{ label: '境内结算', value: 'domestic' }, { label: '跨境结算', value: 'cross' }],
          inQuery: false,
        },
        {
          prop: 'statusLabel',
          label: '状态说明',
          formtype: 'Input',
          inQuery: false,
          reactions: [
            {
              dependencies: ['settleType'],
              fulfill: { value: { if: [{ '==': [{ var: 'settleType' }, 'cross'] }, '跨境业务', '境内业务'] } },
            },
          ],
        },
      ],
      actions: ['add', 'edit'],
    }
    const r = validateAndRepair(config)
    expect(r.valid).toBe(true)
    expect(r.warnings).toEqual([])
  })
})
