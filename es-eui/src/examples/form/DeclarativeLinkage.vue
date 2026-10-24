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

<script>
import {
  declarativeLinkageItems,
  declarativeLinkageModel
} from './declarative-linkage.config'

export default {
  name: 'FormDeclarativeLinkage',
  data() {
    return {
      formModel: { ...declarativeLinkageModel },
      formItems: declarativeLinkageItems,
      // 只用于展示：这份 JSON 可以被存库、可以由服务端下发、可以是 AI 的产物。
      configJson: JSON.stringify(
        { model: declarativeLinkageModel, items: declarativeLinkageItems },
        null,
        2
      ),
      configBtn: [
        { name: '提交', type: 'primary', click: () => this.submit() },
        { name: '重置', click: () => this.$refs.formRef.resetFields() }
      ]
    }
  },
  methods: {
    async submit() {
      try {
        await this.$refs.formRef.validate()
      } catch (e) {
        this.$message.error('请先补齐动态出现的必填项')
        return
      }
      this.$message.success('校验通过：' + JSON.stringify(this.formModel))
    }
  }
}
</script>

<style scoped>
.example-declarative-linkage {
  padding: 20px;
}
.tip {
  margin: 0 0 16px;
  color: #606266;
  font-size: 13px;
}
.config-source {
  margin-top: 16px;
  font-size: 13px;
}
.config-source summary {
  cursor: pointer;
  color: #409eff;
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
