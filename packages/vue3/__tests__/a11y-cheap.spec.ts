/**
 * 廉价可访问性（W4）：不做键盘网格，只补三条「读屏能听见」的语义。
 *
 *   1. 表格加载中 `aria-busy`（v-loading 只是视觉遮罩，读屏看不见）；
 *   2. 空态 `role="status"`（「请求回来但没数据」是一次状态变化，应播报）；
 *   3. 弹窗头部的图标按钮（全屏 / 关闭）有 `aria-label`，且键盘 Enter / Space 可触发
 *      —— `el-icon` 渲染成 `<i>`，没有 role、也不进 Tab 序列。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider, ElDialog, ElIcon,
} from 'element-plus'
import EsTable from '../src/components/es-table/src/component.vue'
import EsDialog from '../src/components/es-dialog/src/component.vue'
import { configureEsPlus, resetGlobalConfig } from '@es-plus/core'

vi.stubGlobal(
  'ResizeObserver',
  vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }))
)

const tableGlobal = { components: { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider } }

const mountTable = (propsOverrides: Record<string, unknown> = {}) =>
  mount(EsTable, {
    props: { dataSource: [], columns: [{ prop: 'name', label: '姓名' }], ...propsOverrides },
    global: tableGlobal,
  })

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(EsDialog, { props: { visible: true, render: () => null, ...props } })
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  return wrapper
}

afterEach(() => {
  resetGlobalConfig()
  document.body.innerHTML = ''
})

describe('EsTable 可访问性（廉价项）', () => {
  it('加载中容器 aria-busy="true"，空闲时回到 "false"', async () => {
    const wrapper = mountTable({ options: { loading: true } })
    expect(wrapper.find('.page-loading-con').attributes('aria-busy')).toBe('true')

    await wrapper.setProps({ options: { loading: false } })
    expect(wrapper.find('.page-loading-con').attributes('aria-busy')).toBe('false')
  })

  it('空数据时空态带 role="status"', () => {
    const wrapper = mountTable()
    const empty = wrapper.find('.es-empty')
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('role')).toBe('status')
    expect(empty.text()).toContain('暂无数据')
  })

  it('空态文案跟随 locale（computed 而非 import 时求值）', () => {
    configureEsPlus({ locale: 'en-US' })
    const wrapper = mountTable()
    expect(wrapper.find('.es-empty').text()).toContain('No data')
  })
})

describe('EsDialog 图标按钮可访问性', () => {
  it('全屏 / 关闭按钮有可访问名，全屏后名字切换成「退出全屏」', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('[aria-label="全屏"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="关闭"]').exists()).toBe(true)

    await wrapper.find('[aria-label="全屏"]').trigger('click')
    expect(wrapper.find('[aria-label="退出全屏"]').exists()).toBe(true)
  })

  it('可访问名跟随 locale', async () => {
    configureEsPlus({ locale: 'en-US' })
    const wrapper = await mountDialog()
    expect(wrapper.find('[aria-label="Fullscreen"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Close"]').exists()).toBe(true)
  })

  it('键盘可达：Enter 触发全屏，Space 触发关闭', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('[aria-label="全屏"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.find('i.el-icon[role="button"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="退出全屏"]').exists()).toBe(true)

    await wrapper.find('[aria-label="关闭"]').trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('图标按钮在 Tab 序列里（tabindex="0" + role="button"）', async () => {
    const wrapper = await mountDialog()
    const buttons = wrapper.findAll('.btns [role="button"]')
    expect(buttons).toHaveLength(2)
    for (const b of buttons) expect(b.attributes('tabindex')).toBe('0')
  })
})
