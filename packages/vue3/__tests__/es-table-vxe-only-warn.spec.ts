/**
 * P0-1 运行时那一半：手写 `<es-table :options>` 不经过生成器，vxe-only 键配在默认引擎上
 * 修前会被 TABLE_INTERNAL_KEYS 静默剥掉、零输出。这里用真组件挂载证明告警确实发生。
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider } from 'element-plus'
import EsTable from '../src/components/es-table/src/component.vue'
import { __resetVxeOnlyWarnings } from '@es-plus/core'

vi.stubGlobal(
  'ResizeObserver',
  vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }))
)

const mountTable = (options: Record<string, unknown>) =>
  mount(EsTable, {
    props: { dataSource: [{ name: 'a' }], columns: [{ prop: 'name', label: '姓名' }], options },
    global: { components: { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider } },
  })

describe('EsTable vxe-only 键运行时告警（P0-1）', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    __resetVxeOnlyWarnings()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
    document.body.innerHTML = ''
  })

  const vxeWarnings = () =>
    warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("只在 engine: 'vxe' 下生效"))

  it('默认引擎 + editConfig → 挂载即告警，点名键与渲染端', () => {
    mountTable({ editConfig: { trigger: 'click' } })
    const hits = vxeWarnings()
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('[es-plus/vue3]')
    expect(hits[0]).toContain('options.editConfig')
  })

  it('engine: vxe 时不告警', () => {
    // vxe 引擎组件在测试环境不注册也无妨：只断言不发本条告警
    mountTable({ engine: 'vxe', editConfig: {} })
    expect(vxeWarnings()).toEqual([])
  })

  it('没配 vxe-only 键时不告警', () => {
    mountTable({ border: true })
    expect(vxeWarnings()).toEqual([])
  })
})
