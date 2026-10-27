<template>
  <!-- 组件站壳：侧栏分组与页内 chrome 都来自 utils/doc-nav.js 的同一张表 -->
  <doc-shell :groups="['起步', '组件']" />
</template>

<script>
import DocShell from '@/components/doc/DocShell.vue'

export default {
  name: 'ComponentLayout',
  components: { DocShell }
}
</script>
