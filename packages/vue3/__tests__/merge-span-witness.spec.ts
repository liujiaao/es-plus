/**
 * AI-23 声明式合并单元格 —— vue3 端到端见证。
 * ────────────────────────────────────────────────────────────────────────
 * core 单测（merge-span.spec.ts）证明「相邻相等 → span 映射」纯函数正确；
 * shared 单测证明「生成器把 mergeConfig 发进 schema.tableOptions」；parity 守卫证明
 * 「三端都接了线」。但都**没有**证明「发射的 mergeConfig 喂进真实 EsTable 后，
 * 相邻相等的行**真的在 DOM 上合并了**」。本 spec 补这一环：
 *
 *   golden 172 ──generatePageSchema──▶ pageSchema
 *     ├─ schema.tableOptions.mergeConfig 深等输入（透传无损）
 *     └─ mount(真实 EsCrudPage + EsTable)──▶ el-table 的 span-method 真的生效：
 *          段首格带 rowspan=N，段内其余格**整格消失**（td 不再渲染）。
 *
 * 关键：DOM 结果（`<td rowspan="3">`）无法由「发射了字段」推出 —— 只有 span-method
 * 真的被 el-table 调用才会出现。用例取 golden 172（vue3/schema，rowsBy:['dept']）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import EsPlus from '../src/index'
import EsCrudPage from '../src/components/es-crud-page/src/es-crud-page.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'
import { loadGoldenConfig, generatePageSchema } from './runtime-harness'

/** 相邻相等的部门数据：研发 ×3（相邻）→ 段长 3；销售 ×1。 */
const rows = [
  { id: 1, dept: '研发', team: 'A', name: '张三', role: '工程师' },
  { id: 2, dept: '研发', team: 'A', name: '李四', role: '工程师' },
  { id: 3, dept: '研发', team: 'B', name: '王五', role: '工程师' },
  { id: 4, dept: '销售', team: 'C', name: '赵六', role: '销售' },
]

function mountPage(schema: CrudPageSchema): VueWrapper {
  return mount(EsCrudPage, {
    props: {
      schema,
      httpRequest: async () => ({ records: rows.length, rows }),
    },
    attachTo: document.body,
    global: { plugins: [ElementPlus, EsPlus] },
  })
}

describe('生成物运行时见证 — AI-23 声明式合并单元格（vue3 / el-table span-method）', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const config = loadGoldenConfig('172-dept-staff-merge-vue3.json')
  const schema = generatePageSchema(config)

  it('生成物 tableOptions.mergeConfig 与输入深等（透传无损）', () => {
    const to = schema.tableOptions as any
    expect(to.mergeConfig, '生成物应保留 mergeConfig（而非被 Zod / 适配层剥掉）').toEqual({ rowsBy: ['dept'] })
  })

  it('相邻相等的行真的在 DOM 上合并：段首格 rowspan=段长，段内其余格消失', async () => {
    const wrapper = mountPage(schema)
    await flushPromises()
    await nextTick()

    const tds = Array.from(wrapper.element.querySelectorAll('.el-table__body td')) as HTMLTableCellElement[]
    expect(tds.length, '表格应渲染出数据行').toBeGreaterThan(0)

    // 段首格：dept 列第一行带 rowspan="3"（研发段长 3），其余两行的 dept 格不渲染。
    const merged = tds.filter((td) => td.getAttribute('rowspan') === '3')
    expect(merged, '应恰有一个 rowspan=3 的格（研发段）').toHaveLength(1)
    expect(merged[0].textContent).toContain('研发')

    // 「研发」在正文里只出现一次 —— 段内其余两格真的被合并掉了，不是只是没设属性。
    const bodyText = wrapper.element.querySelector('.el-table__body')!.textContent || ''
    expect(bodyText.split('研发').length - 1, '「研发」应只渲染 1 次（其余被合并）').toBe(1)

    // 非合并列照常逐行渲染（team 的 B/C 各 1 次，name 四行各 1 次）。
    expect(bodyText).toContain('王五')
    expect(bodyText).toContain('赵六')
  })
})
