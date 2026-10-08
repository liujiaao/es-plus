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

/**
 * 三端 formtype 的**行为层**契约（单源）。
 *
 * FORM_RENDER_CONTRACT 只回答「这个 formtype 绑到了哪个组件」。但 C 系列缺陷全都满足
 * 「键在、组件对、编译过、门禁全绿」，却让配置静默失效 —— 组件绑对了，**行为没接通**：
 *   - Upload：三端都绑了 ElUpload/el-upload/a-upload，但 vue3/antdv 的 `model[prop]`
 *     从未被写入（连 fileList 都没绑）—— 上传完表单提交上去是空的，零报错；
 *   - Transfer：vue3 绑了 ElTransfer 却从未消费 `dataOptions` —— 穿梭框两侧永远是空的。
 * 两者都是「绑定正确」之外的另一条边，只查组件名在结构上看不见。
 *
 * 形态：`{ [formtype]: { [behaviorId]: { why, tokens, deviation? } } }`
 *   - `tokens[renderer]`：该端**在该 formtype 的渲染分支窗口内**必须出现的全部 token
 *     （组内 AND：少一个就没接通）。token 沿用 FORM_RENDER_CONTRACT 的匹配规则
 *     （含 `-` 或全小写按带引号字符串匹配，否则按标识符单词边界）。
 *   - `deviation[renderer]`：该端在这一维度上是有意的差异实现，**必须写明原因**
 *     （与 FORM_RENDER_CONTRACT 的 deviation 同一套规则与检查）。
 *
 * 加一条行为的门槛：它必须能区分「接通了」和「没接通」两种实现。像 `setNestedValue`
 * 这种全分支都在的 token，只有放在**该 formtype 的分支窗口里**才有意义 —— 窗口外出现
 * 多少次都不算数（extractBranchWindows 天然保证了这一点）。
 */
export const FORM_BEHAVIOR_CONTRACT = {
  Upload: {
    // 读侧：把 model 里的文件列表交给组件。缺了它，组件自己的列表永远是空的。
    // 两个 token 都要：`getNestedValue` 钉住「列表来自 model」，`fileList` 钉住「交到了组件手上」。
    // 只写 `fileList` 不够 —— 一个同名的局部变量就能满足它，而 model 根本没被读过
    // （写这个契约时踩过：把 Transfer 的 token 写成裸 `dataOptions`，注入
    //  `const dataOptions = undefined` 依然全绿）。
    'bind-fileList': {
      why:
        '组件必须拿到 model 里的文件列表作为初值，否则回显为空；' +
        'vue3/antdv 此前连 fileList 都没绑（Vue 里传 undefined 还会让 ElUpload 首屏 .find() 抛错）',
      tokens: {
        vue3: ['getNestedValue', 'fileList'],
        vue2: ['getNestedValue', 'fileList'],
        antdv: ['getNestedValue', 'fileList'],
      },
    },
    // 写侧：把列表写回 model。缺了它，上传成功但 model[prop] 仍是初始值。
    'writeback-to-model': {
      why:
        '上传/失败/删除三个生命周期都必须把最新列表写回 model，否则表单提交的是空值且不报错；' +
        '三端入口不同（vue3 接管 onSuccess/onError/onRemove + update:fileList，' +
        'antdv 只有内部 onUpdate:fileList，vue2 走 :file-list + 三个回调），' +
        '但最终都必须落到 setNestedValue 写 model',
      tokens: { vue3: ['setNestedValue'], vue2: ['setNestedValue'], antdv: ['setNestedValue'] },
    },
  },
  Transfer: {
    // 数据源：三端都必须把 dataOptions 喂给穿梭框，否则两侧是空的。
    // token 用 `row.dataOptions`（取值点）而不是裸 `dataOptions` —— 后者是个局部变量名就能满足。
    'consume-dataOptions': {
      why:
        'dataOptions 是 es-plus 的标准选项字段，三端都必须把它映射成穿梭框的数据源；' +
        'vue3 此前只传了 modelValue 与透传袋，dataOptions 完全没消费 —— 两侧永远为空、零报错',
      tokens: {
        vue3: ['row.dataOptions'],
        vue2: ['row.dataOptions'],
        antdv: ['row.dataOptions'],
      },
    },
  },
}

