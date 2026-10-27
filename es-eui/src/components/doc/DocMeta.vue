<template>
  <!-- 收尾条：编辑此页 / 报告问题 / 最后更新。
       类名与外观由 docs/theme/docs-chrome.css 统一规定（三站同源）。
       「最后更新」的日期来自构建期注入的 __ES_DOC_META__（scripts/doc-meta.mjs），
       没有数据就整行不渲染 —— 不编一个假日期。 -->
  <div class="es-doc-meta">
    <a :href="editHref" target="_blank" rel="noopener">编辑此页</a>
    <a :href="issueHref" target="_blank" rel="noopener">报告问题</a>
    <span v-if="updated" class="es-doc-meta-date">最后更新：{{ updated }}</span>
  </div>
</template>

<script>
import { editUrlFor, issueUrlFor } from '@/utils/doc-chrome'

export default {
  name: 'DocMeta',
  props: {
    // 该页正文所在的仓库路径（见 utils/doc-nav.js 的 source 字段）
    sourcePath: { type: String, default: '' },
    // 页面标题：预填进 issue 标题，省得读者自己抄
    title: { type: String, default: '' },
    // YYYY-MM-DD；空串表示没有数据
    updated: { type: String, default: '' }
  },
  computed: {
    editHref() {
      return editUrlFor(this.sourcePath)
    },
    issueHref() {
      return issueUrlFor(this.title)
    }
  }
}
</script>
