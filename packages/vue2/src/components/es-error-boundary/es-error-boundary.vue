<!--
  EsErrorBoundary —— 组件级错误边界（Vue 2 版本，对齐 @es-plus/vue3 的对外 API）

  用 errorCaptured 选项钩子捕获【默认插槽子树】在渲染 / 生命周期 / 侦听器中抛出的错误：
  - 捕获后渲染 fallback（具名插槽 fallback，或默认降级文案），把故障子树隔离，避免整页白屏
  - 通过 error 事件把 (err, info) 上报宿主，便于埋点/日志
  - errorCaptured 返回 false：阻止错误继续向上冒泡（不再触发上层 errorCaptured 与
    Vue.config.errorHandler），将故障真正围栏在本边界内
  - 暴露 reset() 供宿主在数据恢复后清除错误态、重新渲染子树
-->
<template>
  <slot v-if="!capturedError" />
  <slot v-else name="fallback" :error="capturedError" :reset="reset">
    <div class="es-error-boundary" role="alert">
      {{ fallbackText || '组件渲染出错' }}
    </div>
  </slot>
</template>

<script lang="ts">
export default {
  name: 'EsErrorBoundary',
  props: {
    /** 默认降级文案（未提供 fallback 插槽时使用） */
    fallbackText: { type: String, default: '' },
  },
  data() {
    return { capturedError: null as unknown }
  },
  errorCaptured(this: any, err: unknown, _vm: unknown, info: string) {
    this.capturedError = err
    this.$emit('error', err, info)
    // 阻止继续冒泡，将故障隔离在本边界内
    return false
  },
  methods: {
    reset(this: any) {
      this.capturedError = null
    },
  },
}
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
