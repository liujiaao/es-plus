<!--
  ADV 适配器：表格工具栏按钮（对齐 @es-plus/vue3 table-btns.vue）

  - click 回调签名对齐 vue3：单参数 instance（非 _model, instance）
  - 支持 render 自定义渲染按钮
  - leftText 样式对齐 vue3（灰色 rgb(125,125,125)）
  - 响应式样式（@media 768px 竖排）
-->
<template>
  <div v-if="showContainer" class="flex-float btns">
    <div class="left-text">
      {{ leftText }}
    </div>

    <div class="btn-container_block">
      <!-- 左侧按钮组 -->
      <div class="btn-left">
        <template v-for="(item, index) in processedBtnLeft" :key="item.name">
          <div :style="buttonContainerStyle(index)">
            <render-dom v-if="typeof item.render === 'function'" :render="item.render" />
            <a-button
              v-else
              :type="mapBtnType(item.type as string)"
              :danger="mapBtnDanger(item.type as string)"
              :size="mapBtnSize(item.size as string)"
              :loading="item.loading || false"
              :disabled="getDisabledState(item)"
              v-bind="filterExtraProps(item as any)"
              @click="() => (item.click as any)?.(instance)"
            >
              <template #icon v-if="item.icon">
                <component :is="renderIcon(item.icon as string)" />
              </template>
              {{ item.name }}
            </a-button>
          </div>
        </template>
      </div>

      <!-- 右侧按钮组 -->
      <div class="btn-right">
        <template v-for="(item, index) in processedBtnRight" :key="item.name">
          <div :style="buttonContainerStyle(index)">
            <render-dom v-if="typeof item.render === 'function'" :render="item.render" />
            <a-button
              v-else
              :type="mapBtnType(item.type as string)"
              :danger="mapBtnDanger(item.type as string)"
              :size="mapBtnSize(item.size as string)"
              :loading="item.loading || false"
              :disabled="getDisabledState(item)"
              v-bind="filterExtraProps(item as any)"
              @click="() => (item.click as any)?.(instance)"
            >
              <template #icon v-if="item.icon">
                <component :is="renderIcon(item.icon as string)" />
              </template>
              {{ item.name }}
            </a-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, inject, defineComponent } from 'vue'
// 本地导入 AButton↔<a-button>，对齐 es-table/component.vue 的别名策略，
// 使命令式弹窗内（appContext 为 null）表格操作列按钮仍能解析。
import { Button as AButton } from 'ant-design-vue'
import { getButtonPosition } from '@es-plus/core'
import { getAdvIconComponent } from '../../../utils/icon'
import { getGlobalConfig } from '../../../config'
import { mapButtonType, mapButtonDanger, mapSize } from '../../../utils/shared'
import type { ButtonType } from 'ant-design-vue/es/button/buttonTypes'
import type { SizeType } from 'ant-design-vue/es/config-provider/context'

const props = defineProps<{
  btnConfig?: Array<Record<string, unknown>>
  leftText?: string
  instance?: Record<string, unknown>
}>()

const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) ?? getGlobalConfig() ?? {}

const hasPermission = (pvalue?: string) => {
  if (!pvalue) return true
  const permFn = esPlus.permission
  if (typeof permFn === 'function') return (permFn as (v: string) => boolean)(pvalue)
  return true
}

const processButtonConfig = (config: Array<Record<string, unknown>>) => {
  return config.map((item) => {
    const processed = { ...item }
    const hasPerm = hasPermission(item.permissionValue as string)
    if (!hasPerm) {
      processed.isHide = true
    } else if (typeof item.isHide === 'function') {
      processed.isHide = item.isHide()
    } else {
      processed.isHide = item.isHide || false
    }
    return processed
  })
}

const processedBtnLeft = computed(() =>
  processButtonConfig((props.btnConfig || []).filter((item) => getButtonPosition(item as any) === 'left')).filter((item) => !item.isHide),
)
const processedBtnRight = computed(() =>
  processButtonConfig((props.btnConfig || []).filter((item) => getButtonPosition(item as any) === 'right')).filter((item) => !item.isHide),
)

const showContainer = computed(() => props.leftText || processedBtnLeft.value.length > 0 || processedBtnRight.value.length > 0)

function mapBtnType(type?: string): ButtonType {
  return mapButtonType(type) as ButtonType
}
function mapBtnDanger(type?: string): boolean {
  return mapButtonDanger(type)
}
function mapBtnSize(size?: string): SizeType {
  return mapSize(size, 'small') as SizeType
}

const getDisabledState = (item: Record<string, unknown>): boolean => {
  if (typeof item.disabled === 'function') return (item.disabled as () => boolean)()
  return (item.disabled as boolean) || false
}

function renderIcon(iconName?: string) {
  if (!iconName) return undefined
  return getAdvIconComponent(iconName)
}

const buttonContainerStyle = (index: number) => ({
  display: 'inline-block',
  marginLeft: index !== 0 ? '8px' : '0px',
})

/** 过滤掉已知的内部属性，其余透传给 a-button */
function filterExtraProps(item: Record<string, unknown>): Record<string, unknown> {
  const knownKeys = new Set([
    'name', 'key', 'type', 'size', 'icon', 'position', 'code', 'direction',
    'loading', 'disabled', 'permissionValue', 'click', 'render', 'isHide',
  ])
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (!knownKeys.has(k)) extra[k] = v
  }
  return extra
}

// 自定义渲染组件（对齐 vue3 RenderDom）
const RenderDom = defineComponent({
  name: 'RenderDom',
  props: { render: { type: Function, required: true } },
  setup(props) {
    return () => {
      if (!props.render || typeof props.render !== 'function') return null
      try {
        return props.render(h)
      } catch {
        return null
      }
    }
  },
})
</script>

<style scoped>
.btns {
  padding: 0;
  padding-bottom: 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-text {
  color: rgb(125, 125, 125);
  font-size: 14px;
}

.btn-container_block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
}

.btn-container_block .btn-left {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-wrap: wrap;
}

.btn-container_block .btn-right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .btns {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-container_block {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .btn-container_block .btn-left,
  .btn-container_block .btn-right {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
