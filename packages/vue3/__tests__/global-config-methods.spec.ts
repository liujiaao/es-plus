import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider, ElForm } from 'element-plus'

// 与 es-form.spec.ts 同一组 mock：EsForm 与 use-dialog / es-table 之间有循环依赖，
// 在测试环境里裸 import 会在 `EsForm.install = ...` 处拿到 undefined。
vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsTable from '../src/components/es-table/src/component.vue'
import EsForm from '../src/components/es-form/src/es-form.vue'
import { configureEsPlus, resetGlobalConfig } from '../src/config'
import type { TableColumn } from '../src/types'

/**
 * `configureEsPlus()` 路径下的**组件档配置**（docs/usage.md 模式二）。
 *
 * 为什么单独一条：`app.use(ESPlus, { EsTable: { methods } })` 由 Plugin `provide` 出**平的**
 * 方法表，组件读平键天然通；而 `configureEsPlus` 写进模块单例的是**原样的**
 * `{ methods: {...} }`。组件回落到单例时若不展平，`configQueryFieldOutput` /
 * `paginationLayout` / `fieldFieldOutput` 全部读成 undefined —— 文档整段示例配了等于没配，
 * 而 `$httpRequest` 另有 `resolveHttpRequest` 兜底，缺陷被掩盖，只有这三个键坏。
 *
 * 断言的是**渲染结果**，不是内部字段，免得「函数被调用过」这种假绿。
 */

const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
vi.stubGlobal('ResizeObserver', mockResizeObserver)

const globalComponents = { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider }

const columns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'status', label: '状态', width: 100 }
]

const mountTable = (props: Record<string, unknown> = {}) =>
  mount(EsTable, {
    // 有 total 才会渲染分页器；数据本身无关（列渲染另有用例）
    props: { dataSource: [], columns, pagination: { current: 1, pageSize: 10, total: 30 }, ...props },
    global: { components: globalComponents }
  })

describe('configureEsPlus 的 EsTable.methods 必须生效', () => {
  afterEach(() => resetGlobalConfig())

  it('paginationLayout（methods 内）改到 el-pagination 的 layout / page-sizes / background', async () => {
    configureEsPlus({
      EsTable: {
        methods: {
          paginationLayout: () => ({
            layout: 'total, prev, pager, next',
            pageSizes: [5, 15],
            background: false
          })
        }
      }
    })

    const wrapper = mountTable()
    await wrapper.vm.$nextTick()

    const pagination = wrapper.findComponent(ElPagination)
    expect(pagination.exists()).toBe(true)
    expect(pagination.props('layout')).toBe('total, prev, pager, next')
    // 当前 pageSize(10) 不在 [5,15] 里，组件会把它补进去（否则 el-pagination 会回退到 5）
    expect(pagination.props('pageSizes')).toEqual([5, 10, 15])
    expect(pagination.props('background')).toBe(false)
  })
})

describe('configureEsPlus 的 EsForm.methods 必须生效', () => {
  afterEach(() => resetGlobalConfig())

  it('fieldFieldOutput（methods 内）真的改变了远端选项的字段映射', async () => {
    // 响应里只有 `items`：默认映射读的是 `data`，所以「选项渲出来」只可能来自全局映射。
    // 请求函数挂在字段上（item 级 httpRequest），把变量隔离到 fieldFieldOutput 一个键。
    // 映射函数必须**展开 defaults**：`configFormField` 会用 `checkQueryFields` 校验返回
    // 对象是否四项齐全，缺项即整体回落到默认映射（静默），是本仓的既有契约。
    configureEsPlus({
      EsForm: {
        methods: {
          fieldFieldOutput: (defaults: Record<string, string>) => ({
            ...defaults,
            listData: 'items',
            total: 'total'
          })
        }
      }
    })

    const wrapper = mount(EsForm, {
      props: {
        model: { category: '' },
        formItemList: [
          {
            prop: 'category',
            label: '分类',
            formtype: 'Radio',
            span: 24,
            apiParams: { url: '/api/categories', method: 'GET' },
            httpRequest: async () => ({ items: [{ label: '选项A', value: 'a' }] })
          }
        ]
      },
      global: { components: { ElConfigProvider } }
    })
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Radio 的选项是内联渲染的（Select 的选项挂在 teleport 的 popper 里，未展开时不在 DOM，
    // 拿它断言会得到「配置生效了但查不到」的假红）。
    expect(wrapper.text()).toContain('选项A')
  })
})

/**
 * `EsForm.defaults`（全局默认布局）：兑现类型注释里承诺的「全局默认 props」。
 *
 * 关注的不是 formLayProps 里能塞什么，而是**合并语义**：实例只改一个键时，
 * 全局默认的其余键不能被整块挤掉（一层浅合并就会这样）。
 */
describe('EsForm.defaults', () => {
  afterEach(() => resetGlobalConfig())

  it('defaults.formLayProps 落到 el-form 的 label-width', async () => {
    configureEsPlus({ EsForm: { defaults: { formLayProps: { labelWidth: '96px' } } } })
    const wrapper = mount(EsForm, {
      props: { model: {}, formItemList: [] },
      global: { components: { ElConfigProvider } }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(ElForm).props('labelWidth')).toBe('96px')
  })

  it('实例只给另一个键时，全局默认的 labelWidth 仍然保留', async () => {
    configureEsPlus({ EsForm: { defaults: { formLayProps: { labelWidth: '96px' } } } })
    const wrapper = mount(EsForm, {
      props: {
        model: {},
        formItemList: [],
        layoutFormProps: { formLayProps: { labelPosition: 'top' } }
      },
      global: { components: { ElConfigProvider } }
    })
    await wrapper.vm.$nextTick()

    const form = wrapper.findComponent(ElForm)
    expect(form.props('labelWidth')).toBe('96px')
    expect(form.props('labelPosition')).toBe('top')
  })
})
