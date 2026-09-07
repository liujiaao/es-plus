<template>
  <div class="code-playground">
    <div class="playground-header">
      <div class="playground-header-left">
        <h3 class="playground-title">{{ title }}</h3>
        <p v-if="description" class="playground-desc">{{ description }}</p>
      </div>
      <div class="playground-actions">
        <el-button size="mini" plain @click="expanded = !expanded">
          <i :class="expanded ? 'el-icon-arrow-up' : 'el-icon-arrow-down'" />
          {{ expanded ? '收起代码' : '展开代码' }}
        </el-button>
        <el-button size="mini" plain @click="copyCode">
          <i class="el-icon-document-copy" /> 复制代码
        </el-button>
      </div>
    </div>

    <div class="playground-preview">
      <slot name="preview" />
    </div>

    <div v-show="expanded" class="playground-code">
      <pre><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CodePlayground',
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    code: { type: String, default: '' }
  },
  data() {
    return {
      expanded: false
    }
  },
  methods: {
    async copyCode() {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(this.code)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = this.code
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
        this.$message.success('代码已复制到剪贴板')
      } catch (e) {
        this.$message.error('复制失败，请手动复制')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.code-playground {
  margin-bottom: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.playground-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.playground-header-left {
  flex: 1;
  min-width: 0;
  padding-right: 16px;
}

.playground-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.playground-desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

.playground-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.playground-preview {
  padding: 20px;
}

.playground-code {
  border-top: 1px solid #e4e7ed;

  // 显式声明全部属性，避免 App.vue 全局 pre / code 规则（border-radius、margin、color:#c0392b 等）渗入代码块
  pre {
    margin: 0;
    padding: 16px 20px;
    background: #1e1e1e;
    border-radius: 0;
    overflow-x: auto;
    white-space: pre;
    font-size: 13px;
    line-height: 1.6;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }

  // .playground-code pre code 特异度高于全局 pre code，确保代码文字为浅色、无背景/圆角
  pre code {
    display: block;
    margin: 0;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    color: #d4d4d4;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    white-space: pre;
  }
}
</style>
