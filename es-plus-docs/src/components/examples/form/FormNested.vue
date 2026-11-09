<template>
  <div class="form-nested-demo">
    <el-alert type="info" :closable="false" class="intro-alert">
      <template #title>一个对象 = 一行标题 + 一组子字段，仍然只是一份 formItemList</template>
      <div class="intro-body">
        父字段写 <code>children</code>，组件把它摊成「整行标题 + 子字段」：父字段本身不渲染控件、
        不绑定数据；子字段的 <code>prop</code> 写相对路径（<code>province</code> → 绑定
        <code>address.province</code>），也可以直接写绝对路径。
        <br />
        子字段的栅格由容器内的数量自动算（下面三个子字段 = 8 / 8 / 24），显式写
        <code>span</code> 则以显式值为准。只支持一层：子字段再写 <code>children</code> 会被忽略。
      </div>
    </el-alert>

    <div class="toolbar">
      <el-button size="small" @click="fillSample">填入示例数据</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <el-button size="small" type="primary" @click="submit">提交（校验嵌套字段）</el-button>
    </div>

    <es-form ref="formRef" :model="formModel" :form-item-list="formItems" :rules="formRules" />

    <pre class="model-preview">{{ modelPreview }}</pre>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { EsForm } from '@es-plus/vue3'
import { ElMessage } from 'element-plus'

const formRef = ref()

// 模型是真正的嵌套对象：不是 `{'address.city': ''}` 这种点号键
const formModel = reactive({
  customerName: '',
  phone: '',
  address: { province: '', city: '', detail: '' },
  invoice: { title: '', taxNo: '' }
})

const formItems = [
  { prop: 'customerName', label: '客户名称', formtype: 'Input', span: 12, required: true },
  { prop: 'phone', label: '联系电话', formtype: 'Input', span: 12 },
  {
    // 容器字段：没有 formtype，也不绑定数据 —— 只负责标题
    prop: 'address',
    label: '联系地址',
    children: [
      {
        prop: 'province',
        label: '省',
        formtype: 'Select',
        dataOptions: [
          { label: '浙江', value: 'zj' },
          { label: '江苏', value: 'js' },
          { label: '广东', value: 'gd' }
        ]
      },
      {
        prop: 'city',
        label: '市',
        formtype: 'Select',
        dataOptions: [
          { label: '杭州', value: 'hz' },
          { label: '南京', value: 'nj' },
          { label: '深圳', value: 'sz' }
        ]
      },
      // 显式 span 覆盖容器内的自动栅格（默认 8，这里占满整行）
      { prop: 'detail', label: '详细地址', formtype: 'Input', span: 24, required: true }
    ]
  },
  {
    prop: 'invoice',
    label: '开票信息',
    children: [
      { prop: 'title', label: '抬头', formtype: 'Input' },
      { prop: 'taxNo', label: '税号', formtype: 'Input' }
    ]
  }
]

// 表单级规则按字段路径写：嵌套子字段就是 `address.detail`
const formRules = {
  'address.detail': [{ required: true, message: '请填写详细地址', trigger: 'blur' }]
}

const modelPreview = computed(() => JSON.stringify(formModel, null, 2))

const fillSample = () => {
  formModel.customerName = '北辰商贸'
  formModel.phone = '0571-88886666'
  // 直接整体赋值也能工作：组件读的是路径，不是拷贝
  formModel.address = { province: 'zj', city: 'hz', detail: '文三路 478 号' }
  formModel.invoice = { title: '北辰商贸有限公司', taxNo: '91330100MA2XXXXX0A' }
}

const clearAll = () => {
  formRef.value?.resetFields()
  formModel.address = { province: '', city: '', detail: '' }
  formModel.invoice = { title: '', taxNo: '' }
}

const submit = async () => {
  try {
    await formRef.value?.validate()
    ElMessage.success(`已提交：${formModel.customerName} / ${formModel.address.city}`)
  } catch {
    ElMessage.warning('嵌套字段校验未通过')
  }
}
</script>

<style scoped>
.intro-alert {
  margin-bottom: var(--es-space-4);
}
.intro-body {
  font-size: var(--es-text-sm);
  margin-top: var(--es-space-2);
  line-height: 1.6;
}
.toolbar {
  display: flex;
  gap: var(--es-space-2);
  margin-bottom: var(--es-space-4);
}
.model-preview {
  margin-top: var(--es-space-4);
  padding: var(--es-space-3) var(--es-space-4);
  background: var(--el-fill-color-light);
  border-radius: var(--es-radius-sm);
  font-size: var(--es-text-xs);
  color: var(--el-text-color-secondary);
}
</style>
