<template>
  <div class="trace-tab">
    <div v-if="!traces.length" class="trace-empty">
      <el-icon :size="32"><Connection /></el-icon>
      <p>{{ t('aiCrud.trace.empty') }}</p>
    </div>

    <ol v-else class="trace-list">
      <li
        v-for="entry in traces"
        :key="entry.id"
        class="trace-entry"
        :class="[
          `kind-${entry.kind}`,
          `status-${entry.status}`,
          { highlighted: highlightedIds?.includes(entry.id) },
        ]"
      >
        <div class="trace-head" @click="toggle(entry.id)">
          <span class="trace-icon">{{ kindIcon(entry.kind) }}</span>
          <div class="trace-meta">
            <div class="trace-title-row">
              <span class="trace-title">{{ traceTitle(entry) }}</span>
              <span v-if="entry.toolName" class="trace-tag">tool: {{ entry.toolName }}</span>
              <span v-if="entry.resourceUri" class="trace-tag">resource</span>
            </div>
            <div class="trace-summary">{{ entry.summary }}</div>
          </div>
          <div class="trace-aside">
            <span class="trace-status" :class="`status-${entry.status}`">
              {{ statusBadge(entry.status) }}
            </span>
            <span class="trace-duration">{{ entry.durationMs }}ms</span>
          </div>
        </div>

        <div v-if="expanded.has(entry.id)" class="trace-body">
          <DiffBadge v-if="entry.diff" :diff="entry.diff" />

          <details v-if="entry.input !== undefined" class="trace-detail" open>
            <summary>{{ t('aiCrud.trace.input') }}</summary>
            <pre class="trace-json"><code>{{ formatPayload(entry.input) }}</code></pre>
          </details>

          <details v-if="entry.output !== undefined" class="trace-detail" open>
            <summary>{{ t('aiCrud.trace.output') }}</summary>
            <pre class="trace-json"><code>{{ formatPayload(entry.output) }}</code></pre>
          </details>

          <div v-if="entry.error" class="trace-error">
            <strong>error:</strong> {{ entry.error }}
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Connection } from '@element-plus/icons-vue'
import DiffBadge from './DiffBadge.vue'
import type { TraceEntry, TraceKind, TraceStatus } from '@/utils/mcp-flow'

const props = defineProps<{
  traces: TraceEntry[]
  highlightedIds?: string[]
}>()

const { t } = useI18n()

const expanded = ref<Set<string>>(new Set())

const toggle = (id: string) => {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

const kindIcon = (kind: TraceKind): string => {
  switch (kind) {
    case 'user_message': return '💬'
    case 'mcp_resource_fetch': return '📚'
    case 'ai_request': return '🤖'
    case 'ai_response': return '🤖'
    case 'mcp_tool_call': return '🛠'
    case 'mcp_validation': return '✅'
    case 'config_diff': return '🔄'
    case 'render': return '✨'
    default: return '·'
  }
}

const statusBadge = (status: TraceStatus): string => {
  switch (status) {
    case 'success': return '✓'
    case 'error': return '✗'
    case 'retry': return '↻'
    case 'cached': return '💾'
    default: return ''
  }
}

const traceTitle = (entry: TraceEntry): string => {
  // For canonical kinds we localize the title (server-side strings stay raw,
  // tool/resource names stay raw because they're protocol-stable identifiers).
  if (entry.kind === 'user_message') return t('aiCrud.trace.userMessage')
  if (entry.kind === 'render') return t('aiCrud.trace.render')
  return entry.title
}

const formatPayload = (val: unknown): string => {
  if (val === undefined) return ''
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

// Auto-expand the most recent trace entry whenever a new one is appended.
import { watch } from 'vue'
watch(
  () => props.traces.length,
  (n, prev) => {
    if (n > (prev ?? 0)) {
      const last = props.traces[n - 1]
      if (last) expanded.value.add(last.id)
    }
  },
)
</script>

<style lang="scss" scoped>
.trace-tab {
  height: 100%;
  overflow-y: auto;
  padding: 8px 4px;
}

.trace-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  color: var(--text-color-secondary);
  gap: 12px;

  p {
    font-size: 13px;
    text-align: center;
    max-width: 280px;
    line-height: 1.5;
  }
}

.trace-list {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 22px;
    top: 16px;
    bottom: 16px;
    width: 2px;
    background: var(--border-color-lighter);
  }
}

.trace-entry {
  position: relative;
  margin-bottom: 8px;
  border-radius: 8px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;

  &.highlighted {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color-light);
  }

  &.status-error {
    border-left: 3px solid #f56c6c;
  }
  &.status-retry {
    border-left: 3px solid #e6a23c;
  }
  &.status-cached {
    border-left: 3px solid var(--text-color-secondary);
  }
  &.status-success {
    border-left: 3px solid #67c23a;
  }
}

.trace-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var(--fill-color-light);
  }
}

.trace-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 28px;
  display: flex;
  justify-content: center;
}

.trace-meta {
  flex: 1;
  min-width: 0;
}

.trace-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .trace-title {
    font-weight: 600;
    color: var(--text-color-primary);
    font-size: 13px;
  }

  .trace-tag {
    padding: 1px 6px;
    background: var(--fill-color);
    color: var(--text-color-secondary);
    border-radius: 3px;
    font-size: 11px;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.trace-summary {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;

  .trace-status {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;

    &.status-success { color: #67c23a; }
    &.status-error { color: #f56c6c; }
    &.status-retry { color: #e6a23c; }
    &.status-cached { color: var(--text-color-secondary); }
  }

  .trace-duration {
    font-size: 11px;
    color: var(--text-color-secondary);
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.trace-body {
  padding: 0 12px 12px 52px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-detail {
  border: 1px solid var(--border-color-lighter);
  border-radius: 4px;
  background: var(--fill-color-light);

  summary {
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text-color-secondary);
    cursor: pointer;
    user-select: none;
  }
}

.trace-json {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  font-family: 'SFMono-Regular', Consolas, monospace;
  background: var(--bg-color);
  border-top: 1px solid var(--border-color-lighter);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow-y: auto;

  code {
    color: var(--text-color-regular);
  }
}

.trace-error {
  padding: 6px 10px;
  background: rgba(245, 108, 108, 0.08);
  color: #f56c6c;
  font-size: 12px;
  border-radius: 4px;
  border-left: 2px solid #f56c6c;
}
</style>
