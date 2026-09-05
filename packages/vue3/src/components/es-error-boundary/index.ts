import EsErrorBoundary from './src/es-error-boundary.vue'

EsErrorBoundary.install = function (app: any) {
  app.component(EsErrorBoundary.name, EsErrorBoundary)
}

export default EsErrorBoundary
