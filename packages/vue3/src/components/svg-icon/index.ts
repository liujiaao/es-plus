import SvgIcon from './src/svg-icon.vue'

SvgIcon.install = function (app: any) {
  app.component(SvgIcon.name, SvgIcon)
}

export default SvgIcon