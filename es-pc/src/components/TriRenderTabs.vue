<template>
  <div class="tri-render-tabs">
    <!-- 同一份 Schema 源码（三端零改动复用） -->
    <div class="tri-schema">
      <div class="tri-schema-header">
        <span class="tri-badge">同一份 Schema</span>
        <span class="tri-schema-tip">换一行 import，Vue 2 / Vue 3 / AntDV 零成本切换</span>
      </div>
      <pre class="tri-schema-code"><code>{{ schemaCode }}</code></pre>
    </div>

    <!-- 三端渲染快照切换器 -->
    <a-tabs v-model:activeKey="active" class="tri-tabs">
      <a-tab-pane v-for="r in renderers" :key="r.key" :tab="r.name">
        <div class="tri-shot">
          <!-- 三端渲染快照尚未生成（快照生成脚本待接入 CI）——不做无证据的「渲染对比」，
               只展示同一份 Schema 与各端安装/导入方式；实际渲染见本站各示例页。 -->
          <p class="tri-shot-hint">
            同一份 Schema 源码，{{ r.name }} 端只需更换导入包；实际渲染效果见本站示例页。
          </p>
          <div class="tri-shot-meta">
            <code class="tri-pkg">{{ r.pkg }}</code>
            <code class="tri-install">{{ r.install }}</code>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
// 三端 Schema 单一真源：由 scripts/sync-tri-render.mjs 从 docs/tri-render/ 分发，禁止手改本文件
import schema from '@/tri-render/schema.json'

const active = ref('vue3')

const renderers = [
  { key: 'vue3', name: 'Vue 3 · Element Plus', pkg: '@es-plus/vue3', install: 'npm i @es-plus/vue3 element-plus' },
  { key: 'vue2', name: 'Vue 2 · Element UI', pkg: '@es-plus/vue2', install: 'npm i @es-plus/vue2 element-ui' },
  { key: 'antdv', name: 'Vue 3 · Ant Design Vue', pkg: '@es-plus/adapter-antdv', install: 'npm i @es-plus/adapter-antdv ant-design-vue' },
]

const schemaCode = computed(() => JSON.stringify(schema, null, 2))
</script>

<style scoped>
.tri-render-tabs {
  border: 1px solid #f0f0f0;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.tri-schema {
  border-bottom: 1px solid #f0f0f0;
}

.tri-schema-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.tri-badge {
  display: inline-block;
  padding: 3px 12px;
  background: linear-gradient(135deg, var(--es-brand-primary), var(--es-brand-accent));
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.tri-schema-tip {
  font-size: 13px;
  color: #999;
}

.tri-schema-code {
  margin: 0;
  padding: 16px 20px;
  background: #1e1e1e;
  max-height: 280px;
  overflow: auto;
}

.tri-schema-code code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #9cdcfe;
  white-space: pre;
}

.tri-tabs {
  padding: 0 20px 20px;
}

.tri-shot {
  padding-top: 12px;
}

.tri-shot-hint {
  margin: 0;
  padding: 14px 16px;
  border: 1px dashed #e5e5e5;
  border-radius: 8px;
  color: #666;
  font-size: 14px;
  line-height: 1.7;
}

.tri-shot-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.tri-pkg {
  padding: 4px 10px;
  background: #f5f5f5;
  color: var(--es-brand-primary);
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
}

.tri-install {
  color: #999;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
}
</style>
