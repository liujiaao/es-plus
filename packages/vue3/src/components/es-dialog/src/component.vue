<template>
  <div class="dp-dialog_wrapper">
    <!--
      appendTo 此前是**声明了却从不读**的死 prop（`withDefaults` 里收了、模板里没绑）：
      声明式 `<es-dialog append-to="#app">` 的挂载目标被静默丢弃（与 cacheKey 同族，
      但这里底层库支持）。Element Plus 2.14 的 el-dialog 用
      teleport :to="appendTo"、:disabled="appendTo !== 'body' ? false : !appendToBody"
      选择挂载点，故显式转发；给了 appendTo 就打开 append-to-body
      （appendTo === 'body' 时 teleport 的启用开关只认 appendToBody）。
      不传 appendTo 时 appendToBody 保持 false —— 渲染位置与修复前逐字节一致。
    -->
    <!--
      底座可切换：dialog（默认）/ drawer（W3-4）。
      两者都是 Element Plus 的「弹层」，共用 v-model、before-close、header/footer 插槽与
      appendTo/appendToBody，故此处的头/身/脚只写一份；差异收敛到 hostProps：
        - 抽屉用 size（宽度或高度，随 direction 而定），弹窗用 width；
        - 抽屉没有 draggable / fullscreen，弹窗专有；
        - 抽屉的关闭触发（遮罩/ESC）同样经 before-close，关闭链三端一致。
      type 是声明 prop，不会落进 attrs —— 所以必须显式 v-bind，不能靠透传。
    -->
    <component
      :is="hostComponent"
      :class="['dg-dialog', initDialogCls]"
      v-bind="hostBindings"
      v-model="dialogVisible"
      :show-close="showNativeClose"
      :before-close="onBeforeClose"
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
            <!-- 图标按钮：可见内容只有一个图标，读屏拿不到名字；补 role/aria-label 与
                 Enter / Space 键盘操作（el-icon 渲染成 <i>，原生不进 Tab 序列）。 -->
            <el-icon
              role="button"
              tabindex="0"
              :aria-label="isFullscreen ? builtinExitFullscreen : builtinFullscreen"
              @click="handleFullscreen"
              @keydown.enter.prevent="handleFullscreen"
              @keydown.space.prevent="handleFullscreen"
              v-show="!props.hiddenFullBtn && !isDrawer"
            >
              <FullScreen v-if="!isFullscreen" />
              <CopyDocument v-else />
            </el-icon>
            <el-icon
              role="button"
              tabindex="0"
              :aria-label="builtinClose"
              @click="handleClose"
              @keydown.enter.prevent="handleClose"
              @keydown.space.prevent="handleClose"
              v-show="props.showClose"
            >
              <Close />
            </el-icon>
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
        <!-- 默认插槽：声明式用法 `<es-dialog><es-form /></es-dialog>` 的主体内容。
             此前这里只有 render 分支、没有 slot 回退，插槽内容被**静默丢弃**
             （标题/按钮照常渲染，唯独表单不见）——antdv 版一直有 `<slot v-else />`，
             vue2/vue3 漏了。AI 生成器的 component 形态弹窗正是这种写法。 -->
        <slot v-else />
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
    </component>
  </div>
</template>

<script lang="ts">
export default { name: 'EsDialog' }
</script>

<script setup lang="ts">
import { computed, ref, reactive, getCurrentInstance, provide, inject, useAttrs, onMounted, watch } from 'vue'
import { ElConfigProvider, ElDialog, ElDrawer, ElButton, ElIcon, vLoading } from 'element-plus'
import { FullScreen, Close, CopyDocument } from '@element-plus/icons-vue'
import RenderJsx from './render-jsx.vue'
import EsTable from '../../es-table'
import EsForm from '../../es-form'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { getGlobalConfig } from '../../../config'
import { checkPermissionValue } from '@es-plus/core'
// locale 文案一律走包内桥（P2-4 热切换）
import { resolveBuiltinText } from '../../../locale'
import type { BtnConfig } from '../../../types'

// 图标按钮的可访问名（locale 单源；弹窗头部只有图标，没有可见文字）。
// computed：宿主在 app.use 时才配置 locale，模块级常量会冻在 import 时的缺省中文。
const builtinFullscreen = computed(() => resolveBuiltinText('fullscreen'))
const builtinExitFullscreen = computed(() => resolveBuiltinText('exitFullscreen'))
const builtinClose = computed(() => resolveBuiltinText('close'))


const props = withDefaults(
  defineProps<{
    /**
     * 底座形态：'dialog'（默认）或 'drawer'。
     *
     * drawer 复用弹窗的全部能力（render/renderHeader/renderFooter/configBtn/beforeClose/
     * cacheKey 缓存/权限过滤），只把底座换成 el-drawer —— `useDialog({ type: 'drawer' })`
     * 与 `<es-dialog type="drawer">` 走的是同一条路径。
     */
    type?: 'dialog' | 'drawer'
    /** 抽屉弹出方向，默认 'rtl'（右侧）；dialog 忽略。ttb/btt 时 width 作用于高度 */
    direction?: 'rtl' | 'ltr' | 'ttb' | 'btt'
    title?: string
    visible?: boolean
    // 与 el-dialog 的 appendTo 同型（Element Plus 的 teleport :to 接受选择器或元素）。
    // 此前写成 object | string 与底层不兼容，转发时 typecheck 直接挡住。
    appendTo?: string | HTMLElement
    hiddenFullBtn?: boolean
    width?: string | number
    isDraggable?: boolean
    configBtn?: BtnConfig[]
    maxHeight?: string | number
    isHiddenFooter?: boolean
    renderHeader?: Function
    renderFooter?: Function
    render?: Function
    fullscreen?: boolean
    loading?: boolean
    /** 是否显示关闭按钮（默认 true）。false 时自绘的与原生的一起隐藏 */
    showClose?: boolean
    /** 关闭前拦截：传入后由用户调用 done() 才真正关闭（X/遮罩/ESC 统一经此闸门） */
    beforeClose?: (done: () => void) => void
  }>(),
  // showClose 必须真的默认 true：模板里用 `v-show="props.showClose"` 做闸门，
  // 若声明成 optional 而不给默认值，不传时是 undefined → 自绘的 X 反而被隐藏。
  { showClose: true, type: 'dialog', direction: 'rtl' }
)

// ─── 底座选择（dialog / drawer）──────────────────────────────────────────
const isDrawer = computed(() => props.type === 'drawer')
const hostComponent = computed(() => (isDrawer.value ? ElDrawer : ElDialog))

/**
 * 两个底座共有的键（appendTo/appendToBody）之外，各自专有的键在这里分流：
 *   - el-drawer 的「尺寸」叫 size，方向叫 direction；它没有 draggable / fullscreen。
 *   - el-dialog 仍是原来的 draggable/width/fullscreen。
 * 与透传属性合并成一个对象（同一元素上不允许两个 v-bind）；底座专有键覆盖同名透传键。
 */
const hostBindings = computed<Record<string, unknown>>(() => {
  const merged = { ...(filteredAttrs.value as Record<string, unknown>) }
  if (isDrawer.value) {
    return {
      ...merged,
      direction: props.direction,
      size: props.width,
      appendTo: props.appendTo,
      appendToBody: props.appendTo !== undefined,
    }
  }
  return {
    ...merged,
    draggable: props.isDraggable,
    width: props.width,
    fullscreen: isFullscreen.value,
    appendTo: props.appendTo,
    appendToBody: props.appendTo !== undefined,
  }
})

// 原生关闭按钮只在「用户没有自绘头部」时放出。
//
// 此前这里硬编码 `:show-close="false"`，它只在**内置头部**下成立 —— 内置头部的
// `.btns` 里已经自绘了一个 X（与全屏按钮同排）。可一旦调用方传入 renderHeader，
// 自绘 X 随 `v-else` 一起消失，原生 X 又恒被关掉 —— 弹窗**完全没有关闭入口**，
// 且无法通过 attrs 补救：`v-bind="filteredAttrs"` 在前、显式绑定在后，后者胜出。
//
// 现在：showClose === false 全关；否则内置头部用自绘的、自定义头部用原生的，
// 任何组合下都不会出现两个 X。
const showNativeClose = computed(() => props.showClose && !!props.renderHeader)

const emit = defineEmits<{
  'update:visible': [val: boolean]
  closed: [val: boolean]
  open: []
}>()

const slots = defineSlots()

const instance = getCurrentInstance()
const attrs = useAttrs()

const extended = Object.fromEntries(Object.entries(ElementPlusIconsVue).map(([key]) => [key, (ElementPlusIconsVue as Record<string, unknown>)[key]]))

const lyFormInstance = ref(null)
const renderBodyRefsObject = reactive<Record<string, any>>({})
// fullscreen 是声明 prop（Vue 会把它从 attrs 摘走），文档语义为「初值」——
// 对齐 vue2 `ref(!!props.fullscreen)` / antdv `ref(props.fullscreen || false)`。
const isFullscreen = ref(!!props.fullscreen)

// 但「初值」只在**每次调用**时定：useDialog 复用单例/cacheKey 实例时，
// 本次调用的 fullscreen 是重新下发的 prop（省略的键会被复位到缺省值），
// 而 isFullscreen 只在 setup 读过一次 —— 于是「先开任意弹窗、再开全屏弹窗」不全屏。
// 用户点弹窗内的按钮改的是 isFullscreen 本身、不动 prop，因此这条 watcher 不会打架。
watch(
  () => props.fullscreen,
  (val) => {
    isFullscreen.value = !!val
  }
)
const dialogInstance = instance
const locale = ref(zhCn)

const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) as Record<string, unknown> ?? getGlobalConfig() ?? {}

const checkPermission = (pvalue?: string): boolean =>
  checkPermissionValue(pvalue, esPlus.permission as ((v: string) => boolean) | undefined)

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
  // 抽屉没有全屏态：它本身就是贴着一条边的整高（或整宽）容器，缩放由 direction + size
  // 决定。图标在 drawer 下已隐藏，这里再兜一层，防止外部调用 exposed.toggleFullscreen
  // 把 isFullscreen 翻成 true 后带进下一次 dialog 复用。
  if (isDrawer.value) return
  // 此处原本有一句 `if (attrs?.fullscreen) return`：fullscreen 是声明 prop，
  // 永远不在 attrs 里，该守卫从未生效（死代码）。vue2 / antdv 的切换都不设闸，
  // 这里保持三端一致 —— prop 只定初值，之后允许自由切换。
  isFullscreen.value = !isFullscreen.value
}

// X 按钮点击：走统一关闭闸门（beforeClose 拦截）
const handleClose = () => {
  runBeforeClose(doClose)
}

// el-dialog 内建关闭触发（遮罩点击 / ESC）：同样经闸门，不调用 el 的 done，
// 由 doClose 翻转 v-model（visible）来收起弹窗，保证 beforeClose 可否决
const onBeforeClose = (_done: () => void) => {
  runBeforeClose(doClose)
}

// drawer 下 dialog 专有的透传属性（top / alignCenter / draggable / fullscreen）若原样
// 落到 el-drawer，只会变成根节点上的无意义 DOM 属性（Element Plus 的 drawer 用 size /
// direction，不认这些）；按底座过滤，别让「静默不生效」看起来像支持。
const DRAWER_IGNORED_ATTRS = new Set(['top', 'alignCenter', 'align-center', 'draggable', 'fullscreen'])

const filteredAttrs = computed(() => {
  const { ...rest } = attrs
  if (!isDrawer.value) return rest
  return Object.fromEntries(Object.entries(rest).filter(([k]) => !DRAWER_IGNORED_ATTRS.has(k)))
})

const initDialogCls = computed(() => {
  // drawer 不参与弹窗的 margin/fullscreen 类（它们改的是 .el-dialog 的定位与尺寸）
  if (isDrawer.value) return ''
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
  // drawer 没有全屏态（见 handleFullscreen）：即便复用实例上残留 isFullscreen=true，
  // 也不能把正文撑成整视口高度 —— 抽屉自身的高度由 size/direction 决定。
  if (isDrawer.value || !isFullscreen.value) {
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
    if (val) {
      // 重新打开 = 一次新调用：全屏状态归位到本次的 fullscreen 初值
      // （用户在弹窗里手动切换过全屏，残留到下一次打开就是错的）
      isFullscreen.value = !!props.fullscreen
      emit('open')
    }
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

  /* 抽屉：与弹窗同一套视觉（头部下边线、正文/底部内边距），
     否则 render/configBtn 在两种底座下会长得不一样。 */
  :deep(.el-drawer) {
    .el-drawer__header {
      border-bottom: 1px solid #eee;
      display: flex;
      margin: 0;
      padding: 10px;
      align-items: center;
      justify-content: space-between;
      color: inherit;
    }

    .el-drawer__body {
      padding: 10px;
    }

    .el-drawer__footer {
      padding: 0 10px 10px;
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
