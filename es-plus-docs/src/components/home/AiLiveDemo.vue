<template>
  <section class="ai-live-demo">
    <div class="ai-live-header">
      <div class="ai-live-tag">
        <el-icon><MagicStick /></el-icon>
        <span>{{ t('aiLive.tag') }}</span>
      </div>
      <h2 class="ai-live-title">{{ t('aiLive.title') }}</h2>
      <p class="ai-live-subtitle">
        {{ t('aiLive.subtitle') }}
      </p>
    </div>

    <div class="ai-live-body">
      <div class="ai-live-input-area">
        <div class="ai-live-presets">
          <span class="presets-label">{{ t('aiLive.presetsLabel') }}</span>
          <button
            v-for="p in presets"
            :key="p.label"
            class="preset-chip"
            :class="{ active: currentPreset === p.label }"
            @click="usePreset(p)"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="ai-live-prompt">
          <textarea
            v-model="prompt"
            class="prompt-input"
            :placeholder="t('aiLive.promptPlaceholder')"
            rows="3"
          />
          <div class="prompt-actions">
            <span class="prompt-hint">
              <el-icon><InfoFilled /></el-icon>
              {{ t('aiLive.noKeyHint') }}
            </span>
            <el-button type="primary" :loading="generating" @click="generate">
              <el-icon class="btn-icon"><MagicStick /></el-icon>
              {{ t('aiLive.generate') }}
            </el-button>
          </div>
        </div>
      </div>

      <div class="ai-live-output">
        <div class="output-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="output-content" v-show="activeTab === 'preview'">
          <div v-if="!config" class="output-empty">
            <el-icon :size="32"><MagicStick /></el-icon>
            <p>{{ t('aiLive.previewPlaceholder') }}</p>
          </div>
          <div v-else class="output-preview">
            <div class="preview-section">
              <div class="preview-section-title">{{ t('aiLive.previewQueryForm') }}</div>
              <div class="preview-form">
                <div v-for="item in config.formItems" :key="item.prop" class="preview-form-item">
                  <label class="preview-label">{{ item.label }}</label>
                  <div class="preview-input">
                    <el-input
                      v-if="item.formtype === 'Input'"
                      :placeholder="t('aiLive.inputPlaceholder')"
                      disabled
                      size="small"
                    />
                    <el-select
                      v-else-if="item.formtype === 'Select'"
                      :placeholder="t('aiLive.selectPlaceholder')"
                      disabled
                      size="small"
                    />
                    <el-date-picker
                      v-else-if="item.formtype === 'datePicker'"
                      type="daterange"
                      disabled
                      size="small"
                    />
                    <el-input
                      v-else
                      :placeholder="item.formtype"
                      disabled
                      size="small"
                    />
                  </div>
                </div>
              </div>
              <div class="preview-form-btns">
                <el-button
                  v-for="b in config.queryBtns"
                  :key="b.name"
                  :type="b.type || 'default'"
                  size="small"
                  disabled
                >
                  {{ b.name }}
                </el-button>
              </div>
            </div>
            <div class="preview-section">
              <div class="preview-section-title">{{ t('aiLive.previewTable') }}</div>
              <table class="preview-table">
                <thead>
                  <tr>
                    <th v-for="col in config.columns" :key="col.prop">{{ col.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="i in 2" :key="i">
                    <td v-for="col in config.columns" :key="col.prop">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="output-content output-code" v-show="activeTab === 'json'">
          <div v-if="!config" class="output-empty">
            <p>{{ t('aiLive.noConfig') }}</p>
          </div>
          <pre v-else><code>{{ jsonString }}</code></pre>
        </div>
        <div class="output-content output-code" v-show="activeTab === 'code'">
          <div v-if="!code" class="output-empty">
            <p>{{ t('aiLive.noCode') }}</p>
          </div>
          <pre v-else><code>{{ code }}</code></pre>
        </div>
      </div>
    </div>

    <div class="ai-live-cta">
      <el-button type="success" size="large" @click="goFull">
        <el-icon class="btn-icon"><MagicStick /></el-icon>
        {{ t('aiLive.ctaFull') }}
      </el-button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MagicStick, InfoFilled } from '@element-plus/icons-vue'
import { generateCrudConfig, generateCode, PRESET_EXAMPLES } from '@es-plus/shared'

const { t } = useI18n()
const router = useRouter()

const presets = PRESET_EXAMPLES.slice(0, 4)
const prompt = ref(presets[0].prompt)
const currentPreset = ref(presets[0].label)
const config = ref(null)
const code = ref('')
const activeTab = ref('preview')
const generating = ref(false)

const tabs = computed(() => [
  { key: 'preview', label: t('aiLive.tabPreview') },
  { key: 'json', label: t('aiLive.tabJson') },
  { key: 'code', label: t('aiLive.tabCode') },
])

const jsonString = computed(() =>
  config.value ? JSON.stringify(config.value, null, 2) : ''
)

function usePreset(p) {
  prompt.value = p.prompt
  currentPreset.value = p.label
  generate()
}

function generate() {
  if (!prompt.value.trim()) return
  generating.value = true
  try {
    const cfg = generateCrudConfig(prompt.value)
    config.value = cfg
    code.value = generateCode(cfg)
  } finally {
    generating.value = false
  }
}

function goFull() {
  router.push('/ai-crud')
}

generate()
</script>

<style lang="scss" scoped>
.ai-live-demo {
  margin: 60px 0;
  padding: 48px 32px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.06) 0%, rgba(103, 194, 58, 0.06) 100%);
  border-radius: 16px;
  border: 1px solid var(--border-color-lighter);
}

.ai-live-header {
  text-align: center;
  margin-bottom: 36px;
}

.ai-live-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(103, 194, 58, 0.12);
  color: #67c23a;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
}

.ai-live-title {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text-color-primary);
}

.ai-live-subtitle {
  font-size: 15px;
  color: var(--text-color-secondary);
  margin: 0;
}

.ai-live-body {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 24px;
  align-items: stretch;
}

.ai-live-input-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-live-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.presets-label {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.preset-chip {
  padding: 6px 14px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-color-regular);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;
  }
}

.ai-live-prompt {
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.prompt-input {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  color: var(--text-color-primary);
  background: transparent;
  min-height: 80px;
}

.prompt-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.prompt-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.btn-icon {
  margin-right: 4px;
}

.ai-live-output {
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.output-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color-lighter);
  background: var(--fill-color-light);
}

.tab-btn {
  flex: 1;
  padding: 10px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color-regular);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;

  &:hover {
    color: var(--primary-color);
  }

  &.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    background: var(--bg-color);
  }
}

.output-content {
  flex: 1;
  padding: 16px;
  min-height: 280px;
  max-height: 420px;
  overflow: auto;
}

.output-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-color-placeholder);
  text-align: center;
}

.output-code pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  color: var(--text-color-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

.preview-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.preview-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.preview-form {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 12px;
}

.preview-form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 12px;
  color: var(--text-color-regular);
}

.preview-form-btns {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-color-lighter);
    text-align: left;
  }

  th {
    background: var(--fill-color-light);
    color: var(--text-color-regular);
    font-weight: 500;
  }

  td {
    color: var(--text-color-secondary);
  }
}

.ai-live-cta {
  text-align: center;
  margin-top: 32px;
}

@media (max-width: 768px) {
  .ai-live-demo {
    padding: 32px 16px;
    margin: 36px 0;
  }

  .ai-live-title {
    font-size: 22px;
  }

  .ai-live-body {
    grid-template-columns: 1fr;
  }

  .preview-form {
    grid-template-columns: 1fr;
  }
}
</style>
