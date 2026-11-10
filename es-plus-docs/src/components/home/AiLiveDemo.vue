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
                  <tr v-for="i in 3" :key="i">
                    <td v-for="col in config.columns" :key="col.prop">{{ sampleCell(col, i) }}</td>
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
      <!-- 主行动按钮回到品牌蓝：绿色在这里不是语义色，只是「AI 看起来像绿色」的
           惯性，和全站唯一的强调色打架。 -->
      <el-button type="primary" size="large" @click="goFull">
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
import { generateCrudConfig, generateCode } from '@es-plus/shared'

const { t } = useI18n()
const router = useRouter()

// 首页离线 demo 的四个快捷描述（W6：原来是 shared 的 `PRESET_EXAMPLES.slice(0,4)`）。
// 这份列表只服务这一个组件 —— 它喂的是 legacy `generateCrudConfig`（纯前端、无模型），
// 与 CLI/MCP 的预设不是同一件事，故就近放置，不再经公共包导出。
const presets = [
  { label: '用户管理', prompt: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除' },
  { label: '订单列表', prompt: '订单列表，查询订单号、客户名称、日期范围、状态，表格显示订单号、客户、金额、状态、创建时间，支持查看详情和删除' },
  { label: '商品管理', prompt: '商品管理，查询商品名称、分类、状态，表格显示名称、分类、价格、库存、状态，支持新增编辑删除' },
  { label: '日志查询', prompt: '操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看不编辑' },
]
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

/**
 * 预览表里的示例行。
 *
 * 此前三行全是「—」—— 一张空表证明不了「生成出来能用」，只会让人以为
 * 组件还没接上数据。这里按列名给一组稳定的示例值（纯前端展示，不发请求）：
 * 读者看到的是一张「生成完就能填数」的表，而不是占位符矩阵。
 */
const SAMPLE_BY_LABEL = [
  [/金额|价格|费用|金额/, ['¥ 12,800', '¥ 3,260', '¥ 48,900']],
  [/日期|时间/, ['2026-10-12', '2026-10-15', '2026-11-02']],
  [/状态/, ['已启用', '待审核', '已归档']],
  [/部门|组织/, ['研发中心', '财务部', '华东大区']],
  [/类型|类别/, ['标准', '加急', '框架']],
  [/名称|姓名|用户/, ['张伟', '李娜', '王强']],
  [/编号|单号|ID/i, ['SO-20261012-01', 'SO-20261012-02', 'SO-20261012-03']],
]

function sampleCell(col, row) {
  const label = String(col.label || col.prop || '')
  for (const [re, values] of SAMPLE_BY_LABEL) {
    if (re.test(label)) return values[(row - 1) % values.length]
  }
  // 没有语义线索的列：给「第 N 行」而不是「—」，至少读得出这是一张表
  return `${row}`
}

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
  margin: 0;
  padding: var(--es-space-6);
  background: var(--es-bg);
  border-radius: var(--es-radius-md);
  border: 1px solid var(--es-border-lighter);
  box-shadow: var(--es-shadow-sm);
}

.ai-live-header {
  text-align: center;
  margin-bottom: 24px;
}

.ai-live-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--es-info-tint);
  color: var(--es-accent-text);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
}

.ai-live-title {
  font-size: var(--es-text-28);
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
  transition: color var(--es-duration-base) var(--es-ease), background-color var(--es-duration-base) var(--es-ease), border-color var(--es-duration-base) var(--es-ease), box-shadow var(--es-duration-base) var(--es-ease), transform var(--es-duration-base) var(--es-ease), opacity var(--es-duration-base) var(--es-ease);

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
  /* 鼠标点击不留环（容器已有底），键盘焦点必须看得见 —— 见下方 :focus-visible */
  outline: none;
  resize: vertical;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  color: var(--text-color-primary);
  background: transparent;
  min-height: 80px;
}

.prompt-input:focus-visible {
  outline: 2px solid var(--es-link);
  outline-offset: 2px;
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
  transition: color var(--es-duration-base) var(--es-ease), background-color var(--es-duration-base) var(--es-ease), border-color var(--es-duration-base) var(--es-ease), box-shadow var(--es-duration-base) var(--es-ease), transform var(--es-duration-base) var(--es-ease), opacity var(--es-duration-base) var(--es-ease);

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
  margin-top: 20px;
}

@media (max-width: 768px) {
  .ai-live-demo {
    padding: var(--es-space-5) var(--es-space-4);
    margin: 0;
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

  /* 英文按钮标签在 nowrap 下 min-content 就 388px（390px 视口整页横滚），
     允许换行并让高度自适应 */
  .ai-live-cta .el-button {
    max-width: 100%;
    white-space: normal;
    height: auto;
    padding: 12px 16px;
    line-height: 1.4;
  }
}
</style>
