<template>
  <!--
    示例分组标签条（组件页与高级指南共用）。
    只有两个以上分组才渲染 —— 单组页面不出现「只有一个按钮」的标签条，
    行为与分组功能上线前完全一致。
    外观：胶囊 + 计数，颜色 / 间距全走令牌，暗色自动跟随。
  -->
  <div v-if="groups.length > 1" class="examples-groups">
    <button
      v-for="group in groups"
      :key="group.name"
      type="button"
      class="examples-group"
      :class="{ 'is-active': group.name === active }"
      :aria-pressed="group.name === active"
      @click="emit('select', group.name)"
    >
      {{ group.name }}
      <span class="examples-group-count">{{ group.items.length }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ExampleGroup } from '@/composables/useExampleGroups'

defineProps<{
  groups: ExampleGroup[]
  active: string
}>()

const emit = defineEmits<{ select: [name: string] }>()
</script>

<style scoped>
.examples-groups {
  display: flex;
  flex-wrap: wrap;
  gap: var(--es-space-2);
  margin: 0 0 var(--es-space-5);
}

.examples-group {
  display: inline-flex;
  align-items: center;
  gap: var(--es-space-2);
  padding: var(--es-space-2) var(--es-space-4);
  border: 1px solid var(--border-color-lighter);
  border-radius: var(--es-radius-full);
  background-color: transparent;
  color: var(--text-color-regular);
  font-size: var(--es-text-sm);
  line-height: var(--es-leading-tight);
  cursor: pointer;
  transition: color var(--es-duration-base) var(--es-ease),
    border-color var(--es-duration-base) var(--es-ease),
    background-color var(--es-duration-base) var(--es-ease);
}

.examples-group:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.examples-group.is-active {
  color: var(--es-brand-strong);
  border-color: var(--primary-color);
  /* 底色用 --es-brand-tint 而不是 --primary-color-light：品牌字压品牌浅底这条配对
     实测 4.75:1（浅色）/ 6.18:1（暗色）；换回主色浅底那档更蓝的 tint 只有 4.24:1，
     13px 的字就该算不合格了（es-pc 的 SectionTabs 同一处同样改）。 */
  background-color: var(--es-brand-tint);
}

.examples-group:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.examples-group-count {
  font-size: var(--es-text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--text-color-secondary);
}
</style>
