/**
 * 廉价可访问性（W4）：表格 aria-busy / 空态 role="status"、弹窗图标按钮 aria-label。
 *
 * 与 es-table.spec.ts 同法 mock 掉 ant-design-vue：这里只关心我们自己模板上的语义，
 * 底层组件的行为（键盘可达）由真实 <a-button> 提供，不在本用例的射程内。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { configureEsPlus, resetGlobalConfig } from '@es-plus/core'

vi.mock('ant-design-vue', () => {
  const passthrough = (name: string) => ({
    name,
    render(this: any) {
      return h('div', this.$slots.default?.())
    },
  })
  return {
    Table: {
      name: 'ATable',
      props: ['columns', 'dataSource', 'locale', 'loading', 'pagination'],
      render(this: any) {
        // 只要空态：模板自定义的 #emptyText 插槽必须真的被渲染
        return h('div', this.$slots.emptyText?.() ?? [])
      },
    },
    Pagination: passthrough('APagination'),
    Spin: passthrough('ASpin'),
    ConfigProvider: passthrough('AConfigProvider'),
    Tooltip: passthrough('ATooltip'),
    Tag: passthrough('ATag'),
    Button: passthrough('AButton'),
    Space: passthrough('ASpace'),
    Modal: {
      name: 'AModal',
      render(this: any) {
        return h('div', [this.$slots.title?.() ?? [], this.$slots.default?.() ?? []])
      },
    },
  }
})

import EsTable from '../src/components/es-table/src/component.vue'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountTable = (propsOverrides: Record<string, unknown> = {}) =>
  mount(EsTable, {
    props: { dataSource: [], columns: [{ prop: 'id', label: 'ID' }], options: {}, ...propsOverrides },
  })

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(EsDialog, { props: { visible: true, render: () => null, ...props } })

afterEach(() => {
  resetGlobalConfig()
})

describe('EsTable（antdv）可访问性', () => {
  it('加载中容器 aria-busy="true"，空闲时 "false"', async () => {
    const wrapper = mountTable({ options: { loading: true } })
    expect(wrapper.find('.table_containers').attributes('aria-busy')).toBe('true')
    await wrapper.setProps({ options: { loading: false } })
    expect(wrapper.find('.table_containers').attributes('aria-busy')).toBe('false')
  })

  it('空数据时空态带 role="status"', () => {
    const wrapper = mountTable()
    const empty = wrapper.find('.es-table__empty')
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('role')).toBe('status')
    expect(empty.text()).toBe('暂无数据')
  })

  it('空态文案跟随 locale', () => {
    configureEsPlus({ locale: 'en-US' })
    const wrapper = mountTable()
    expect(wrapper.find('.es-table__empty').text()).toBe('No data')
  })

  it('P2-4：已挂载后 configureEsPlus({ locale }) 热切换，无需重新挂载', async () => {
    const wrapper = mountTable()
    expect(wrapper.find('.es-table__empty').text()).toBe('暂无数据')

    configureEsPlus({ locale: 'en-US' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.es-table__empty').text()).toBe('No data')

    configureEsPlus({ locale: 'zh-CN' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.es-table__empty').text()).toBe('暂无数据')
  })
})

describe('EsDialog（antdv）图标按钮可访问性', () => {
  it('全屏 / 关闭按钮有可访问名，全屏后切换成「退出全屏」', async () => {
    const wrapper = mountDialog()
    expect(wrapper.find('[aria-label="全屏"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="关闭"]').exists()).toBe(true)

    await wrapper.find('[aria-label="全屏"]').trigger('click')
    expect(wrapper.find('[aria-label="退出全屏"]').exists()).toBe(true)
  })

  it('可访问名跟随 locale', () => {
    configureEsPlus({ locale: 'en-US' })
    const wrapper = mountDialog()
    expect(wrapper.find('[aria-label="Fullscreen"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Close"]').exists()).toBe(true)
  })
})
