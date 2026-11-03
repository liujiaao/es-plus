import { describe, it, expect } from 'vitest'
import { describeUnrenderedFeatures } from '../src/preview-hints.js'
import type { StructuredCrudConfig } from '../src/structured-config.schema.js'

/**
 * preview-hints 是「配置里有、预览画不出来」的**唯一判据**（站点提示条与 MCP
 * 摘要共用）。它一旦过度宣称，提示条就成了噪音，用户很快学会无视它 ——
 * 那时真正的「生成器丢了需求」也一起被无视。
 *
 * 因此这里钉两条相反方向的规则：
 *   1. 有对应键 → 必须有 hint（不能沉默）；
 *   2. 没有对应键 / 预览已能渲染（dialogs、actions、分页）→ 不得有 hint（不能吹牛）。
 */

const base = (over: Partial<StructuredCrudConfig> = {}): StructuredCrudConfig =>
  ({
    name: 'user',
    apiUrl: '/api/user',
    fields: [
      { prop: 'name', label: '姓名', formtype: 'Input' },
      { prop: 'status', label: '状态', formtype: 'Select' },
    ],
    ...over,
  }) as StructuredCrudConfig

describe('describeUnrenderedFeatures', () => {
  it('普通 CRUD 配置零 hint（不制造噪音）', () => {
    expect(describeUnrenderedFeatures(base())).toEqual([])
  })

  it('dialogs / actions / toolbarBtns 不产生 hint —— 预览已能渲染', () => {
    const config = base({
      actions: ['add', 'edit', 'delete'],
      dialogs: { add: { title: '新增', formItems: [] } },
    } as Partial<StructuredCrudConfig>)
    expect(describeUnrenderedFeatures(config)).toEqual([])
  })

  it('字段级 render：点名 prop', () => {
    const hints = describeUnrenderedFeatures(
      base({
        fields: [
          { prop: 'name', label: '姓名', formtype: 'Input' },
          { prop: 'status', label: '状态', formtype: 'Select', render: 'row.status === 1' },
        ],
      } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('status')
    expect(hints[0]).toContain('render')
  })

  it('字段级 formatter：点名 prop', () => {
    const hints = describeUnrenderedFeatures(
      base({
        fields: [
          { prop: 'amount', label: '金额', formtype: 'Input', formatter: 'v => `¥${v}`' },
        ],
      } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('amount')
    expect(hints[0]).toContain('formatter')
  })

  it('virtual：说明预览用模拟数据，需真实数据量验证', () => {
    const hints = describeUnrenderedFeatures(
      base({ tableOptions: { virtual: true } } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('虚拟滚动')
  })

  it('multiSelect：说明批量操作栏需宿主实现；cachePageSelection 一并点名', () => {
    const plain = describeUnrenderedFeatures(
      base({ tableOptions: { multiSelect: true } } as Partial<StructuredCrudConfig>),
    )
    expect(plain).toHaveLength(1)
    expect(plain[0]).toContain('批量操作栏')
    expect(plain[0]).not.toContain('cachePageSelection')

    const cached = describeUnrenderedFeatures(
      base({
        tableOptions: { multiSelect: true, cachePageSelection: true },
      } as Partial<StructuredCrudConfig>),
    )
    expect(cached[0]).toContain('cachePageSelection')
  })

  it("mode:'sfc'：说明预览渲染的是 schema 视图", () => {
    const hints = describeUnrenderedFeatures(
      base({ mode: 'sfc' } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('schema 视图')
  })

  it('弹窗自定义体（hasCustomRender）：点名弹窗，说明预览里是空壳', () => {
    const hints = describeUnrenderedFeatures(
      base({
        dialogs: { add: { hasCustomRender: true } },
      } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('add')
    expect(hints[0]).toContain('空壳')
  })

  it("弹窗 action:'custom' 的按钮：点名按钮，不误报 confirm / cancel", () => {
    const hints = describeUnrenderedFeatures(
      base({
        dialogs: {
          add: {
            formItems: [],
            configBtn: [
              { name: '导出明细', action: 'custom' },
              { name: '确定', action: 'confirm' },
              { name: '取消', action: 'cancel' },
            ],
          },
        },
      } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('add/导出明细')
    expect(hints[0]).not.toContain('确定')
    expect(hints[0]).not.toContain('取消')
  })

  it('省略 action 的弹窗按钮同样没有处理函数（schema 模式）', () => {
    const hints = describeUnrenderedFeatures(
      base({
        dialogs: { view: { formItems: [], configBtn: [{ name: '更多' }] } },
      } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain('view/更多')
  })

  it('弹窗只有底座键（开合 / 宽度 / formItems）时不产生 hint', () => {
    const hints = describeUnrenderedFeatures(
      base({
        dialogs: {
          add: {
            title: '新增',
            width: 600,
            formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
            configBtn: [
              { name: '确定', action: 'confirm' },
              { name: '取消', action: 'cancel' },
            ],
          },
        },
      } as Partial<StructuredCrudConfig>),
    )
    expect(hints).toEqual([])
  })

  it('每条 hint 都能在 config 里找到对应键（hint ↔ key 一一对应）', () => {
    // 组合配置：四个信号各一条，数量必须与「有键」数量一致
    const hints = describeUnrenderedFeatures(
      base({
        mode: 'sfc',
        tableOptions: { virtual: true, multiSelect: true, cachePageSelection: true },
        fields: [
          { prop: 'status', label: '状态', formtype: 'Select', render: 'row.status' },
          { prop: 'amount', label: '金额', formtype: 'Input', formatter: 'v => v' },
        ],
      } as Partial<StructuredCrudConfig>),
    )
    // render + formatter + virtual + multiSelect + mode = 5
    expect(hints).toHaveLength(5)
  })
})
