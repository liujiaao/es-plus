<!--
  ADV 适配器：EsDialog 弹窗组件

  Ant Design Vue a-modal 替代 el-dialog。关键差异：
  - v-model:open 替代 v-model（ADV API）
  - closable 替代 showClose
  - maskClosable 替代 closeOnClickModal
  - keyboard 替代 closeOnPressEscape
  - 拖拽和全屏需自实现（ADV 无原生支持）
-->
<template>
  <a-modal
    :class="[modalClass, { 'es-dialog-fullscreen': isFullscreen }]"
    :style="dragStyle"
    v-bind="filteredAttrs"
    v-model:open="dialogVisible"
    :width="props.width"
    :closable="false"
    :maskClosable="props.closeOnClickModal !== false"
    :keyboard="props.closeOnPressEscape !== false"
    :destroyOnClose="props.destroyOnClose"
    :centered="props.alignCenter !== false"
    :mask="props.modal !== false"
    :wrapClassName="props.modalClass"
    @cancel="handleClose"
  >
    <!-- 自定义头部（含拖拽手柄 + 全屏/关闭按钮） -->
    <template #title>
      <div
        class="es-dialog-header"
        :class="{ 'es-dialog-draggable': props.isDraggable }"
        @mousedown="props.isDraggable ? onDragStart($event) : undefined"
      >
        <span class="es-dialog-title-text">
          <slot name="title">{{ props.title || '弹窗' }}</slot>
        </span>
        <span class="es-dialog-header-actions">
          <a-button
            v-if="!props.hiddenFullBtn"
            type="text"
            size="small"
            @click="toggleFullscreen"
          >
            <FullscreenOutlined v-if="!isFullscreen" />
            <FullscreenExitOutlined v-else />
          </a-button>
          <a-button
            v-if="props.showClose !== false"
            type="text"
            size="small"
            @click="handleClose"
          >
            <CloseOutlined />
          </a-button>
        </span>
      </div>
    </template>

    <!-- 主体内容 -->
    <div :style="bodyStyle">
      <RenderJsx
        v-if="props.render"
        :render="props.render"
        :instance="dialogInstance"
        :components="slotComponents"
      />
      <slot v-else />
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div v-if="!props.isHiddenFooter && footerBtns.length" class="es-dialog-footer">
        <a-space>
          <a-button
            v-for="(item, idx) in footerBtns"
            :key="item.key || idx"
            :type="mapBtnType(item.type)"
            :size="mapBtnSize(item.size)"
            :loading="item.loading"
            :disabled="isDisabled(item)"
            @click="handleFooterBtnClick(item)"
            v-bind="filterExtraProps(item)"
          >{{ item.name }}</a-button>
        </a-space>
      </div>
    </template>
  </a-modal>
</template>

<script lang="ts">
export default { name: 'EsDialog' }
</script>

<script setup lang="ts">
import { ref, reactive, computed, inject, watch, onBeforeUnmount } from 'vue'
import {
  Modal, Button, Space,
} from 'ant-design-vue'
import { CloseOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons-vue'
import { getGlobalConfig } from '../../../config'
import { mapButtonType, mapSize } from '../../../utils/shared'
import type { DialogOptions, BtnConfig } from '../../../types'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import RenderJsx from './render-jsx.vue'

// ─── Props ───────────────────────────────────────────
const props = withDefaults(
  defineProps<DialogOptions>(),
  {
    title: '弹窗',
    width: '600px',
    showClose: true,
    fullscreen: false,
    destroyOnClose: false,
    modal: true,
    closeOnClickModal: true,
    closeOnPressEscape: true,
    alignCenter: true,
    isDraggable: false,
    hiddenFullBtn: false,
    isHiddenFooter: false,
    configBtn: () => [],
  }
)

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  close: []
  closed: []
}>()

// ─── 注入 ───────────────────────────────────────────
const esPlus = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}

// ─── 对话框可见性 ───────────────────────────────────
const dialogVisible = ref(props.visible !== false)
watch(() => props.visible, (val) => {
  if (val !== undefined) dialogVisible.value = val
})

// ─── 全屏（ADV 无原生，CSS 实现） ────────────────────
const isFullscreen = ref(props.fullscreen || false)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

// ─── 拖拽（ADV 无原生，手动实现）── 全屏时禁用拖拽 ──
const isDragging = ref(false)
const dragOffset = reactive({ x: 0, y: 0 })

let dragStartX = 0
let dragStartY = 0

const dragStyle = computed(() => {
  // 全屏模式下禁用拖拽
  if (isFullscreen.value) return undefined
  if (!props.isDraggable || (!isDragging.value && dragOffset.x === 0 && dragOffset.y === 0)) {
    return undefined
  }
  return { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
})

function onDragStart(e: MouseEvent) {
  // 全屏模式下不允许拖拽
  if (isFullscreen.value) return
  isDragging.value = true
  dragStartX = e.clientX - dragOffset.x
  dragStartY = e.clientY - dragOffset.y

  const onMove = (ev: MouseEvent) => {
    if (!isDragging.value) return
    dragOffset.x = ev.clientX - dragStartX
    dragOffset.y = ev.clientY - dragStartY
  }

  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// 全屏切换时重置拖拽偏移
watch(isFullscreen, (val) => {
  if (val) {
    dragOffset.x = 0
    dragOffset.y = 0
    isDragging.value = false
  }
})

onBeforeUnmount(() => {
  isDragging.value = false
})

// ─── 关闭 ───────────────────────────────────────────
function handleClose() {
  if (props.beforeClose) {
    props.beforeClose(() => doClose())
  } else {
    doClose()
  }
}

function doClose() {
  dialogVisible.value = false
  emit('update:visible', false)
  emit('close')
  // Reset state
  isFullscreen.value = false
  dragOffset.x = 0
  dragOffset.y = 0
}

// ─── 底部按钮 ───────────────────────────────────────
const footerBtns = computed(() =>
  (props.configBtn || []).filter((btn) => {
    if (!btn.permissionValue) return true
    const fn = esPlus.permission
    return typeof fn === 'function' ? (fn as Function)(btn.permissionValue) : true
  })
)

function mapBtnType(type?: string): string { return mapButtonType(type) }
function mapBtnSize(size?: string): string { return mapSize(size, 'small') }

function isDisabled(item: BtnConfig): boolean {
  if (typeof item.disabled === 'function') return item.disabled()
  return !!item.disabled
}

function filterExtraProps(item: BtnConfig): Record<string, unknown> {
  const knownKeys = new Set([
    'name', 'key', 'type', 'size', 'icon', 'position', 'code', 'direction',
    'loading', 'disabled', 'permissionValue', 'click', 'confirm',
  ])
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (!knownKeys.has(k)) extra[k] = v
  }
  return extra
}

function handleFooterBtnClick(item: BtnConfig) {
  item.click?.({} as Record<string, unknown>, dialogInstance.value)
}

// ─── 透传 attrs ─────────────────────────────────────
const filteredAttrs = computed(() => {
  const ignored = new Set([
    'title', 'width', 'render', 'renderHeader', 'renderFooter',
    'configBtn', 'onSubmit', 'onClosed', 'isDraggable', 'hiddenFullBtn',
    'isHiddenFooter', 'maxHeight', 'appendTo', 'fullscreen', 'showClose',
    'destroyOnClose', 'modal', 'closeOnClickModal', 'closeOnPressEscape',
    'beforeClose', 'alignCenter', 'top', 'modalClass', 'visible',
  ])
  const attrs: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (!ignored.has(k) && v !== undefined) attrs[k] = v
  }
  return attrs
})

// ─── 主体样式 ───────────────────────────────────────
const bodyStyle = computed(() => ({
  maxHeight: props.maxHeight || 'auto',
  overflowY: (props.maxHeight ? 'auto' : 'visible') as string,
}))

// ─── 弹窗实例（暴露给 render 函数） ──────────────────
const dialogInstance = computed(() => ({
  close: handleClose,
  fullscreen: toggleFullscreen,
  isFullscreen,
  dialogVisible,
}))

const slotComponents = { EsForm, EsTable }

defineExpose({ close: handleClose, toggleFullscreen })
</script>

<style lang="scss" scoped>
.es-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  user-select: none;
}

.es-dialog-draggable {
  cursor: move;
}

.es-dialog-title-text {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.es-dialog-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.es-dialog-footer {
  display: flex;
  justify-content: flex-end;
}

/* 全屏：覆盖 modal 的默认定位 */
.es-dialog-fullscreen {
  :deep(.ant-modal) {
    top: 0;
    padding-bottom: 0;
    max-width: 100vw;
  }
  :deep(.ant-modal-content) {
    height: 100vh;
    border-radius: 0;
    display: flex;
    flex-direction: column;
  }
  :deep(.ant-modal-body) {
    flex: 1;
    overflow: auto;
  }
}
</style>
