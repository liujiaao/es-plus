import EsErrorBoundary from './src/es-error-boundary.vue'

;(EsErrorBoundary as any).install = (app: any) => {
  app.component((EsErrorBoundary as any).name || 'EsErrorBoundary', EsErrorBoundary)
}

export { EsErrorBoundary }
export default EsErrorBoundary
