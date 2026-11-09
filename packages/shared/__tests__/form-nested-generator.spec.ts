/**
 * P1-3 第二期：嵌套对象容器在**生成器**一侧的落地见证。
 *
 * 运行时见证在 core / vue3 / vue2 / antdv 各自的 `*-nested.spec`；这里只钉生成物：
 *   - 容器不派生成控件字段（`formtype`/`attrs`/`formItemOptions`/`span` 一律不发）；
 *   - 子字段不预设栅格（列数由运行时的容器内 autoSpan 计算）；
 *   - 容器不派生表格列；
 *   - reactive 模型初值里有嵌套对象，且子字段用**相对 prop**；
 *   - TS 投影里是嵌套对象类型。
 */
import { describe, it, expect } from 'vitest'
import {
  generateFromConfig,
  buildModelInitLiteral,
  buildModelTypeMembers,
} from '../src/structured-generator'
import type { StructuredCrudConfig } from '../src/structured-generator'

const nestedFields = [
  { prop: 'customerName', label: '客户名称', formtype: 'Input' as const },
  { prop: 'phone', label: '联系电话', formtype: 'Input' as const },
  {
    prop: 'address',
    label: '联系地址',
    inTable: false,
    children: [
      { prop: 'province', label: '省', formtype: 'Select' as const },
      { prop: 'city', label: '市', formtype: 'Select' as const },
      { prop: 'detail', label: '详细地址', formtype: 'Input' as const },
    ],
  },
]

const nestedConfig: StructuredCrudConfig = {
  name: 'CustomerAddressManage',
  apiUrl: '/api/customers',
  fields: nestedFields as StructuredCrudConfig['fields'],
  actions: ['add', 'edit', 'delete'],
  typescript: true,
}

describe('嵌套对象容器 — 模型初值 / TS 投影', () => {
  it('buildModelInitLiteral 为容器产出嵌套对象，子字段用相对 prop', () => {
    expect(buildModelInitLiteral(nestedFields as never)).toBe(
      "customerName: '', phone: '', address: { province: '', city: '', detail: '' }"
    )
  })

  it('普通字段逐字保持历史形态（含点号 prop 的引号）', () => {
    expect(
      buildModelInitLiteral([
        { prop: 'name', label: '名称', formtype: 'Input' },
        { prop: 'extra.code', label: '编码', formtype: 'Input' },
      ] as never)
    ).toBe("name: '', 'extra.code': ''")
  })

  it('子字段 prop 已是绝对路径时不重复加前缀', () => {
    expect(
      buildModelInitLiteral([
        {
          prop: 'address',
          label: '地址',
          children: [{ prop: 'address.city', label: '市', formtype: 'Input' }],
        },
      ] as never)
    ).toBe("address: { city: '' }")
  })

  it('点号容器 prop 按段包成嵌套对象（最外一段是属性名，不是对象字面量）', () => {
    expect(
      buildModelInitLiteral([
        {
          prop: 'extra.address',
          label: '地址',
          children: [{ prop: 'city', label: '市', formtype: 'Input' }],
        },
      ] as never)
    ).toBe("extra: { address: { city: '' } }")
  })

  it('buildModelTypeMembers 产出嵌套对象类型', () => {
    expect(buildModelTypeMembers(nestedFields as never)).toEqual([
      '  customerName: string',
      '  phone: string',
      // Select 的模型是「标量值」，与 inferTsType 同源
      "  address: { province: string | number | ''; city: string | number | ''; detail: string }",
    ])
  })
})

describe('嵌套对象容器 — generateFromConfig 端到端（schema 模式）', () => {
  const result = generateFromConfig(nestedConfig)
  /** 取 `export const pageSchema ... = {…}` 的对象本体（import 行里也有 `{`，不能直接 indexOf）。 */
  const schema = JSON.parse(result.code.slice(result.code.indexOf('= {') + 2).replace(/;\s*$/, ''))

  it('表单项里容器不带 formtype / attrs / span，子字段挂在 children 下且不预设栅格', () => {
    const container = schema.formItems.find((i: { prop: string }) => i.prop === 'address')
    expect(container).toBeTruthy()
    expect(container.label).toBe('联系地址')
    expect(container.formtype).toBeUndefined()
    expect(container.attrs).toBeUndefined()
    expect(container.span).toBeUndefined()
    expect(container.children.map((c: { prop: string }) => c.prop)).toEqual(['province', 'city', 'detail'])
    for (const child of container.children) {
      expect(child.formtype).toBeTruthy()
      expect(child.span).toBeUndefined()
    }
  })

  it('弹窗表单里的容器同样不带栅格，子字段也不带', () => {
    const container = schema.dialogFormItems.find((i: { prop: string }) => i.prop === 'address')
    expect(container).toBeTruthy()
    expect(container.span).toBeUndefined()
    expect(container.children.every((c: { span?: number }) => c.span === undefined)).toBe(true)
  })

  it('容器不派生表格列（列仍只有两个普通字段）', () => {
    const props = schema.columns.map((c: { prop: string }) => c.prop)
    expect(props).toEqual(['customerName', 'phone'])
  })
})
