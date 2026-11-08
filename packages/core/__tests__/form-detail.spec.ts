import { describe, it, expect } from 'vitest'
import { resolveFormDetailText, formatDetailDate } from '../src/form-detail'
import type { FormItemOption } from '../src/types'

const item = (patch: Partial<FormItemOption>): FormItemOption => ({ prop: 'v', label: '值', ...patch })

describe('formatDetailDate', () => {
  it('零点只输出日期', () => {
    expect(formatDetailDate(new Date(2026, 10, 8, 0, 0, 0))).toBe('2026-11-08')
  })

  it('带时分秒输出本地时间（不是 UTC）', () => {
    expect(formatDetailDate(new Date(2026, 10, 8, 9, 5, 3))).toBe('2026-11-08 09:05:03')
  })
})

describe('resolveFormDetailText', () => {
  it('标量直接字符串化', () => {
    expect(resolveFormDetailText(item({}), { v: '张三' })).toBe('张三')
    expect(resolveFormDetailText(item({}), { v: 42 })).toBe('42')
  })

  it('命中 dataOptions 输出 label（1 ↔ "1" 宽松相等）', () => {
    const it0 = item({ prop: 'status', dataOptions: [{ label: '启用', value: 1 }] })
    expect(resolveFormDetailText(it0, { status: '1' })).toBe('启用')
  })

  it('未命中选项时保留原值，不回退成占位符', () => {
    const it0 = item({ prop: 'status', dataOptions: [{ label: '启用', value: 1 }] })
    expect(resolveFormDetailText(it0, { status: 9 })).toBe('9')
  })

  it('空值走占位符，默认 -，可被 emptyPlaceholder 覆盖', () => {
    expect(resolveFormDetailText(item({}), { v: null })).toBe('-')
    expect(resolveFormDetailText(item({}), { v: undefined })).toBe('-')
    expect(resolveFormDetailText(item({}), { v: '' })).toBe('-')
    expect(resolveFormDetailText(item({ emptyPlaceholder: '暂无' }), { v: '' })).toBe('暂无')
  })

  it('空数组按空值处理', () => {
    expect(resolveFormDetailText(item({}), { v: [] })).toBe('-')
  })

  it('多选数组逐项映射标签并用顿号连接', () => {
    const it0 = item({
      prop: 'tags',
      dataOptions: [
        { label: '前端', value: 'fe' },
        { label: '后端', value: 'be' },
        { label: '测试', value: 'qa' },
      ],
    })
    expect(resolveFormDetailText(it0, { tags: ['fe', 'qa'] })).toBe('前端、测试')
    expect(resolveFormDetailText(it0, { tags: ['fe', 'x'] })).toBe('前端、x')
  })

  it('Cascader 层级路径按 children 逐层取标签', () => {
    const it0 = item({
      prop: 'area',
      dataOptions: [
        {
          label: '浙江',
          value: 'zj',
          children: [
            { label: '杭州', value: 'hz', children: [{ label: '西湖', value: 'xh' }] },
          ],
        },
      ],
    })
    expect(resolveFormDetailText(it0, { area: ['zj', 'hz', 'xh'] })).toBe('浙江 / 杭州 / 西湖')
    // 路径中有一层未命中 → 回退成逐项映射（命中的仍取标签），不让整个字段变占位符
    expect(resolveFormDetailText(it0, { area: ['zj', 'nope'] })).toBe('浙江、nope')
  })

  it('Date 值格式化，字符串原样保留', () => {
    expect(resolveFormDetailText(item({ prop: 'd' }), { d: new Date(2026, 10, 8) })).toBe('2026-11-08')
    expect(resolveFormDetailText(item({ prop: 'd' }), { d: '2026-11-08' })).toBe('2026-11-08')
  })

  it('支持嵌套 prop 路径', () => {
    expect(resolveFormDetailText(item({ prop: 'user.name' }), { user: { name: '李四' } })).toBe('李四')
  })

  it('值缺失时不抛错', () => {
    expect(resolveFormDetailText(item({ prop: 'a.b.c' }), undefined)).toBe('-')
  })
})
