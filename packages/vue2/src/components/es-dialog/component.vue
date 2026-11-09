<template>
  <div class="dp-dialog_wrapper">
    <!--
      Element UI dialog 与 Element Plus 关键差异：
        - 双向绑定：:visible.sync (Vue 3 是 v-model)
        - 不支持 draggable 属性（Element UI 2.x 无此特性），本组件用纯 DOM transform 实现拖拽
        - 全屏：fullscreen 同名属性
        - header/footer 槽位写法相同，但不能用 #header (Vue 2.6+ 支持新语法，2.5 及以下需 slot="header")
        - 图标改用 i.el-icon-* class 字符串
    -->
    <!--
      底座可切换：dialog（默认）/ drawer（W3-4）。
      Element UI 的 el-dialog 与 el-drawer 差异比 Element Plus 大：
        - 尺寸键名不同：dialog 用 width，drawer 用 size（横向管宽、纵向管高）；
        - drawer **没有 footer 槽**（只有 title + default），底部动作区必须放进默认插槽；
        - 抽屉没有 fullscreen / draggable；点遮罩关闭叫 wrapperClosable。
      差异收敛到 hostProps 与 isDrawer 分支，头/身两份底座共用。
    -->
    <component
      :is="isDrawer ? 'el-drawer' : 'el-dialog'"
      ref="dialogRootRef"
      :class="['dg-dialog', initDialogCls]"
      v-bind="hostBindings"
      :visible.sync="dialogVisible"
      :show-close="showNativeClose"
      :append-to-body="resolvedAppendToBody"
      :modal-append-to-body="modalAppendToBody"
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
              <!-- 图标按钮：可见内容只有一个 <i>，读屏拿不到名字；补 role/aria-label 与
                   Enter / Space 键盘操作（原生 <i> 不进 Tab 序列，键盘用户此前无法全屏/关闭）。 -->
              <i
                v-show="!hiddenFullBtn && !isDrawer"
                role="button"
                tabindex="0"
                :aria-label="isFullscreen ? builtinExitFullscreen : builtinFullscreen"
                :class="isFullscreen ? 'el-icon-copy-document' : 'el-icon-full-screen'"
                @click="handleFullscreen"
                @keydown.enter.prevent="handleFullscreen"
                @keydown.space.prevent="handleFullscreen"
              />
              <i
                class="el-icon-close"
                role="button"
                tabindex="0"
                :aria-label="builtinClose"
                v-show="showClose"
                @click="handleClose"
                @keydown.enter.prevent="handleClose"
                @keydown.space.prevent="handleClose"
              />
            </div>
          </div>
        </template>
      </template>

      <!-- 底座的默认插槽容器。drawer 分支需要 flex 列布局把底部动作区钉在抽屉底部
           （el-drawer__body 是 flex:1 + overflow:auto，见下方 .es-drawer-layout 样式）。 -->
      <div :class="isDrawer ? 'es-drawer-layout' : ''">
        <div v-loading="loading" class="dialog_body_layouts" :style="initDialogHeight">
          <render-jsx
            v-if="render && typeof render === 'function'"
            :refs="renderBodyRefsObject"
            :instance="getCurrentInstanceModel"
            :render="render"
            :components="dialogComponents"
          />
          <!-- 默认插槽：`<es-dialog><es-form /></es-dialog>` 的主体内容。
               此前只有 render 分支，插槽被静默丢弃（同 vue3；antdv 版一直有回退）。 -->
          <slot v-else />
        </div>

        <!-- Element UI 的 el-drawer 没有 footer 槽（只有 title + default），底部动作区
             只能放进默认插槽。内容与下面 dialog 的 #footer 逐项一致：同一套
             renderFooter / configBtn / footer 插槽语义，三端行为不变。
             （Element UI 源码：packages/drawer/src/main.vue 的 <section class="el-drawer__body">） -->
        <div v-if="isDrawer && !isHiddenFooter" class="es-drawer-footer">
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
        </div>
      </div>

      <template v-if="!isHiddenFooter && !isDrawer" #footer>
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
    </component>
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
 *   5. draggable：Element UI 2.x 无原生 draggable，用纯 DOM transform 实现（见下方拖拽块）
 *   6. exposed 方法：通过 expose() 或挂到 vm 上（Vue 2 中通过 setup 返回值即可）
 *
 * 业务能力（render slot/configBtn/全屏/maxHeight/事件）与 Vue 3 版本对齐。
 */
import {
  defineComponent,
  ref,
  reactive,
  computed,
  watch,
  inject,
  provide,
  nextTick,
  getCurrentInstance,
  markRaw,
  onBeforeUnmount,
  onMounted,
} from '../../vue-compat'
import type { PropType } from '../../vue-compat'
import { getGlobalConfig, checkPermissionValue, type BtnConfig } from '@es-plus/core'
// locale 文案一律走包内桥（P2-4 热切换）
import { resolveBuiltinText } from '../../locale'
import RenderJsx from './render-jsx.vue'
import { getCompIcon } from '../../utils/icon'

export default defineComponent({
  name: 'EsDialog',
  components: { RenderJsx },
  inheritAttrs: false,
  props: {
    /**
     * 底座形态：'dialog'（默认）或 'drawer'。
     *
     * drawer 复用弹窗的全部能力（render/renderHeader/renderFooter/configBtn/beforeClose/
     * cacheKey 缓存/权限过滤），只把底座换成 el-drawer；`useDialog({ type: 'drawer' })`
     * 与 `<es-dialog type="drawer">` 都走这条路径。
     */
    type: { type: String, default: 'dialog' },
    /** 抽屉弹出方向，默认 'rtl'（右侧）；dialog 忽略。ttb/btt 时 width 作用于高度 */
    direction: { type: String, default: 'rtl' },
    title: { type: String, default: '' },
    visible: { type: Boolean, default: false },
    appendTo: { type: [Object, String], default: undefined },
    appendToBody: { type: Boolean, default: false },
    modalAppendToBody: { type: Boolean, default: true },
    closeOnClickModal: { type: Boolean, default: true },
    closeOnPressEscape: { type: Boolean, default: true },
    // 关闭闸门：存在时 X/遮罩/ESC 关闭前先交给用户 done() 决定；doClose() 可绕过它强制关闭。
    beforeClose: {
      type: Function as PropType<(done: () => void) => void>,
      default: undefined,
    },
    destroyOnClose: { type: Boolean, default: false },
    hiddenFullBtn: { type: Boolean, default: false },
    width: { type: [String, Number], default: '50%' },
    isDraggable: { type: Boolean, default: false },
    configBtn: { type: Array as () => BtnConfig[], default: () => [] },
    maxHeight: { type: [String, Number], default: undefined },
    isHiddenFooter: { type: Boolean, default: false },
    renderHeader: { type: Function, default: undefined },
    renderFooter: { type: Function, default: undefined },
    render: { type: Function, default: undefined },
    fullscreen: { type: Boolean, default: false },
    // 是否显示关闭按钮，默认 true。false 时自绘的（内置头部）与原生的一起隐藏。
    showClose: { type: Boolean, default: true },
    // 弹窗内容加载态：true 时在 body 区域显示 el-loading 遮罩
    loading: { type: Boolean, default: false },
    // 用户透传给 RenderJsx 的额外组件映射（如 EsTable / EsForm 引用）
    components: { type: Object, default: () => ({}) },
    // 编程式（useDialog）创建时，无法通过 propsData 填充 $attrs，
    // 故把「未声明的透传属性」（如 el-dialog 的 customClass/top/center 等）
    // 显式收进此 prop，再在 filteredAttrs 里合并 v-bind 到 el-dialog。
    passThroughAttrs: { type: Object, default: () => ({}) },
  },
  emits: ['update:visible', 'closed', 'open'],
  setup(props, { emit, attrs, slots, expose }) {
    const instance = getCurrentInstance() as unknown as Record<string, unknown>
    const lyFormInstance = ref<unknown>(null)
    const renderBodyRefsObject = reactive<Record<string, unknown>>({})
    const isFullscreen = ref(!!props.fullscreen)
    // 「初值」只在**每次调用**时定：useDialog 复用单例/cacheKey 实例时，本次调用的
    // fullscreen 是重新下发的 prop（省略的键会被复位到缺省值），而 isFullscreen 只在
    // setup 读过一次 —— 于是「先开任意弹窗、再开全屏弹窗」不全屏（三端同病）。
    // 用户点弹窗内的按钮改的是 isFullscreen 本身、不动 prop，因此这条 watcher 不会打架。
    watch(
      () => props.fullscreen,
      (val) => {
        isFullscreen.value = !!val
      }
    )
    // ─── 底座选择（dialog / drawer）────────────────────────────────────────
    // drawer 只换底座：render/configBtn/关闭链/权限过滤全部复用，故下面所有
    // 「弹窗专有」的逻辑（拖拽、全屏、margin 类）都以 isDrawer 为闸门。
    const isDrawer = computed(() => props.type === 'drawer')

    /**
     * appendTo：Element UI 2.x 的 el-dialog **只有布尔 `append-to-body`**，没有
     * 「选择器挂载点」能力（Element Plus 的 `appendTo`、antdv 的 `getContainer` 有）。
     *
     * 此前 `appendTo` 只在 props 里声明、模板从不读 —— 声明式
     * `<es-dialog append-to="#app">` 被**静默丢弃**（与 cacheKey 同族）。
     * 现在：给了 appendTo（或 appendToBody）就打开 `append-to-body`，
     * 让弹窗至少脱离当前 DOM 层级；`appendTo:'body'` 语义完全一致，
     * 非 body 选择器/DOM 元素则在挂载时**显式告警**这一端能力缺口，
     * 绝不静默假装支持。
     */
    const resolvedAppendToBody = computed(() => !!props.appendToBody || props.appendTo !== undefined)
    watch(
      () => props.appendTo,
      (v) => {
        if (v === undefined || v === 'body') return
        console.warn(
          '[EsDialog] Element UI 2.x 的 el-dialog 不支持选择器级 appendTo（' +
            String(v) +
            '）：已退化为 append-to-body 挂到 body。需要精确挂载容器请用 useDialog、' +
            '或改用 vue3 / antdv 端的 <es-dialog>。'
        )
      },
      { immediate: true }
    )
    // markRaw：dialogInstance 是活的 Vue 组件实例。放进会被 composition-api 遍历的
    // 结构前打 raw 标记，作为 Vue 2.6 polyfill customReactive 深度遍历 vm 的防御。
    const dialogInstance = markRaw(instance)

    // ─── 拖拽支持（Element UI 2.x 无原生 draggable，纯 DOM transform 绕过 Vue 响应式）───
    // 相比旧实现的三点修复：
    //   1. 手柄取 el-dialog 真实 .el-dialog__header —— 默认标题栏与 renderHeader
    //      自定义标题栏都可拖拽（旧实现的 ref 只绑在默认标题栏 div 上，自定义时失效）。
    //   2. 边界基于弹窗实际 getBoundingClientRect + 视口计算，保证不被拖出屏幕；
    //      每次 mousedown 重新计算，天然适配窗口 resize（旧实现用 innerWidth/2-100 硬编码）。
    //   3. 卸载时清理拖拽途中残留的 document 监听，并在每次打开时归位。
    let isDragging = false
    let dragOffsetX = 0
    let dragOffsetY = 0
    let dragStartX = 0
    let dragStartY = 0
    let dragTarget: HTMLElement | null = null
    let dragHandleEl: HTMLElement | null = null
    let activeDragCleanup: (() => void) | null = null

    const clampVal = (v: number, min: number, max: number) =>
      min > max ? min : Math.max(min, Math.min(max, v))

    function onDragStart(e: MouseEvent) {
      if (isFullscreen.value || isDrawer.value || !props.isDraggable) return
      // 从手柄向上找 .el-dialog 元素
      let el = e.currentTarget as HTMLElement
      while (el && !el.classList.contains('el-dialog')) {
        el = el.parentElement as HTMLElement
      }
      if (!el) return
      dragTarget = el
      isDragging = true
      dragStartX = e.clientX - dragOffsetX
      dragStartY = e.clientY - dragOffsetY

      // 以弹窗当前实际位置换算「未偏移」基准，再据视口算出允许的位移范围，
      // 使 newLeft = baseLeft + offset 始终落在 [0, 视口宽 - 弹窗宽] 内。
      const rect = el.getBoundingClientRect()
      const baseLeft = rect.left - dragOffsetX
      const baseTop = rect.top - dragOffsetY
      const minX = -baseLeft
      const maxX = window.innerWidth - rect.width - baseLeft
      const minY = -baseTop
      const maxY = window.innerHeight - rect.height - baseTop

      const onMove = (ev: MouseEvent) => {
        if (!isDragging) return
        dragOffsetX = clampVal(ev.clientX - dragStartX, minX, maxX)
        dragOffsetY = clampVal(ev.clientY - dragStartY, minY, maxY)
        // 直接操作 DOM，完全绕过 Vue 响应式系统
        dragTarget!.style.transform = `translate(${dragOffsetX}px, ${dragOffsetY}px)`
      }

      const onUp = () => {
        isDragging = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        activeDragCleanup = null
      }

      // 保存清理句柄：拖拽途中若组件卸载，用它移除 document 上的临时监听，防止泄漏
      activeDragCleanup = onUp
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    // 解析并绑定拖拽手柄（el-dialog 真实标题栏）。
    // Vue 2 + composition-api 下字符串 ref 不会自动回填 setup ref，需经 vm.$refs 手动获取；
    // append-to-body 时 $el 仍指向真实节点，querySelector 依然可用。
    const bindDragHandle = () => {
      // drawer 没有 .el-dialog__header，也没有拖拽语义（贴着屏幕边滑动）
      if (!props.isDraggable || isDrawer.value) return
      const vm = (instance as unknown as { proxy?: { $refs?: Record<string, any> } }).proxy
      const dlg = vm?.$refs?.dialogRootRef
      const root = dlg?.$el as HTMLElement | undefined
      const handle = (root?.querySelector('.el-dialog__header') as HTMLElement | null) || null
      if (!handle || handle === dragHandleEl) return
      if (dragHandleEl) dragHandleEl.removeEventListener('mousedown', onDragStart)
      dragHandleEl = handle
      handle.style.cursor = 'move'
      handle.style.userSelect = 'none'
      handle.addEventListener('mousedown', onDragStart)
    }

    // 归位：清空位移与 transform（复用实例/切换全屏时避免停留在上次位置）
    const resetDragPosition = () => {
      dragOffsetX = 0
      dragOffsetY = 0
      isDragging = false
      if (dragTarget) dragTarget.style.transform = ''
    }

    watch(isFullscreen, (val) => {
      if (val) resetDragPosition()
    })

    // 每次打开：绑定手柄（首次挂载时标题栏可能尚未就绪）并归位
    watch(
      () => props.visible,
      (val) => {
        if (val) {
          // 重新打开 = 一次新调用：全屏状态归位到本次的 fullscreen 初值
          // （用户在弹窗里手动切换过全屏，残留到下一次打开就是错的）
          isFullscreen.value = !!props.fullscreen
          emit('open')
          nextTick(() => {
            bindDragHandle()
            resetDragPosition()
          })
        }
      }
    )

    onMounted(() => {
      // 程序化调用（useDialog）挂载时 visible 已为 true，watch 不会触发，
      // 需在此补发 open，保证 onOpen 生命周期回调可用。
      if (props.visible) emit('open')
      nextTick(bindDragHandle)
    })

    onBeforeUnmount(() => {
      isDragging = false
      if (activeDragCleanup) activeDragCleanup()
      if (dragHandleEl) dragHandleEl.removeEventListener('mousedown', onDragStart)
      dragHandleEl = null
      dragTarget = null
    })

    const esPlus =
      inject<Record<string, unknown>>('$EsPlus', null as unknown as Record<string, unknown>) ??
      (getGlobalConfig() as Record<string, unknown>) ??
      {}

    const checkPermission = (pvalue?: string): boolean =>
      checkPermissionValue(pvalue, esPlus.permission as ((v: string) => boolean) | undefined)

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
      // 抽屉没有全屏态：它本身就贴着一条边、由 direction + size 决定尺寸。
      // 图标在 drawer 下已隐藏；这里再兜一层，防止外部 toggleFullscreen 把状态带进下一次 dialog。
      if (isDrawer.value) return
      isFullscreen.value = !isFullscreen.value
    }
    // 对齐 antdv/vue3 的命名（exposed 用 toggleFullscreen）
    const toggleFullscreen = handleFullscreen

    const dialogVisible = computed({
      get: () => props.visible || false,
      set: (val: boolean) => {
        const wasVisible = props.visible
        emit('update:visible', val)
        // 只在 true→false 转换时 emit closed，避免重复设置导致的循环
        if (!val && wasVisible) {
          emit('closed', val)
          closeFullscreen()
        }
      },
    })

    // 强制关闭：直接翻转 dialogVisible（setter 统一 emit closed），绕过 beforeClose 闸门。
    // 这是「真正的强制关闭」逃生舱，供 exposed.doClose / 内部确认后调用。
    const doClose = () => {
      ;(dialogVisible as unknown as { value: boolean }).value = false
      closeFullscreen()
    }

    // 关闭闸门：存在 beforeClose 则交给用户 done() 决定何时关闭，否则直接 doClose。
    const runBeforeClose = (proceed: () => void) => {
      if (typeof props.beforeClose === 'function') {
        props.beforeClose(proceed)
      } else {
        proceed()
      }
    }

    const handleClose = () => {
      // X 按钮点击：走统一关闭闸门（beforeClose 可拦截）
      runBeforeClose(doClose)
    }

    const onDialogClose = () => {
      // 遮罩/ESC/子组件触发 → 走闸门（与 X 按钮一致）
      runBeforeClose(doClose)
    }

    const onDialogClosed = () => {
      // 动画结束后触发
    }

    /**
     * el-dialog 的 before-close 钩子：改为走 handleClose 统一流程，
     * 避免 done() 绕过 dialogVisible setter 造成事件丢失
     */
    const beforeCloseHandler = (_done: () => void) => {
      handleClose()
    }

    const filteredAttrs = computed(() => ({
      ...(attrs as Record<string, unknown>),
      ...((props.passThroughAttrs as Record<string, unknown>) || {}),
    }))

    /**
     * 传给底座的完整属性集：透传属性 + 底座专有键。
     *
     * 两底座的键名不同（Element UI 2.x）：
     *   - el-dialog：width / fullscreen / close-on-click-modal
     *   - el-drawer：size（横向管宽、纵向管高）/ direction / wrapperClosable（点遮罩关闭）
     * Vue 2.6 的模板不允许同一元素上写两个 `v-bind`（解析报 duplicate-attribute），
     * 故在这里合并成一个对象；底座专有键覆盖透传同名键（与 vue3 的绑定顺序一致）。
     */
    const hostBindings = computed<Record<string, unknown>>(() => {
      const merged = { ...(filteredAttrs.value as Record<string, unknown>) }
      if (isDrawer.value) {
        return {
          ...merged,
          size: typeof props.width === 'number' ? `${props.width}px` : props.width,
          direction: props.direction,
          // Element UI 的抽屉把「点遮罩关闭」叫 wrapperClosable；dialog 叫 closeOnClickModal
          wrapperClosable: props.closeOnClickModal !== false,
        }
      }
      return {
        ...merged,
        width: typeof props.width === 'number' ? `${props.width}px` : props.width,
        fullscreen: isFullscreen.value,
        closeOnClickModal: props.closeOnClickModal,
      }
    })

    // 原生关闭按钮只在「调用方没有自绘头部」时放出。
    //
    // 此前这里硬编码 `:show-close="false"`，它只在**内置头部**下成立 —— 内置头部的
    // `.btns` 里已经自绘了一个 X（与全屏按钮同排）。可一旦调用方传入 renderHeader，
    // 自绘 X 随 `v-else` 一起消失，原生 X 又恒被关掉 —— 弹窗**完全没有关闭入口**。
    // 现在：showClose === false 全关；否则内置头部用自绘的、自定义头部用原生的，
    // 任何组合下都不会出现两个 X。
    const showNativeClose = computed(() => props.showClose && !!props.renderHeader)

    const initDialogCls = computed(() => {
      // drawer 不参与弹窗的 margin / fullscreen 类（它们改的是 .el-dialog 的定位与尺寸）
      if (isDrawer.value) return ''
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
      // drawer 没有全屏态（见 handleFullscreen）：即便复用实例上残留 isFullscreen=true，
      // 也不能把正文撑成整视口高度 —— 抽屉自身高度由 size/direction 决定。
      if (isDrawer.value || !isFullscreen.value) {
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
      // markRaw：EsForm 实例是活的 vm，防御 customReactive 深度遍历
      lyFormInstance.value = e && typeof e === 'object' ? markRaw(e as object) : e
    })

    // dialogComponents：包给 RenderJsx 的组件映射（Vue 2 没有 Vue 3 的全局 components 注入）
    // 用户在 useDialog 调用时若需要 EsTable/EsForm，需自行 import 并通过 components prop 透传
    const dialogComponents = computed(() => ({
      ...(props.components as Record<string, unknown>),
    }))

    const exposed = {
      // 三端统一命名：close（标准）/ closed（别名，历史兼容）走闸门；
      // toggleFullscreen 切全屏；doClose 绕过 beforeClose 强制关闭。
      close: handleClose,
      closed: handleClose,
      toggleFullscreen,
      doClose,
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
      // 图标按钮的可访问名（locale 单源；弹窗头部只有图标，没有可见文字）。
      // 用 computed 而非字符串快照：setup() 的返回值只求值一次，快照会让热切换失效。
      builtinFullscreen: computed(() => resolveBuiltinText('fullscreen')),
      builtinExitFullscreen: computed(() => resolveBuiltinText('exitFullscreen')),
      builtinClose: computed(() => resolveBuiltinText('close')),
      // computeds
      isDrawer,
      hostBindings,
      filteredAttrs,
      resolvedAppendToBody,
      showNativeClose,
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

  /* 抽屉：与弹窗同一套视觉（头部下边线、正文/底部内边距），
     否则 render/configBtn 在两种底座下会长得不一样。
     Element UI 的 .el-drawer__header 默认 margin-bottom:32px / padding:20px 20px 0。 */
  ::v-deep(.el-drawer) {
    .el-drawer__header {
      border-bottom: 1px solid #eee;
      margin: 0;
      padding: 10px;
      color: inherit;
    }

    .el-drawer__body {
      padding: 10px;
    }
  }

  /* 抽屉默认插槽里的列布局：正文滚动、底部动作区钉底。
     .el-drawer__body 是 flex:1 + overflow:auto，所以这里用 height:100% 接住它的高度。 */
  ::v-deep(.es-drawer-layout) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    .dialog_body_layouts {
      flex: 1;
      min-height: 0;
    }
  }

  /* drawer 的底部动作区（Element UI 没有 footer 槽，我们自己放进默认插槽）：
     对齐 el-dialog__footer 的右对齐，并加一条上边线与正文分开。 */
  ::v-deep(.es-drawer-footer) {
    flex: none;
    text-align: right;
    padding-top: 10px;
    border-top: 1px solid #eee;
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
