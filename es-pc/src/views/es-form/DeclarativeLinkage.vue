<template>
  <div class="example-declarative-linkage">
    <p class="tip">
      9 个字段、<strong>0 个回调</strong>：三级选项、必填、禁用、显隐全部由
      <code>declarative-linkage.config.js</code> 里的 <code>reactions</code> 与 JSON 表达式求值。
    </p>

    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
    />

    <details class="config-source">
      <summary>展开查看驱动本表单的纯 JSON 配置</summary>
      <pre>{{ configJson }}</pre>
    </details>
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { declarativeLinkageItems, declarativeLinkageModel } from './declarative-linkage.config'

const formRef = ref(null)
const formModel = reactive({ ...declarativeLinkageModel })
const formItems = declarativeLinkageItems

// 只用于展示：这份 JSON 可以被存库、可以由服务端下发、可以是 AI 的产物。
const configJson = JSON.stringify(
  { model: declarativeLinkageModel, items: declarativeLinkageItems },
  null,
  2
)

const submit = async () => {
  try {
    await formRef.value.validate()
  } catch {
    message.error('请先补齐动态出现的必填项')
    return
  }
  message.success('校验通过：' + JSON.stringify(formModel))
}

const configBtn = [
  { name: '提交', type: 'primary', click: submit },
  { name: '重置', click: () => formRef.value.resetFields() }
]
</script>

<style scoped>
.example-declarative-linkage {
  padding: 20px;
}
.tip {
  margin: 0 0 16px;
  color: #666;
  font-size: 13px;
}
.config-source {
  margin-top: 16px;
  font-size: 13px;
}
.config-source summary {
  cursor: pointer;
  color: #1677ff;
}
.config-source pre {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  background: #f6f8fa;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}
</style>
