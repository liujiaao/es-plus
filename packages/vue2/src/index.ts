/**
 * @es-plus/vue2 主入口
 *
 * 与 Vue 3 版本（packages/es-plus）的关键差异：
 *   1. install 签名为 (Vue: typeof Vue, options) 而非 (app: App, options)
 *   2. 全局组件注册：Vue.component(name, comp) 而非 app.component(name, comp)
 *   3. 全局属性注入：Vue.prototype.$xxx 而非 app.config.globalProperties
 *   4. 跨组件依赖注入：通过 Vue.mixin 全局 provide，而非 app.provide
 *
 * 用户使用方式（在 main.js / main.ts 中）：
 *
 *   ┌─ Vue 2.7+ ───────────────────────────────────┐
 *   │ import Vue from 'vue'                          │
 *   │ import ElementUI from 'element-ui'             │
 *   │ import 'element-ui/lib/theme-chalk/index.css'  │
 *   │ import EsPlus from '@es-plus/vue2'             │
 *   │                                                │
 *   │ Vue.use(ElementUI)                             │
 *   │ Vue.use(EsPlus, { permission: (v) => true })   │
 *   └────────────────────────────────────────────────┘
 *
 *   ┌─ Vue 2.6 ─────────────────────────────────────┐
 *   │ import Vue from 'vue'                          │
 *   │ import VueCompositionAPI from '@vue/composition-api' │
 *   │ import ElementUI from 'element-ui'             │
 *   │ import EsPlus from '@es-plus/vue2'             │
 *   │                                                │
 *   │ Vue.use(VueCompositionAPI)                     │
 *   │ Vue.use(ElementUI)                             │
 *   │ Vue.use(EsPlus)                                │
 *   └────────────────────────────────────────────────┘
 *
 * 配置示例：
 *   Vue.use(EsPlus, {
 *     permission: (value) => userPermissions.includes(value),
 *     componentSize: 'small',
 *     skipComponentRegistration: false, // true 时跳过组件全局注册（按需导入场景）
 *     globalProperties: true,           // false 时跳过 Vue.prototype.$useDialog 注入
 *   })
 */

import { configureEsPlus } from '@es-plus/core'
import type { Vue as VueType } from './vue-compat'

import EsForm from './components/es-form'
import EsTable from './components/es-table'
import EsDialog, { useDialog } from './components/es-dialog'
import EsCrudPage from './components/es-crud-page'

// 组件清单（用于全局注册）
const components = [EsForm, EsTable, EsDialog, EsCrudPage]

interface InstallOptions extends Record<string, unknown> {
  /** 是否跳过组件的全局注册（按需导入场景下置为 true） */
  skipComponentRegistration?: boolean
  /** 是否跳过 Vue.prototype 上的全局属性注入（默认 true 注入） */
  globalProperties?: boolean
}

/**
 * Vue 2 插件安装函数
 *
 * 与 Vue 3 版本的安装逻辑保持语义一致：
 *   - 写入模块级单例（configureEsPlus），让 composable 内部能读到全局配置
 *   - 全局注册组件（除非 skipComponentRegistration: true）
 *   - 注入全局属性（Vue.prototype.$useDialog）
 *   - 通过 Vue.mixin 实现 provide('$EsPlus') 全局可注入
 */
/**
 * 兼容垫片：把旧 es-eui 的 options 形状归一化为 @es-plus/vue2 期望的扁平形状
 *
 * 旧 es-eui 形状：
 *   { EsTable: { methods: { $httpRequest, paginationLayout, configQueryfieldOutput } },
 *     EsForm:  { methods: { $httpRequest, fieldFieldOutput } } }
 *
 * @es-plus/vue2 形状：
 *   { EsTable: { $httpRequest, paginationLayout, configQueryFieldOutput },
 *     EsForm:  { $httpRequest, fieldFieldOutput } }
 *
 * 差异处理：
 *   1. 把 .methods 子对象展平到上一层
 *   2. 把 configQueryfieldOutput（小写 f）改名为 configQueryFieldOutput（大写 F）
 *
 * 这样原 es-eui 的 main.js 中 `Vue.use(esEui, { EsTable: { methods: { ... } } })`
 * 配置可以一字不改地切换到 `Vue.use(EsPlus, { ... })`。
 */
const normalizeLegacyOptions = (options: InstallOptions): InstallOptions => {
  const out: Record<string, unknown> = { ...options }
  for (const key of ['EsTable', 'EsForm', 'EsDialog']) {
    const sub = out[key] as Record<string, unknown> | undefined
    if (!sub || typeof sub !== 'object') continue
    const methods = (sub as Record<string, unknown>).methods as
      | Record<string, unknown>
      | undefined
    if (methods && typeof methods === 'object') {
      // 展平 methods 到 sub 上（不覆盖已有同名键）
      const { methods: _drop, ...rest } = sub as Record<string, unknown>
      out[key] = { ...methods, ...rest }
    }
    // 重命名 configQueryfieldOutput → configQueryFieldOutput
    const flat = out[key] as Record<string, unknown>
    if (
      typeof flat.configQueryfieldOutput === 'function' &&
      typeof flat.configQueryFieldOutput !== 'function'
    ) {
      flat.configQueryFieldOutput = flat.configQueryfieldOutput
    }
  }
  return out as InstallOptions
}

const install = (Vue: typeof VueType, options: InstallOptions = {}) => {
  // 兼容旧 es-eui options 形状（methods 嵌套 + 字段名差异）
  const normalized = normalizeLegacyOptions(options)

  // 写入全局配置单例（permission / 默认 size 等）
  configureEsPlus(normalized as any)

  // 全局注册所有组件
  if (!normalized.skipComponentRegistration) {
    components.forEach((component) => {
      const compName = (component as unknown as { name?: string }).name
      if (compName) {
        Vue.component(compName, component as any)
      }
    })
  }

  if (normalized.globalProperties !== false) {
    // 编程式弹窗挂到 Vue.prototype 上，方便 Options API 通过 this.$useDialog() 调用
    ;(Vue as unknown as { prototype: Record<string, unknown> }).prototype.$useDialog = useDialog
  }

  /**
   * Vue 2 没有 app.provide()，但可以通过 Vue.mixin 在每个组件实例上注入 provide：
   *   Vue.mixin({ provide: { $EsPlus: { ... } } })
   *
   * 注意：此处的 provide 在 Vue 2 中是函数还是对象都可以。
   * 内部组件通过 inject('$EsPlus') 即可拿到（与 Vue 3 版本 API 完全一致）。
   */
  Vue.mixin({
    provide: {
      $EsPlus: {
        useDialog,
        ...normalized,
      },
    },
  })
}

// ─── 命名导出 ───
export {
  EsForm,
  EsTable,
  EsDialog,
  EsCrudPage,
  useDialog,
  configureEsPlus,
  install,
}

// ─── 类型导出（与 Vue 3 版本保持完全一致的类型契约） ───
export type {
  CrudPageSchema,
  CrudAction,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  RowBtnContext,
  CrudDialogConfig,
  DialogRenderContext,
  DialogBtnConfig,
  DialogActionContext,
} from './components/es-crud-page'

export type {
  ModelData,
  RenderFn,
  AnyVNode,
  EsButtonType,
  EsButtonSize,
  EsTableSize,
  ApiParams,
  FormType,
  FormItemOption,
  BtnConfig,
  LayoutFormProps,
  TableColumn,
  ConfigTableOut,
  TableOptions,
  PaginationConfig,
  DialogOptions,
  EsFormInstance,
  EsTableInstance,
  EsPlusOptions,
} from './types'

// ─── 默认导出（带 install 的对象，可直接 Vue.use()） ───
export default {
  version: '0.9.0',
  install,
}
