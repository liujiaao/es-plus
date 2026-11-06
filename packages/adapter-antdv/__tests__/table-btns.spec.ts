/**
 * 表格工具栏按钮（`table-btns.vue`）的渲染语义。
 *
 * 这个组件此前只被 `es-table` 的挂载测试间接碰到，本身没有任何直接测试 ——
 * 函数覆盖率里它 1/10。但它承载的是**用户可见的按钮面**：位置分组、类型/尺寸映射、
 * 权限隐藏、disabled 函数化、自定义 render、属性白名单透传。任何一条改错都不会让
 * 既有测试变红（表格照样渲染，只是按钮少了/位置错了），所以这里逐条钉住。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableBtns from '../src/components/es-table/src/table-btns.vue'

interface MountOpts {
  permission?: (v: string) => boolean
  instance?: Record<string, unknown>
}

function mountBtns(btnConfig: Array<Record<string, unknown>>, opts: MountOpts = {}) {
  return mount(TableBtns, {
    props: {
      btnConfig,
      instance: opts.instance ?? { id: 1 },
      leftText: '共 3 条',
    },
    global: {
      provide: {
        $EsPlus: { permission: opts.permission ?? (() => true) },
      },
    },
  })
}

const buttonTexts = (wrapper: any) =>
  wrapper.findAll('button').map((b: any) => b.text().replace(/\s+/g, ''))

describe('table-btns（adapter-antdv）— 按钮面', () => {
  it('左侧按钮带类型 / 尺寸映射，并透传额外属性', () => {
    const w = mountBtns([
      { name: '新增', type: 'primary', size: 'large', position: 'left' },
      { name: '删除', type: 'danger', position: 'left', 'data-extra': 'kept' },
    ])

    expect(buttonTexts(w)).toEqual(['新增', '删除'])
    // mapBtnType：primary 原样、danger → default + danger 标记
    const [add, del] = w.findAll('button')
    expect(add.classes().join(' ')).toContain('ant-btn-primary')
    expect(add.classes().join(' ')).toContain('ant-btn-lg') // mapBtnSize('large')
    expect(del.classes().join(' ')).toContain('ant-btn-dangerous') // mapBtnDanger('danger')
    // filterExtraProps：白名单外的键（data-extra）透传到 a-button → 根元素
    expect(del.attributes('data-extra')).toBe('kept')
    // 白名单内的内部键不外漏
    expect(del.attributes('permissionvalue')).toBeUndefined()
  })

  it('position 决定分组：右侧按钮进 .btn-right', () => {
    const w = mountBtns([
      { name: '左', position: 'left' },
      { name: '右', position: 'right' },
    ])

    expect(w.find('.btn-left').text()).toContain('左')
    expect(w.find('.btn-right').text()).toContain('右')
  })

  it('未通过 permissionValue 的按钮整条隐藏', () => {
    const w = mountBtns(
      [
        { name: '新增', position: 'left', permissionValue: 'order:add' },
        { name: '删除', position: 'left', permissionValue: 'order:delete' },
      ],
      { permission: (v) => v !== 'order:delete' },
    )

    expect(buttonTexts(w)).toEqual(['新增'])
  })

  it('disabled 既支持布尔也支持函数', () => {
    const w = mountBtns([
      { name: '固定禁用', position: 'left', disabled: true },
      { name: '动态禁用', position: 'left', disabled: () => true },
      { name: '可用', position: 'left' },
    ])

    const [a, b, c] = w.findAll('button')
    expect(a.attributes('disabled')).toBeDefined()
    expect(b.attributes('disabled')).toBeDefined()
    expect(c.attributes('disabled')).toBeUndefined()
  })

  it('点击回调收到 instance（与 vue3 签名一致：单参数）', () => {
    const click = vi.fn()
    const instance = { id: 42 }
    const w = mountBtns([{ name: '导出', position: 'left', click }], { instance })

    w.find('button').trigger('click')

    expect(click).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledWith(instance)
  })

  it('render 自定义渲染走 RenderDom，不生成 a-button', () => {
    const w = mountBtns([
      {
        name: '自定义',
        position: 'left',
        render: (render: any) => render('span', { class: 'custom-cell' }, 'hi'),
      },
    ])

    expect(w.find('.custom-cell').text()).toBe('hi')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('没有按钮也没有 leftText 时整块容器不渲染', () => {
    const w = mount(TableBtns, {
      props: { btnConfig: [], leftText: '' },
      global: { provide: { $EsPlus: { permission: () => true } } },
    })

    expect(w.find('.btns').exists()).toBe(false)
  })
})
