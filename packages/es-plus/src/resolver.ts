/**
 * EsPlusResolver for unplugin-vue-components
 *
 * 解决 es-plus 内部使用 Element Plus 组件但 ElementPlusResolver
 * 无法扫描到第三方预编译包的样式注入问题。
 *
 * @example
 * ```ts
 * import Components from 'unplugin-vue-components/vite'
 * import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
 * import { EsPlusResolver } from 'es-plus-ui/resolver'
 *
 * export default defineConfig({
 *   plugins: [
 *     Components({
 *       resolvers: [ElementPlusResolver(), EsPlusResolver()]
 *     })
 *   ]
 * })
 * ```
 */

export interface EsPlusResolverOptions {
  /**
   * 是否自动注入 es-plus 内部依赖的 Element Plus 组件样式
   * @default true
   */
  importElementStyles?: boolean

  /**
   * Element Plus 样式导入方式
   * - 'css': 导入编译后的 CSS (element-plus/es/components/xxx/style/css)
   * - 'sass': 导入 SASS 源文件 (element-plus/es/components/xxx/style/index)
   * @default 'css'
   */
  importStyle?: 'css' | 'sass'
}

// es-plus 内部使用的所有 Element Plus 组件（按 kebab-case）
const EP_INTERNAL_DEPS = [
  'config-provider',
  'form',
  'form-item',
  'input',
  'select',
  'option',
  'button',
  'row',
  'col',
  'table',
  'table-column',
  'pagination',
  'dialog',
  'icon',
  'tag',
  'dropdown',
  'dropdown-menu',
  'dropdown-item',
  'date-picker',
  'time-picker',
  'cascader',
  'radio',
  'radio-group',
  'checkbox',
  'checkbox-group',
  'switch',
  'slider',
  'rate',
  'color-picker',
  'transfer',
  'upload',
  'loading',
  'message',
  'message-box',
  'breadcrumb',
  'breadcrumb-item',
]

// es-plus 组件名 → 模块路径映射
const ES_PLUS_COMPONENTS: Record<string, string> = {
  EsTable: 'es-plus-ui',
  EsForm: 'es-plus-ui',
  EsDialog: 'es-plus-ui',
  EsCrudPage: 'es-plus-ui',
  SvgIcon: 'es-plus-ui',
}

function getSideEffects(options: EsPlusResolverOptions): string[] {
  const effects: string[] = ['es-plus-ui/dist/style.css']

  if (options.importElementStyles !== false) {
    const stylePath = options.importStyle === 'sass' ? 'style/index' : 'style/css'
    for (const comp of EP_INTERNAL_DEPS) {
      effects.push(`element-plus/es/components/${comp}/${stylePath}`)
    }
  }

  return effects
}

export function EsPlusResolver(options: EsPlusResolverOptions = {}) {
  let sideEffects: string[] | undefined

  return {
    type: 'component' as const,
    resolve(name: string) {
      if (name in ES_PLUS_COMPONENTS) {
        if (!sideEffects) {
          sideEffects = getSideEffects(options)
        }
        return {
          name,
          from: ES_PLUS_COMPONENTS[name],
          sideEffects,
        }
      }
    },
  }
}

export default EsPlusResolver
