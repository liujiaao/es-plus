import { describe, expect, it, vi } from 'vitest'
import {
  flattenFormItems,
  resolveNestedProp,
  isNestedFormHead,
  isNestedFormChild,
  pruneEmptyNestedContainers,
} from '../src/form-nested'
import type { NestedFormItemLike } from '../src/form-nested'

describe('resolveNestedProp', () => {
  it('相对 prop 拼成绝对路径', () => {
    expect(resolveNestedProp('address', 'city')).toBe('address.city')
  })

  it('已是绝对路径时幂等（不重复拼接）', () => {
    expect(resolveNestedProp('address', 'address.city')).toBe('address.city')
    expect(resolveNestedProp('address', 'address.city.street')).toBe('address.city.street')
  })

  it('容器没有 prop 时原样返回子 prop', () => {
    expect(resolveNestedProp('', 'city')).toBe('city')
    expect(resolveNestedProp(undefined, 'city')).toBe('city')
  })

  it('非字符串入参不抛错', () => {
    expect(resolveNestedProp(null, 42 as unknown as string)).toBe('')
  })
})

describe('flattenFormItems', () => {
  it('无 children 的字段原样返回（引用不变）', () => {
    const a = { prop: 'name', label: '姓名' }
    const out = flattenFormItems<NestedFormItemLike>([a])
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(a)
    expect(isNestedFormHead(out[0])).toBe(false)
    expect(isNestedFormChild(out[0])).toBe(false)
  })

  it('空 children 数组不算容器', () => {
    const out = flattenFormItems<NestedFormItemLike>([{ prop: 'a', label: 'A', children: [] }])
    expect(out).toHaveLength(1)
    expect(isNestedFormHead(out[0])).toBe(false)
    expect('children' in out[0]).toBe(false)
  })

  it('容器展开为「标题行 + 子字段」，子字段 prop 解析为绝对路径', () => {
    const out = flattenFormItems<NestedFormItemLike>([
      {
        prop: 'address',
        label: '地址',
        children: [
          { prop: 'city', label: '城市' },
          { prop: 'street', label: '街道' },
        ],
      },
    ])

    expect(out.map((it) => it.prop)).toEqual(['address', 'address.city', 'address.street'])
    expect(isNestedFormHead(out[0])).toBe(true)
    expect(isNestedFormChild(out[1])).toBe(true)
    expect(isNestedFormChild(out[2])).toBe(true)
    // 容器不携带 children（否则渲染层会重复画一遍）
    expect('children' in out[0]).toBe(false)
  })

  it('容器默认整行（span 24），显式 span 优先', () => {
    const out = flattenFormItems<NestedFormItemLike>([
      { prop: 'g1', label: 'G1', children: [{ prop: 'a', label: 'A' }] },
      { prop: 'g2', label: 'G2', span: 12, children: [{ prop: 'b', label: 'B' }] },
    ])
    expect(out[0].span).toBe(24)
    expect(out[2].span).toBe(12)
  })

  it('子字段继承容器的 group，自己声明的优先', () => {
    const out = flattenFormItems<NestedFormItemLike>([
      {
        prop: 'address',
        label: '地址',
        group: 'base',
        children: [
          { prop: 'city', label: '城市' },
          { prop: 'street', label: '街道', group: 'other' },
        ],
      },
    ])
    expect(out[1].group).toBe('base')
    expect(out[2].group).toBe('other')
  })

  it('子字段 span 由容器内部单独计算，显式 span 优先', () => {
    const autoSpan = vi.fn(() => 12)
    const out = flattenFormItems<NestedFormItemLike>(
      [
        {
          prop: 'address',
          label: '地址',
          children: [
            { prop: 'city', label: '城市' },
            { prop: 'street', label: '街道', span: 8 },
          ],
        },
      ],
      autoSpan
    )
    expect(autoSpan).toHaveBeenCalledTimes(1)
    expect(out[1].span).toBe(12)
    expect(out[2].span).toBe(8)
  })

  it('不传 autoSpan 时不填子字段 span（交给渲染层的统一 auto-span）', () => {
    const out = flattenFormItems<NestedFormItemLike>([
      { prop: 'g', label: 'G', children: [{ prop: 'a', label: 'A' }] },
    ])
    expect(out[1].span).toBeUndefined()
  })

  it('只支持一层：深层 children 被忽略并告警一次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = flattenFormItems<NestedFormItemLike>([
      {
        prop: 'a',
        label: 'A',
        children: [
          {
            prop: 'b',
            label: 'B',
            children: [{ prop: 'c', label: 'C' }],
          },
        ],
      },
    ])
    expect(out.map((it) => it.prop)).toEqual(['a', 'a.b'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('只支持一层')
    warn.mockRestore()
  })

  it('幂等：重复摊平不改变结果', () => {
    const once = flattenFormItems<NestedFormItemLike>([
      { prop: 'g', label: 'G', children: [{ prop: 'a', label: 'A' }] },
    ])
    const twice = flattenFormItems(once)
    expect(twice.map((it) => it.prop)).toEqual(['g', 'g.a'])
    expect(isNestedFormHead(twice[0])).toBe(true)
    expect(isNestedFormChild(twice[1])).toBe(true)
  })

  it('非数组 / 空项安全', () => {
    expect(flattenFormItems<NestedFormItemLike>([])).toEqual([])
    expect(flattenFormItems(null as unknown as [])).toEqual([])
    expect(flattenFormItems<NestedFormItemLike>([null as unknown as { prop: string }])).toEqual([])
  })
})

describe('pruneEmptyNestedContainers', () => {
  it('子字段仍在时保留标题行', () => {
    const flat = flattenFormItems<NestedFormItemLike>([
      { prop: 'g', label: 'G', children: [{ prop: 'a', label: 'A' }] },
    ])
    expect(pruneEmptyNestedContainers(flat).map((it) => it.prop)).toEqual(['g', 'g.a'])
  })

  it('子字段全被过滤后丢掉标题行', () => {
    const flat = flattenFormItems<NestedFormItemLike>([
      { prop: 'g', label: 'G', children: [{ prop: 'a', label: 'A' }] },
    ])
    // 模拟过滤：子字段被 isHidden / 权限过滤
    const survivors = flat.filter((it) => it.prop !== 'g.a')
    expect(pruneEmptyNestedContainers(survivors)).toEqual([])
  })

  it('普通字段不受影响；没有子字段的容器（理论上已被摊平排除）也不受影响', () => {
    const flat = [
      { prop: 'name', label: '姓名' },
      { prop: 'g', label: 'G' },
    ] as unknown as ReturnType<typeof flattenFormItems<NestedFormItemLike>>
    expect(pruneEmptyNestedContainers(flat).map((it) => it.prop)).toEqual(['name', 'g'])
  })
})
