<template>
  <div class="ai-tools-page">
    <div class="container">
      <h1 class="content-title">{{ ai.title }}</h1>
      <p class="subtitle">{{ ai.subtitle }}</p>

      <template v-for="section in ai.sections">
        <section
          :key="section.id"
          class="ai-section"
        >
          <h2 class="content-subtitle">{{ section.title }}</h2>
          <p>{{ rendererize(section.intro) }}</p>
          <el-card
            v-for="(block, i) in section.codeBlocks"
            :key="i"
            class="code-block"
            shadow="never"
          >
            <pre><code>{{ rendererize(block.code) }}</code></pre>
          </el-card>
          <p v-if="section.flow">AI 的协作流程：{{ section.flow }}</p>
          <p v-if="section.links">
            <template v-for="(link, i) in section.links">
              <a
                :key="link.href"
                :href="link.href"
                target="_blank"
                rel="noopener"
              >{{ link.label }}</a><span
                v-if="i < section.links.length - 1"
                :key="'sep' + i"
              >、</span>
            </template>。
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<script>
// AI 工具链文案单一真源：由 scripts/sync-ai.mjs 从 docs/ai/ai-tools.json 分发，禁止手改本文件
import ai from '@/ai/ai-tools.json'

export default {
  name: 'AiTools',
  data() {
    return {
      ai
    }
  },
  methods: {
    // 本站渲染器（Vue 2 + Element UI），替换单源中的 {renderer} 占位
    rendererize(text) {
      return text.replaceAll('{renderer}', 'vue2')
    }
  }
}
</script>

<style scoped>
.ai-tools-page {
  padding: 40px 20px;
}

.container {
  max-width: 860px;
  margin: 0 auto;
}

.subtitle {
  font-size: 16px;
  color: #606266;
  line-height: 1.8;
}

.ai-section {
  margin: 32px 0;
}

.code-block {
  margin: 16px 0;
  background: #f6f8fa;
  border: 1px solid #e4e7ed;
}

.code-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-block code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
  color: #303133;
}

.ai-section p {
  line-height: 1.8;
  color: #606266;
}

.ai-section a {
  color: #409eff;
}
</style>
