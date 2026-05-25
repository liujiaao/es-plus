<template>
  <div class="dp-dialog_wrapper">
    <el-dialog
      :class="['dg-dialog', initDialogCls]"
      v-bind="filteredAttrs"
      v-model="dialogVisible"
      :draggable="props.isDraggable"
      :width="props.width"
      :show-close="false"
      @close="beforeClose"
      :fullscreen="filteredAttrs?.fullscreen ?? isFullscreen"
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

      <div class="dialog_body_layouts" :style="initDialogHeight">
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

      <template #footer v-if="!attrs.isHiddenFooter">
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
import { computed, ref, reactive, getCurrentInstance, provide, inject, useAttrs } from 'vue'
import { ElConfigProvider, ElDialog, ElButton, ElIcon } from 'element-plus'
import { FullScreen, Close, CopyDocument } from '@element-plus/icons-vue'
import RenderJsx from './render-jsx.vue'
import EsTable from '../../es-table'
import EsForm from '../../es-form'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
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
}>()

const emit = defineEmits<{
  'update:visible': [val: boolean]
  closed: [val: boolean]
  submit: [payload: any]
}>()

const slots = defineSlots()

const instance = getCurrentInstance()
const attrs = useAttrs()

const extended = Object.fromEntries(Object.entries(ElementPlusIconsVue).map(([key]) => [key, ElementPlusIconsVue[key]]))

const lyFormInstance = ref(null)
const renderBodyRefsObject = reactive<Record<string, any>>({})
const isFullscreen = ref(false)
const dialogInstance = instance
const locale = ref(zhCn)

const esPlus = inject<Record<string, unknown>>('$EsPlus', {})

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

const filterOptions = (it: BtnConfig) => {
  const { icon, ...opt } = it as Record<string, unknown>
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

const handleClose = () => {
  emit('closed', false)
  closeFullscreen()
}

const handleConfirm = () => {
  emit('submit', { renderBodyRefs: renderBodyRefsObject.currentRef, lyFormInstance, dialogInstance })
}

const beforeClose = () => {
  emit('closed', false)
  closeFullscreen()
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
    emit('update:visible', val)
    if (!val) {
      emit('closed', val)
      closeFullscreen()
    }
  }
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
    closed: handleClose
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
