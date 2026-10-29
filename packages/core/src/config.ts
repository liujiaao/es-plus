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

/**
 * 全局配置接口
 *
 * 各组件可从这里读取默认值并与组件自身 props 合并。例如 EsTable 的默认 size 可在此声明。
 */
export interface EsPlusGlobalConfig {
  /** EsTable 全局默认 props（合并优先级低于组件实例 props） */
  EsTable?: Record<string, unknown>
  /**
   * EsForm 全局默认 props
   *
   * 其中 `rules`（`{ 字段路径: 规则数组 }`）会作为 **form 级校验规则**的兜底，
   * 与组件 `props.rules` 按字段名浅合并：组件给了某字段就用组件的，否则用全局的。
   * form-item 级规则仍优先于 form 级（底层组件自身的合并语义）。
   */
  EsForm?: Record<string, unknown>
  /** EsDialog 全局默认 props */
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
 * @param options 新的配置项
 */
export function configureEsPlus(options: EsPlusGlobalConfig): void {
  globalConfig = { ...globalConfig, ...options }
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

/** 全局 HTTP 请求函数签名（AI 生成代码与用户配置共同遵守的调用契约） */
export type HttpRequestFn = (params: Record<string, unknown>) => Promise<unknown>

/**
 * 取某个组件档（`EsTable` / `EsForm` / `EsDialog`）的全局配置，并把 `methods` 展平。
 *
 * 为什么需要这个函数：两条安装路径写进单例/注入的形状**不一样**。
 *
 *   · `app.use(EsPlus, { EsTable: { methods } })` —— `install()` 里
 *     `app.use(EsTable.Plugin, options.EsTable)`，Plugin 只把 `options.methods`
 *     `provide` 出来，于是组件 `inject('$esPlusTable')` 拿到的是**平的**
 *     `{ $httpRequest, configQueryFieldOutput, paginationLayout }`。
 *   · `configureEsPlus({ EsTable: { methods } })` —— 没有插件、没有 provide，组件回落到
 *     单例，读到的是**原样**的 `{ methods: {...} }`。
 *
 * 组件内部的读取点一律是平键（`$esPlusTable.configQueryFieldOutput` /
 * `$esPlusTable.paginationLayout` / `$esPlusForm.fieldFieldOutput`），于是第二条路径下
 * 这几个键全是 undefined —— docs/usage.md 的「模式二：configureEsPlus」整段示例
 * （字段映射、分页布局）配了等于没配。`$httpRequest` 因为另有 `resolveHttpRequest`
 * 兜底所以看不出问题，缺陷因此被掩盖。
 *
 * 展平时 `methods` 里的键**覆盖**同级平键（与 `resolveHttpRequest` 的 nested 优先
 * 一致）；`methods` 本身保留在结果里，旧代码读 `cfg.methods.x` 也不受影响。
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
 * 兼容三端 install 写入单例后的三种键位约定：
 *   1. 顶层 `httpRequest` —— core 权威字段（app.use(EsPlus, { httpRequest })）
 *   2. `EsTable/EsForm.methods.$httpRequest` —— vue3 / adapter-antdv 原样透传的 options.methods
 *   3. `EsTable/EsForm.$httpRequest` —— vue2 normalizeLegacyOptions 展平 methods 之后
 *
 * 导出给渲染层复用：EsForm 的字段级远端取数此前只读 `$esPlusForm.$httpRequest`
 * （等价于第 2/3 条），完全看不到顶层 `httpRequest` —— 而顶层才是 core 的权威字段，
 * 也是未配置时错误提示里推荐给用户的写法。于是「按文档配了顶层 httpRequest」的应用里，
 * EsForm 的远端下拉取不到请求函数（表现为挂起），EsTable 却一切正常。
 * 渲染层统一回落到这里，三种键位约定只需维护这一份。
 */
export function resolveHttpRequest(cfg: EsPlusGlobalConfig): HttpRequestFn | null {
  if (typeof cfg.httpRequest === 'function') return cfg.httpRequest as HttpRequestFn
  for (const key of ['EsTable', 'EsForm'] as const) {
    const sub = cfg[key] as Record<string, unknown> | undefined
    if (!sub || typeof sub !== 'object') continue
    const methods = sub.methods as Record<string, unknown> | undefined
    const nested = methods && typeof methods.$httpRequest === 'function' ? methods.$httpRequest : undefined
    const flat = typeof sub.$httpRequest === 'function' ? sub.$httpRequest : undefined
    const fn = nested || flat
    if (typeof fn === 'function') return fn as HttpRequestFn
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
