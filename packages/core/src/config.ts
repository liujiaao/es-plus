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
 * 提取自 packages/es-plus/src/config.ts (1.3.5)，行为完全一致。
 */

/**
 * 全局配置接口
 *
 * 各组件可从这里读取默认值并与组件自身 props 合并。例如 EsTable 的默认 size 可在此声明。
 */
export interface EsPlusGlobalConfig {
  /** EsTable 全局默认 props（合并优先级低于组件实例 props） */
  EsTable?: Record<string, unknown>
  /** EsForm 全局默认 props */
  EsForm?: Record<string, unknown>
  /** EsDialog 全局默认 props */
  EsDialog?: Record<string, unknown>
  /** 权限校验函数（按钮 permissionValue → boolean），不配置则视为全部放行 */
  permission?: (value: string) => boolean
  /** i18n 翻译函数（labelKey/nameKey → text），不配置则降级使用 label/name */
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
