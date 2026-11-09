import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElTabs, ElTabPane, ElCollapse, ElCollapseItem, ElSteps, ElStep
} from 'element-plus'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const globalComponents = {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElTabs, ElTabPane, ElCollapse, ElCollapseItem, ElSteps, ElStep
}

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: { model: {}, formItemList: [], ...props },
    global: { components: globalComponents }
  })

const fields = [
  { prop: 'name', label: '姓名', formtype: 'Input', group: 'basic' },
  { prop: 'phone', label: '电话', formtype: 'Input', group: 'contact' },
  { prop: 'email', label: '邮箱', formtype: 'Input', group: 'contact' }
]

describe('EsForm - 分组容器：未配置时行为不变', () => {
  it('没有 layout 时不出现任何容器，字段仍在同一个 el-row 里', () => {
    const wrapper = mountForm({ formItemList: fields.map(({ group, ...rest }) => rest) })
    expect(wrapper.find('.el-tabs').exists()).toBe(false)
    expect(wrapper.find('.el-collapse').exists()).toBe(false)
    expect(wrapper.find('.el-steps').exists()).toBe(false)
    expect(wrapper.findAll('.el-row')).toHaveLength(1)
    expect(wrapper.findAll('.el-form-item')).toHaveLength(3)
  })

  it('配置了 type 但没有任何字段分组 → 仍走扁平（不出现空容器）', () => {
    const wrapper = mountForm({
      formItemList: fields.map(({ group, ...rest }) => rest),
      layoutFormProps: { layout: { type: 'tabs' } }
    })
    expect(wrapper.find('.el-tabs').exists()).toBe(false)
    expect(wrapper.findAll('.el-form-item')).toHaveLength(3)
  })
})

describe('EsForm - 分组容器：tabs', () => {
  const mountTabs = (patch: Record<string, unknown> = {}) =>
    mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: {
          type: 'tabs',
          groups: [
            { key: 'basic', label: '基本信息' },
            { key: 'contact', label: '联系方式' }
          ],
          ...patch
        }
      }
    })

  it('按声明顺序渲染页签，组内字段完整', () => {
    const wrapper = mountTabs()
    const tabs = wrapper.findAll('.el-tabs__item').map((n) => n.text())
    expect(tabs).toEqual(['基本信息', '联系方式'])
    expect(wrapper.findAll('.el-form-item')).toHaveLength(3)
  })

  it('未分组字段落进「其他」页签，排在最后', () => {
    const wrapper = mountForm({
      formItemList: [...fields, { prop: 'remark', label: '备注', formtype: 'Input' }],
      layoutFormProps: {
        layout: { type: 'tabs', groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }] }
      }
    })
    const tabs = wrapper.findAll('.el-tabs__item').map((n) => n.text())
    expect(tabs).toEqual(['基本信息', '联系方式', '其他'])
    expect(wrapper.findAll('.el-form-item')).toHaveLength(4)
  })

  it('defaultLabel 覆盖未分组页签标题', () => {
    const wrapper = mountForm({
      formItemList: [{ prop: 'a', label: 'A', formtype: 'Input', group: 'x' }, { prop: 'b', label: 'B', formtype: 'Input' }],
      layoutFormProps: { layout: { type: 'tabs', defaultLabel: '补充信息' } }
    })
    expect(wrapper.findAll('.el-tabs__item').map((n) => n.text())).toEqual(['x', '补充信息'])
  })

  it('ungrouped: hidden 不渲染未分组字段', () => {
    const wrapper = mountForm({
      formItemList: [{ prop: 'a', label: 'A', formtype: 'Input', group: 'x' }, { prop: 'b', label: 'B', formtype: 'Input' }],
      layoutFormProps: { layout: { type: 'tabs', ungrouped: 'hidden' } }
    })
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)
  })
})

describe('EsForm - 分组容器：collapse / steps', () => {
  it('collapse 缺省全部展开，面板标题按声明解析', () => {
    const wrapper = mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: {
          type: 'collapse',
          groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }]
        }
      }
    })
    expect(wrapper.findAll('.el-collapse-item')).toHaveLength(2)
    expect(wrapper.find('.el-collapse-item__wrap').attributes('style') || '').not.toContain('display: none')
    expect(wrapper.findAll('.el-form-item')).toHaveLength(3)
  })

  it('steps 只渲染当前组，上一步禁用、下一步可点且能切到下一组', async () => {
    const wrapper = mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: {
          type: 'steps',
          groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }]
        }
      }
    })
    expect(wrapper.findAll('.el-step')).toHaveLength(2)
    // 首步只显示 basic 组的一个字段
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)
    const navBtns = wrapper.findAll('.es-form-groups__nav button')
    expect(navBtns).toHaveLength(2)
    expect(navBtns[0].attributes('disabled')).toBeDefined()

    await navBtns[1].trigger('click')
    await nextTick()
    // 第二步显示 contact 组的两个字段
    expect(wrapper.findAll('.el-form-item')).toHaveLength(2)
    expect(wrapper.findAll('.es-form-groups__nav button')[1].attributes('disabled')).toBeDefined()
  })
})

describe('EsForm - 分组容器：与折叠的互斥', () => {
  it('分组生效时隐藏折叠按钮（折叠按整表行数，跨组会藏字段）', () => {
    const wrapper = mountForm({
      formItemList: fields,
      configBtn: [{ name: '查询', key: 'query' }],
      layoutFormProps: {
        formLayProps: { minFoldRows: 1 },
        rowLayProps: {},
        layout: { type: 'tabs', groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }] }
      }
    })
    expect(wrapper.find('.el-tabs').exists()).toBe(true)
    // 折叠按钮的文案来自内置字典（展开/收起），分组时不应出现
    expect(wrapper.text()).not.toContain('展开')
  })
})
