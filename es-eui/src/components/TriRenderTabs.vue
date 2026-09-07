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
    <el-tabs v-model="active" class="tri-tabs">
      <el-tab-pane
        v-for="r in renderers"
        :key="r.key"
        :name="r.key"
      >
        <span slot="label">{{ r.name }}</span>
        <div class="tri-shot">
          <img
            v-if="r.snapshot"
            :src="r.snapshot"
            :alt="`${r.name} 渲染快照`"
            class="tri-shot-img"
          />
          <div v-else class="tri-shot-placeholder">
            <div class="tri-shot-placeholder-icon">📸</div>
            <div>{{ r.name }} 渲染快照</div>
            <div class="tri-shot-placeholder-sub">构建期由 gen-tri-render-snapshots.mjs 生成</div>
          </div>
          <div class="tri-shot-meta">
            <code class="tri-pkg">{{ r.pkg }}</code>
            <code class="tri-install">{{ r.install }}</code>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
// 三端渲染快照单一真源：由 scripts/sync-tri-render.mjs 从 docs/tri-render/ 分发，禁止手改本文件
import schema from '@/tri-render/schema.json'

// 三端渲染快照（构建期由 scripts/gen-tri-render-snapshots.mjs 生成到 docs/tri-render/*.png）。
// webpack 用 require.context 探测快照是否存在，缺失时优雅降级为占位图，不阻塞构建。
const snapshotContext = require.context('../tri-render', false, /\.png$/)
const snapshotFor = (name) => {
  const key = snapshotContext.keys().find((k) => k.includes(name))
  return key ? snapshotContext(key) : null
}

export default {
  name: 'TriRenderTabs',
  data() {
    return {
      active: 'vue3',
      schemaCode: JSON.stringify(schema, null, 2),
      renderers: [
        { key: 'vue3', name: 'Vue 3 · Element Plus', pkg: '@es-plus/vue3', install: 'npm i @es-plus/vue3 element-plus', snapshot: snapshotFor('vue3') },
        { key: 'vue2', name: 'Vue 2 · Element UI', pkg: '@es-plus/vue2', install: 'npm i @es-plus/vue2 element-ui', snapshot: snapshotFor('vue2') },
        { key: 'antdv', name: 'Vue 3 · Ant Design Vue', pkg: '@es-plus/adapter-antdv', install: 'npm i @es-plus/adapter-antdv ant-design-vue', snapshot: snapshotFor('antdv') }
      ]
    }
  }
}
</script>

<style scoped>
.tri-render-tabs {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.tri-schema {
  border-bottom: 1px solid #e2e8f0;
}

.tri-schema-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
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
  color: #718096;
}

.tri-schema-code {
  margin: 0;
  padding: 16px 20px;
  background: #1e1e1e;
  max-height: 280px;
  overflow: auto;
}

.tri-schema-code code {
  font-family: 'Fira Code', Consolas, monospace;
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

.tri-shot-img {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: block;
}

.tri-shot-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 56px 20px;
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
  color: #4a5568;
  font-size: 14px;
}

.tri-shot-placeholder-icon {
  font-size: 32px;
}

.tri-shot-placeholder-sub {
  font-size: 12px;
  color: #718096;
}

.tri-shot-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.tri-pkg {
  padding: 4px 10px;
  background: #f7fafc;
  color: var(--es-brand-primary);
  border-radius: 4px;
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 13px;
}

.tri-install {
  color: #718096;
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 13px;
}
</style>
