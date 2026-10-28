---
title: 'EsForm 高级表单'
route: '/components/es-form'
canonical: 'https://liujiaao.github.io/es-plus/components/es-form/'
source: 'es-plus-docs/src/views/component-doc.data.ts'
type: 'component'
---

# EsForm 高级表单

> 基于 Element Plus 的增强型表单组件，支持配置化、联动化、抽象化设计，让表单开发更高效。

## 能力

- **配置化** —— 通过 JSON 配置生成表单，无需编写模板
- **联动化** —— 支持字段间联动，自动响应数据变化
- **抽象化** —— 封装常用表单逻辑，简化开发流程
- **自适应** —— 支持响应式布局，自动折叠展开

## 示例

- 最简表单 —— 三个字段、零事件代码：formItemList 声明字段即得完整表单。
- 14 种表单控件一览 —— Input / InputNumber / Select / DatePicker / TimePicker / Slider / ColorPicker / Transfer / Cascader / Radio / Checkbox / Switch / Rate / Upload —— 全部来自 formItemList，没有一行手写控件。
- 布局与折叠 —— 24 栅格布局 + 自动折叠展开，支持响应式自适应。
- 条件联动表单 —— 模型驱动字段显隐。这里是「回调」对照写法：声明式解法（reactions + JSON 表达式，0 个函数）见下方『报销单：零回调联动』。
- 报销单：零回调联动 —— 省 → 市 → 门店三级下拉；选了城市才要求发票号；大区自动等于省份且锁定；金额 > 5000 才要求说明；非部分退款时隐藏退款原因 —— 全部来自一份纯 JSON（reactions + JSON 表达式），示例里 0 个函数。
- 运行期增删表单项 —— 运行时动态增删表单项，支持数组类型表单与动态验证。
- 校验：rules + 自定义 validator —— 集成 Element Plus 验证体系，支持 rules、pattern、自定义 validator。
- 异步数据表单 —— apiParams 自动加载下拉选项 + on.change 驱动级联联动；不依赖请求的级联可用纯声明式写（见『报销单：零回调联动』）。
- 自定义渲染表单 —— render 函数扩展能力，支持 Upload、Transfer、Slider、ColorPicker 等复杂组件。
- 弹窗内嵌表单 —— 在弹窗中使用 EsForm，展示表单与弹窗的无缝集成。
- 日期时间范围 —— 完整覆盖日期、时间、日期时间范围选择场景。
- 级联选择器 —— 使用 Cascader 组件实现多级联动选择。
- 高级按钮区 —— direction: left/right 把按钮分到两端：导出居左，查询/重置居右，无需手写布局；查询真的过滤下方结果集，导出是真的 CSV 文件。
- 图片上传 —— 支持 picture-card 多图上传、自定义 httpRequest、预览删除等完整上传功能。
- 文件上传 —— 图片 / PDF / TXT 在线预览，Office 文档与压缩包下载，自定义文件列表渲染与操作按钮。
- 偏好设置 —— Radio、Checkbox、Switch、Slider、ColorPicker、Rate 六种选择类控件的纯配置化写法。
- 联动计算 —— on.change + on.input 实现商品选择→自动填充单价→数量折扣→实时计算总价；其中「回写」这一步可改用 reactions.fulfill.value 纯声明式完成（见『报销单：零回调联动』）。
- 自定义按钮区 —— renderBtn 完全自定义按钮区域，支持异步提交、保存草稿、确认弹窗等交互。
- 详情模式 —— 编辑/详情双模式切换：详情模式禁用所有字段并隐藏按钮，编辑模式恢复可交互。
- 组合搜索 —— isHidden 条件显隐 + apiParams 异步选项 + 更多/收起，完整搜索表单模式。

## API

### props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| model | Object | {} | 表单数据对象（必填，v-model 绑定） |
| formItemList | FormItemOption[] | [] | 表单项配置数组（必填，见 FormItemOption 表） |
| layoutFormProps | LayoutFormProps | {} | 布局配置（见 LayoutFormProps 表） |
| configBtn | BtnConfig[] | [] | 按钮配置（见 BtnConfig 表） |
| renderBtn | Function \| boolean | false | 自定义按钮渲染函数，返回 VNode |
| btnColSpanRow | boolean | true | 按钮区域是否独占一行（左右分栏布局） |
| rules | Object | {} | 验证规则（Element Plus 格式） |
| fieldFieldOutput | Function | - | API 响应字段映射函数，(defaults) => FieldMap |

### FormItemOption

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| prop | string | - | 字段名（必填） |
| label | string | - | 标签文本（必填） |
| formtype | string | - | 控件类型（14 种）：Input / InputNumber / Select / DatePicker / TimePicker / Slider / ColorPicker / Transfer / Cascader / Radio / Checkbox / Switch / Rate / Upload。旧写法 datePicker / timePicker 仍兼容 |
| span | number | 6 | 栅格占位（24 列布局） |
| attrs | Object | - | 透传给 Element Plus 组件的属性（placeholder、clearable 等） |
| on | Object | - | 事件监听，如 { change: (val) => {} } |
| dataOptions | Array<{label, value}> | - | 选项数据（Select/Radio/Checkbox/Cascader） |
| isHidden | Function \| 声明式条件 | - | 条件隐藏：函数 (model, item, formProps) => boolean；也可写 JSON 表达式（如 { "!=": [{ var: "type" }, "a"] }）或 { field, op, value } 条件数组 |
| reactions | FieldReaction[] | - | 声明式字段联动（纯 JSON，无需回调）：fulfill 可给 dataOptions / required / disabled / value；value 必须配 dependencies |
| required | boolean | - | 必填快捷字段（可被 reactions.fulfill.required 动态覆盖） |
| disabled | boolean | - | 禁用快捷字段，自动注入 attrs（可被 reactions.fulfill.disabled 动态覆盖） |
| render | Function | - | 自定义渲染，(h, model, ctx) => VNode |
| apiParams | ApiParams | - | 远程选项数据配置 { url, method, model, headers } |
| httpRequest | Function | - | 自定义请求方法（覆盖全局配置） |
| isInitRun | boolean | true | 是否在初始化时自动加载接口数据 |
| callOptionListFormat | Function | - | (data) => [{ label, value }]，转换 API 响应 |
| listenToCallBack | Object | - | 回调映射，crtn 用于选项格式转换 |
| formItemOptions | Object | - | el-form-item 附加属性（rules、labelWidth 等） |
| width | number \| string | - | 字段宽度 |

### LayoutFormProps

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| rowLayProps | Object | - | 行级别属性（透传给 el-row） |
| rowLayProps.gutter | number | 20 | 栅格间距 |
| formLayProps | Object | - | 表单本体配置（推荐写法） |
| formLayProps.labelWidth | string \| number | - | 标签宽度，如 "100px" |
| formLayProps.size | string | - | 控件尺寸：large / default / small |
| formLayProps.minFoldRows | number | 0 | 折叠时显示的行数，0 不折叠 |
| formLayProps.isBtnHidden | boolean | false | 是否隐藏内置按钮区域 |
| formLayProps.btnColSpan | number | - | 按钮所在列的 span |
| formLayProps.labelBtnWidth | string \| number | - | 按钮区标签宽度 |
| fromLayProps | Object | - | 旧拼写（键同 formLayProps），仅为兼容保留，新代码请改用 formLayProps |
| setOptions | boolean | - | 是否启用设置下拉 |

### BtnConfig

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| name | string | - | 按钮文本 |
| key | string | - | 按钮唯一标识（query/reset 触发联动） |
| type | string | - | 按钮类型：primary/success/warning/danger/info |
| icon | string | - | 图标名称（Element Plus Icons） |
| direction | string | - | 位置：left / right |
| disabled | boolean \| Function | - | 禁用状态，支持函数形式 |
| click | Function | - | (model, formRef, httpRequestInstance) => void |
| triggerEvent | boolean | - | true 时自动触发表格查询/表单重置 |

### events

> EsForm 不派发事件：查询与重置由按钮的 triggerEvent 在组件内部完成，宿主拿到的是 v-model 的 model 与 configBtn[].click 回调。

### methods

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| validate | - | 校验整个表单，返回 Promise<boolean> |
| resetFields | - | 重置所有字段 |
| clearValidate | (props?) | 清除校验状态 |
| validateField | (props) | 校验指定字段 |
| scrollToField | (prop) | 滚动到指定字段位置 |
| formItmeRequestInstance | (propsList) | 手动触发指定字段的 API 数据加载 |
| getFormRef | - | 获取底层 ElForm 实例 |


## 主题（CSS 变量）

> EsForm 不定义自己的 CSS 变量：标签、控件、错误文案全部由 Element Plus 渲染，换肤就是覆盖 --el-* ——改 --el-color-primary 会同时改主按钮与聚焦边框；深色站点必须覆盖 --el-fill-color-blank，否则输入框是白底白字。

继承：Element Plus

## 可访问性

- 字段标签由 el-form-item 渲染成 label[for] 与控件 id 关联：读屏能念出「字段名 + 控件类型」，鼠标点标签也能聚焦到控件（证据：`packages/vue3/src/components/es-form/src/es-form.vue` 含 `el-form-item`）
- 按钮区（configBtn / renderBtn）渲染成 el-button —— 原生 <button>，Tab 可达、Enter / Space 触发，禁用态落到 disabled 属性上而不只是改颜色（证据：`packages/vue3/src/components/es-form/src/es-form.vue` 含 `el-button`）
- 边界：字段级自定义 render 输出的节点，可访问性由宿主负责 —— 组件只保证外层 form-item 的标签关联，不会替你给 render 出来的任意控件补 label（证据：`packages/vue3/src/components/es-form/src/es-form.vue` 含 `render`）

## 相关

- **es-table**（/components/es-table）—— 查询区就是 es-form 嵌进 es-table：按钮 key=query/rest + triggerEvent 自动联动，整页没有 handleSearch
- **es-crud-page**（/components/es-crud-page）—— 整页 CRUD 时不必手写这两者：一份 schema 同时派生出查询表单、表格与弹窗表单

## 版本

| 端 | 首个包含本组件的版本 |
| --- | --- |
| vue3 | 1.4.0 |
| vue2 | 0.9.0 |
| antdv | 1.0.0 |
