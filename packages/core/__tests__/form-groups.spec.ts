import { describe, it, expect } from 'vitest'
import { groupFormItems, UNGROUPED_FORM_GROUP_KEY } from '../src/form-groups'
import type { FormGroupLayout } from '../src/types'

/**
 * P1-3 第一期：表单分组容器 —— 分桶规则单源。
 *
 * 三端只画容器，**画哪些组、每组有哪些字段**全部由此函数决定。因此这里逐条钉住
 * 规则：没分组保持扁平、声明顺序、未声明组按首次出现、空组丢弃、未分组落点三态。
 */
const item = (prop: string, group?: string) => ({ prop, label: prop, group })

const layout = (patch: Partial<FormGroupLayout> = {}): FormGroupLayout => ({
  type: 'tabs',
  ...patch,
})

describe('groupFormItems — 保持扁平（历史行为不变）', () => {
  it('未配置 layout / 未配置 type → active:false 且单组含全部字段', () => {
    const items = [item('a', 'basic'), item('b', 'extra')]
    for (const config of [undefined, null, {} as FormGroupLayout]) {
      const out = groupFormItems(items, config as FormGroupLayout | undefined)
      expect(out.active).toBe(false)
      expect(out.groups).toHaveLength(1)
      expect(out.groups[0].items).toEqual(items)
      expect(out.groups[0].key).toBe(UNGROUPED_FORM_GROUP_KEY)
    }
  })

  it('配置了 type 但没有任何字段分组、也没声明 groups → 仍走扁平', () => {
    const items = [item('a'), item('b')]
    const out = groupFormItems(items, layout())
    expect(out.active).toBe(false)
    expect(out.groups[0].items).toEqual(items)
  })
})

describe('groupFormItems — 分组与顺序', () => {
  const items = [item('a', 'basic'), item('b', 'contact'), item('c', 'basic')]

  it('按 groups 声明顺序输出，组内保持字段顺序', () => {
    const out = groupFormItems(
      items,
      layout({
        groups: [
          { key: 'contact', label: '联系方式' },
          { key: 'basic', label: '基本信息' },
        ],
      })
    )
    expect(out.active).toBe(true)
    expect(out.groups.map((g) => g.key)).toEqual(['contact', 'basic'])
    expect(out.groups[0].items.map((i) => i.prop)).toEqual(['b'])
    expect(out.groups[1].items.map((i) => i.prop)).toEqual(['a', 'c'])
    expect(out.groups[1].label).toBe('基本信息')
  })

  it('未声明的组按字段首次出现顺序追加在已声明组之后', () => {
    const out = groupFormItems(
      [item('a', 'z'), item('b', 'basic'), item('c', 'y')],
      layout({ groups: [{ key: 'basic', label: '基础' }] })
    )
    expect(out.groups.map((g) => g.key)).toEqual(['basic', 'z', 'y'])
    // 未声明 label → 不编造标题，渲染层回落 key
    expect(out.groups[1].label).toBeUndefined()
  })

  it('空组丢弃（字段被过滤后不留空页签）', () => {
    const out = groupFormItems(
      [item('a', 'basic')],
      layout({
        groups: [
          { key: 'basic', label: '基础' },
          { key: 'empty', label: '空组' },
        ],
        ungrouped: 'hidden',
      })
    )
    expect(out.groups.map((g) => g.key)).toEqual(['basic'])
  })

  it('重复 / 空白 key 的声明被忽略，不会产生两个同名组', () => {
    const out = groupFormItems(
      [item('a', 'basic')],
      layout({
        groups: [
          { key: 'basic', label: '第一次' },
          { key: 'basic', label: '第二次' },
          { key: '  ', label: '空' },
        ],
      })
    )
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0].label).toBe('第一次')
  })

  it('labelKey / description 原样透出（i18n 解析留给渲染层）', () => {
    const out = groupFormItems(
      [item('a', 'basic')],
      layout({ groups: [{ key: 'basic', labelKey: 'form.basic', description: '说明' }] })
    )
    expect(out.groups[0].labelKey).toBe('form.basic')
    expect(out.groups[0].description).toBe('说明')
  })
})

describe('groupFormItems — 未分组字段的三种落点', () => {
  const items = [item('a', 'basic'), item('b')]

  it("缺省 'default'：单独成组、排最后、标题取 defaultLabel", () => {
    const out = groupFormItems(items, layout({ defaultLabel: '补充' }))
    expect(out.groups.map((g) => g.key)).toEqual(['basic', UNGROUPED_FORM_GROUP_KEY])
    expect(out.groups[1].label).toBe('补充')
    expect(out.groups[1].items.map((i) => i.prop)).toEqual(['b'])
  })

  it("'first'：并入第一个组", () => {
    const out = groupFormItems(items, layout({ ungrouped: 'first' }))
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0].key).toBe('basic')
    expect(out.groups[0].items.map((i) => i.prop)).toEqual(['a', 'b'])
  })

  it("'first' 且首个组来自声明（字段尚未出现）时也成立", () => {
    const out = groupFormItems(items, layout({ ungrouped: 'first', groups: [{ key: 'basic', label: '基础' }] }))
    expect(out.groups[0].items.map((i) => i.prop)).toEqual(['a', 'b'])
  })

  it("'hidden'：不渲染未分组字段", () => {
    const out = groupFormItems(items, layout({ ungrouped: 'hidden' }))
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0].items.map((i) => i.prop)).toEqual(['a'])
  })
})

describe('groupFormItems — 边界', () => {
  it('空列表且无分组 → 扁平空组，不抛错', () => {
    const out = groupFormItems([], layout())
    expect(out.active).toBe(false)
    expect(out.groups[0].items).toEqual([])
  })

  it('字段 group 为空格串视为未分组', () => {
    const out = groupFormItems([item('a', '   '), item('b', 'basic')], layout())
    expect(out.groups.map((g) => g.key)).toEqual(['basic', UNGROUPED_FORM_GROUP_KEY])
  })

  it('三种容器形态的分桶结果完全一致（容器只是画法）', () => {
    const items = [item('a', 'x'), item('b', 'y')]
    const shapes = (['tabs', 'steps', 'collapse'] as const).map((type) =>
      groupFormItems(items, layout({ type })).groups.map((g) => `${g.key}:${g.items.length}`)
    )
    expect(shapes[0]).toEqual(['x:1', 'y:1'])
    expect(shapes[1]).toEqual(shapes[0])
    expect(shapes[2]).toEqual(shapes[0])
  })
})
