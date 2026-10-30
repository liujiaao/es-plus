/**
 * 全局配置管理
 *
 * 通过单例模块变量保存 es-plus 的全局配置（permission/t/httpRequest 等），
 * 由 Vue 2 / Vue 3 各自的 install 函数在 use(EsPlus, options) 时调用 configureEsPlus 写入。
 *
 * 设计原则：
 * 1. 不依赖 Vue —— 单例对象由模块作用域闭包保管，跨框架共享
 * 2. 使用浅合并而非深合并，避免覆盖用户在新一次 use 时的显式 undefined
 * 3. getGlobalConfig 返回 readonly 引用，调用方不应直接修改其内容
 *
 * 提取自 packages/vue3/src/config.ts (1.3.5)，行为完全一致。
 */

/** 全局 HTTP 请求函数签名（AI 生成代码与用户配置共同遵守的调用契约） */
export type HttpRequestFn = (params: Record<string, unknown>) => Promise<unknown>

/**
 * 全局配置接口
 *
 * 各组件可从这里读取默认值并与组件自身 props 合并。例如 EsTable 的默认 size 可在此声明。
 */
export interface EsPlusGlobalConfig {
  /** EsTable 组件档全局配置（见 `EsTableGlobalConfig`） */
  EsTable?: EsTableGlobalConfig
  /**
   * EsForm 组件档全局配置（见 `EsFormGlobalConfig`）
   *
   * 其中 `rules`（`{ 字段路径: 规则数组 }`）会作为 **form 级校验规则**的兜底，
   * 与组件 `props.rules` 按字段名浅合并：组件给了某字段就用组件的，否则用全局的。
   * form-item 级规则仍优先于 form 级（底层组件自身的合并语义）。
   */
  EsForm?: EsFormGlobalConfig
  /**
   * EsDialog 组件档。**当前没有消费点**：弹窗配置是每次 `useDialog(opts)` 的实参，
   * 没有「实例 props」可兜底，因此本档也**不提供 `defaults`**。保留键位是为了让
   * 三端 install 的 options 形状一致，以及给后续「弹窗默认值」留位置。
   */
  EsDialog?: Record<string, unknown>
  /** 权限校验函数（按钮 permissionValue → boolean），不配置则视为全部放行 */
  permission?: (value: string) => boolean
  /** i18n 翻译函数（labelKey → text），不配置则降级使用 label */
  t?: (key: string) => string
  /** 全局 HTTP 请求函数（组件级 httpRequest 优先于此） */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /** 允许任意扩展键（业务方可通过这里塞入主题色、企业元信息等） */
  [key: string]: unknown
}

/**
 * 惰性配置值：字面量，或「取时求值」的工厂函数。
 *
 * 为什么允许函数：有些值依赖运行时（当前语言、登录角色）。但绝大多数场景就是一个
 * 字面量 —— 历史 API 只认函数，逼得用户写 `paginationLayout: () => ({ ... })`，
 * 既噪音又误导（看着像能被调用多次）。两种形态等价，读取方统一走
 * `resolveConfigProvider`。
 */
export type ConfigProvider<T> = T | (() => T)

/** 取时解包 `ConfigProvider`；undefined 原样返回。 */
export function resolveConfigProvider<T>(value: ConfigProvider<T> | undefined): T | undefined {
  if (value === undefined) return undefined
  return typeof value === 'function' ? (value as () => T)() : value
}

/** 分页器外观（`paginationLayout` 的返回值形状） */
export interface EsTablePaginationLayout {
  layout?: string
  pageSizes?: number[]
  isSmall?: boolean
  /** 只认这一路：`PaginationConfig` 里没有 background 键 */
  background?: boolean
  prevText?: string
  nextText?: string
  [key: string]: unknown
}

/** 字段映射表（`{ 内部键: 后端键 }`，值一律是字符串路径） */
export type FieldOutputMap = Record<string, string>

/**
 * 字段映射配置的两种写法：字面量映射表，或 `(默认映射) => 映射表`。
 *
 * 字面量形态历史上被**静默忽略**（读取点只认函数），配了等于没配；现在两种等价。
 */
export type FieldOutputProvider =
  | FieldOutputMap
  | ((defaults: FieldOutputMap) => FieldOutputMap)

/**
 * 把字段映射配置归一成「注入函数」形态 —— 三端表格 / 表单只有这一个出口。
 *
 * 对象形态**叠加在默认映射之上**（对象里写到的键覆盖默认值，没写到的沿用默认），
 * 于是部分键也能生效：`configQueryFieldOutput: { tableData: 'list' }` 只换列表键，
 * 其余三个键保持默认。函数形态原样返回（历史写法，返回值仍会走完整性校验）。
 */
export function resolveFieldOutputProvider(
  value: FieldOutputProvider | undefined
): ((defaults: FieldOutputMap) => FieldOutputMap) | undefined {
  if (!value) return undefined
  if (typeof value === 'function') return value
  if (typeof value === 'object') {
    const map = value as FieldOutputMap
    return (defaults) => ({ ...defaults, ...map })
  }
  return undefined
}

/**
 * `EsTable` 组件档全局配置。
 *
 * 所有键都可以写在 `{ EsTable: { ... } }` 里，也兼容早期 `{ EsTable: { methods: { ... } } }`
 * 的嵌套写法（`configureEsPlus` 在**写入时**展平，见 `normalizeSectionConfig`）。
 * `$httpRequest` / `configQueryfieldOutput` 这类历史键名同样在写入时归一成下面的
 * 无 `$` 规范名，旧读法仍然有效。
 */
export interface EsTableGlobalConfig {
  /** 表格请求函数；等价于顶层 `httpRequest`，但只作用于表格 */
  httpRequest?: HttpRequestFn
  /** 分页器外观：字面量或工厂 */
  paginationLayout?: ConfigProvider<EsTablePaginationLayout>
  /**
   * 响应字段映射：字面量或工厂（见 `FieldOutputProvider`）
   *
   * 字面量形态历史上被静默忽略（读取点只认函数），现在两种都认。
   */
  configQueryFieldOutput?: FieldOutputProvider
  /**
   * 每张表的 `options` 默认值（浅合并，实例 `:options` 优先）。
   *
   * 例：`{ defaults: { size: 'small', border: true } }` —— 之前只能逐表重复写。
   */
  defaults?: Record<string, unknown>
  /** 允许任意扩展键（业务方自用） */
  [key: string]: unknown
}

/** `EsForm` 组件档全局配置 */
export interface EsFormGlobalConfig {
  httpRequest?: HttpRequestFn
  /** 字段映射（远端下拉等），字面量或工厂（见 `FieldOutputProvider`） */
  fieldFieldOutput?: FieldOutputProvider
  /** form 级校验规则兜底：组件 `props.rules` 按字段名浅合并覆盖 */
  rules?: Record<string, unknown>
  /**
   * 每个表单的 `layoutFormProps` 默认值（浅合并，实例 prop 优先）。
   *
   * 例：`{ defaults: { labelWidth: '96px', size: 'small' } }`
   */
  defaults?: Record<string, unknown>
  [key: string]: unknown
}

/** 有「实例配置对象」可兜底的组件档 ——— `defaults` 只对它们有意义 */
type DefaultsSectionKey = 'EsTable' | 'EsForm'

const SECTION_KEYS = ['EsTable', 'EsForm', 'EsDialog'] as const

/**
 * 把一个组件档归一成**唯一形状**：
 *
 *   1. 展平 `methods: { ... }`（es-eui 时代的嵌套写法），methods 内的键优先；
 *   2. 剥掉 `$` 前缀补出规范名（`$httpRequest` → `httpRequest`），原键保留；
 *   3. `configQueryfieldOutput` → `configQueryFieldOutput`（历史上的大小写笔误）。
 *
 * 归一发生在**写入时**（`configureEsPlus`），因此所有读点只面对一种形状 ——
 * 此前是 vue2 一份 `normalizeLegacyOptions`、core 的 `resolveHttpRequest` 走三路键位、
 * `resolveComponentConfig` 再展平一次，同一个概念三处兼容，任一处漏了就是一类 bug。
 */
export function normalizeSectionConfig(section: unknown): Record<string, unknown> | undefined {
  if (!section || typeof section !== 'object') return undefined
  const src = section as Record<string, unknown>
  const methods =
    src.methods && typeof src.methods === 'object'
      ? (src.methods as Record<string, unknown>)
      : undefined
  const out: Record<string, unknown> = methods ? { ...src, ...methods } : { ...src }
  for (const [key, value] of Object.entries({ ...out })) {
    if (!key.startsWith('$')) continue
    const bare = key.slice(1)
    // 显式给的规范名优先，别被 `$` 版覆盖
    if (out[bare] === undefined) out[bare] = value
  }
  if (out.configQueryfieldOutput !== undefined && out.configQueryFieldOutput === undefined) {
    out.configQueryFieldOutput = out.configQueryfieldOutput
  }
  // 保留原 methods 对象：旧代码读 `cfg.methods.x` 不受影响
  if (methods) out.methods = methods
  return out
}

/** 归一整个 options（三个组件档各走一遍）。install 与 configureEsPlus 共用。 */
export function normalizeEsPlusOptions(
  options: EsPlusGlobalConfig = {}
): EsPlusGlobalConfig {
  const out: EsPlusGlobalConfig = { ...options }
  for (const key of SECTION_KEYS) {
    const normalized = normalizeSectionConfig(out[key])
    if (normalized) out[key] = normalized
  }
  return out
}

/**
 * 模块作用域单例 —— 整个应用生命周期内唯一
 *
 * 注意：此模式在 SSR 多实例环境（如多租户 server-side）下会发生串扰，
 * 当前 1.x 版本不针对此场景特殊处理。
 */
let globalConfig: EsPlusGlobalConfig = {}

/**
 * 写入/合并全局配置
 *
 * 采用浅合并（top-level Object spread），子级 EsTable/EsForm 等会被整体覆盖，
 * 与原 1.3.5 版本行为保持一致。如需保留旧子级配置，调用方应自行展开。
 *
 * 写入前先归一（展平 methods / 剥 `$` / 改名），于是**单例里永远只有一种形状**。
 */
export function configureEsPlus(options: EsPlusGlobalConfig): void {
  globalConfig = { ...globalConfig, ...normalizeEsPlusOptions(options) }
}

/**
 * 读取全局配置（直接引用，请勿原地修改）
 */
export function getGlobalConfig(): EsPlusGlobalConfig {
  return globalConfig
}

/**
 * 重置全局配置（主要供测试使用）
 *
 * 业务代码不应调用此函数 —— 一旦重置，已经从 getGlobalConfig 取过引用的代码
 * 会读到旧值，造成不一致。
 */
export function resetGlobalConfig(): void {
  globalConfig = {}
}

/**
 * 构造 `provide('$EsPlus', ...)` 用的「读时回落」视图。
 *
 * 背景：三端 install() 直接用 `{ useDialog, ...options }` 做快照 provide，而组件内部一律是
 * `inject('$EsPlus', null) ?? getGlobalConfig() ?? {}`。由于 provide 出去的对象**永远非空**，
 * 第二条分支成了死代码 —— 于是 `install` 之后再调用 `configureEsPlus({ permission })`
 * 完全改不动组件行为（Permission 示例里切角色不生效就是这个原因）。
 *
 * 这里用 Proxy 把「options 里没有的键」在**读取时**回落到模块级单例，
 * 让 `configureEsPlus()` 与 `app.use(EsPlus, options)` 两种写法真正等价（docs/usage.md 的承诺）。
 * 显式传入的值仍然优先；值为 undefined 时视为未提供，继续回落。
 */
export function createGlobalConfigView(extras: Record<string, unknown> = {}): Record<string, unknown> {
  const own = { ...extras }
  const globalOf = () => globalConfig as Record<string, unknown>
  return new Proxy(own, {
    get(target, key, receiver) {
      const local = Reflect.get(target, key, receiver)
      if (local !== undefined) return local
      if (typeof key === 'symbol') return undefined
      return globalOf()[key]
    },
    has(target, key) {
      if (Reflect.has(target, key)) return true
      return typeof key === 'string' && globalOf()[key] !== undefined
    },
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...Object.keys(globalOf())])]
    },
    getOwnPropertyDescriptor(target, key) {
      const d = Reflect.getOwnPropertyDescriptor(target, key)
      if (d) return d
      if (typeof key !== 'string') return undefined
      const v = globalOf()[key]
      if (v === undefined) return undefined
      // configurable 必须为 true：ownKeys 多报的键若不可配置会违反 Proxy 不变量
      return { value: v, enumerable: true, configurable: true, writable: false }
    },
  })
}

/**
 * 构造组件档的 `provide('$esPlusTable' / '$esPlusForm', ...)` 视图。
 *
 * 与 `createGlobalConfigView` 同一个思路，但回落源是**单例里的那一节**：
 * `install` 期间 `configureEsPlus(options)` 已经把（归一过的）options 写进单例，
 * 因此 provide 只需给一个「读时透传」的壳：
 *
 *   · `app.use(EsPlus, { EsTable: {...} })` → install 写入单例 → 视图读得到；
 *   · 之后 `configureEsPlus({ EsTable: {...} })` → 改的是单例 → 视图同样读得到。
 *
 * 这修掉了旧快照 `provide('$esPlusTable', { ...options.methods })` 的安装顺序缺陷：
 * install 之后再 configureEsPlus 对 EsTable/EsForm 无效（旧值被快照住）。
 */
export function createComponentConfigView(
  key: 'EsTable' | 'EsForm' | 'EsDialog',
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  const own = { ...extras }
  const sectionOf = () => {
    const sub = globalConfig[key]
    return sub && typeof sub === 'object' ? (sub as Record<string, unknown>) : {}
  }
  return new Proxy(own, {
    get(target, prop, receiver) {
      const local = Reflect.get(target, prop, receiver)
      if (local !== undefined) return local
      if (typeof prop === 'symbol') return undefined
      return sectionOf()[prop]
    },
    has(target, prop) {
      if (Reflect.has(target, prop)) return true
      return typeof prop === 'string' && sectionOf()[prop] !== undefined
    },
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...Object.keys(sectionOf())])]
    },
    getOwnPropertyDescriptor(target, prop) {
      const d = Reflect.getOwnPropertyDescriptor(target, prop)
      if (d) return d
      if (typeof prop !== 'string') return undefined
      const v = sectionOf()[prop]
      if (v === undefined) return undefined
      return { value: v, enumerable: true, configurable: true, writable: false }
    },
  })
}

/**
 * 取某个组件档的 `defaults`（实例配置的兜底值）。
 *
 * 语义：**组件实例显式给的键优先**，`defaults` 只补缺。合并只做一层浅合并 ——
 * 与 `configureEsPlus` 的浅合并策略一致，避免深层结构被意外拼接。
 *
 * 无 `defaults` 时返回 `undefined`（而非 `{}`），让调用方可以保持实例对象的**同一引用**，
 * 避免每次渲染都造新对象触发子组件 `watch`/`deep` 比较。
 */
export function resolveComponentDefaults(
  cfg: EsPlusGlobalConfig | null | undefined,
  key: DefaultsSectionKey
): Record<string, unknown> | undefined {
  const section = resolveComponentConfig(cfg, key)
  const defaults = section.defaults
  return defaults && typeof defaults === 'object' ? (defaults as Record<string, unknown>) : undefined
}

/**
 * 把 `defaults` 合并进实例配置（实例优先）；无 defaults 时原样返回实例对象引用。
 *
 * 泛型只为保住**实例配置的类型**：返回值在无 defaults 时就是实例对象本身，
 * 有 defaults 时是浅合并后的新对象（键集合可能多于实例，故断言回 T）。
 */
export function mergeComponentDefaults<T extends Record<string, unknown>>(
  defaults: Record<string, unknown> | undefined,
  instance: T | undefined
): T {
  if (!defaults) return (instance || ({} as T)) as T
  return { ...defaults, ...(instance || {}) } as T
}

/**
 * 表单布局配置的两层合并：`layoutFormProps` 本身浅合并，**并且** `formLayProps`
 * （真正承载 labelWidth / minFoldRows / btnColSpan 的那一层）再合并一次。
 *
 * 为什么不能只做一层：所有有用的键都在 `formLayProps` 里，实例只要给了一个键
 * （例如 `{ formLayProps: { labelPosition: 'top' } }`），一层合并就会把全局默认的
 * `labelWidth` 整块挤掉 —— 这正是「默认值只在部分场景生效」的来源。
 */
export function mergeLayoutFormProps(
  defaults: Record<string, unknown> | undefined,
  instance: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(defaults || {}), ...(instance || {}) }
  const defaultInner = (defaults?.formLayProps ?? defaults?.fromLayProps) as
    | Record<string, unknown>
    | undefined
  const instanceInner = (instance?.formLayProps ?? instance?.fromLayProps) as
    | Record<string, unknown>
    | undefined
  if (defaultInner || instanceInner) out.formLayProps = { ...(defaultInner || {}), ...(instanceInner || {}) }
  return out
}

/**
 * 取某个组件档（`EsTable` / `EsForm` / `EsDialog`）的全局配置，并把 `methods` 展平。
 *
 * **读侧兜底，不是主路径。** 归一只在写入时做一次（`normalizeEsPlusOptions`，
 * `configureEsPlus` 与三端 `install` 都经过它），所以单例里、以及
 * `createComponentConfigView()` provide 出去的视图里都已经是扁平形状 ——
 * 对本函数而言输入已展平、调用是幂等的。
 *
 * 保留它的两个理由：
 *   1. 宿主可能不经 `configureEsPlus` 直接 `app.provide('$esPlusTable', {...})`，
 *      组件回落到单例之外时仍要能读到 `methods` 里的键；
 *   2. 新旧版本混装（宿主升级了 vue3 但另一个包还是旧版）时写入未归一，
 *      读侧还有一次机会。
 *
 * 展平时 `methods` 里的键**覆盖**同级平键；`methods` 本身保留在结果里，
 * 旧代码读 `cfg.methods.x` 也不受影响。
 */
export function resolveComponentConfig(
  cfg: EsPlusGlobalConfig | null | undefined,
  key: 'EsTable' | 'EsForm' | 'EsDialog'
): Record<string, unknown> {
  const sub = cfg?.[key]
  if (!sub || typeof sub !== 'object') return {}
  const flat = sub as Record<string, unknown>
  const methods = flat.methods
  if (!methods || typeof methods !== 'object') return flat
  return { ...flat, ...(methods as Record<string, unknown>) }
}

/**
 * 从全局配置中解析出用户配置的 HTTP 请求函数。
 *
 * 权威键是**顶层** `httpRequest`（`app.use(EsPlus, { httpRequest })` /
 * `configureEsPlus({ httpRequest })`）。写入归一已经把 `EsTable` / `EsForm` 档下的
 * `$httpRequest`、`methods.$httpRequest` 一并补出规范名 `httpRequest`，故下面这层
 * 三路兜底对已归一的配置是幂等的 —— 它存在只为两种边缘输入：宿主手写 provide、
 * 或新旧版本混装导致单例里还是未归一的形状。
 *
 * 导出给渲染层复用：EsForm 的字段级远端取数此前只读 `$esPlusForm.$httpRequest`，
 * 完全看不到顶层 `httpRequest` —— 而顶层才是 core 的权威字段，也是未配置时错误提示里
 * 推荐给用户的写法。于是「按文档配了顶层 httpRequest」的应用里，EsForm 的远端下拉
 * 取不到请求函数（表现为挂起），EsTable 却一切正常。渲染层统一回落到这里，
 * 键位约定只需维护这一份。
 */
export function resolveHttpRequest(cfg: EsPlusGlobalConfig): HttpRequestFn | null {
  if (typeof cfg.httpRequest === 'function') return cfg.httpRequest as HttpRequestFn
  for (const key of ['EsTable', 'EsForm'] as const) {
    const sub = resolveComponentConfig(cfg, key)
    // 规范化之后的权威键；`$httpRequest` 与 `methods.$httpRequest` 是历史写法
    const candidates = [sub.httpRequest, sub.$httpRequest]
    const methods = sub.methods as Record<string, unknown> | undefined
    if (methods) candidates.push(methods.httpRequest, methods.$httpRequest)
    for (const fn of candidates) {
      if (typeof fn === 'function') return fn as HttpRequestFn
    }
  }
  return null
}

/**
 * 全局 HTTP 请求自由函数（配置驱动 / 多端同构 / AI 原生）。
 *
 * 供 AI + mcp-server 生成的 CRUD 包装代码直接
 *   `import { httpRequest } from '@es-plus/vue3'`（或 '@es-plus/vue2' / '@es-plus/adapter-antdv'）
 * 后调用，而无需在组件 provide/inject 树内取用。它解析 install 时写入模块单例的全局 HTTP 客户端，
 * 因此与 EsTable / EsForm 内部使用的是同一个请求实例（单一实例，避免重复配置）。
 *
 * @param params 传给用户配置的 HTTP 请求函数的参数对象（如 { url, method, params, data }）
 * @throws 若未通过 configureEsPlus / app.use(EsPlus, { httpRequest }) 配置，抛出明确错误，
 *         而非静默返回 undefined —— 便于在开发期立刻定位「忘记配置全局请求函数」。
 */
export function httpRequest(params: Record<string, unknown>): Promise<unknown> {
  const fn = resolveHttpRequest(getGlobalConfig())
  if (!fn) {
    throw new Error(
      '[es-plus] 全局 httpRequest 未配置。请在应用入口配置全局请求函数，例如：\n' +
        '  app.use(EsPlus, { httpRequest: (params) => axios(params) })\n' +
        '  // 或（兼容旧约定）app.use(EsPlus, { EsTable: { methods: { $httpRequest } } })\n' +
        'AI 生成的 CRUD 代码依赖该全局请求函数完成列表查询与增删改查。',
    )
  }
  return fn(params)
}
