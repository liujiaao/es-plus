/**
 * 全局配置单例 (ADV 适配器版本)
 *
 * 与 @es-plus/vue3 的 config.ts 逻辑一致，直接复用 @es-plus/core 的单例。
 * 这里提供一个 ADV 专用的便捷访问入口。
 */
export { getGlobalConfig, configureEsPlus, resetGlobalConfig } from '@es-plus/core'
export type { EsPlusGlobalConfig } from '@es-plus/core'
