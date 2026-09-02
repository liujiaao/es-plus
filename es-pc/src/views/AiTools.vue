<template>
  <div class="ai-tools-page">
    <h1>{{ ai.title }}</h1>
    <p class="subtitle" v-html="ai.subtitle"></p>

    <template v-for="section in ai.sections" :key="section.id">
      <a-divider />
      <section :id="section.id">
        <h2>{{ section.title }}</h2>
        <p>{{ rendererize(section.intro) }}</p>
        <a-card v-for="(block, i) in section.codeBlocks" :key="i" class="code-block">
          <pre v-pre><code>{{ rendererize(block.code) }}</code></pre>
        </a-card>
        <p v-if="section.flow">AI 的协作流程：{{ section.flow }}</p>
        <p v-if="section.links">
          <template v-for="(link, i) in section.links" :key="link.href">
            <a :href="link.href" target="_blank">{{ link.label }}</a><span v-if="i < section.links.length - 1">、</span>
          </template>。
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
// AI 工具链文案单一真源：由 scripts/sync-ai.mjs 从 docs/ai/ai-tools.json 分发，禁止手改本文件
import ai from '@/ai/ai-tools.json'

// 本站渲染器（Ant Design Vue），替换单源中的 {renderer} 占位
const rendererize = (text) => text.replaceAll('{renderer}', 'antdv')
</script>

<style scoped>
.ai-tools-page {
  max-width: 860px;
}

.subtitle {
  font-size: 16px;
  color: #666;
}

.code-block {
  margin: 16px 0;
  background: #f6f8fa;
}

.code-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-block code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
}

section p {
  color: #666;
  line-height: 1.8;
}

section a {
  color: var(--es-brand-primary);
}
</style>
