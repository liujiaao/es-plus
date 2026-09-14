/**
 * 站点展示版本号的单一来源。
 *
 * 直接读取 monorepo 内各包的 package.json，避免文档首页 / 顶栏里硬编码的版本号
 * 随发布过期（历史上 adapter 标 1.0.0、core 标 1.0.1，实际都已到 1.1.0）。
 */
import adapterPkg from '../../../packages/adapter-antdv/package.json'
import corePkg from '../../../packages/core/package.json'

export const ADAPTER_ANTDV_VERSION = adapterPkg.version
export const CORE_VERSION = corePkg.version
