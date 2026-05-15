<template>
  <div class="example-form-cascader">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
    />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

const formRef = ref(null)
const formModel = reactive({
  region: [],
  multiRegion: [],
  address: ''
})

const regionOptions = [
  {
    value: 'zhejiang',
    label: '浙江省',
    children: [
      {
        value: 'hangzhou',
        label: '杭州市',
        children: [
          { value: 'xihu', label: '西湖区' },
          { value: 'binjiang', label: '滨江区' },
          { value: 'yuhang', label: '余杭区' }
        ]
      },
      {
        value: 'ningbo',
        label: '宁波市',
        children: [
          { value: 'jiangbei', label: '江北区' },
          { value: 'yinzhou', label: '鄞州区' }
        ]
      }
    ]
  },
  {
    value: 'jiangsu',
    label: '江苏省',
    children: [
      {
        value: 'nanjing',
        label: '南京市',
        children: [
          { value: 'xuanwu', label: '玄武区' },
          { value: 'gulou', label: '鼓楼区' }
        ]
      },
      {
        value: 'suzhou',
        label: '苏州市',
        children: [
          { value: 'gusu', label: '姑苏区' },
          { value: 'wuzhong', label: '吴中区' }
        ]
      }
    ]
  }
]

const formItems = [
  {
    prop: 'region',
    label: '区域选择',
    formtype: 'Cascader',
    span: 12,
    attrs: {
      placeholder: '请选择区域',
      options: regionOptions,
      props: {
        expandTrigger: 'hover',
        emitPath: false
      }
    }
  },
  {
    prop: 'multiRegion',
    label: '多选区域',
    formtype: 'Cascader',
    span: 12,
    attrs: {
      placeholder: '请选择区域(多选)',
      options: regionOptions,
      props: {
        expandTrigger: 'hover',
        multiple: true
      }
    }
  },
  {
    prop: 'address',
    label: '详细地址',
    span: 24,
      formtype: 'Input',
    attrs: {
      type: 'textarea',
      rows: 2,
      placeholder: '请输入详细地址'
    }
  }
]

const configBtn = [
  {
    name: '提交',
    type: 'primary',
    click: (model) => {
      ElMessage.success('提交成功: ' + JSON.stringify(model))
    }
  },
  {
    name: '重置',
    click: (model, formRef) => {
      formRef.resetFields()
    }
  }
]
</script>

<style scoped>
.example-form-cascader {
  padding: 20px;
}
</style>
