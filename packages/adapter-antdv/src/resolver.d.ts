export interface EsPlusResolverOptions {
  /** 样式导入方式：默认 'css' */
  styleSuffix?: 'css' | 'less'
  /**
   * 是否自动注入 ant-design-vue 基础样式
   * @default false
   */
  importAntdStyles?: boolean
}

export declare function EsPlusResolver(options?: EsPlusResolverOptions): {
  type: 'component'
  resolve(name: string): { name: string; from: string; sideEffects: string[] } | undefined
}

export default EsPlusResolver
