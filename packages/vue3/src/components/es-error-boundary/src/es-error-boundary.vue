<!--
  EsErrorBoundary —— 组件级错误边界（Vue 3）

  用 onErrorCaptured 捕获【默认插槽子树】在渲染 / 生命周期 / 侦听器中抛出的错误：
  - 捕获后渲染 fallback（具名插槽 fallback，或默认降级文案），把故障子树隔离，避免整页白屏
  - 通过 error 事件把 (err, info) 上报宿主，便于埋点/日志
  - onErrorCaptured 返回 false：阻止错误继续向上冒泡（不再触发上层 errorCaptured 与
    app.config.errorHandler），将故障真正围栏在本边界内
  - 暴露 reset() 供宿主在数据恢复后清除错误态、重新渲染子树

  说明：这是三端一致的通用错误边界（vue3 / adapter-antdv 实现相同，vue2 用 errorCaptured 选项）。
  与 EsTable 逐单元格 render 的 try/catch 互补——后者只兜住单个自定义 cell render，
  本边界兜住子组件生命周期/渲染错误。
-->
<template>
  <slot v-if="!capturedError" />
  <slot v-else name="fallback" :error="capturedError" :reset="reset">
    <div class="es-error-boundary" role="alert">
      {{ fallbackText || '组件渲染出错' }}
    </div>
  </slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

defineOptions({ name: 'EsErrorBoundary' })

defineProps<{
  /** 默认降级文案（未提供 fallback 插槽时使用） */
  fallbackText?: string
}>()

const emit = defineEmits<{
  error: [err: unknown, info: string]
}>()

const capturedError = ref<unknown>(null)

onErrorCaptured((err, _instance, info) => {
  capturedError.value = err
  emit('error', err, info)
  // 阻止继续冒泡，将故障隔离在本边界内
  return false
})

function reset() {
  capturedError.value = null
}

defineExpose({ reset })
</script>

<style scoped>
.es-error-boundary {
  padding: 12px 16px;
  color: #cf1322;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  font-size: 13px;
}
</style>
