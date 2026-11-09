<template>
  <div class="form-nested-demo">
    <div class="intro-wrap">
      <el-alert
        title="一个对象 = 一行标题 + 一组子字段"
        type="info"
        :closable="false"
        show-icon
      >父字段写 children：容器只出整行标题，不渲染控件也不绑定数据；子字段的 prop 是相对路径
        （province → 绑定 address.province）。子字段栅格按容器内数量自动算，显式 span 优先。
        只支持一层。Element UI 端的摊平规则与 Element Plus / Ant Design Vue 完全一致。</el-alert>
    </div>

    <div class="toolbar">
      <el-button size="small" @click="fillSample">填入示例数据</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <el-button size="small" type="primary" @click="submit">提交（校验嵌套字段）</el-button>
    </div>

    <es-form ref="formRef" :model="model" :form-item-list="formItems" :rules="formRules" />

    <pre class="model-preview">{{ JSON.stringify(model, null, 2) }}</pre>
  </div>
</template>

<script>
import { defineComponent, ref, reactive } from '@vue/composition-api'
import Message from 'element-ui/lib/message'

export default defineComponent({
  name: 'FormNested',
  setup() {
    const formRef = ref(null)

    // 模型是真正的嵌套对象：不是 `{'address.city': ''}` 这种点号键
    const model = reactive({
      customerName: '', phone: '',
      address: { province: '', city: '', detail: '' },
      invoice: { title: '', taxNo: '' },
    })

    const formItems = [
      { prop: 'customerName', label: '客户名称', formtype: 'Input', span: 12, required: true },
      { prop: 'phone', label: '联系电话', formtype: 'Input', span: 12 },
      {
        // 容器字段：没有 formtype，也不绑定数据 —— 只负责标题
        prop: 'address', label: '联系地址',
        children: [
          { prop: 'province', label: '省', formtype: 'Select', dataOptions: [
            { label: '浙江', value: 'zj' }, { label: '江苏', value: 'js' }, { label: '广东', value: 'gd' },
          ] },
          { prop: 'city', label: '市', formtype: 'Select', dataOptions: [
            { label: '杭州', value: 'hz' }, { label: '南京', value: 'nj' }, { label: '深圳', value: 'sz' },
          ] },
          // 显式 span 覆盖容器内的自动栅格（默认 8，这里占满整行）
          { prop: 'detail', label: '详细地址', formtype: 'Input', span: 24, required: true },
        ],
      },
      {
        prop: 'invoice', label: '开票信息',
        children: [
          { prop: 'title', label: '抬头', formtype: 'Input' },
          { prop: 'taxNo', label: '税号', formtype: 'Input' },
        ],
      },
    ]

    // 表单级规则按字段路径写：嵌套子字段就是 `address.detail`
    const formRules = {
      'address.detail': [{ required: true, message: '请填写详细地址', trigger: 'blur' }],
    }

    const fillSample = () => {
      model.customerName = '北辰商贸'
      model.phone = '0571-88886666'
      model.address = { province: 'zj', city: 'hz', detail: '文三路 478 号' }
      model.invoice = { title: '北辰商贸有限公司', taxNo: '91330100MA2XXXXX0A' }
    }

    const clearAll = () => {
      formRef.value && formRef.value.resetFields()
      model.address = { province: '', city: '', detail: '' }
      model.invoice = { title: '', taxNo: '' }
    }

    const submit = () => {
      const form = formRef.value
      if (!form) return
      form.validate((valid) => {
        if (valid) {
          Message.success('已提交：' + model.customerName + ' / ' + model.address.city)
        } else {
          Message.warning('嵌套字段校验未通过')
        }
      })
    }

    return { formRef, model, formItems, formRules, fillSample, clearAll, submit }
  },
})
</script>

<style scoped>
.form-nested-demo {
  max-width: 900px;
}
.intro-wrap {
  margin-bottom: var(--es-space-3);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--es-space-3);
  margin-bottom: var(--es-space-3);
  flex-wrap: wrap;
}
.model-preview {
  background: var(--es-fill-light);
  padding: var(--es-space-3);
  border-radius: var(--es-radius-xs);
  margin-top: var(--es-space-3);
  font-size: var(--es-text-xs);
}
</style>
