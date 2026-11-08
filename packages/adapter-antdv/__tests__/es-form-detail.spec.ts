/**
 * Ant Design Vue — EsForm 详情（只读）模式。
 *
 * 断言与 vue3/vue2 同规：14 种控件换成文本、label 布局不变、render 字段仍走函数、
 * triggerEvent 按钮（查询/重置）默认不渲染。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { FormItem as AFormItem } from 'ant-design-vue'
import { VALID_FORM_TYPES } from '@es-plus/core'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() },
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, { props: { model: {}, formItemList: [], ...props } })

const detailTexts = (wrapper: ReturnType<typeof mountForm>): string[] =>
  wrapper.findAll('.es-form-detail__text').map((n) => n.text())

describe('EsForm(ADV) detail 模式', () => {
  it('14 种控件都渲染成文本，不出现输入控件', () => {
    const formItemList = VALID_FORM_TYPES.map((formtype, i) => ({
      prop: `f${i}`,
      label: formtype,
      formtype,
      span: 24,
    }))
    const model = Object.fromEntries(formItemList.map((it, i) => [it.prop, `值${i}`]))
    const wrapper = mountForm({ mode: 'detail', model, formItemList })

    expect(wrapper.find('.es-form--detail').exists()).toBe(true)
    expect(wrapper.findAll('.es-form-detail__text')).toHaveLength(VALID_FORM_TYPES.length)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('dataOptions 映射标签、空值走占位文本', () => {
    const wrapper = mountForm({
      mode: 'detail',
      model: { status: 1, remark: '' },
      formItemList: [
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
        },
        { prop: 'remark', label: '备注', formtype: 'Input', emptyPlaceholder: '暂无' },
      ],
    })
    expect(detailTexts(wrapper)).toEqual(['启用', '暂无'])
  })

  it('label 与表单项数量跟编辑模式一致', () => {
    const formItemList = [{ prop: 'name', label: '姓名', formtype: 'Input', span: 12 }]
    const edit = mountForm({ model: { name: '张三' }, formItemList })
    const detail = mountForm({ mode: 'detail', model: { name: '张三' }, formItemList })
    expect(detail.findAllComponents(AFormItem)).toHaveLength(edit.findAllComponents(AFormItem).length)
    expect(detail.text()).toContain('姓名')
    expect(edit.find('input').exists()).toBe(true)
    expect(detail.find('input').exists()).toBe(false)
  })

  it('render 字段在 detail 下仍走自定义渲染', () => {
    const wrapper = mountForm({
      mode: 'detail',
      model: { extra: 'x' },
      formItemList: [
        {
          prop: 'extra',
          label: '扩展',
          render: (h: unknown) => ((h as any)('b', { class: 'custom-render' }, '自定义内容')),
        },
      ],
    })
    expect(wrapper.find('.custom-render').text()).toBe('自定义内容')
  })

  it('detail 下隐藏 triggerEvent 按钮，保留动作按钮', () => {
    const wrapper = mountForm({
      mode: 'detail',
      model: {},
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
      configBtn: [
        { name: '查询', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true },
        { name: '关闭', key: 'close' },
      ],
    })
    // Ant Design 会给两个汉字的按钮自动插入空格（关 闭），断言前先归一空白
    const text = wrapper.text().replace(/\s+/g, '')
    expect(text).toContain('关闭')
    expect(text).not.toContain('查询')
    expect(text).not.toContain('重置')
  })
})
