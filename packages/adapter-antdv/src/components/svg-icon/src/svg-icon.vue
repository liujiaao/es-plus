<!--
  SVG Icon 组件 — ADV 适配版（对齐 vue3 API）

  支持三种图标模式：
  1. SVG sprite 符号（iconClass 不以协议开头）
  2. 外部 URL 图片（iconClass 以 http/https/mailto/tel/open 开头）
  3. @ant-design/icons-vue 组件（iconClass 可解析为 ADV 图标名）
-->
<template>
  <svg v-if="isSvgIcon" :class="svgClass" aria-hidden="true" v-bind="$attrs">
    <use :href="symbolId" />
  </svg>
  <img
    v-else-if="isExternal"
    :src="iconValue"
    :class="svgClass"
    :style="{ width: '1em', height: '1em', verticalAlign: '-0.15em', fill: 'currentColor', overflow: 'hidden' }"
    v-bind="$attrs"
  />
  <component v-else-if="resolvedIcon" :is="resolvedIcon" :style="{ fontSize: '1em' }" v-bind="$attrs" />
  <span v-else class="anticon" :class="svgClass" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getAdvIcon } from '../../../utils/icon'

const props = withDefaults(
  defineProps<{
    /** 主图标标识，对齐 vue3 的 iconClass */
    iconClass?: string
    /** 兼容旧版 prop，效果同 iconClass */
    iconName?: string
    /** 额外类名，对齐 vue3 */
    className?: string
  }>(),
  {
    iconClass: '',
    iconName: '',
    className: '',
  },
)

const iconValue = computed(() => props.iconClass || props.iconName || '')

const isExternal = computed(() => /^(https?:|mailto:|tel:|open)/.test(iconValue.value))
const isSvgIcon = computed(() => !!iconValue.value && !isExternal.value)

const svgClass = computed(() => {
  if (props.className) return `svg-icon ${props.className}`
  return 'svg-icon'
})

const symbolId = computed(() => {
  const val = iconValue.value
  return val.startsWith('icon-') ? `#${val}` : `#icon-${val}`
})

// 按优先级解析：先映射表，再直接匹配，再尝试加 Outlined 后缀
const resolvedIcon = computed(() => {
  const val = iconValue.value
  if (!val || isExternal.value) return null
  return getAdvIcon(val, 14) ? getAdvIcon(val, 14) : null
})
</script>
