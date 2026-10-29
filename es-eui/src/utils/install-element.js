/**
 * 站点（含 `@es-plus/vue2` 的模板）用到的 Element UI 组件 —— **只有这些会被打进产物**。
 *
 * 这里曾经是 `Vue.use(ElementUI, { size: 'mini' })`（全量注册 80 个组件 + 三个服务）。
 * Element UI 2.x 的主入口是 `lib/element-ui.common.js`（CommonJS，216 KB gz），
 * 它既不能 tree-shake，又会被 `import { Message } from 'element-ui'` 这类具名导入
 * 整个装进包 —— 所以「注册方式」和「怎么 import 服务」是同一笔账的两半，
 * 只改一半等于没改。两半的做法都是走 `element-ui/lib/<kebab>` 子路径模块。
 *
 * 失败模式和主站的 Element Plus 一样：**页面看起来正常、某个组件突然不渲染**，
 * 而且常常只在一个页面上少一个空格/一条分割线。所以清单不能靠人维护：
 * `npm run check:bundle-sources` 会把三处的标签并集与这张表对账 ——
 *   ① 站点全部 .vue 模板与 script 里的 JSX；
 *   ② `@es-plus/vue2` 的模板（es-form / es-table / es-dialog 里直接写 `<el-form>` 等，
 *      靠的是全局注册 —— 只登记站点自己的标签，这些会整块消失）；
 *   ③ `@es-plus/vue2` 用 `h('el-xxx', …)` 按名字取的控件（use-form-inputs.ts 里
 *      Cascader / ColorPicker / Slider / Transfer / Upload / TimePicker 都在这条路上）。
 *
 * 每个 `lib/<kebab>.js` 的默认导出都带 `install(Vue)`（内部 `Vue.component(name, comp)`），
 * 所以这里只列组件、不写名字 —— 名字由库自己给，写错了反而更难查。
 */
import ElAlert from 'element-ui/lib/alert'
import ElAvatar from 'element-ui/lib/avatar'
import ElButton from 'element-ui/lib/button'
import ElCard from 'element-ui/lib/card'
import ElCascader from 'element-ui/lib/cascader'
import ElCheckbox from 'element-ui/lib/checkbox'
import ElCheckboxGroup from 'element-ui/lib/checkbox-group'
import ElCol from 'element-ui/lib/col'
import ElColorPicker from 'element-ui/lib/color-picker'
import ElDatePicker from 'element-ui/lib/date-picker'
import ElDescriptions from 'element-ui/lib/descriptions'
import ElDescriptionsItem from 'element-ui/lib/descriptions-item'
import ElDialog from 'element-ui/lib/dialog'
import ElDivider from 'element-ui/lib/divider'
import ElDrawer from 'element-ui/lib/drawer'
import ElDropdown from 'element-ui/lib/dropdown'
import ElDropdownItem from 'element-ui/lib/dropdown-item'
import ElDropdownMenu from 'element-ui/lib/dropdown-menu'
import ElForm from 'element-ui/lib/form'
import ElFormItem from 'element-ui/lib/form-item'
import ElIcon from 'element-ui/lib/icon'
import ElInput from 'element-ui/lib/input'
import ElInputNumber from 'element-ui/lib/input-number'
import ElOption from 'element-ui/lib/option'
import ElPagination from 'element-ui/lib/pagination'
import ElProgress from 'element-ui/lib/progress'
import ElRadio from 'element-ui/lib/radio'
import ElRadioButton from 'element-ui/lib/radio-button'
import ElRadioGroup from 'element-ui/lib/radio-group'
import ElRate from 'element-ui/lib/rate'
import ElRow from 'element-ui/lib/row'
import ElSelect from 'element-ui/lib/select'
import ElSlider from 'element-ui/lib/slider'
import ElStep from 'element-ui/lib/step'
import ElSteps from 'element-ui/lib/steps'
import ElSwitch from 'element-ui/lib/switch'
import ElTabPane from 'element-ui/lib/tab-pane'
import ElTable from 'element-ui/lib/table'
import ElTableColumn from 'element-ui/lib/table-column'
import ElTabs from 'element-ui/lib/tabs'
import ElTag from 'element-ui/lib/tag'
import ElTimePicker from 'element-ui/lib/time-picker'
import ElTransfer from 'element-ui/lib/transfer'
import ElUpload from 'element-ui/lib/upload'
import Message from 'element-ui/lib/message'
import MessageBox from 'element-ui/lib/message-box'
import Notification from 'element-ui/lib/notification'
import Loading from 'element-ui/lib/loading'

/** 组件清单：守卫按这里的**导出名**与标签对账（`ElDropdownItem` ↔ `<el-dropdown-item>`） */
export const ELEMENT_UI_COMPONENTS = [
  ElAlert,
  ElAvatar,
  ElButton,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElColorPicker,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElPagination,
  ElProgress,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElRate,
  ElRow,
  ElSelect,
  ElSlider,
  ElStep,
  ElSteps,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElTimePicker,
  ElTransfer,
  ElUpload,
]

/**
 * 等价于 `Vue.use(ElementUI, { size: 'mini' })` 里真正会生效的那部分。
 *
 * 三处必须逐字对齐主入口（`element-ui/src/index.js` 的 install）：
 *   · `$ELEMENT.size` —— 全站的控件尺寸；漏了它，所有组件回落到默认 `medium`，
 *     页面不会报错，只是每张表、每个输入框都变高了一档；
 *   · `v-loading` 指令 —— 它与 `$loading` 服务是同一个模块的两个出口，`Vue.use(Loading)`
 *     一次给全；
 *   · 原型上的六个服务方法 —— 站点里 `this.$message` / `this.$confirm` 用得最多，
 *     少了它们不是「样式不对」，是运行时 `this.$message is not a function`。
 *
 * 没做的两件事：`locale.use()`（不传参保持默认 zh-CN，与主入口等价）与
 * `InfiniteScroll`（全站没有 `v-infinite-scroll`，它会让整个滚动指令模块进包）。
 */
export function installElement(Vue) {
  ELEMENT_UI_COMPONENTS.forEach((component) => Vue.use(component))

  Vue.use(Loading)

  Vue.prototype.$ELEMENT = { size: 'mini', zIndex: 2000 }
  Vue.prototype.$message = Message
  Vue.prototype.$notify = Notification
  Vue.prototype.$msgbox = MessageBox
  Vue.prototype.$alert = MessageBox.alert
  Vue.prototype.$confirm = MessageBox.confirm
  Vue.prototype.$prompt = MessageBox.prompt
}

export default installElement
