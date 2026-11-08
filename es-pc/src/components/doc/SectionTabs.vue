<template>
  <!--
    手写 section 页的分组标签条（/es-form、/es-table）。
    与主站 components/doc/ExampleGroupTabs.vue 同一套外观与交互：胶囊 + 计数，
    颜色 / 间距全走令牌，暗色自动跟随；同一时刻只有一组 `aria-pressed`。

    与主站的区别只有一个：这里的 `<button>` 换组是**换正文**（v-if），
    所以点击后要自己把滚动位置带回标签条 —— 否则从长组的中段切组，用户会落在
    新组的半山腰，看不出内容已经换了。
  -->
  <div class="section-tabs" role="group" aria-label="示例分组">
    <button
      v-for="group in groups"
      :key="group.key"
      type="button"
      class="section-tab"
      :class="{ 'is-active': group.key === active }"
      :aria-pressed="group.key === active"
      @click="emit('select', group.key)"
    >
      {{ group.name }}
      <span class="section-tab-count">{{ group.count }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  /** [{ key, name, count }]，由 useSectionGroups 给出 */
  groups: { type: Array, required: true },
  /** 当前分组的 key */
  active: { type: String, default: '' },
})

const emit = defineEmits(['select'])
</script>

<style scoped>
.section-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--es-space-2);
  /* 组内可能有 2,000px 上下的示例，标签条吸在顶栏下才不用每次滚回页首换组。
     顶栏 64px（<992px 是 56px）；背景用正文卡片色，滚过去的内容不会透出来。 */
  position: sticky;
  top: 64px;
  z-index: 30;
  margin: calc(-1 * var(--es-space-2)) 0 var(--es-space-4);
  padding: var(--es-space-2) 0;
  background: var(--es-bg);
}

@media (max-width: 991px) {
  .section-tabs {
    top: 56px;
  }
}

.section-tab {
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

.section-tab:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.section-tab.is-active {
  color: var(--es-brand-strong);
  border-color: var(--primary-color);
  /* 底色用 --es-brand-tint 而不是 --primary-color-light：品牌字压品牌浅底这条配对
     实测 4.75:1（浅色）/ 6.18:1（暗色）；换回主色浅底那档更蓝的 tint 只有 4.24:1，
     13px 的字就该算不合格了。 */
  background-color: var(--es-brand-tint);
}

.section-tab:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.section-tab-count {
  font-size: var(--es-text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--text-color-secondary);
}
</style>
