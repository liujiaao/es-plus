import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ElTable, ElTableColumn, ElPagination, ElConfigProvider } from 'element-plus'

import EsTable from '../src/components/es-table/src/component.vue'
import EsTableModule from '../src/components/es-table'
import { configureEsPlus, resetGlobalConfig } from '../src/config'
import type { TableColumn } from '../src/types'

/**
 * 两条「配了等于没配」的缺陷的回归：
 *
 * 1. **安装顺序**：Plugin 旧实现 `provide('$esPlusTable', { ...options.methods })` 是
 *    install 时的一次性**快照**。先 `app.use(ESPlus)` 再 `configureEsPlus({ EsTable })`
 *    就完全无效 —— 而文档从没说过这个顺序约束。
 * 2. **全局默认 props**：类型注释承诺 `EsTable` 档是「全局默认 props（优先级低于实例 props）」，
 *    但 `options` prop 的默认值就是 `{ ...defaultOptions }`，等于每个键都被显式给出，
 *    任何 defaults 合并都会被压掉。
 *
 * 断言的都是**外部可观察结果**（provide 出去的对象 / 渲染出的 el-table prop），不是内部变量。
 */

const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
vi.stubGlobal('ResizeObserver', mockResizeObserver)

const globalComponents = { ElTable, ElTableColumn, ElPagination, ElConfigProvider }

const columns: TableColumn[] = [{ prop: 'name', label: '姓名', width: 120 }]

const mountTable = (props: Record<string, unknown> = {}) =>
  mount(EsTable, {
    props: { dataSource: [], columns, ...props },
    global: { components: globalComponents }
  })

describe('Plugin 的 $esPlusTable 必须是读时视图，而不是 install 时的快照', () => {
  afterEach(() => resetGlobalConfig())

  it('install 之后再 configureEsPlus，provide 出去的对象读得到新值', () => {
    const provided: Record<string, unknown> = {}
    const app = {
      provide: (key: string, value: unknown) => {
        provided[key] = value
      },
      component: vi.fn()
    }
    // @ts-expect-error 测试用最小 app 桩
    ;(EsTableModule as unknown as { Plugin: { install: (a: unknown, o: unknown) => void } }).Plugin.install(app, {})
    expect(provided.$esPlusTable).toBeTruthy()
    expect((provided.$esPlusTable as Record<string, unknown>).httpRequest).toBeUndefined()

    const fn = () => Promise.resolve({})
    configureEsPlus({ EsTable: { httpRequest: fn } })

    expect((provided.$esPlusTable as Record<string, unknown>).httpRequest).toBe(fn)
  })
})

describe('EsTable.defaults（全局默认 props）', () => {
  afterEach(() => resetGlobalConfig())

  it('defaults 合并进实例 options，并落到 el-table 的 border 上', async () => {
    configureEsPlus({ EsTable: { defaults: { border: true } } })
    const wrapper = mountTable()
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(ElTable).props('border')).toBe(true)
  })

  it('实例 :options 优先于全局 defaults', async () => {
    configureEsPlus({ EsTable: { defaults: { border: true } } })
    const wrapper = mountTable({ options: { border: false } })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(ElTable).props('border')).toBe(false)
  })

  it('未配置 defaults 时沿用内置默认值（border 仍是 false）', async () => {
    const wrapper = mountTable()
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(ElTable).props('border')).toBe(false)
  })
})
