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
  <!-- 加载中占位：示例组件与它的源码是惰性加载的（见 example-registry.ts），
       先占住高度，避免代码块从页面上「跳」出来 -->
  <div v-else-if="hasDemo" class="demo-loading" role="status" aria-live="polite">
    <span class="demo-loading-dot" aria-hidden="true"></span>
    <span>正在加载示例「{{ name }}」…</span>
  </div>
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
import { computed, markRaw, ref, shallowRef, watch } from 'vue'
import CodePlayground from './CodePlayground.vue'
import { hasExample, listExampleNames, loadExample, type ExampleEntry } from './example-registry'

const props = defineProps<{
  name: string
  title?: string
  description?: string
}>()

const entry = shallowRef<ExampleEntry | null>(null)
const hasDemo = computed(() => hasExample(props.name))

// 竞态防护：同一实例被换成另一个示例名时，先返回的旧结果不得覆盖新结果
let seq = 0
watch(
  () => props.name,
  async (name) => {
    const mine = ++seq
    entry.value = null
    if (!hasExample(name)) return
    const loaded = await loadExample(name)
    if (mine !== seq) return
    // markRaw：示例组件是模块导出的对象，不需要也不应该被做成响应式代理
    entry.value = loaded ? markRaw(loaded) : null
  },
  { immediate: true },
)

const title = computed(() => props.title || props.name)
const description = computed(() => props.description || '')

const availableHint = computed(() => {
  const names = listExampleNames()
  return names.length > 6 ? `${names.slice(0, 6).join(', ')}...` : names.join(', ')
})
</script>

<style scoped>
.demo-loading {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 20px 16px;
  margin: 16px 0;
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  background: var(--fill-color-light);
  color: var(--text-color-secondary);
  font-size: 14px;
}

.demo-loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-color);
  animation: demo-loading-pulse 1.2s ease-in-out infinite;
}

@keyframes demo-loading-pulse {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}

/* 尊重「减少动态效果」偏好：脉冲换成静态圆点（docs-a11y.css 的同一口径） */
@media (prefers-reduced-motion: reduce) {
  .demo-loading-dot {
    animation: none;
    opacity: 1;
  }
}
</style>
