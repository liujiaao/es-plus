import EsTable from './src/component.vue'

EsTable.install = (app: any) => {
  app.component(EsTable.name || 'EsTable', EsTable)
}

export { EsTable }
export default EsTable
