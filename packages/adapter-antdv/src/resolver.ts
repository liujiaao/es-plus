/**
 * Ant Design Vue 自动导入解析器
 *
 * 用于 unplugin-vue-components，自动解析 EsTable/EsForm/EsDialog/EsCrudPage/SvgIcon
 * 的导入路径，同时注入 es-plus 样式。
 *
 * ADV 样式管理：
 * - ADV 组件样式通过 ant-design-vue 的按需加载或全量引入管理
 * - es-plus 自身只有少量覆盖样式（style.css）
 * - 因此 sideEffects 只需注入 es-plus 的 style.css
 *
 * 使用方式：
 *   // vite.config.ts
 *   import { EsPlusResolver } from '@es-plus/adapter-antdv/resolver'
 *   import Components from 'unplugin-vue-components/vite'
 *
 *   Components({
 *     resolvers: [EsPlusResolver()]
 *   })
 */
const ES_PLUS_COMPONENTS: Record<string, string> = {
  EsTable: '@es-plus/adapter-antdv',
  EsForm: '@es-plus/adapter-antdv',
  EsDialog: '@es-plus/adapter-antdv',
  EsCrudPage: '@es-plus/adapter-antdv',
  SvgIcon: '@es-plus/adapter-antdv',
}

export interface EsPlusResolverOptions {
  /** 样式导入方式：默认 'css' */
  styleSuffix?: 'css'
}

export function EsPlusResolver(options: EsPlusResolverOptions = {}) {
  return {
    type: 'component' as const,

    resolve(name: string) {
      if (ES_PLUS_COMPONENTS[name]) {
        return {
          name,
          from: ES_PLUS_COMPONENTS[name],
          sideEffects: [
            `@es-plus/adapter-antdv/dist/style.css`,
          ],
        }
      }
    },
  }
}
