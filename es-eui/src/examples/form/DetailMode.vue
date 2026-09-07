<template>
  <div style="max-width: 760px;">
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
      <span style="color: #606266;">模式：</span>
      <el-switch
        v-model="editable"
        active-text="编辑"
        inactive-text="详情"
      />
      <el-button v-if="editable" type="primary" size="mini" @click="handleSave">保存</el-button>
    </div>
    <es-form
      :model="model"
      :form-item-list="formItems"
      :layout-form-props="layoutFormProps"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 详情/编辑模式 —— 同一份 EsForm 配置在两种模式间切换
 *
 * 关键点：
 *   1. editable 开关控制模式；formItems 为 computed，按模式动态设置 attrs.disabled
 *   2. 详情态下所有控件只读，编辑态可修改，无需维护两套模板
 *   3. attrs.disabled 也支持函数形式 (model, item, props) => boolean，此处用 computed 更直观
 */
import { defineComponent, reactive, ref, computed } from '@vue/composition-api'
import { Message } from 'element-ui'

export default defineComponent({
  name: 'FormDetailMode',
  setup() {
    const editable = ref(false)

    const model = reactive({
      name: '张三',
      gender: 'male',
      dept: '研发部',
      level: 'P6',
      entryDate: '2021-03-15',
      remark: '核心开发人员，负责组件库建设。'
    })

    const formItems = computed(() => {
      const disabled = !editable.value
      return [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 12, attrs: { disabled } },
        {
          prop: 'gender',
          label: '性别',
          formtype: 'Radio',
          span: 12,
          attrs: { disabled },
          dataOptions: [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' }
          ]
        },
        {
          prop: 'dept',
          label: '部门',
          formtype: 'Select',
          span: 12,
          attrs: { disabled, style: 'width:100%' },
          dataOptions: [
            { label: '研发部', value: '研发部' },
            { label: '市场部', value: '市场部' },
            { label: '财务部', value: '财务部' }
          ]
        },
        { prop: 'level', label: '职级', formtype: 'Input', span: 12, attrs: { disabled } },
        {
          prop: 'entryDate',
          label: '入职日期',
          formtype: 'DatePicker',
          span: 12,
          attrs: { disabled, type: 'date', valueFormat: 'yyyy-MM-dd', style: 'width:100%' }
        },
        {
          prop: 'remark',
          label: '备注',
          formtype: 'Input',
          span: 24,
          attrs: { disabled, type: 'textarea', rows: 3 }
        }
      ]
    })

    const layoutFormProps = {
      fromLayProps: { labelWidth: '90px', size: 'small' },
      rowLayProps: { gutter: 20 }
    }

    const handleSave = () => {
      editable.value = false
      Message.success('已保存')
    }

    return { editable, model, formItems, layoutFormProps, handleSave }
  }
})
</script>
