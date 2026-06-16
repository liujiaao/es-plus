<!--
  SVG Icon 组件 — ADV 适配版

  支持三种图标模式：
  1. SVG sprite 符号（`icon-xxx`）
  2. 外部 URL 图片
  3. @ant-design/icons-vue 组件
-->
<template>
  <svg v-if="isSvgIcon" :class="svgClass" aria-hidden="true" v-bind="$attrs">
    <use :href="symbolId" />
  </svg>
  <img
    v-else-if="isExternal"
    :src="iconName"
    :style="{ width: '1em', height: '1em', verticalAlign: '-0.15em', fill: 'currentColor', overflow: 'hidden' }"
    v-bind="$attrs"
  />
  <component v-else-if="resolvedIcon" :is="resolvedIcon" :style="{ fontSize: '1em' }" />
  <span v-else class="anticon" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getAdvIcon } from '../../../utils/icon'

const props = withDefaults(
  defineProps<{
    iconClass?: string
    iconName?: string
  }>(),
  {
    iconClass: '',
    iconName: '',
  }
)

const icon = computed(() => props.iconName || '')

const isSvgIcon = computed(() => icon.value.startsWith('icon-'))
const isExternal = computed(() => /^(https?:)?\/\//.test(icon.value))

const svgClass = computed(() => {
  if (props.iconClass) return `svg-icon ${props.iconClass}`
  return 'svg-icon'
})

const symbolId = computed(() => `#${icon.value}`)

// 按优先级解析：先映射表，再直接匹配，再尝试加 Outlined 后缀
const resolvedIcon = computed(() => {
  if (!icon.value || isSvgIcon.value || isExternal.value) return null
  return getAdvIcon(icon.value, 14) ? getAdvIcon(icon.value, 14) : null
})
</script>
