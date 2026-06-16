<!--
  ADV 适配器：表格工具栏按钮

  将 el-button 替换为 a-button，图标使用 @ant-design/icons-vue。
-->
<template>
  <div class="table-btns-container">
    <div class="btn-left" v-if="leftBtns.length || leftText">
      <span v-if="leftText" class="btn-left-text">{{ leftText }}</span>
      <a-button
        v-for="(item, idx) in leftBtns"
        :key="item.key || idx"
        :type="mapBtnType(item.type)"
        :size="mapBtnSize(item.size)"
        :loading="item.loading"
        :disabled="isDisabled(item)"
        :icon="renderIcon(item.icon)"
        v-bind="filterExtraProps(item)"
        @click="item.click ? item.click(item._model, instance) : undefined"
      >
        {{ item.name }}
      </a-button>
    </div>
    <div class="btn-right" v-if="rightBtns.length">
      <a-button
        v-for="(item, idx) in rightBtns"
        :key="item.key || idx"
        :type="mapBtnType(item.type)"
        :size="mapBtnSize(item.size)"
        :loading="item.loading"
        :disabled="isDisabled(item)"
        :icon="renderIcon(item.icon)"
        v-bind="filterExtraProps(item)"
        @click="item.click ? item.click(item._model, instance) : undefined"
      >
        {{ item.name }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BtnConfig } from '../../../types'
import { getButtonPosition } from '@es-plus/core'
import { getAdvIcon } from '../../../utils/icon'
import { mapButtonType, mapSize } from '../../../utils/shared'

const props = defineProps<{
  btnConfig: BtnConfig[]
  leftText?: string
  instance?: Record<string, unknown>
}>()

const leftBtns = computed(() =>
  props.btnConfig.filter((b) => getButtonPosition(b) === 'left')
)
const rightBtns = computed(() =>
  props.btnConfig.filter((b) => getButtonPosition(b) !== 'left')
)

function mapBtnType(type?: string): string {
  return mapButtonType(type)
}

function mapBtnSize(size?: string): string {
  return mapSize(size, 'small')
}

function isDisabled(item: BtnConfig): boolean {
  if (typeof item.disabled === 'function') return item.disabled()
  return !!item.disabled
}

function renderIcon(iconName?: string) {
  if (!iconName) return undefined
  return getAdvIcon(iconName)
}

/**
 * 过滤掉已知的内部属性，其余透传给 a-button
 */
function filterExtraProps(item: BtnConfig): Record<string, unknown> {
  const knownKeys = new Set([
    'name', 'key', 'type', 'size', 'icon', 'position', 'code', 'direction',
    'loading', 'disabled', 'permissionValue', 'triggerEvent', 'click',
    'dialogKey', 'actionType', 'confirm', '_model',
  ])
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (!knownKeys.has(k)) {
      extra[k] = v
    }
  }
  return extra
}
</script>

<style scoped>
.table-btns-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  min-height: 32px;
}
.btn-left, .btn-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-left-text {
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
  margin-right: 4px;
}
</style>
