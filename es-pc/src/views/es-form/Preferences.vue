<template>
  <div class="example-form-preferences">
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
import { reactive } from 'vue'
import { message } from 'ant-design-vue'

const formModel = reactive({
  gender: 'male',
  interests: [],
  notify: true,
  darkMode: false,
  volume: 60,
  themeColor: '#409EFF',
  satisfaction: 4
})

const formItems = [
  {
    prop: 'gender',
    label: '通知称谓',
    span: 12,
    formtype: 'Radio',
    dataOptions: [
      { label: '先生', value: 'male' },
      { label: '女士', value: 'female' }
    ]
  },
  {
    prop: 'interests',
    label: '兴趣标签',
    span: 12,
    formtype: 'Checkbox',
    dataOptions: [
      { label: '科技', value: 'tech' },
      { label: '音乐', value: 'music' },
      { label: '运动', value: 'sport' },
      { label: '阅读', value: 'read' }
    ]
  },
  {
    prop: 'notify',
    label: '消息通知',
    span: 12,
    formtype: 'Switch',
    attrs: { checkedChildren: '开', unCheckedChildren: '关' }
  },
  {
    prop: 'darkMode',
    label: '深色模式',
    span: 12,
    formtype: 'Switch',
    attrs: { checkedChildren: '开', unCheckedChildren: '关' }
  },
  {
    prop: 'volume',
    label: '提示音量',
    span: 12,
    formtype: 'Slider',
    attrs: { included: true, step: 10 }
  },
  {
    prop: 'themeColor',
    label: '主题色',
    span: 12,
    formtype: 'ColorPicker'
  },
  {
    prop: 'satisfaction',
    label: '满意度',
    span: 12,
    formtype: 'Rate',
    attrs: { tooltips: ['很差', '一般', '不错', '满意', '非常满意'] }
  }
]

const configBtn = [
  {
    name: '保存设置',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model) => {
      message.success('偏好设置已保存')
      console.log('偏好数据:', model)
    }
  },
  {
    name: '恢复默认',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_, formRef) => {
      formRef?.resetFields()
      message.info('已恢复默认设置')
    }
  }
]

const layoutProps = {
  fromLayProps: { labelWidth: '100px', size: 'default' },
  rowLayProps: { gutter: 20 }
}
</script>

<style scoped>
.example-form-preferences { padding: 20px; }
</style>
