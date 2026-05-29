<template>
  <div class="diff-badge">
    <span v-if="diff.added.length" class="diff-chunk added">
      <span class="sigil">+</span>{{ diff.added.length }}
      <span class="props">{{ formatList(diff.added) }}</span>
    </span>
    <span v-if="diff.removed.length" class="diff-chunk removed">
      <span class="sigil">−</span>{{ diff.removed.length }}
      <span class="props">{{ formatList(diff.removed) }}</span>
    </span>
    <span v-if="diff.modified.length" class="diff-chunk modified">
      <span class="sigil">~</span>{{ diff.modified.length }}
      <span class="props">{{ formatList(diff.modified) }}</span>
    </span>
    <span v-if="!diff.added.length && !diff.removed.length && !diff.modified.length" class="diff-chunk noop">
      no changes
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  diff: { added: string[]; removed: string[]; modified: string[] }
}>()

const formatList = (props: string[]): string => {
  if (props.length === 0) return ''
  if (props.length <= 3) return props.join(', ')
  return `${props.slice(0, 3).join(', ')} +${props.length - 3}`
}
</script>

<style lang="scss" scoped>
.diff-badge {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.diff-chunk {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;

  .sigil {
    font-weight: 700;
  }

  .props {
    margin-left: 4px;
    color: var(--text-color-regular);
    font-size: 11px;
  }

  &.added {
    background: rgba(103, 194, 58, 0.12);
    color: #67c23a;
  }
  &.removed {
    background: rgba(245, 108, 108, 0.12);
    color: #f56c6c;
  }
  &.modified {
    background: rgba(230, 162, 60, 0.12);
    color: #e6a23c;
  }
  &.noop {
    background: var(--fill-color-light);
    color: var(--text-color-secondary);
  }
}
</style>
