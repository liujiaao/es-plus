import svgIcon from './src/svgIcn.vue'

svgIcon.install = function (Vue) {
  Vue.component(svgIcon.name, svgIcon)
}
export default svgIcon
