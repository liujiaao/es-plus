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

    <!-- 证据：实测「同名示例之间到底差几行」 -->
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
            <router-link
              v-if="r.key === 'vue2'"
              to="/cases"
              class="tri-stat-note"
            >Vue 2 端示例仍是并入前的手写版本，尚未与同一份配置对齐（渲染器本身支持同一份配置，含 attrs 透传）</router-link>
          </div>
        </div>
      </div>

      <!-- 差异最小的那一对：两侧完整源码 + 逐行标出变更 -->
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

    <!-- 三端渲染方式切换器（安装 / 导入方式） -->
    <el-tabs v-model="active" class="tri-tabs">
      <el-tab-pane v-for="r in renderers" :key="r.key" :name="r.key">
        <template #label>
          <span class="tab-label">
            <span class="tab-dot" :style="{ background: r.color }"></span>{{ r.name }}
          </span>
        </template>
        <div class="tri-shot">
          <p class="tri-shot-hint">
            同一份 Schema 源码，{{ r.name }} 端只需更换导入包。
          </p>
          <div class="tri-shot-meta">
            <code class="tri-pkg">{{ r.pkg }}</code>
            <code class="tri-install">{{ r.install }}</code>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
// 三端 Schema 单一真源：由 scripts/sync-tri-render.mjs 从 docs/tri-render/ 分发，禁止手改本文件
import schema from '@/tri-render/schema.json'
// 同名示例配对的**实测**结果（由 scripts/gen-tri-render-pairs.mjs 从三端真实示例文件量出并生成）
import pairsJson from '@/tri-render/pairs.json'

const active = ref('vue3')

const renderers = [
  { key: 'vue3', name: 'Vue 3 · Element Plus', color: '#409eff', pkg: '@es-plus/vue3', install: 'npm i @es-plus/vue3 element-plus' },
  { key: 'vue2', name: 'Vue 2 · Element UI', color: '#3b82f6', pkg: '@es-plus/vue2', install: 'npm i @es-plus/vue2 element-ui' },
  { key: 'antdv', name: 'Vue 3 · Ant Design Vue', color: '#1677ff', pkg: '@es-plus/adapter-antdv', install: 'npm i @es-plus/adapter-antdv ant-design-vue' },
]

const schemaCode = computed(() => JSON.stringify(schema, null, 2))

const pairs = pairsJson as unknown as {
  metric: string
  renderers: { key: string; label: string; pkg: string; pairs: number; medianDelta: number; le10: number }[]
  proof: {
    title: string
    deltaLines: number
    source: { label: string; path: string; changed: number[]; code: string }
    target: { label: string; path: string; changed: number[]; code: string }
  } | null
}

/** 证据两侧的完整源码 + 变更行号（行号为生成器按 LCS 逐行比对得出，前端不做 diff） */
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
</script>

<style lang="scss" scoped>
.tri-render-tabs {
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-color);
}

.tri-schema {
  border-bottom: 1px solid var(--border-color-lighter);
}

.tri-schema-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-color-page);
  border-bottom: 1px solid var(--border-color-lighter);
}

.tri-badge {
  display: inline-block;
  padding: 3px 12px;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.tri-schema-tip {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.tri-schema-code {
  margin: 0;
  padding: 16px 20px;
  background: #1e1e1e;
  max-height: 300px;
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
  border-bottom: 1px solid var(--border-color-lighter);
  background: var(--bg-color-page);
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
  color: var(--text-color-primary);
}

.tri-evidence-metric {
  font-size: 12px;
  color: var(--text-color-secondary);
  line-height: 1.6;
}

.tri-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.tri-stat {
  padding: 12px 14px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  background: var(--bg-color);
}

.tri-stat-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 6px;
}

.tri-stat-figures {
  font-size: 13px;
  color: var(--text-color-regular);
  line-height: 1.8;
}

.tri-stat-num {
  font-weight: 700;
  color: var(--primary-color);
}

.tri-stat-pkg {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.tri-stat-note {
  font-size: 12px;
  color: var(--text-color-secondary);
  line-height: 1.6;
  text-decoration: none;

  &:hover {
    color: var(--primary-color);
  }
}

.tri-proof-header {
  margin: 18px 0 10px;
  font-size: 13px;
  color: var(--text-color-regular);
  line-height: 1.7;

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: var(--primary-color);
  }

  strong {
    color: var(--primary-color);
  }
}

.tri-proof {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tri-proof-pane {
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-color);
}

.tri-proof-pane-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: var(--fill-color-light);
  border-bottom: 1px solid var(--border-color-lighter);
}

.tri-proof-pane-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.tri-proof-pane-path {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: var(--text-color-secondary);
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

/* 变更行高亮：整行铺满宽度，左边一条色带，一眼看出「只差了这几行」 */
.tri-proof-line {
  display: block;
  padding: 0 12px;
}

.tri-proof-line.is-changed {
  background: rgba(59, 130, 246, 0.18);
  box-shadow: inset 3px 0 0 var(--primary-color);
}

.tri-tabs {
  padding: 0 20px 20px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tri-shot {
  padding-top: 12px;
}

.tri-shot-hint {
  margin: 0;
  padding: 14px 16px;
  border: 1px dashed var(--border-color-lighter);
  border-radius: 8px;
  color: var(--text-color-regular);
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
  background: var(--fill-color-light);
  color: var(--primary-color);
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
}

.tri-install {
  color: var(--text-color-secondary);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
}

@media (max-width: 768px) {
  .tri-proof {
    grid-template-columns: 1fr;
  }
}
</style>
