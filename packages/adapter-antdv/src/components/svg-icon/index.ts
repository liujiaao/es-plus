import SvgIcon from './src/svg-icon.vue'

SvgIcon.install = (app: any) => {
  app.component(SvgIcon.name || 'SvgIcon', SvgIcon)
}

export { SvgIcon }
export default SvgIcon
