<template>
  <div class="code-diff">
    <div class="diff-pane traditional">
      <div class="diff-header">
        <span class="diff-badge bad">{{ leftTitle }}</span>
        <span class="diff-lines">{{ leftLines }}</span>
      </div>
      <pre class="diff-code"><code>{{ leftCode }}</code></pre>
    </div>
    <div class="diff-pane esplus">
      <div class="diff-header">
        <span class="diff-badge good">{{ rightTitle }}</span>
        <span class="diff-lines">{{ rightLines }}</span>
      </div>
      <pre class="diff-code"><code>{{ rightCode }}</code></pre>
    </div>
  </div>
</template>

<script>
// 并排 diff 组件（三站接口一致）：左原生右 es-plus，行数徽章。
// 详见 docs/改造三端站点.md §5.3
export default {
  name: 'CodeDiff',
  props: {
    leftTitle: { type: String, default: '原生写法' },
    rightTitle: { type: String, default: 'ES-Plus' },
    leftLines: { type: String, default: '~250 行' },
    rightLines: { type: String, default: '~30 行' },
    leftCode: { type: String, required: true },
    rightCode: { type: String, required: true }
  }
}
</script>

<style scoped>
.code-diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.diff-pane {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.diff-pane.traditional {
  border-color: rgba(245, 108, 108, 0.3);
}

.diff-pane.esplus {
  border-color: rgba(103, 194, 58, 0.3);
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.diff-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
}

.diff-badge.bad {
  background: #fef0f0;
  color: #f56c6c;
}

.diff-badge.good {
  background: #f0f9eb;
  color: #67c23a;
}

.diff-lines {
  font-size: 13px;
  font-weight: 600;
  color: #718096;
}

.diff-code {
  margin: 0;
  padding: 16px 20px;
  background: #1e1e1e;
  max-height: 420px;
  overflow: auto;
}

.diff-code code {
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #d4d4d4;
  white-space: pre;
}

@media (max-width: 768px) {
  .code-diff {
    grid-template-columns: 1fr;
  }
}
</style>
