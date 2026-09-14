/**
 * 三端 formtype → 渲染组件 的**行为层契约**（单源）
 *
 * check-renderer-parity.mjs 用它把「键集一致」升级为「键指向的组件语义一致」：
 * 每个 formtype 在每个渲染器里必须真的绑到声明中的组件（或已登记的降级实现），
 * 从而挡住「键还在、但实现被换成别的控件」这类现有门禁抓不到的分叉
 * （例如把 `'DatePicker': ElDatePicker` 误改成 `'TimePicker'`）。
 *
 * token 形态：
 *   - 标识符（如 `ElInput` / `InputComp`）按单词边界匹配
 *   - 含 `-` 或原生标签名（如 `el-input` / `input`）按带引号字符串匹配
 *   - antdv 的 DatePicker/TimePicker 经渲染函数间接实现，token 声明为函数名
 *
 * deviation：该端为有意的降级/差异实现，必须写明原因（文档化强制）。
 */
export const FORM_RENDER_CONTRACT = {
  Input: { vue3: ['ElInput'], vue2: ['el-input'], antdv: ['InputComp', 'Input'] },
  InputNumber: { vue3: ['ElInputNumber'], vue2: ['el-input-number'], antdv: ['InputNumber'] },
  Select: { vue3: ['ElSelect'], vue2: ['el-select'], antdv: ['Select'] },
  DatePicker: { vue3: ['ElDatePicker'], vue2: ['el-date-picker'], antdv: ['renderDatePicker'] },
  TimePicker: { vue3: ['ElTimePicker'], vue2: ['el-time-picker'], antdv: ['renderTimePicker'] },
  Slider: { vue3: ['ElSlider'], vue2: ['el-slider'], antdv: ['Slider'] },
  ColorPicker: {
    vue3: ['ElColorPicker'],
    vue2: ['el-color-picker'],
    antdv: ['input'],
    deviation: {
      antdv: 'Ant Design Vue 无 ColorPicker，降级为原生 <input type="color">（丢失 alpha/predefine/history，且不触发 a-form-item 校验）',
    },
  },
  Transfer: { vue3: ['ElTransfer'], vue2: ['el-transfer'], antdv: ['Transfer'] },
  Cascader: { vue3: ['ElCascader'], vue2: ['el-cascader'], antdv: ['Cascader'] },
  Radio: { vue3: ['ElRadioGroup'], vue2: ['el-radio-group'], antdv: ['RadioGroup'] },
  Checkbox: { vue3: ['ElCheckboxGroup'], vue2: ['el-checkbox-group'], antdv: ['CheckboxGroup'] },
  Switch: { vue3: ['ElSwitch'], vue2: ['el-switch'], antdv: ['Switch'] },
  Rate: { vue3: ['ElRate'], vue2: ['el-rate'], antdv: ['Rate'] },
  Upload: { vue3: ['ElUpload'], vue2: ['el-upload'], antdv: ['Upload'] },
}
