<template>
  <CodePlayground
    v-if="entry"
    :title="title"
    :description="description"
    :code="entry.code"
  >
    <template #preview>
      <component :is="entry.component" />
    </template>
  </CodePlayground>
  <el-alert
    v-else
    type="warning"
    :title="`未找到示例：${name}`"
    :description="`请检查 example-registry.ts 是否注册了该示例（已注册：${availableHint}）`"
    show-icon
    :closable="false"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CodePlayground from './CodePlayground.vue'
import { getExample, listExampleNames } from './example-registry'

const props = defineProps<{
  name: string
  title?: string
  description?: string
}>()

const entry = computed(() => getExample(props.name))

const title = computed(() => props.title || props.name)
const description = computed(() => props.description || '')

const availableHint = computed(() => {
  const names = listExampleNames()
  return names.length > 6 ? `${names.slice(0, 6).join(', ')}...` : names.join(', ')
})
</script>
