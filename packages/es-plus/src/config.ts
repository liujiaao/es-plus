export interface EsPlusGlobalConfig {
  EsTable?: Record<string, unknown>
  EsForm?: Record<string, unknown>
  EsDialog?: Record<string, unknown>
  permission?: (value: string) => boolean
  t?: (key: string) => string
  [key: string]: unknown
}

let globalConfig: EsPlusGlobalConfig = {}

export function configureEsPlus(options: EsPlusGlobalConfig): void {
  globalConfig = { ...globalConfig, ...options }
}

export function getGlobalConfig(): EsPlusGlobalConfig {
  return globalConfig
}
