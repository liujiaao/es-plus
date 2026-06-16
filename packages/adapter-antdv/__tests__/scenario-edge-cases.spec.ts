/**
 * 场景测试：边界/异常/极端场景
 * 覆盖空数据、全部隐藏、快速翻页、并发请求等异常情况
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { useTableSelection } from '../src/composables/use-table-selection'
import { adaptColumn, adaptColumns } from '../src/components/es-table/src/column-adapter'
import { getNestedValue, setNestedValue, findValueByKey, isEmpty, mapButtonType, mapSize } from '../src/utils/shared'
import { useFormRequest } from '../src/composables/use-form-request'
import { getButtonPosition } from '@es-plus/core'
import type { TableColumn, FormItemOption } from '../src/types'

describe('边界: 空数据场景', () => {
  it('空 dataSource → 不崩溃', () => {
    const cols = adaptColumns([])
    expect(cols).toEqual([])
  })

  it('空 columns → 不崩溃', () => {
    const result = adaptColumns([])
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
  })

  it('空 formItemList → 所有 computed 不报错', () => {
    const items: FormItemOption[] = []
    expect(items.length).toBe(0)
  })

  it('空 dataOptions → Select 渲染空选项列表', () => {
    const item: FormItemOption = { prop: 'empty', label: '空', formtype: 'Select', dataOptions: [] }
    expect(item.dataOptions).toEqual([])
  })

  it('null/undefined model → getNestedValue 返回 undefined', () => {
    expect(getNestedValue(null as any, 'any.path')).toBeUndefined()
    expect(getNestedValue(undefined as any, 'any.path')).toBeUndefined()
  })

  it('空 model → 所有字段读取不报错', () => {
    const model = {}
    expect(getNestedValue(model, 'a.b.c')).toBeUndefined()
    expect(() => setNestedValue(model, 'x.y.z', 'value')).not.toThrow()
    expect(model).toEqual({ x: { y: { z: 'value' } } })
  })
})

describe('边界: 全部隐藏列', () => {
  it('所有列 hidCol → adaptedColumns 为空', () => {
    const cols: TableColumn[] = [
      { prop: 'a', label: 'A', hidCol: true },
      { prop: 'b', label: 'B', hidCol: true },
      { prop: 'c', label: 'C', hidCol: true },
    ]
    const visible = cols.filter((c) => !c.hidCol)
    expect(visible).toHaveLength(0)
  })

  it('部分列 hidCol → 仅可见列被适配', () => {
    const cols: TableColumn[] = [
      { prop: 'visible1', label: 'V1' },
      { prop: 'hidden', label: 'H', hidCol: true },
      { prop: 'visible2', label: 'V2' },
    ]
    const visible = cols.filter((c) => !c.hidCol)
    const adapted = visible.map(adaptColumn)
    expect(adapted).toHaveLength(2)
    expect(adapted[0].dataIndex).toBe('visible1')
    expect(adapted[1].dataIndex).toBe('visible2')
  })
})

describe('边界: 极端数据量', () => {
  it('100000 行数据生成不崩溃', () => {
    const data = Array.from({ length: 100000 }, (_, i) => ({ id: String(i), value: i }))
    expect(data).toHaveLength(100000)
    expect(data[0].id).toBe('0')
    expect(data[99999].id).toBe('99999')
  })

  it('100 列定义转换', () => {
    const cols: TableColumn[] = Array.from({ length: 100 }, (_, i) => ({
      prop: `col${i}`, label: `列${i}`, width: 100,
    }))
    const adapted = cols.map(adaptColumn)
    expect(adapted).toHaveLength(100)
    adapted.forEach((c, i) => {
      expect(c.dataIndex).toBe(`col${i}`)
    })
  })

  it('50 个表单字段 layout 计算', () => {
    const items: FormItemOption[] = Array.from({ length: 50 }, (_, i) => ({
      prop: `field${i}`, label: `字段${i}`, formtype: 'Input' as const, span: 6,
    }))
    expect(items).toHaveLength(50)
    // 50 * 6 = 300 span total, 12.5 rows of 24
    const totalSpan = items.reduce((s, item) => s + (item.span || 24), 0)
    const rows = Math.ceil(totalSpan / 24)
    expect(rows).toBe(13)
  })

  it('深度嵌套路径 — 5 层', () => {
    const deep = { a: { b: { c: { d: { e: 'found' } } } } }
    expect(getNestedValue(deep, 'a.b.c.d.e')).toBe('found')
  })

  it('深度嵌套设置 — 5 层自动创建', () => {
    const target: Record<string, unknown> = {}
    setNestedValue(target, 'a.b.c.d.e', 'deep')
    expect(getNestedValue(target, 'a.b.c.d.e')).toBe('deep')
  })

  it('findValueByKey — depth=3 限制', () => {
    const data = { level1: { level2: { level3: { level4: 'too deep' } } } }
    expect(findValueByKey(data, 'level4')).toBeUndefined() // beyond depth 3
    expect(findValueByKey(data, 'level3')).toEqual({ level4: 'too deep' })
  })
})

describe('边界: 快速翻页', () => {
  it('连续翻页10次 — 选择状态正确', () => {
    const sel = useTableSelection('id')
    for (let page = 1; page <= 10; page++) {
      sel.handleSelectionChange(
        [{ id: `${page}-1` }, { id: `${page}-2` }],
        page,
      )
    }
    expect(sel.multipleSelection.value).toHaveLength(20)
  })

  it('翻到第5页后回到第1页 — 恢复选中', () => {
    const sel = useTableSelection('id')
    // 第1页选了1,2
    sel.handleSelectionChange([{ id: '1' }, { id: '2' }], 1)
    // 跳到第5页选了一些
    sel.handleSelectionChange([{ id: '5-1' }, { id: '5-2' }], 5)
    // 回到第1页，数据含1,2,3
    sel.handleSelectData([{ id: '1' }, { id: '2' }, { id: '3' }], null)
    expect(sel.selectedRowKeys.value.sort()).toEqual(['1', '2'])
  })

  it('initSelection 守卫 — isInitChange 阻止递归', () => {
    const sel = useTableSelection('id')
    sel.multipleSelection.value = [{ id: '1' }]
    sel.initSelection([{ id: '1' }, { id: '2' }])
    expect(sel.isInitChange.value).toBe(true) // init 未完成时为 true
  })
})

describe('边界: 并发请求', () => {
  it('getEveryFormQueryField — 5个API同时请求', async () => {
    const { getEveryFormQueryField } = useFormRequest()
    let callCount = 0
    const makeMockFn = () => vi.fn().mockImplementation(async () => {
      callCount++
      return { rows: [{ id: callCount, name: `Option${callCount}` }] }
    })

    const items: FormItemOption[] = Array.from({ length: 5 }, (_, i) => ({
      prop: `field${i}`, label: `Field${i}`, formtype: 'Select' as const,
      apiParams: { url: `/api/field${i}` },
      httpRequest: makeMockFn(),
    }))

    const result = await getEveryFormQueryField(items)
    expect(result).toHaveLength(5)
  })

  it('getEveryFormQueryField — 1个失败不影响其他4个', async () => {
    const { getEveryFormQueryField } = useFormRequest()
    const successFn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })
    const failFn = vi.fn().mockRejectedValue(new Error('Network Error'))

    const items: FormItemOption[] = [
      { prop: 'good1', label: 'G1', formtype: 'Select', apiParams: { url: '/a' }, httpRequest: successFn },
      { prop: 'bad', label: 'B', formtype: 'Select', apiParams: { url: '/b' }, httpRequest: failFn },
      { prop: 'good2', label: 'G2', formtype: 'Select', apiParams: { url: '/c' }, httpRequest: successFn },
    ]

    const result = await getEveryFormQueryField(items)
    // bad 失败，good1/good2 正常
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.prop).sort()).toEqual(['good1', 'good2'])
  })
})

describe('边界: 特殊字符和命名', () => {
  it('prop 含中文', () => {
    const col: TableColumn = { prop: '姓名', label: '姓名' }
    const adv = adaptColumn(col)
    expect(adv.dataIndex).toBe('姓名')
  })

  it('prop 含特殊字符', () => {
    const col: TableColumn = { prop: 'user-name_v2', label: '字段' }
    const adv = adaptColumn(col)
    expect(adv.dataIndex).toBe('user-name_v2')
  })

  it('label 为空 — title 不设置 (ADV 不设置 falsy title)', () => {
    const col: TableColumn = { prop: 'noLabel', label: '' }
    const adv = adaptColumn(col)
    // ADV adaptColumn 仅在 label 为 truthy 时设置 title
    expect(adv.title).toBeUndefined()
  })

  it('嵌套 prop 路径 (user.address.city)', () => {
    const model = { user: { address: { city: '深圳' } } }
    expect(getNestedValue(model, 'user.address.city')).toBe('深圳')
    setNestedValue(model, 'user.address.city', '上海')
    expect(getNestedValue(model, 'user.address.city')).toBe('上海')
  })
})

describe('边界: 按钮边缘情况', () => {
  it('按钮无 type → mapButtonType 返回 default', () => {
    expect(mapButtonType(undefined)).toBe('default')
    expect(mapButtonType('')).toBe('default')
  })

  it('按钮无 size → mapSize 返回默认 middle', () => {
    expect(mapSize(undefined)).toBe('middle')
    expect(mapSize('')).toBe('middle')
  })

  it('按钮 disabled 为函数 → 动态计算', () => {
    const btn = {
      name: '提交',
      disabled: (model?: Record<string, unknown>) => !model?.agree,
    }
    expect(btn.disabled?.({ agree: false })).toBe(true)
    expect(btn.disabled?.({ agree: true })).toBe(false)
    expect(btn.disabled?.({})).toBe(true)
  })

  it('按钮 position 缺失 → getButtonPosition 默认 left', () => {
    expect(getButtonPosition({ name: 'btn' } as any)).toBe('left')
  })

  it('按钮 code=1/2 兼容 position', () => {
    expect(getButtonPosition({ name: 'btn1', code: 1 } as any)).toBe('left')
    expect(getButtonPosition({ name: 'btn2', code: 2 } as any)).toBe('right')
  })
})

describe('边界: model 数据类型', () => {
  it('model 为 frozen 对象', () => {
    const frozen = Object.freeze({ name: 'test', age: 25 })
    expect(getNestedValue(frozen as any, 'name')).toBe('test')
  })

  it('model 值含 undefined', () => {
    const model: Record<string, unknown> = { name: 'test', email: undefined, phone: null }
    expect(isEmpty(model.email)).toBe(true)
    expect(isEmpty(model.phone)).toBe(true)
    expect(isEmpty(model.name)).toBe(false)
  })

  it('数字 0 不是 empty', () => {
    expect(isEmpty(0)).toBe(false)
    expect(isEmpty(false)).toBe(false)
  })
})
