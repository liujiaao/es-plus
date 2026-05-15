<template>
  <!-- 模板部分保持不变 -->
  <div class="dp-dialog_wapper">
    <el-dialog
      :class="['dg-dialog', iniDalogCls]"
      v-bind="filteredAttrs"
      v-model="dialogVisible"
      :draggable="props.isDraggable"
      :width="props.width"
      :show-close="false"
      @close="beforeClose"
      :fullscreen="filteredAttrs?.fullscreen ?? isFullscreen"
    >
      <template #header>
        <template v-if="attrs.renderHeader">
         <RenderJsx :render="attrs.renderHeader" :instance="getCurtInstanceModel" />
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
          <el-icon @click="handleClose"><Close /> </el-icon>
        </div>
              </template>
      </template>

      <div class="dialog_body_layouts" :style="initDialogHeight">
        <template v-if="attrs.render && typeof attrs.render === 'function'">
          <RenderJsx
            :refs="renderBodyRefsObject"
            :instance="getCurtInstanceModel"
            :render="attrs.render"
            :components="{ EsTable, EsForm }"
            :locale="locale"
          />
        </template>
      </div>

      <template #footer v-if="!attrs.isHiddeFooter">
        <span v-if="!slots.footer" class="dialog-footer">
          <template v-if="attrs.renderFooter && typeof attrs.renderFooter === 'function'">
            <RenderJsx :render="attrs.renderFooter" :instance="getCurtInstanceModel"  />
          </template>
          <template v-else-if="props.configBtn && props.configBtn.length">
            <el-button
              v-for="(it, inx) in configBtn"
              size="small"
              v-bind="filterOptions(it)"
              :icon="getCompIcon(it.icon)"
              :disabled="typeof it.disabled === 'function' ? it.disabled() : it.disabled || false"
              @click="
                () => {
                  console.log('it', getCurtInstanceModel.getRefs())
                  it.click?.(renderBodyRefsObject.currentRef, {
                    close: handleClose,  
                    getRefs: (name) => {
                       // 支持获取指定名称的组件实例
                       // 使用 reactive 对象直接获取
                       if (name) {
                         // 获取指定名称的组件实例
                         return renderBodyRefsObject[name] || null
                       }
                       // 返回所有 refs
                       return renderBodyRefsObject
                     },
                    // getCurtInstanceModel.lyFormInstantce.value, 
                    dialogInstantce
                  })
                }
              "
              :key="it.key || inx"
            >
              {{ it.name }}
            </el-button>
          </template>
          <!-- <template v-else>
            <el-button size="small" type="primary" @click="handleConfirm">{{ props.confirmText }}</el-button>
            <el-button size="small" @click="handleClose">{{ props.cancelText }}</el-button>
          </template> -->
        </span>
        <slot v-else name="footer" />
      </template>
      </el-dialog>
    </div>
</template>

<script>
import { defineComponent, computed, ref, reactive, getCurrentInstance, provide, inject } from 'vue'
import { ElConfigProvider, ElDialog, ElButton, ElIcon } from 'element-plus'
import { FullScreen, Close, CopyDocument } from '@element-plus/icons-vue'
import RenderJsx from './utils/RenderJsx.vue'
import EsTable from '../../es-table'
import EsForm from '../../es-form'

// 导入所有Element Plus图标
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

export default defineComponent({
  name: 'EsDialog',

  components: {
    RenderJsx,
    FullScreen,
    Close,
    CopyDocument,
    ElConfigProvider,
    ElDialog, 
    ElButton,
    ElIcon
  },

  props: {
    title: { type: String, default: '' },
    visible: { type: Boolean, default: false },
    appendTo: { type: [Object, String], default: null },
    hiddenFullBtn: { type: Boolean, default: false },
    width: { type: [String, Number], default: '60%' },
    isDraggable: { type: Boolean, default: false },
    confirmText: { type: String, default: '确认' },
    cancelText: { type: String, default: '取消' },
    configBtn: { type: Array, default: () => [] },
    maxHeight: { type: [String, Number], default: null }
  },

  emits: ['update:visible', 'closed', 'submit'],

  setup(props, context) {
    const { attrs, slots, emit } = context
    const instance = getCurrentInstance()

    // 创建图标映射
    const extented = Object.fromEntries(Object.entries(ElementPlusIconsVue).map(([key]) => [key, ElementPlusIconsVue[key]]))

    // 响应式数据
    const lyFormInstantce = ref(null)
    const renderBodyRefs = ref(null)
    // 使用 reactive 对象来存储子组件 refs，支持通过名称获取
    const renderBodyRefsObject = reactive({})
    const isFullscreen = ref(false)
    const dialogInstantce = instance
    const locale = ref(zhCn)
    
    // 获取弹窗注入的语言环境
    const injectedLocale = inject('elLocale', null)
    if (injectedLocale) {
      locale.value = injectedLocale
    }

    // 提供语言环境给子组件
    provide('elLocale', locale.value)

    // 方法
    const getCompIcon = (key) => {
      return extented[key] || key
    }

    const filterOptions = (it) => {
      const { icon, ...opt } = it
      return opt
    }

    const closeFullscreens = () => {
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
      closeFullscreens()
    }

    const handleConfirm = () => {
      emit('submit', { renderBodyRefs: renderBodyRefsObject.currentRef, lyFormInstantce, dialogInstantce })
    }

    const beforeClose = () => {
      emit('closed', false)
      closeFullscreens()
    }

    // 计算属性
    const filteredAttrs = computed(() => {
      const { ...rest } = attrs
      return rest
    })

    const iniDalogCls = computed(() => {
      if (!isFullscreen.value) {
        if (props.maxHeight) {
          return 'dailogShodo'
        }
        return 'dailogAuto'
      }
      return 'dailogFull'
    })

    // 内容最大高 = 视口高 - 预留区（标题+按钮+安全区）
    const getMaxContentHeight = () => {
      const viewH = window.innerHeight
      // 预留：标题 55 + 按钮 60 + 安全 20 = 135
      return Math.max(viewH - 135, 200) // 最低 200px
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
      get: () => props.visible,
      set: (val) => {
        emit('update:visible', val)
        if (!val) {
          emit('closed', val)
          closeFullscreens()
        }
      }
    })

    const getCurtInstanceModel = computed(() => ({
      renderBodyRefs: renderBodyRefsObject.currentRef,
      renderBodyRefsObject,
      lyFormInstantce,
      dialogInstantce,
      // 提供一个获取所有 refs 的方法
      getRefs: () => renderBodyRefsObject
    }))

    // 提供表单实例
    provide('bodyFormInstantce', (e) => {
      lyFormInstantce.value = e
    })

    // 暴露公共方法
    instance.exposed = {
      closed: handleClose
    }

    return {
      props,
      attrs,
      slots,
      lyFormInstantce,
      renderBodyRefs,
      renderBodyRefsObject,
      isFullscreen,
      dialogInstantce,
      getCompIcon,
      filterOptions,
      closeFullscreens,
      handleFullscreen,
      handleClose,
      handleConfirm,
      beforeClose,
      filteredAttrs,
      initDialogHeight,
      dialogVisible,
      getCurtInstanceModel,
      iniDalogCls,
      EsTable,
      EsForm,
      locale
    }
  }
})
</script>

<style lang="scss" scoped>
.dp-dialog_wapper {
  :deep(.dailogAuto) {
    // margin: 8vh auto 50px !important;
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
