import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  resolveReactionOverlay,
  resolveReactionItem,
  resolveReactionValues,
  collectReactionDependencies,
} from '../src/reactions'
import type { FieldReaction } from '../src/types'

/**
 * AI-07 底座：core 的字段联动规划器。
 *
 * 与 expr.spec 同理，这是「三端等价」的真见证 —— 三端渲染器只调 core 这里，
 * 没有渲染侧规划器。故一份 core 测试即覆盖 vue3 / vue2 / antdv 的等价性。
 */

const M = (o: Record<string, unknown>) => o
// 宽松入参：这些用例刻意喂入畸形 fulfill（非数组 dataOptions / 未知算子），
// 故 helper 只做「造一条规则」的形状约束，具体键值交给运行时 fail-safe 验证。
const R = (r: {
  dependencies?: string[]
  when?: unknown
  fulfill: Record<string, unknown>
}): FieldReaction => r as unknown as FieldReaction

afterEach(() => {
  vi.restoreAllMocks()
})

describe('core > reactions > resolveReactionOverlay 显示派生', () => {
  it('无 reactions / 空数组 → null', () => {
    expect(resolveReactionOverlay(undefined, M({}))).toBeNull()
    expect(resolveReactionOverlay([], M({}))).toBeNull()
  })

  it('dataOptions：字面量数组 + when 分支（每分支一套选项）', () => {
    const rules = [
      R({
        dependencies: ['province'],
        when: { '==': [{ var: 'province' }, 'zj'] },
        fulfill: { dataOptions: [{ label: '杭州', value: 'hz' }, { label: '宁波', value: 'nb' }] },
      }),
      R({
        dependencies: ['province'],
        when: { '==': [{ var: 'province' }, 'js'] },
        fulfill: { dataOptions: [{ label: '南京', value: 'nj' }] },
      }),
    ]
    expect(resolveReactionOverlay(rules, M({ province: 'zj' }))).toEqual({
      dataOptions: [{ label: '杭州', value: 'hz' }, { label: '宁波', value: 'nb' }],
    })
    expect(resolveReactionOverlay(rules, M({ province: 'js' }))).toEqual({
      dataOptions: [{ label: '南京', value: 'nj' }],
    })
    expect(resolveReactionOverlay(rules, M({ province: '' }))).toBeNull()
  })

  it('when 为假 → 规则不生效 → null', () => {
    const rules = [R({ when: { notEmpty: [{ var: 'province' }] }, fulfill: { required: { truthy: [{ var: 'x' }] } } })]
    expect(resolveReactionOverlay(rules, M({ province: '' }))).toBeNull()
    expect(resolveReactionOverlay(rules, M({ province: 'zj' }))).toEqual({ required: false })
  })

  it('required / disabled：求值为布尔', () => {
    const rules = [
      R({
        fulfill: {
          required: { notEmpty: [{ var: 'city' }] },
          disabled: { empty: [{ var: 'city' }] },
        },
      }),
    ]
    expect(resolveReactionOverlay(rules, M({ city: 'hz' }))).toEqual({ required: true, disabled: false })
    expect(resolveReactionOverlay(rules, M({ city: '' }))).toEqual({ required: false, disabled: true })
  })

  it('多规则 last-wins（后声明覆盖先声明）', () => {
    const rules = [
      R({ fulfill: { required: { truthy: [{ var: 'a' }] } } }),
      R({ fulfill: { required: { truthy: [{ var: 'b' }] } } }),
    ]
    expect(resolveReactionOverlay(rules, M({ a: true, b: false }))).toEqual({ required: false })
  })

  it('畸形表达式 → 该键丢弃且不抛', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rules = [R({ fulfill: { required: { bogusOp: [1] } } })]
    expect(resolveReactionOverlay(rules, M({}))).toBeNull()
    expect(spy).toHaveBeenCalled()
  })

  it('dataOptions 非字面量数组 → 该键丢弃', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveReactionOverlay([R({ fulfill: { dataOptions: { var: 'notArray' } } })], M({ notArray: 3 }))).toBeNull()
    expect(spy).toHaveBeenCalled()
  })

  it('required 求值成非布尔 → 该键丢弃', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveReactionOverlay([R({ fulfill: { required: { var: 'n' } } })], M({ n: 5 }))).toBeNull()
    expect(spy).toHaveBeenCalled()
  })

  it('一个键畸形不影响同规则的另一键', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rules = [
      R({
        fulfill: {
          dataOptions: { bogusOp: [1] },
          required: { notEmpty: [{ var: 'city' }] },
        },
      }),
    ]
    expect(resolveReactionOverlay(rules, M({ city: 'hz' }))).toEqual({ required: true })
  })
})

describe('core > reactions > resolveReactionValues 值回写', () => {
  it('价值表达式按依赖求值；仅返回「应写成什么」', () => {
    const items = [
      {
        prop: 'region',
        reactions: [R({ dependencies: ['province'], fulfill: { value: { var: 'province' } } })],
      },
    ]
    expect(resolveReactionValues(items, M({ province: 'zj' }))).toEqual([{ prop: 'region', value: 'zj' }])
  })

  it('fulfill.value 缺 dependencies → 跳过 + 告警一次', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = [{ prop: 'region', reactions: [R({ fulfill: { value: { var: 'province' } } })] }]
    expect(resolveReactionValues(items, M({ province: 'zj' }))).toEqual([])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('when 为假 → 该写回跳过', () => {
    const items = [
      {
        prop: 'region',
        reactions: [
          R({ dependencies: ['province'], when: { notEmpty: [{ var: 'province' }] }, fulfill: { value: { var: 'province' } } }),
        ],
      },
    ]
    expect(resolveReactionValues(items, M({ province: '' }))).toEqual([])
    expect(resolveReactionValues(items, M({ province: 'js' }))).toEqual([{ prop: 'region', value: 'js' }])
  })

  it('同一 prop 多规则 → last-wins', () => {
    const items = [
      {
        prop: 'x',
        reactions: [
          R({ dependencies: ['a'], fulfill: { value: { var: 'a' } } }),
          R({ dependencies: ['b'], fulfill: { value: { var: 'b' } } }),
        ],
      },
    ]
    expect(resolveReactionValues(items, M({ a: 1, b: 2 }))).toEqual([{ prop: 'x', value: 2 }])
  })

  it('畸形价值表达式 → 跳过 + 告警，不抛', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = [{ prop: 'x', reactions: [R({ dependencies: ['a'], fulfill: { value: { bogus: [1] } } })] }]
    expect(resolveReactionValues(items, M({ a: 1 }))).toEqual([])
  })

  it('无 reactions 的 item 被忽略', () => {
    expect(resolveReactionValues([{ prop: 'x' }, {}], M({}))).toEqual([])
  })
})

describe('core > reactions > collectReactionDependencies', () => {
  it('并集、去重、保序', () => {
    const items = [
      { reactions: [R({ dependencies: ['province', 'city'], fulfill: {} })] },
      { reactions: [R({ dependencies: ['city', 'town'], fulfill: {} })] },
      { reactions: [R({ fulfill: {} })] },
    ]
    expect(collectReactionDependencies(items)).toEqual(['province', 'city', 'town'])
  })

  it('无 reactions → 空数组', () => {
    expect(collectReactionDependencies([{}, { reactions: [] }])).toEqual([])
  })
})

describe('core > reactions > resolveReactionItem 合并 + 必填文案', () => {
  const item = (extra: Record<string, unknown> = {}) => ({
    prop: 'rejectReason',
    label: '驳回原因',
    formtype: 'Input',
    reactions: [R({ dependencies: ['status'], fulfill: { required: { '==': [{ var: 'status' }, 'rejected'] } } })],
    ...extra,
  })

  it('无 reactions → 返回原引用（调用方据此免去重渲染）', () => {
    const plain = { prop: 'a', label: 'A' }
    expect(resolveReactionItem(plain, M({}))).toBe(plain)
    const empty = item({ reactions: [] })
    expect(resolveReactionItem(empty, M({ status: 'rejected' }))).toBe(empty)
  })

  it('required 生效 → 落成带 label 文案的规则，并删掉裸布尔', () => {
    const out = resolveReactionItem(item(), M({ status: 'rejected' })) as Record<string, unknown>
    expect(out.required).toBeUndefined()
    expect(out.rules).toEqual([{ required: true, message: '请输入驳回原因', trigger: ['blur', 'change'] }])
  })

  it('选择类控件用「请选择」', () => {
    const out = resolveReactionItem(item({ formtype: 'Select' }), M({ status: 'rejected' })) as Record<string, unknown>
    expect((out.rules as Array<{ message: string }>)[0].message).toBe('请选择驳回原因')
  })

  it('字段自带 required 规则 → 不重复添加，但仍去掉裸布尔', () => {
    const own = [{ required: true, message: '自定义文案' }]
    const out = resolveReactionItem(item({ rules: own }), M({ status: 'rejected' })) as Record<string, unknown>
    expect(out.rules).toBe(own)
    expect(out.required).toBeUndefined()
  })

  it('formItemOptions.rules 里的 required 也算自有规则', () => {
    const optsRules = [{ required: true, message: '透传袋文案' }]
    const out = resolveReactionItem(item({ formItemOptions: { rules: optsRules } }), M({ status: 'rejected' })) as Record<string, unknown>
    expect(out.rules).toBeUndefined()
    expect(out.required).toBeUndefined()
  })

  it('required 求值为 false → 保留布尔 false，不加规则', () => {
    const out = resolveReactionItem(item(), M({ status: 'approved' }) ) as Record<string, unknown>
    // status=approved 时表达式为 false：overlay 有 required:false，规则不再加
    expect(out.required).toBe(false)
    expect(out.rules).toBeUndefined()
  })

  it('dataOptions / disabled 照旧合并（不因必填文案改动而回归）', () => {
    const it0 = {
      prop: 'city',
      label: '城市',
      formtype: 'Select',
      reactions: [
        R({ dependencies: ['p'], fulfill: { dataOptions: [{ label: '杭州', value: 'hz' }], disabled: { '==': [{ var: 'p' }, ''] } } }),
      ],
    }
    const out = resolveReactionItem(it0, M({ p: '' })) as Record<string, unknown>
    expect(out.dataOptions).toEqual([{ label: '杭州', value: 'hz' }])
    expect(out.disabled).toBe(true)
  })
})
