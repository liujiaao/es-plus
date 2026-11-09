/**
 * P0-2 + P0-1（antdv 端运行时告警）：
 *   - a-table 无虚拟滚动：一次渲染 >1000 行必须告警（判的是**实际渲染行数**，挂载即判）；
 *   - vxe-only 键配在默认引擎上必须告警（手写配置不经过生成器）。
 *
 * 两条都**不**用 import.meta.env.DEV 门控：本包经 vite lib 构建发布，DEV 在 dist 里是 false。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { __resetVxeOnlyWarnings } from '@es-plus/core'

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
      render() {
        return h('div')
      },
    },
    Pagination: passthrough('APagination'),
    Spin: passthrough('ASpin'),
    ConfigProvider: passthrough('AConfigProvider'),
    Tooltip: passthrough('ATooltip'),
    Tag: passthrough('ATag'),
    Button: passthrough('AButton'),
    Space: passthrough('ASpace'),
  }
})

import EsTable from '../src/components/es-table/src/component.vue'

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, name: `r${i}` }))
const mountTable = (props: Record<string, unknown>) =>
  mount(EsTable, { props: { columns: [{ prop: 'name', label: '名称' }], ...props } })

describe('antdv es-table 运行时告警', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    __resetVxeOnlyWarnings()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  const msgs = (needle: string) => warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(needle))

  it('挂载即渲染 1200 行 → 告警一次（点名行数与 vxe 出路）', () => {
    mountTable({ dataSource: rows(1200) })
    const hits = msgs('没有虚拟滚动')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('1200')
    expect(hits[0]).toContain("engine: 'vxe'")
  })

  it('1000 行（阈值内）→ 不告警', () => {
    mountTable({ dataSource: rows(1000) })
    expect(msgs('没有虚拟滚动')).toEqual([])
  })

  it('5000 行但本地分页（每页 20）→ 实际只渲染 20 行，不误报', () => {
    mountTable({ dataSource: rows(5000), options: { localPagination: true }, pagination: { pageSize: 20 } })
    expect(msgs('没有虚拟滚动')).toEqual([])
  })

  it('engine: vxe → 不告警（vxe-grid 自带虚拟滚动）', () => {
    mountTable({ dataSource: rows(1200), options: { engine: 'vxe' } })
    expect(msgs('没有虚拟滚动')).toEqual([])
  })

  it('默认引擎 + toolbarConfig → vxe-only 告警点名 antdv', () => {
    mountTable({ dataSource: rows(3), options: { toolbarConfig: { refresh: true } } })
    const hits = msgs("只在 engine: 'vxe' 下生效")
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('[es-plus/antdv]')
    expect(hits[0]).toContain('options.toolbarConfig')
  })
})
