<!--
  ADV 适配器：EsDialog 弹窗组件（对齐 @es-plus/vue3 component.vue）

  Ant Design Vue a-modal 替代 el-dialog。对齐 vue3 关键行为：
  - 关闭链：onClosed/onSubmit 不声明为 prop（作为事件监听器流入），doClose emit('closed', false)
  - RenderJsx 传入 renderBodyRefsObject，footer 按钮 click 第一参 = renderBodyRefsObject.currentRef，
    第二参 = { close, getRefs, dialogInstance }
  - instance 结构对齐 vue3：{ renderBodyRefs, renderBodyRefsObject, lyFormInstance, dialogInstance, getRefs }
  - bodyFormInstance provide（供 dialog 内 EsForm 上报实例）
  - body 默认 maxHeight 对齐 vue3 视口计算；top 映射 wrapStyle（关闭 centered）
  - renderHeader / renderFooter / footer 具名插槽
  - 拖拽 transform + 边界 clamp；全屏切换重置偏移
-->
<template>
  <a-modal
    :wrapClassName="modalWrapClass"
    :wrapStyle="wrapStyle"
    v-bind="filteredAttrs"
    :open="dialogVisible"
    :width="isFullscreen ? '100vw' : props.width"
    :closable="false"
    :maskClosable="props.closeOnClickModal !== false"
    :keyboard="props.closeOnPressEscape !== false"
    :destroyOnClose="props.destroyOnClose"
    :centered="props.alignCenter !== false && !props.top"
    :mask="props.modal !== false"
    :footer="props.isHiddenFooter ? null : undefined"
    @cancel="handleClose"
    @update:open="onUpdateOpen"
  >
    <!-- 头部 -->
    <template #title>
      <RenderJsx
        v-if="props.renderHeader"
        :render="props.renderHeader"
        :instance="getCurrentInstanceModel"
        :refs="renderBodyRefsObject"
        :track-ref="false"
      />
      <div
        v-else
        class="es-dialog-header"
        :class="{ 'es-dialog-draggable': props.isDraggable }"
        @mousedown="props.isDraggable ? onDragStart($event) : undefined"
      >
        <span class="es-dialog-title-text">
          <slot name="title">{{ dialogTitle }}</slot>
        </span>
        <span class="es-dialog-header-actions">
          <a-button
            v-if="!props.hiddenFullBtn"
            type="text"
            size="small"
            @click="toggleFullscreen"
          >
            <FullscreenExitOutlined v-if="isFullscreen" />
            <FullscreenOutlined v-else />
          </a-button>
          <a-button type="text" size="small" @click="handleClose">
            <CloseOutlined />
          </a-button>
        </span>
      </div>
    </template>

    <!-- 主体内容 -->
    <div class="dialog_body_layouts" :style="initDialogHeight">
      <RenderJsx
        v-if="props.render"
        :render="props.render"
        :instance="getCurrentInstanceModel"
        :components="slotComponents"
        :refs="renderBodyRefsObject"
        :locale="antLocale"
      />
      <slot v-else />
    </div>

    <!-- 底部按钮 -->
    <template #footer v-if="!props.isHiddenFooter">
      <div class="es-dialog-footer">
        <RenderJsx
          v-if="props.renderFooter"
          :render="props.renderFooter"
          :instance="getCurrentInstanceModel"
          :refs="renderBodyRefsObject"
          :track-ref="false"
        />
        <a-space v-else-if="footerBtns.length">
          <a-button
            v-for="(item, idx) in footerBtns"
            v-show="checkPermission(item.permissionValue)"
            :key="item.key || idx"
            :type="mapBtnType(item.type)"
            :danger="mapBtnDanger(item.type)"
            :size="mapBtnSize(item.size)"
            :loading="item.loading"
            :disabled="isDisabled(item)"
            v-bind="filterOptions(item)"
            @click="handleFooterBtnClick(item)"
          >
            <template #icon v-if="item.icon">
              <component :is="getAdvIconComponent(item.icon)" />
            </template>
            {{ item.name }}
          </a-button>
        </a-space>
        <slot v-else name="footer" />
      </div>
    </template>
  </a-modal>
</template>

<script lang="ts">
export default { name: 'EsDialog' }
</script>

<script setup lang="ts">
import { ref, reactive, computed, inject, watch, onBeforeUnmount, provide, getCurrentInstance, type VNode } from 'vue'
import { CloseOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons-vue'
import { getGlobalConfig } from '../../../config'
import { mapButtonType, mapButtonDanger, mapSize } from '../../../utils/shared'
import type { ButtonType } from 'ant-design-vue/es/button/buttonTypes'
import type { SizeType } from 'ant-design-vue/es/config-provider/context'
import { getAdvIconComponent } from '../../../utils/icon'
import type { BtnConfig } from '../../../types'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import RenderJsx from './render-jsx.vue'
// 本地导入并按模板标签命名（AModal↔<a-modal> 等），使模板解析为直接组件引用而非全局 resolveComponent。
// 对齐 @es-plus/vue3（其 EsDialog 直接 import ElDialog/ElButton/ElIcon），确保在 useDialog 命令式
// 渲染的脱离子树（appContext 为 null，全局注册不可见）中仍能解析弹窗骨架组件。
import { Modal as AModal, Button as AButton, Space as ASpace } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

// ─── Props（onClosed/onSubmit 不声明为 prop，让其作为事件监听器流入）──
const props = withDefaults(
  defineProps<{
    title?: string
    width?: string | number
    visible?: boolean
    render?: (h: any, instance: any, components: Record<string, unknown>) => VNode
    renderHeader?: (h: any, instance: any) => VNode
    renderFooter?: (h: any, instance: any) => VNode
    configBtn?: BtnConfig[]
    isDraggable?: boolean
    hiddenFullBtn?: boolean
    isHiddenFooter?: boolean
    maxHeight?: string | number
    appendTo?: string | HTMLElement
    fullscreen?: boolean
    showClose?: boolean
    destroyOnClose?: boolean
    modal?: boolean
    closeOnClickModal?: boolean
    closeOnPressEscape?: boolean
    beforeClose?: (done: () => void) => void
    alignCenter?: boolean
    top?: string
    modalClass?: string
  }>(),
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
  },
)

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  closed: [val: boolean]
}>()

const instance = getCurrentInstance()
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) ?? getGlobalConfig() ?? {}

// ─── 国际化（对齐 vue3 locale 注入）─────────────────
const antLocale = ref(zhCN)
const injectedLocale = inject('antLocale', null) || inject('elLocale', null)
if (injectedLocale) antLocale.value = injectedLocale as any

// ─── 权限 ───────────────────────────────────────────
const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

// ─── body 内 EsForm 实例 + refs 存储（对齐 vue3）──────
const lyFormInstance = ref<unknown>(null)
const renderBodyRefsObject = reactive<Record<string, any>>({})
const dialogInstance = instance

provide('bodyFormInstance', (e: unknown) => {
  lyFormInstance.value = e
})

// ─── 可见性（由 doClose 唯一控制，对齐 vue3 dialogVisible）──
const dialogVisible = ref(props.visible !== false)
watch(() => props.visible, (val) => {
  if (val !== undefined) dialogVisible.value = val
})

function onUpdateOpen(val: boolean) {
  // a-modal mask/ESC 触发 update:open(false) 时走 handleClose 网关，
  // 由 doClose 决定是否真正关闭（支持 beforeClose 拦截）
  if (val === false) handleClose()
  else dialogVisible.value = val
}

// ─── 全屏 ───────────────────────────────────────────
const isFullscreen = ref(props.fullscreen || false)

const modalWrapClass = computed(() => {
  const classes: string[] = []
  if (props.modalClass) classes.push(props.modalClass)
  if (isFullscreen.value) classes.push('es-dialog-fullscreen')
  return classes.join(' ') || undefined
})

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function closeFullscreen() {
  setTimeout(() => {
    if (isFullscreen.value) isFullscreen.value = false
  }, 500)
}

// ─── 拖拽（transform + 边界 clamp；全屏时禁用）──────
const isDragging = ref(false)
const dragOffset = reactive({ x: 0, y: 0 })
let dragStartX = 0
let dragStartY = 0

const dragStyle = computed(() => {
  if (isFullscreen.value) return undefined
  if (!props.isDraggable || (!isDragging.value && dragOffset.x === 0 && dragOffset.y === 0)) {
    return undefined
  }
  return { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
})

function onDragStart(e: MouseEvent) {
  if (isFullscreen.value) return
  isDragging.value = true
  dragStartX = e.clientX - dragOffset.x
  dragStartY = e.clientY - dragOffset.y

  const onMove = (ev: MouseEvent) => {
    if (!isDragging.value) return
    let nx = ev.clientX - dragStartX
    let ny = ev.clientY - dragStartY
    // 边界 clamp：防止拖出视口
    const maxX = Math.max(window.innerWidth / 2 - 100, 100)
    const maxY = Math.max(window.innerHeight / 2 - 100, 100)
    nx = Math.max(-maxX, Math.min(maxX, nx))
    ny = Math.max(-maxY, Math.min(maxY, ny))
    dragOffset.x = nx
    dragOffset.y = ny
  }

  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

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

// ─── 关闭链（对齐 vue3：emit('closed', false)）────────
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
  emit('closed', false)
  closeFullscreen()
  // 重置拖拽偏移
  dragOffset.x = 0
  dragOffset.y = 0
}

// ─── 标题 ───────────────────────────────────────────
const dialogTitle = computed(() => props.title || '弹窗')

// ─── body 高度（对齐 vue3 initDialogHeight 视口计算）──
const getMaxContentHeight = () => {
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800
  return Math.max(viewH - 135, 200)
}

const initDialogHeight = computed((): Record<string, string> => {
  const viewH = getMaxContentHeight()
  if (!isFullscreen.value) {
    if (props.maxHeight) {
      return { maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight, overflowY: 'auto' }
    }
    return { maxHeight: `${viewH}px`, overflowY: 'auto' }
  }
  return { height: `${viewH}px`, overflowY: 'auto' }
})

// ─── top 映射 wrapStyle（关闭 centered）──────────────
const wrapStyle = computed(() => {
  const style: Record<string, unknown> = { ...dragStyle.value }
  if (props.top) style.top = props.top
  return style
})

// ─── instance 结构（对齐 vue3 getCurrentInstanceModel）──
// 关键：不能用 computed 依赖 renderBodyRefsObject.currentRef —— 该值由 RenderJsx
// 子组件（render/renderHeader/renderFooter 各一个实例）在 mount/updated 时写入，
// 若 computed 依赖它并作为 :instance prop 回流给这些子组件，会形成
// 写 currentRef → computed 失效 → 子组件重渲染 → 再写 → "Maximum recursive updates" 死循环
// （多个 RenderJsx 写入同一 currentRef 槽位时尤其无法收敛）。
// 用稳定对象 + getter 惰性读取，切断响应式回环。
const getCurrentInstanceModel = {
  get renderBodyRefs() {
    return renderBodyRefsObject.currentRef
  },
  renderBodyRefsObject,
  lyFormInstance,
  dialogInstance,
  getRefs: (name?: string) => (name ? renderBodyRefsObject[name] || null : renderBodyRefsObject),
}

const slotComponents = { EsForm, EsTable }

// ─── 底部按钮 ───────────────────────────────────────
const footerBtns = computed(() => props.configBtn || [])

function mapBtnType(type?: string): ButtonType {
  return mapButtonType(type) as ButtonType
}
function mapBtnDanger(type?: string): boolean {
  return mapButtonDanger(type)
}
function mapBtnSize(size?: string): SizeType {
  return mapSize(size, 'small') as SizeType
}

function isDisabled(item: BtnConfig): boolean {
  if (typeof item.disabled === 'function') return item.disabled()
  return !!item.disabled
}

// 透传给 a-button 的额外属性：必须排除所有已显式绑定/自有语义的键，
// 否则会与显式绑定冲突（如 disabled 支持函数形式，原样透传会让 a-button 收到
// Function 触发 "Expected Boolean, got Function" 告警，并覆盖 :disabled 的求值结果）。
const BTN_OWN_KEYS = new Set([
  'icon', 'type', 'size', 'name', 'click', 'loading', 'disabled',
  'permissionValue', 'key', 'direction',
])
function filterOptions(it: BtnConfig): Record<string, unknown> {
  const opt: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(it as Record<string, unknown>)) {
    if (!BTN_OWN_KEYS.has(k)) opt[k] = v
  }
  return opt
}

// footer 按钮 click 签名对齐 vue3：
// 第一参 = renderBodyRefsObject.currentRef（body 组件实例）
// 第二参 = { close, getRefs, dialogInstance }
function handleFooterBtnClick(item: BtnConfig) {
  item.click?.(renderBodyRefsObject.currentRef, {
    close: handleClose,
    getRefs: (name?: string) => (name ? renderBodyRefsObject[name] || null : renderBodyRefsObject),
    dialogInstance,
  })
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

defineExpose({ close: handleClose, toggleFullscreen, doClose })
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

.dialog_body_layouts {
  overflow-y: auto;
  overflow-x: hidden;
}

/* 全屏：覆盖 modal 的默认定位 */
/* a-modal teleport 到 body，scoped :deep() 无法穿透，需用全局样式 */
</style>

<style lang="scss">
.es-dialog-fullscreen {
  .ant-modal {
    top: 0 !important;
    padding-bottom: 0;
    max-width: 100vw;
    margin: 0;
  }
  .ant-modal-content {
    height: 100vh;
    border-radius: 0;
    display: flex;
    flex-direction: column;
  }
  .ant-modal-body {
    flex: 1;
    overflow: auto;
  }
}
</style>
