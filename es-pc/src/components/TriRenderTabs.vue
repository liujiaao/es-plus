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

    <!-- 证据：实测「同名示例之间到底差几行」（数据由 scripts/gen-tri-render-pairs.mjs 从三端真实示例文件量出） -->
    <div class="tri-evidence">
      <div class="tri-evidence-header">
        <span class="tri-evidence-title">实测对比</span>
        <span class="tri-evidence-metric">{{ pairs.metric }}</span>
      </div>

      <div class="tri-stats">
        <div v-for="r in pairs.renderers" :key="r.key" class="tri-stat">
          <div class="tri-stat-label">{{ r.label }}</div>
          <div class="tri-stat-figures">
            <span class="tri-stat-num">{{ r.pairs }}</span> 对同名示例 ·
            中位差 <span class="tri-stat-num">{{ r.medianDelta }}</span> 行 ·
            <span class="tri-stat-num">{{ r.le10 }}</span> 对 ≤10 行
          </div>
          <div class="tri-stat-pkg">
            <code>{{ r.pkg }}</code>
            <span v-if="r.key === 'vue2'" class="tri-stat-note">
              Vue 2 端示例仍是并入前的手写版本，尚未与同一份配置对齐（渲染器本身支持同一份配置，含 attrs 透传）
            </span>
          </div>
        </div>
      </div>

      <template v-if="pairs.proof">
        <div class="tri-proof-header">
          证据样例 <code>{{ pairs.proof.title }}</code> ——
          {{ pairs.proof.source.label }} 与 {{ pairs.proof.rendererLabel }} 的同名示例
          仅 <strong>{{ pairs.proof.deltaLines }} 行</strong>不同
        </div>
        <div class="tri-proof">
          <div v-for="side in proofSides" :key="side.label" class="tri-proof-pane">
            <div class="tri-proof-pane-header">
              <span class="tri-proof-pane-label">{{ side.label }}</span>
              <code class="tri-proof-pane-path">{{ side.path }}</code>
            </div>
            <pre class="tri-proof-code"><code><span
              v-for="(line, i) in side.lines"
              :key="i"
              class="tri-proof-line"
              :class="{ 'is-changed': side.changed.includes(i) }"
            >{{ line }}
</span></code></pre>
          </div>
        </div>
      </template>
    </div>

    <!-- 三端安装/导入方式 -->
    <a-tabs v-model:activeKey="active" class="tri-tabs">
      <a-tab-pane v-for="r in renderers" :key="r.key" :tab="r.name">
        <div class="tri-shot">
          <p class="tri-shot-hint">
            同一份 Schema 源码，{{ r.name }} 端只需更换导入包。
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
// 同名示例配对的**实测**结果（由 scripts/gen-tri-render-pairs.mjs 从三端真实示例文件量出并生成）
import pairsJson from '@/tri-render/pairs.json'

const active = ref('vue3')

const pairs = pairsJson

/** 证据两侧的完整源码 + 变更行号（行号由生成器按 LCS 逐行比对得出，前端不做 diff） */
const proofSides = computed(() => {
  const p = pairs.proof
  if (!p) return []
  return [p.source, p.target].map((s) => ({
    label: s.label,
    path: s.path,
    changed: s.changed,
    lines: s.code.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'),
  }))
})

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

/* ── 实测证据 ── */
.tri-evidence {
  padding: 18px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.tri-evidence-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}

.tri-evidence-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.tri-evidence-metric {
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}

.tri-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.tri-stat {
  padding: 12px 14px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fff;
}

.tri-stat-label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 6px;
}

.tri-stat-figures {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.8;
}

.tri-stat-num {
  font-weight: 700;
  color: var(--es-brand-primary);
}

.tri-stat-pkg {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tri-stat-pkg code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: #999;
}

.tri-stat-note {
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}

.tri-proof-header {
  margin: 18px 0 10px;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.7;
}

.tri-proof-header code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--es-brand-primary);
}

.tri-proof-header strong {
  color: var(--es-brand-primary);
}

.tri-proof {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tri-proof-pane {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.tri-proof-pane-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #f0f0f0;
}

.tri-proof-pane-label {
  font-size: 12px;
  font-weight: 600;
  color: #1f2329;
}

.tri-proof-pane-path {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: #999;
  word-break: break-all;
}

.tri-proof-code {
  margin: 0;
  padding: 10px 0;
  background: #1e1e1e;
  max-height: 320px;
  overflow: auto;
}

.tri-proof-code code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #abb2bf;
  white-space: pre;
}

.tri-proof-line {
  display: block;
  padding: 0 12px;
}

.tri-proof-line.is-changed {
  background: rgba(59, 130, 246, 0.18);
  box-shadow: inset 3px 0 0 var(--es-brand-primary);
}

@media (max-width: 768px) {
  .tri-proof {
    grid-template-columns: 1fr;
  }
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
