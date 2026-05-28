<template>
  <div class="dp-dialog_wrapper">
    <!--
      Element UI dialog 与 Element Plus 关键差异：
        - 双向绑定：:visible.sync (Vue 3 是 v-model)
        - 不支持 draggable 属性（Element UI 2.x 无此特性，已去掉传透）
        - 全屏：fullscreen 同名属性
        - header/footer 槽位写法相同，但不能用 #header (Vue 2.6+ 支持新语法，2.5 及以下需 slot="header")
        - 图标改用 i.el-icon-* class 字符串
    -->
    <el-dialog
      :class="['dg-dialog', initDialogCls]"
      v-bind="filteredAttrs"
      :visible.sync="dialogVisible"
      :width="typeof width === 'number' ? width + 'px' : width"
      :show-close="false"
      :fullscreen="filteredAttrs && filteredAttrs.fullscreen != null ? filteredAttrs.fullscreen : isFullscreen"
      :append-to-body="appendToBody"
      :modal-append-to-body="modalAppendToBody"
      :close-on-click-modal="closeOnClickModal"
      :close-on-press-escape="closeOnPressEscape"
      :destroy-on-close="destroyOnClose"
      :before-close="beforeCloseHandler"
      @close="onDialogClose"
      @closed="onDialogClosed"
    >
      <template #title>
        <render-jsx
          v-if="renderHeader && typeof renderHeader === 'function'"
          :render="renderHeader"
          :instance="getCurrentInstanceModel"
        />
        <template v-else>
          <div class="dialog-header">
            <span class="dialog-title">{{ title }}</span>
            <div class="btns">
              <i
                v-show="!hiddenFullBtn"
                :class="isFullscreen ? 'el-icon-copy-document' : 'el-icon-full-screen'"
                @click="handleFullscreen"
              />
              <i class="el-icon-close" @click="handleClose" />
            </div>
          </div>
        </template>
      </template>

      <div class="dialog_body_layouts" :style="initDialogHeight">
        <render-jsx
          v-if="render && typeof render === 'function'"
          :refs="renderBodyRefsObject"
          :instance="getCurrentInstanceModel"
          :render="render"
          :components="dialogComponents"
        />
      </div>

      <template v-if="!isHiddenFooter" #footer>
        <span v-if="!$slots.footer" class="dialog-footer">
          <render-jsx
            v-if="renderFooter && typeof renderFooter === 'function'"
            :render="renderFooter"
            :instance="getCurrentInstanceModel"
          />
          <template v-else-if="configBtn && configBtn.length">
            <template v-for="(it, inx) in configBtn">
              <el-button
                v-if="checkPermission(it.permissionValue)"
                :key="it.key || inx"
                size="small"
                v-bind="filterOptions(it)"
                :icon="getCompIcon(it.icon)"
                :disabled="getDisabled(it)"
                @click="() => handleBtnClick(it)"
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
/**
 * EsDialog 弹窗组件 —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异（详细列举）：
 *   1. <script setup> → defineComponent + setup()
 *   2. dialog 双向绑定：:visible.sync 替代 v-model
 *   3. 图标系统：el-icon-* class 字符串替代 Element Plus 图标组件
 *   4. ElConfigProvider 不存在 —— 国际化由 Vue.use(ElementUI, { locale }) 全局完成
 *   5. draggable 属性在 Element UI 2.x 中不存在，本组件不再支持 isDraggable
 *      （prop 仍保留兼容，仅传递给底层用户使用，但 el-dialog 会忽略）
 *   6. exposed 方法：通过 expose() 或挂到 vm 上（Vue 2 中通过 setup 返回值即可）
 *
 * 业务能力（render slot/configBtn/全屏/maxHeight/事件）100% 与 Vue 3 版本一致。
 */
import {
  defineComponent,
  ref,
  reactive,
  computed,
  inject,
  provide,
  getCurrentInstance,
} from '../../vue-compat'
import { getGlobalConfig, type BtnConfig } from '@es-plus/core'
import RenderJsx from './render-jsx.vue'
import { getCompIcon } from '../../utils/icon'

export default defineComponent({
  name: 'EsDialog',
  components: { RenderJsx },
  inheritAttrs: false,
  props: {
    title: { type: String, default: '' },
    visible: { type: Boolean, default: false },
    appendTo: { type: [Object, String], default: undefined },
    appendToBody: { type: Boolean, default: false },
    modalAppendToBody: { type: Boolean, default: true },
    closeOnClickModal: { type: Boolean, default: true },
    closeOnPressEscape: { type: Boolean, default: true },
    destroyOnClose: { type: Boolean, default: false },
    hiddenFullBtn: { type: Boolean, default: false },
    width: { type: [String, Number], default: '50%' },
    // Element UI 不支持 draggable，保留 prop 兼容用户配置但实际不生效
    isDraggable: { type: Boolean, default: false },
    confirmText: { type: String, default: '' },
    cancelText: { type: String, default: '' },
    configBtn: { type: Array as () => BtnConfig[], default: () => [] },
    maxHeight: { type: [String, Number], default: undefined },
    isHiddenFooter: { type: Boolean, default: false },
    renderHeader: { type: Function, default: undefined },
    renderFooter: { type: Function, default: undefined },
    render: { type: Function, default: undefined },
    fullscreen: { type: Boolean, default: false },
    // 用户透传给 RenderJsx 的额外组件映射（如 EsTable / EsForm 引用）
    components: { type: Object, default: () => ({}) },
  },
  emits: ['update:visible', 'closed', 'submit'],
  setup(props, { emit, attrs, slots, expose }) {
    const instance = getCurrentInstance() as unknown as Record<string, unknown>
    const lyFormInstance = ref<unknown>(null)
    const renderBodyRefsObject = reactive<Record<string, unknown>>({})
    const isFullscreen = ref(false)
    const dialogInstance = instance

    const esPlus =
      inject<Record<string, unknown>>('$EsPlus', null as unknown as Record<string, unknown>) ??
      (getGlobalConfig() as Record<string, unknown>) ??
      {}

    const checkPermission = (pvalue?: string): boolean => {
      if (!pvalue) return true
      const fn = esPlus.permission
      return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
    }

    const filterOptions = (it: BtnConfig) => {
      const {
        icon: _icon,
        click: _c,
        permissionValue: _p,
        name: _n,
        disabled: _d,
        key: _k,
        ...opt
      } = it as unknown as Record<string, unknown>
      return opt
    }

    const getDisabled = (it: BtnConfig): boolean => {
      const d = (it as Record<string, unknown>).disabled
      if (typeof d === 'function') return (d as () => boolean)()
      return !!d
    }

    const closeFullscreen = () => {
      setTimeout(() => {
        if (isFullscreen.value) {
          isFullscreen.value = false
        }
      }, 500)
    }

    const handleFullscreen = () => {
      if ((attrs as Record<string, unknown>)?.fullscreen) return
      isFullscreen.value = !isFullscreen.value
    }

    const dialogVisible = computed({
      get: () => props.visible || false,
      set: (val: boolean) => {
        emit('update:visible', val)
        if (!val) {
          emit('closed', val)
          closeFullscreen()
        }
      },
    })

    const handleClose = () => {
      // 通过 set dialogVisible 触发 :visible.sync → emit('update:visible', false)
      ;(dialogVisible as unknown as { value: boolean }).value = false
      emit('closed', false)
      closeFullscreen()
    }

    const onDialogClose = () => {
      // el-dialog @close 触发，与 handleClose 等价
      emit('closed', false)
      closeFullscreen()
    }

    const onDialogClosed = () => {
      // 动画结束后触发
    }

    /**
     * el-dialog 的 before-close 钩子：返回 false 可阻止关闭
     * 此处保持开放（done() 调用即关闭）
     */
    const beforeCloseHandler = (done: () => void) => {
      done()
    }

    const filteredAttrs = computed(() => ({ ...(attrs as Record<string, unknown>) }))

    const initDialogCls = computed(() => {
      if (!isFullscreen.value) {
        if (props.maxHeight) return 'dialogShadow'
        return 'dialogAuto'
      }
      return 'dialogFull'
    })

    const getMaxContentHeight = () => {
      const viewH = typeof window !== 'undefined' ? window.innerHeight : 800
      return Math.max(viewH - 135, 200)
    }

    const initDialogHeight = computed(() => {
      const viewH = getMaxContentHeight()
      if (!isFullscreen.value) {
        if (props.maxHeight) {
          return {
            maxHeight:
              typeof props.maxHeight === 'number'
                ? `${props.maxHeight}px`
                : (props.maxHeight as string),
          }
        }
        return { maxHeight: viewH + 'px' }
      }
      return { height: viewH + 'px' }
    })

    const getCurrentInstanceModel = computed(() => ({
      renderBodyRefs: (renderBodyRefsObject as Record<string, unknown>).currentRef,
      renderBodyRefsObject,
      lyFormInstance,
      dialogInstance,
      getRefs: () => renderBodyRefsObject,
    }))

    const handleBtnClick = (it: BtnConfig) => {
      const click = (it as Record<string, unknown>).click as Function | undefined
      if (typeof click === 'function') {
        click((renderBodyRefsObject as Record<string, unknown>).currentRef, {
          close: handleClose,
          getRefs: (name?: string) => {
            if (name)
              return (renderBodyRefsObject as Record<string, unknown>)[name] || null
            return renderBodyRefsObject
          },
          dialogInstance,
        })
      }
    }

    // 子组件 EsForm 注册的回调（兼容 EsForm <-> EsDialog 联动）
    provide('bodyFormInstance', (e: unknown) => {
      lyFormInstance.value = e
    })

    // dialogComponents：包给 RenderJsx 的组件映射（Vue 2 没有 Vue 3 的全局 components 注入）
    // 用户在 useDialog 调用时若需要 EsTable/EsForm，需自行 import 并通过 components prop 透传
    const dialogComponents = computed(() => ({
      ...(props.components as Record<string, unknown>),
    }))

    const exposed = {
      closed: handleClose,
    }
    if (typeof expose === 'function') {
      expose(exposed)
    }

    return {
      // state
      dialogVisible,
      isFullscreen,
      lyFormInstance,
      renderBodyRefsObject,
      // computeds
      filteredAttrs,
      initDialogCls,
      initDialogHeight,
      getCurrentInstanceModel,
      dialogComponents,
      // methods
      handleClose,
      handleFullscreen,
      handleBtnClick,
      onDialogClose,
      onDialogClosed,
      beforeCloseHandler,
      checkPermission,
      filterOptions,
      getDisabled,
      getCompIcon,
      // exposed
      ...exposed,
    }
  },
})
</script>

<style lang="scss" scoped>
.dp-dialog_wrapper {
  ::v-deep(.dialogAuto) {
    margin: 0px !important;
  }
  ::v-deep(.el-dialog) {
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

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
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
