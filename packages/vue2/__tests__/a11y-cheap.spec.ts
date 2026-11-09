/**
 * 廉价可访问性（W4）：表格 aria-busy / 空态 role="status"、弹窗图标按钮 aria-label + 键盘可达。
 *
 * 本包没有 @vue/test-utils（见 es-dialog-show-close.spec.ts 的说明），直接用 Vue 2.7 构造函数；
 * element-ui 会解析到根部的 vue@3，故不加载真实组件，用最小桩接住 `#empty` 插槽与弹窗头部。
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import Vue from 'vue'
import { configureEsPlus, resetGlobalConfig } from '@es-plus/core'
import EsTable from '../src/components/es-table/component.vue'
import EsDialog from '../src/components/es-dialog/component.vue'
import RenderJsx from '../src/components/es-dialog/render-jsx.vue'

/** Vue 2.7：`<template #x>` 落在 $scopedSlots（函数），普通子节点落在 $slots（数组） */
const slotStub = (name: string) => ({
  methods: {
    renderSlot(this: any) {
      const scoped = this.$scopedSlots[name]
      if (typeof scoped === 'function') return scoped()
      return this.$slots[name] || []
    },
  },
  render(this: any, h: (tag: string, children?: unknown) => unknown) {
    return h('div', this.renderSlot())
  },
})

const ElTableStub = { name: 'ElTable', ...slotStub('empty') }
const ElDialogStub = { name: 'ElDialog', ...slotStub('title') }

const mountTable = (props: Record<string, unknown> = {}) => {
  const vm = new (Vue as unknown as new (o: unknown) => any)({
    ...(EsTable as unknown as Record<string, unknown>),
    components: { 'el-table': ElTableStub },
    propsData: {
      dataSource: [],
      columns: [{ prop: 'id', label: 'ID' }],
      options: {},
      pagination: { current: 1, pageSize: 10, total: 0 },
      ...props,
    },
  }).$mount()
  return vm as { $el: HTMLElement }
}

const mountDialog = async (propsData: Record<string, unknown> = {}) => {
  const vm = new (Vue as unknown as new (o: unknown) => any)({
    ...(EsDialog as unknown as Record<string, unknown>),
    components: { RenderJsx, 'el-dialog': ElDialogStub },
    propsData: { visible: true, ...propsData },
  }).$mount()
  await Vue.nextTick()
  await Vue.nextTick()
  return vm as { $el: HTMLElement }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  resetGlobalConfig()
})

describe('EsTable（vue2）可访问性', () => {
  it('加载中容器 aria-busy="true"', async () => {
    const vm = mountTable({ options: { loading: true } })
    await Vue.nextTick()
    expect(vm.$el.querySelector('.page-loading-con')?.getAttribute('aria-busy')).toBe('true')
  })

  it('空数据时空态带 role="status"', () => {
    const vm = mountTable()
    const empty = vm.$el.querySelector('.es-empty')
    expect(empty).toBeTruthy()
    expect(empty?.getAttribute('role')).toBe('status')
    expect(empty?.textContent).toContain('暂无数据')
  })

  it('空态文案跟随 locale', () => {
    configureEsPlus({ locale: 'en-US' })
    const vm = mountTable()
    expect(vm.$el.querySelector('.es-empty')?.textContent).toContain('No data')
  })

  it('P2-4：已挂载后 configureEsPlus({ locale }) 热切换（computed 桥，不是字符串快照）', async () => {
    const vm = mountTable()
    expect(vm.$el.querySelector('.es-empty')?.textContent).toContain('暂无数据')

    configureEsPlus({ locale: 'en-US' })
    await Vue.nextTick()
    expect(vm.$el.querySelector('.es-empty')?.textContent).toContain('No data')

    configureEsPlus({ locale: 'zh-CN' })
    await Vue.nextTick()
    expect(vm.$el.querySelector('.es-empty')?.textContent).toContain('暂无数据')
  })
})

describe('EsDialog（vue2）图标按钮可访问性', () => {
  it('全屏 / 关闭图标有 aria-label，且是 role="button" + tabindex="0"', async () => {
    const vm = await mountDialog()
    const fullscreen = vm.$el.querySelector('[aria-label="全屏"]')
    const close = vm.$el.querySelector('[aria-label="关闭"]')
    expect(fullscreen).toBeTruthy()
    expect(close).toBeTruthy()
    for (const el of [fullscreen!, close!]) {
      expect(el.getAttribute('role')).toBe('button')
      expect(el.getAttribute('tabindex')).toBe('0')
    }
  })

  it('全屏后可访问名切换成「退出全屏」', async () => {
    const vm = await mountDialog()
    ;(vm as any).handleFullscreen()
    await Vue.nextTick()
    expect(vm.$el.querySelector('[aria-label="退出全屏"]')).toBeTruthy()
  })

  it('可访问名跟随 locale', async () => {
    configureEsPlus({ locale: 'en-US' })
    const vm = await mountDialog()
    expect(vm.$el.querySelector('[aria-label="Fullscreen"]')).toBeTruthy()
    expect(vm.$el.querySelector('[aria-label="Close"]')).toBeTruthy()
  })
})
