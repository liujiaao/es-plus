<template>
  <!-- 开发指南壳：侧栏分组与页内 chrome 都来自 utils/doc-nav.js 的同一张表 -->
  <doc-shell :groups="['开发指南', '进阶']" />
</template>

<script>
import DocShell from '@/components/doc/DocShell.vue'

export default {
  name: 'GuideLayout',
  components: { DocShell }
}
</script>
