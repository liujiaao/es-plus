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

<script setup lang="ts">
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

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
    formtype: 'Radio' as const,
    dataOptions: [
      { label: '先生', value: 'male' },
      { label: '女士', value: 'female' }
    ]
  },
  {
    prop: 'interests',
    label: '兴趣标签',
    span: 12,
    formtype: 'Checkbox' as const,
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
    formtype: 'Switch' as const,
    attrs: { activeText: '开', inactiveText: '关' }
  },
  {
    prop: 'darkMode',
    label: '深色模式',
    span: 12,
    formtype: 'Switch' as const,
    attrs: { activeText: '开', inactiveText: '关' }
  },
  {
    prop: 'volume',
    label: '提示音量',
    span: 12,
    formtype: 'Slider' as const,
    attrs: { showStops: true, step: 10 }
  },
  {
    prop: 'themeColor',
    label: '主题色',
    span: 12,
    formtype: 'ColorPicker' as const
  },
  {
    prop: 'satisfaction',
    label: '满意度',
    span: 12,
    formtype: 'Rate' as const,
    attrs: { showScore: true, texts: ['很差', '一般', '不错', '满意', '非常满意'], showText: true }
  }
]

const configBtn = [
  {
    name: '保存设置',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model: Record<string, unknown>) => {
      ElMessage.success('偏好设置已保存')
      console.log('偏好数据:', model)
    }
  },
  {
    name: '恢复默认',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRef: { resetFields: () => void } | null) => {
      formRef?.resetFields()
      ElMessage.info('已恢复默认设置')
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
