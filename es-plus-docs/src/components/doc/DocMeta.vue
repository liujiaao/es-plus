<template>
  <!-- 文档页底部的收尾条：编辑此页 · 报告问题 · 最后更新。
       外观来自 docs-chrome.css（单一权威源，三站同源），这里只负责数据与 i18n。 -->
  <div class="es-doc-meta">
    <a :href="editUrl" target="_blank" rel="noopener">
      <el-icon :size="14"><EditPen /></el-icon>
      {{ t('doc.editPage') }}
    </a>
    <a :href="feedbackUrl" target="_blank" rel="noopener">
      <el-icon :size="14"><ChatDotRound /></el-icon>
      {{ t('doc.reportIssue') }}
    </a>
    <span v-if="updated" class="es-doc-meta-date">
      {{ t('doc.lastUpdated') }}：{{ updated }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditPen, ChatDotRound } from '@element-plus/icons-vue'
import { editUrlFor, issueUrlFor } from '@/utils/doc-source'

const props = defineProps<{
  /** 仓库内路径，如 es-plus-docs/src/docs/usage.md */
  sourcePath: string
  /** 页面标题（预填进 issue） */
  title: string
  /** YYYY-MM-DD；空串则不显示 */
  updated?: string
}>()

const { t } = useI18n()

const editUrl = computed(() => editUrlFor(props.sourcePath))
const feedbackUrl = computed(() => issueUrlFor(props.title))
</script>
