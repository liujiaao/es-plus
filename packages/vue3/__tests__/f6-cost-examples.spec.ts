/**
 * F6「原生 vs es-plus：实测成本」的两组对照示例**必须真的能跑**。
 *
 * 为什么这条断言放在测试里而不是生成脚本里：`docs/examples/{native,es}/*.vue` 不进任何
 * 站点构建，`scripts/gen-cases-metrics.mjs` 只能把它们真编译一遍（挡住语法坏），挡不住
 * 「编译通过但渲染出来是空的」。而 Cases 页把实算的行数/事件/函数贴在它们旁边作卖点 ——
 * 若某侧悄悄坏掉，观众看到的就是「用更少代码做到了（其实没做到）」。
 *
 * 断言的不是两边源码相似，而是**同一场景两侧产出同一份可见结果**（行数、码值标签、
 * 空值占位、操作列），这正是成本对照成立的前提。新增对照场景时在这里补一组。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import NativeFilterTable from '../../../docs/examples/native/filter-table.vue'
import EsFilterTable from '../../../docs/examples/es/filter-table.vue'
import NativeStatusColumn from '../../../docs/examples/native/status-column.vue'
import EsStatusColumn from '../../../docs/examples/es/status-column.vue'

/** Element Plus 是全局注册的；示例本身只写标签，所以这里替它装上。 */
const mountExample = async (component: unknown) => {
  const wrapper = mount(component as never, { global: { plugins: [ElementPlus] } })
  // 表格数据走 http-request（Promise），等一个宏任务让首屏 row 落 DOM
  await new Promise((resolve) => setTimeout(resolve, 80))
  return wrapper
}

const tagLabels = (wrapper: Awaited<ReturnType<typeof mountExample>>) =>
  wrapper.findAll('.el-tag').map((tag) => tag.text())

describe('F6 成本对照示例：两侧在同一场景下产出同一份结果', () => {
  it('查询 + 表格 + 分页 + 行内查看：两侧都是 5 行、中文标签、可用的查询/重置/查看', async () => {
    const native = await mountExample(NativeFilterTable)
    const es = await mountExample(EsFilterTable)

    expect(native.findAll('.el-table__body tr')).toHaveLength(5)
    expect(es.findAll('.el-table__body tr')).toHaveLength(5)

    // 同一份标签序列 = 两边渲染的是同一批数据的同一套码值
    expect(tagLabels(es)).toEqual(tagLabels(native))
    expect(tagLabels(es)).toContain('待发货')

    // 查询区与操作列：原生是自己写的表单/按钮，es-plus 侧由 schema 的 formItems /
    // operationColumn / pagination 声明出来 —— 功能面必须一致
    for (const wrapper of [native, es]) {
      expect(wrapper.text()).toContain('查询')
      expect(wrapper.text()).toContain('重置')
      expect(wrapper.text()).toContain('查看')
      expect(wrapper.findAll('.el-pagination').length).toBeGreaterThan(0)
    }
  })

  it('码值列：两侧标签一致，空值都落「未支付」占位', async () => {
    const native = await mountExample(NativeStatusColumn)
    const es = await mountExample(EsStatusColumn)

    expect(tagLabels(es)).toEqual(tagLabels(native))
    expect(tagLabels(es)).toHaveLength(5)
    // 第 3 行没有支付时间 —— 两侧都显示占位文案而不是空白 / null
    expect(es.text()).toContain('未支付')
    expect(native.text()).toContain('未支付')
  })
})
