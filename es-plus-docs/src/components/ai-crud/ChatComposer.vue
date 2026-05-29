<template>
  <div class="chat-composer">
    <!-- Preset library -->
    <div class="preset-section" v-if="!hasMessages">
      <div class="preset-title">{{ t('aiCrud.preset.title') }}</div>
      <div class="preset-grid">
        <button
          v-for="preset in presets"
          :key="preset.id"
          class="preset-card"
          :title="preset.showcases.join(' · ')"
          @click="$emit('selectPreset', preset)"
        >
          <el-icon :size="20"><component :is="iconMap[preset.icon]" /></el-icon>
          <span class="preset-label">{{ localeOf(preset.label) }}</span>
        </button>
      </div>
    </div>

    <!-- Message list -->
    <div ref="listRef" class="message-list">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="`role-${msg.role}`"
        @click="msg.role === 'assistant' && msg.traceIds?.length && $emit('highlightTraces', msg.traceIds)"
      >
        <div class="message-bubble">
          <div class="message-content">{{ msg.content }}</div>
          <div v-if="msg.role === 'assistant' && (msg.fieldsCount || msg.columnsCount)" class="message-stats">
            <span class="stat">{{ t('aiCrud.chat.fieldsCount', { n: msg.fieldsCount ?? 0 }) }}</span>
            <span class="stat">{{ t('aiCrud.chat.columnsCount', { n: msg.columnsCount ?? 0 }) }}</span>
            <span v-if="msg.traceIds?.length" class="stat traces">
              {{ t('aiCrud.chat.traceCount', { n: msg.traceIds.length }) }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="loading" class="message role-assistant">
        <div class="message-bubble loading">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
          <span class="loading-text">{{ t('aiCrud.chat.thinking') }}</span>
        </div>
      </div>
    </div>

    <!-- Composer -->
    <div class="composer">
      <textarea
        v-model="input"
        class="composer-input"
        :placeholder="t('aiCrud.chat.placeholder')"
        rows="3"
        :disabled="loading"
        @keydown.enter.exact.prevent="handleSend"
        @keydown.enter.shift.exact="() => {}"
      />
      <div class="composer-actions">
        <el-button
          v-if="loading"
          size="small"
          type="warning"
          @click="$emit('abort')"
        >
          {{ t('aiCrud.chat.abort') }}
        </el-button>
        <el-button
          v-else
          size="small"
          @click="$emit('reset')"
          :disabled="!hasMessages"
        >
          {{ t('aiCrud.chat.reset') }}
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="loading"
          :disabled="!input.trim()"
          @click="handleSend"
        >
          {{ t('aiCrud.chat.send') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, markRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  User, List, Goods, Document, Check, Connection,
} from '@element-plus/icons-vue'
import type { Preset } from '@/utils/preset-examples'
import type { ChatMessage } from '@/utils/mcp-flow'

const props = defineProps<{
  messages: ChatMessage[]
  loading: boolean
  presets: Preset[]
}>()

const emit = defineEmits<{
  send: [text: string]
  selectPreset: [preset: Preset]
  reset: []
  abort: []
  highlightTraces: [ids: string[]]
}>()

const { t, locale } = useI18n()

const input = ref('')
const listRef = ref<HTMLElement>()

const hasMessages = computed(() => props.messages.length > 0)

const iconMap: Record<string, unknown> = {
  User: markRaw(User),
  List: markRaw(List),
  Goods: markRaw(Goods),
  Document: markRaw(Document),
  Check: markRaw(Check),
  Connection: markRaw(Connection),
}

const localeOf = (label: { zh: string; en: string }): string =>
  locale.value === 'en-US' ? label.en : label.zh

const handleSend = () => {
  const text = input.value.trim()
  if (!text || props.loading) return
  emit('send', text)
  input.value = ''
}

// Autoscroll to bottom on new message or loading state change.
watch(
  () => [props.messages.length, props.loading] as const,
  () => {
    nextTick(() => {
      if (listRef.value) {
        listRef.value.scrollTop = listRef.value.scrollHeight
      }
    })
  },
)
</script>

<style lang="scss" scoped>
.chat-composer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--fill-color-light);
  border-radius: 8px;
  border: 1px solid var(--border-color-lighter);
}

.preset-section {
  padding: 16px;
  border-bottom: 1px solid var(--border-color-lighter);

  .preset-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-secondary);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .preset-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg-color);
    border: 1px solid var(--border-color-lighter);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text-color-primary);
    font-family: inherit;
    text-align: left;

    &:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
      background: var(--primary-color-light);
    }

    .preset-label {
      font-size: 13px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

.message {
  display: flex;
  max-width: 90%;

  &.role-user {
    align-self: flex-end;

    .message-bubble {
      background: var(--primary-color);
      color: white;
    }
  }

  &.role-assistant {
    align-self: flex-start;
    cursor: pointer;

    .message-bubble {
      background: var(--bg-color);
      border: 1px solid var(--border-color-lighter);
      color: var(--text-color-primary);
    }

    &:hover .message-bubble {
      border-color: var(--primary-color);
    }
  }
}

.message-bubble {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;

  &.loading {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-color-secondary);
      animation: dot-bounce 1.2s infinite ease-in-out;

      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }

    .loading-text {
      margin-left: 8px;
      color: var(--text-color-secondary);
      font-size: 12px;
    }
  }
}

@keyframes dot-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.message-stats {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;

  .stat {
    padding: 1px 6px;
    background: var(--fill-color);
    color: var(--text-color-secondary);
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, monospace;

    &.traces {
      color: var(--primary-color);
    }
  }
}

.composer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color-lighter);
  background: var(--bg-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-input {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  color: var(--text-color-primary);
  background: var(--bg-color);
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-color);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
