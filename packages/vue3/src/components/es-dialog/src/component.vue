<template>
  <div class="dp-dialog_wrapper">
    <el-dialog
      :class="['dg-dialog', initDialogCls]"
      v-bind="filteredAttrs"
      v-model="dialogVisible"
      :draggable="props.isDraggable"
      :width="props.width"
      :show-close="false"
      :before-close="onBeforeClose"
      :fullscreen="(filteredAttrs?.fullscreen as boolean) ?? isFullscreen"
    >
      <template #header>
        <template v-if="props.renderHeader">
          <RenderJsx :render="props.renderHeader" :instance="getCurrentInstanceModel" />
        </template>
        <template v-else>
          <div>
            <span class="dialog-title">{{ props.title }}</span>
          </div>
          <div class="btns">
            <el-icon @click="handleFullscreen" v-show="!props.hiddenFullBtn">
              <FullScreen v-if="!isFullscreen" />
              <CopyDocument v-else />
            </el-icon>
            <el-icon @click="handleClose"><Close /></el-icon>
          </div>
        </template>
      </template>

      <div v-loading="props.loading" class="dialog_body_layouts" :style="initDialogHeight">
        <template v-if="props.render && typeof props.render === 'function'">
          <RenderJsx
            :refs="renderBodyRefsObject"
            :instance="getCurrentInstanceModel"
            :render="props.render"
            :components="{ EsTable, EsForm }"
            :locale="locale"
          />
        </template>
      </div>

      <template #footer v-if="!props.isHiddenFooter">
        <span v-if="!slots.footer" class="dialog-footer">
          <template v-if="props.renderFooter && typeof props.renderFooter === 'function'">
            <RenderJsx :render="props.renderFooter" :instance="getCurrentInstanceModel" />
          </template>
          <template v-else-if="props.configBtn && props.configBtn.length">
            <template v-for="(it, inx) in configBtn" :key="it.key || inx">
              <el-button
                v-if="checkPermission(it.permissionValue)"
                size="small"
                v-bind="filterOptions(it)"
                :icon="getCompIcon(it.icon)"
                :disabled="typeof it.disabled === 'function' ? it.disabled() : it.disabled || false"
                @click="() => {
                  it.click?.(renderBodyRefsObject.currentRef, {
                    close: handleClose,
                    getRefs: (name?: string) => {
                      if (name) return renderBodyRefsObject[name] || null
                      return renderBodyRefsObject
                    },
                    dialogInstance
                  })
                }"
              >
                {{ it.name }}
              </el-button>
            </template>
          </template>
        </span>
        <slot v-else name="footer" />
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts">
export default { name: 'EsDialog' }
</script>

<script setup lang="ts">
import { computed, ref, reactive, getCurrentInstance, provide, inject, useAttrs, onMounted, watch } from 'vue'
import { ElConfigProvider, ElDialog, ElButton, ElIcon, vLoading } from 'element-plus'
import { FullScreen, Close, CopyDocument } from '@element-plus/icons-vue'
import RenderJsx from './render-jsx.vue'
import EsTable from '../../es-table'
import EsForm from '../../es-form'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { getGlobalConfig } from '../../../config'
import type { BtnConfig } from '../../../types'

const props = defineProps<{
  title?: string
  visible?: boolean
  appendTo?: object | string
  hiddenFullBtn?: boolean
  width?: string | number
  isDraggable?: boolean
  confirmText?: string
  cancelText?: string
  configBtn?: BtnConfig[]
  maxHeight?: string | number
  isHiddenFooter?: boolean
  renderHeader?: Function
  renderFooter?: Function
  render?: Function
  fullscreen?: boolean
  loading?: boolean
  /** 关闭前拦截：传入后由用户调用 done() 才真正关闭（X/遮罩/ESC 统一经此闸门） */
  beforeClose?: (done: () => void) => void
}>()

const emit = defineEmits<{
  'update:visible': [val: boolean]
  closed: [val: boolean]
  submit: [payload: any]
  open: []
}>()

const slots = defineSlots()

const instance = getCurrentInstance()
const attrs = useAttrs()

const extended = Object.fromEntries(Object.entries(ElementPlusIconsVue).map(([key]) => [key, (ElementPlusIconsVue as Record<string, unknown>)[key]]))

const lyFormInstance = ref(null)
const renderBodyRefsObject = reactive<Record<string, any>>({})
const isFullscreen = ref(false)
const dialogInstance = instance
const locale = ref(zhCn)

const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) as Record<string, unknown> ?? getGlobalConfig() ?? {}

const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

const injectedLocale = inject('elLocale', null)
if (injectedLocale) {
  locale.value = injectedLocale as any
}

provide('elLocale', locale.value)

const getCompIcon = (key?: string) => {
  return key ? extended[key] || key : undefined
}

// 只把「真正属于 el-button 的 props」透传，其余配置键必须剔除。
// 尤其是 click：若随 v-bind 落到原生 <button> 上，Vue 会把它当作 DOM property
// 赋值（'click' in el 为 true），从而覆盖原生 HTMLElement.prototype.click，
// 导致 el.click() 调到「无 context 的原始配置回调」而非派发真实点击事件。
// name 作为按钮文本单独渲染；icon/disabled/permissionValue 已在模板显式处理。
const filterOptions = (it: BtnConfig) => {
  const {
    icon: _icon,
    click: _click,
    name: _name,
    key: _key,
    permissionValue: _pv,
    disabled: _disabled,
    position: _position,
    code: _code,
    direction: _direction,
    action: _action,
    ...opt
  } = it as Record<string, unknown>
  return opt
}

const closeFullscreen = () => {
  setTimeout(() => {
    if (isFullscreen.value) {
      isFullscreen.value = false
    }
  }, 500)
}

const handleFullscreen = () => {
  if (attrs?.fullscreen) return
  isFullscreen.value = !isFullscreen.value
}

// X 按钮点击：走统一关闭闸门（beforeClose 拦截）
const handleClose = () => {
  runBeforeClose(doClose)
}

const handleConfirm = () => {
  emit('submit', { renderBodyRefs: renderBodyRefsObject.currentRef, lyFormInstance, dialogInstance })
}

// el-dialog 内建关闭触发（遮罩点击 / ESC）：同样经闸门，不调用 el 的 done，
// 由 doClose 翻转 v-model（visible）来收起弹窗，保证 beforeClose 可否决
const onBeforeClose = (_done: () => void) => {
  runBeforeClose(doClose)
}

const filteredAttrs = computed(() => {
  const { ...rest } = attrs
  return rest
})

const initDialogCls = computed(() => {
  if (!isFullscreen.value) {
    if (props.maxHeight) return 'dialogShadow'
    return 'dialogAuto'
  }
  return 'dialogFull'
})

const getMaxContentHeight = () => {
  const viewH = window.innerHeight
  return Math.max(viewH - 135, 200)
}

const initDialogHeight = computed(() => {
  const viewH = getMaxContentHeight()
  if (!isFullscreen.value) {
    if (props.maxHeight) {
      return { maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight }
    }
    return { maxHeight: viewH + 'px' }
  }
  return { height: viewH + 'px' }
})

const dialogVisible = computed({
  get: () => props.visible || false,
  set: (val) => {
    // wasVisible 守卫：仅在 true→false 真实转换时 emit closed，避免 v-model 二次回写重复派发
    const wasVisible = props.visible
    emit('update:visible', val)
    if (!val && wasVisible) {
      emit('closed', val)
      closeFullscreen()
    }
  }
})

// 实际关闭动作：翻转 visible（setter 统一派发 update:visible + closed）
const doClose = () => {
  dialogVisible.value = false
}

// 关闭闸门：存在 beforeClose 则交给用户决定何时 done()，否则直接关闭
const runBeforeClose = (proceed: () => void) => {
  if (typeof props.beforeClose === 'function') {
    props.beforeClose(proceed)
  } else {
    proceed()
  }
}

// 声明式切换 visible false→true 时补发 open
watch(
  () => props.visible,
  (val) => {
    if (val) emit('open')
  }
)

// 程序化调用（useDialog）挂载时 visible 已为 true，watch 不会触发，
// 需在此补发 open，保证 onOpen 生命周期回调可用。
onMounted(() => {
  if (props.visible) emit('open')
})

const getCurrentInstanceModel = computed(() => ({
  renderBodyRefs: renderBodyRefsObject.currentRef,
  renderBodyRefsObject,
  lyFormInstance,
  dialogInstance,
  getRefs: () => renderBodyRefsObject
}))

provide('bodyFormInstance', (e: any) => {
  lyFormInstance.value = e
})

if (instance) {
  instance.exposed = {
    // 三端统一命名：close（标准）/ closed（别名，历史兼容）走闸门；
    // toggleFullscreen 切全屏；doClose 绕过 beforeClose 强制关闭。
    close: handleClose,
    closed: handleClose,
    toggleFullscreen: handleFullscreen,
    doClose,
  }
}
</script>

<style lang="scss" scoped>
.dp-dialog_wrapper {
  :deep(.dialogAuto) {
    margin: 0px !important;
  }
  :deep(.el-overlay-dialog) {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  :deep(.el-dialog) {
    padding: 10px;

    .el-dialog__footer {
      padding-top: 0px;
    }

    .el-dialog__body {
      padding: 10px 0px;
    }

    .el-dialog__header {
      border-bottom: 1px solid #eee;
      display: flex;
      padding: 0px 0px 10px 0px;
      align-items: center;
      justify-content: space-between;
      margin: 0;
    }
  }
}

.dialog-title {
  line-height: 24px;
  font-size: 14px;
  color: #303133;
  font-weight: bold;
}

.btns {
  display: flex;
  align-items: center;

  i {
    margin-right: 8px;
    font-size: 14px;
    cursor: pointer;

    &:last-child {
      margin-right: 0;
    }
  }
}

.dialog_body_layouts {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #87a2bd26 #c8d5e147;
}

/* 滚动条样式 */
*::-webkit-scrollbar {
  width: 14px;
  height: 14px;
}

*::-webkit-scrollbar-button {
  width: 0;
  height: 0;
  display: none;
}

*::-webkit-scrollbar-corner {
  background-color: transparent;
}

*::-webkit-scrollbar-thumb {
  min-height: 12px;
  border: 4px solid transparent;
  background-clip: content-box;
  border-radius: 7px;
  background-color: #c8d5e1;

  &:hover {
    background-color: #a8bbcf;
  }

  &:active {
    background-color: #87a2bd;
  }
}

*::-webkit-scrollbar-track {
  background-color: transparent;
}

*::-webkit-scrollbar-track-piece {
  background-color: transparent;
}
</style>
