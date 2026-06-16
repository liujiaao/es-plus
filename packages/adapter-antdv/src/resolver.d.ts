export interface EsPlusResolverOptions {
  styleSuffix?: 'css' | 'less'
}

export function EsPlusResolver(options?: EsPlusResolverOptions): {
  type: 'component'
  resolve(name: string): {
    name: string
    from: string
    sideEffects: string[]
  } | undefined
}
