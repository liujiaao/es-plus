import EsDialog from './src/component.vue'

/* istanbul ignore next */
EsDialog.install = function (Vue, options) {
  Vue.component(EsDialog.name, EsDialog)
}

export default EsDialog
