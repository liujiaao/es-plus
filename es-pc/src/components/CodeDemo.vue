<template>
  <div class="code-demo">
    <!-- 实时预览 -->
    <div class="demo-preview">
      <div class="demo-preview-inner">
        <slot />
      </div>
    </div>

    <!-- 代码查看 -->
    <div class="demo-toolbar">
      <a-button type="link" size="small" @click="expanded = !expanded">
        {{ expanded ? '收起代码' : '查看代码' }}
      </a-button>
    </div>
    <pre v-show="expanded" class="demo-code"><code>{{ source }}</code></pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  source: { type: String, default: '' }
})

const expanded = ref(false)
</script>

<style scoped>
.code-demo {
  margin: 16px 0;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.demo-preview {
  padding: 24px;
  background: #fff;
}

.demo-preview-inner {
  max-width: 100%;
  overflow-x: auto;
}

.demo-toolbar {
  padding: 8px 16px;
  border-top: 1px dashed #f0f0f0;
  background: #fafafa;
}

.demo-code {
  margin: 0;
  padding: 16px;
  background: #f6f8fa;
  font-family: 'SFMono-Regular', Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  white-space: pre;
  border-top: 1px solid #f0f0f0;
}

.demo-code code {
  font-family: inherit;
}
</style>
