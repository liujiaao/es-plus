import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElSelect, ElOption, ElDatePicker, ElInputNumber,
  ElSwitch, ElRadioGroup, ElCheckboxGroup, ElCascader,
  ElRate, ElSlider, ElTimePicker, ElColorPicker, ElTransfer, ElUpload,
} from 'element-plus'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() },
}))

import EsForm from '../src/components/es-form/src/es-form.vue'
import { VALID_FORM_TYPES } from '@es-plus/core'

const globalComponents = {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElSelect, ElOption, ElDatePicker, ElInputNumber,
  ElSwitch, ElRadioGroup, ElCheckboxGroup, ElCascader,
  ElRate, ElSlider, ElTimePicker, ElColorPicker, ElTransfer, ElUpload,
}

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: { model: {}, formItemList: [], ...props },
    global: { components: globalComponents },
  })

describe('EsForm detail 模式（vue3）', () => {
  it('14 种控件都渲染成文本，不出现可编辑控件', () => {
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
    for (const tag of ['input', 'textarea', 'select']) {
      expect(wrapper.find(tag).exists()).toBe(false)
    }
  })

  it('dataOptions 命中输出 label，空值输出占位符', () => {
    const wrapper = mountForm({
      mode: 'detail',
      model: { status: 1, remark: '' },
      formItemList: [
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }],
        },
        { prop: 'remark', label: '备注', formtype: 'Input', emptyPlaceholder: '暂无' },
      ],
    })
    const texts = wrapper.findAll('.es-form-detail__text').map((n) => n.text())
    expect(texts).toEqual(['启用', '暂无'])
  })

  it('label 布局与编辑模式一致（同一个 el-form-item 结构）', () => {
    const formItemList = [{ prop: 'name', label: '姓名', formtype: 'Input', span: 12 }]
    const edit = mountForm({ model: { name: '张三' }, formItemList })
    const detail = mountForm({ mode: 'detail', model: { name: '张三' }, formItemList })
    expect(detail.findAll('.el-form-item')).toHaveLength(edit.findAll('.el-form-item').length)
    expect(detail.find('.el-form-item__label').text()).toBe(edit.find('.el-form-item__label').text())
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

  it('detail 下默认隐藏 triggerEvent 按钮（查询/重置），保留动作按钮', () => {
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
    const names = wrapper.findAll('.el-button').map((n) => n.text())
    expect(names).toContain('关闭')
    expect(names).not.toContain('查询')
    expect(names).not.toContain('重置')
  })

  it('edit 模式仍然渲染全部按钮与输入控件（回归）', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
      configBtn: [
        { name: '查询', key: 'query', triggerEvent: true },
        { name: '关闭', key: 'close' },
      ],
    })
    const names = wrapper.findAll('.el-button').map((n) => n.text())
    expect(names).toEqual(expect.arrayContaining(['查询', '关闭']))
    expect(wrapper.find('input').exists()).toBe(true)
  })
})
