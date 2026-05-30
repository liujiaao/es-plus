export interface EsPlusResolverOptions {
  /**
   * 是否自动注入 es-plus 内部依赖的 Element Plus 组件样式
   * @default true
   */
  importElementStyles?: boolean
  /**
   * Element Plus 样式导入方式
   * - 'css': 导入编译后的 CSS
   * - 'sass': 导入 SASS 源文件
   * @default 'css'
   */
  importStyle?: 'css' | 'sass'
}

export declare function EsPlusResolver(options?: EsPlusResolverOptions): {
  type: 'component'
  resolve(name: string): {
    name: string
    from: string
    sideEffects: string[]
  } | undefined
}

export default EsPlusResolver
