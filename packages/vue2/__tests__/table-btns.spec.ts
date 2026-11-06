/**
 * Vue 2 表格工具栏按钮（`table-btns.vue`）的渲染语义。
 *
 * 与 adapter-antdv 端同一组判据（三端按钮面必须一致）：位置分组、权限隐藏、
 * disabled 函数化、点击回调收到 instance、自定义 render、空配置不渲染容器。
 *
 * 不加载真实 element-ui：它被 hoist 到仓库根，内部 CJS `require('vue')` 会解析到
 * 根部的 vue@3。未注册的 `el-button` 作为未知元素渲染，但事件监听、属性透传与
 * setup 逻辑不受影响（与 `__tests__/es-table.spec.ts` 的挂载方式一致）。
 */
import { describe, it, expect, vi } from 'vitest'
import Vue from 'vue'
import TableBtns from '../src/components/es-table/table-btns.vue'

interface MountOpts {
  permission?: (v: string) => boolean
  instance?: Record<string, unknown>
  leftText?: string
}

function mountBtns(btnConfig: Array<Record<string, unknown>>, opts: MountOpts = {}): any {
  return new Vue({
    provide: {
      $EsPlus: { permission: opts.permission ?? (() => true) },
    },
    render: (h) =>
      h(TableBtns as any, {
        props: {
          btnConfig,
          instance: opts.instance ?? { id: 1 },
          leftText: opts.leftText ?? '',
        },
      }),
  }).$mount()
}

const buttons = (vm: any): any[] => Array.from(vm.$el.querySelectorAll('el-button'))
const texts = (vm: any): string[] => buttons(vm).map((b: any) => b.textContent.replace(/\s+/g, ''))

describe('table-btns（vue2）— 按钮面', () => {
  it('code/position 决定分组', () => {
    const vm = mountBtns([
      { name: '左', position: 'left' },
      { name: '右', position: 'right' },
    ])

    expect(vm.$el.querySelector('.btn-left').textContent).toContain('左')
    expect(vm.$el.querySelector('.btn-right').textContent).toContain('右')
  })

  it('未通过 permissionValue 的按钮整条隐藏', () => {
    const vm = mountBtns(
      [
        { name: '新增', position: 'left', permissionValue: 'order:add' },
        { name: '删除', position: 'left', permissionValue: 'order:delete' },
      ],
      { permission: (v) => v !== 'order:delete' },
    )

    expect(texts(vm)).toEqual(['新增'])
  })

  it('isHide 为函数时会求值', () => {
    const vm = mountBtns([
      { name: '显示', position: 'left', isHide: () => false },
      { name: '隐藏', position: 'left', isHide: () => true },
    ])

    expect(texts(vm)).toEqual(['显示'])
  })

  it('disabled 既支持布尔也支持函数', () => {
    const vm = mountBtns([
      { name: '固定禁用', position: 'left', disabled: true },
      { name: '动态禁用', position: 'left', disabled: () => true },
      { name: '可用', position: 'left' },
    ])

    const [a, b, c] = buttons(vm)
    expect(a.hasAttribute('disabled')).toBe(true)
    expect(b.hasAttribute('disabled')).toBe(true)
    expect(c.hasAttribute('disabled')).toBe(false)
  })

  it('点击回调收到 instance（签名对齐其他两端：单参数）', () => {
    const click = vi.fn()
    const instance = { id: 42 }
    const vm = mountBtns([{ name: '导出', position: 'left', click }], { instance })

    buttons(vm)[0].click()

    expect(click).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledWith(instance)
  })

  it('render 自定义渲染走 RenderDom，不生成 el-button', () => {
    const render = vi.fn(() => null)
    const vm = mountBtns([
      { name: '自定义', position: 'left', render },
    ])

    // vue2 端的 RenderDom 直接调 `props.render()`（不像 vue3 会传入 h），
    // 这里只钉住「走了自定义分支、没有再生成按钮」
    expect(render).toHaveBeenCalledTimes(1)
    expect(buttons(vm)).toHaveLength(0)
  })

  it('没有按钮也没有 leftText 时整块容器不渲染', () => {
    const vm = mountBtns([], { leftText: '' })

    // v-if 为假时 Vue 2 渲染的是注释占位节点
    expect(vm.$el.nodeType).toBe(8)
  })
})
