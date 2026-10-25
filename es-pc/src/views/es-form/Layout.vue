<template>
  <div class="example-layout-form">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { ref } from 'vue'
import { message } from 'ant-design-vue'

const formModel = ref({
  name: '',
  phone: '',
  email: '',
  address: '',
  zip: '',
  company: '',
  department: '',
  status: '',
  dateRange: [],
  category: '',
  manager: ''
})

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 8, attrs: { placeholder: '请输入姓名', allowClear: true } },
  { prop: 'phone', label: '电话', formtype: 'Input', span: 8, attrs: { placeholder: '请输入电话', allowClear: true } },
  { prop: 'email', label: '邮箱', formtype: 'Input', span: 8, attrs: { placeholder: '请输入邮箱', allowClear: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 8, attrs: { placeholder: '请选择状态', allowClear: true }, dataOptions: [{ label: '启用', value: 'active' }, { label: '禁用', value: 'inactive' }, { label: '全部', value: '' }] },
  { prop: 'company', label: '公司', formtype: 'Input', span: 12, attrs: { placeholder: '请输入公司名称', allowClear: true } },
  { prop: 'department', label: '部门', formtype: 'Input', span: 12, attrs: { placeholder: '请输入部门', allowClear: true } },
  { prop: 'category', label: '类别', formtype: 'Select', span: 8, attrs: { placeholder: '请选择类别', allowClear: true }, dataOptions: [{ label: '类型A', value: 'a' }, { label: '类型B', value: 'b' }] },
  { prop: 'manager', label: '负责人', formtype: 'Input', span: 8, attrs: { placeholder: '请输入负责人', allowClear: true } },
  { prop: 'dateRange', label: '日期范围', formtype: 'DatePicker', span: 8, attrs: { type: 'daterange', placeholder: '选择日期范围', allowClear: true } },
  { prop: 'address', label: '地址', formtype: 'Input', span: 24, attrs: { placeholder: '请输入详细地址', allowClear: true } },
  { prop: 'zip', label: '邮编', formtype: 'Input', span: 8, attrs: { placeholder: '请输入邮政编码', allowClear: true } }
]

// 按钮区也是布局的一部分：`direction` 决定按钮落在左栏还是右栏（默认右栏）。
// 两个按钮都做真事 —— 重置真的清空，查询把参数交给回调；这里没有数据源，
// 查询的全部作用就是把「回调收到的 model」显示出来。
const configBtn = [
  {
    name: '重置',
    key: 'rest',
    direction: 'left',
    icon: 'Refresh',
    click: (_, formRef) => {
      formRef?.resetFields()
      message.info('已重置')
    }
  },
  {
    name: '查询',
    key: 'query',
    type: 'primary',
    direction: 'right',
    icon: 'Search',
    click: (model) => {
      message.success('查询参数: ' + JSON.stringify(model))
    }
  }
]

const layoutProps = {
  formLayProps: {
    labelWidth: '80px',
    minFoldRows: 2  // 超过2行自动折叠
  },
  rowLayProps: {
    gutter: 20
  }
}
</script>

<style scoped>
.example-layout-form {
  padding: 20px;
}
</style>
