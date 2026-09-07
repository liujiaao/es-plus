# ES-EUI 组件库开发文档

## 目录

- [概述](#概述)
- [安装与配置](#安装与配置)
- [组件总览](#组件总览)
- [EsTable 表格组件](#estable-表格组件)
- [EsForm 表单组件](#esform-表单组件)
- [EsDialog 弹窗组件](#esdialog-弹窗组件)
- [useDialog 函数式弹窗](#usedialog-函数式弹窗)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [综合评价与市场对比](#综合评价与市场对比分析)
- [在线文档访问地址:https://liujiaao.github.io/es-eui/](https://liujiaao.github.io/es-eui/)
---

## 概述

ES-EUI 是基于 Element UI 二次封装的企业级中后台组件库，提供了表格、表单、弹窗等常用组件的增强功能，支持配置化开发，大幅提升开发效率。

### 核心特性

- **配置化开发**：通过 JSON 配置即可生成复杂的表格和表单
- **数据驱动**：自动处理数据请求、分页、排序等逻辑
- **高度可定制**：支持插槽、自定义渲染、事件回调等扩展方式
- **内置功能丰富**：支持拖拽、全屏、缓存、批量操作等高级功能
- **表单表格联动**：内置表单与表格的深度集成

---

## 安装与配置

### 1. 全局引入组件库（推荐）

```javascript
// main.js
import Vue from 'vue'
import http from '@/assets/common/server/request.js' // 导入封装好的axios请求模块
import ESEUI from 'es-eui'
import 'es-eui/dist/es-eui.css'

Vue.use(ESEUI, {
  // EsTable 组件配置
  EsTable: {
    methods: {
      // 配置 HTTP 请求方法（必填）
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          baseURL: '',
          url,
          contentType: 'application/json',
          method: options?.method || 'POST',
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return http(opt)
      },
      // 配置分页布局（可选）
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: false
      }),
      // 配置表格响应字段映射（可选）
      configQueryfieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        }
      }
    }
  },
  // EsForm 组件配置
  EsForm: {
    methods: {
      // 配置 HTTP 请求方法（必填）
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          baseURL: '',
          url,
          contentType: 'application/json',
          method: options.method || 'POST',
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return http(opt)
      },
      // 配置表单值列表响应字段映射（可选）
      fieldFieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          listData: 'data'
        }
      }
    }
  }
})
```

### 2. 按需引入

如果只需要使用部分组件，可以在单个页面中按需引入：

```javascript
import { EsTable, EsForm, useDialog } from 'es-eui'
import 'es-eui/dist/es-eui.css'
export default {
  components: { EsTable, EsForm },
  data() {
    return {
      // 需要在组件 options 中配置 httpRequest 方法
      tableOptions: {
        httpRequest: (params) => {
          const { url, formParams, headers, ...options } = params
          return axios.post(url, formParams)
        }
      }
    }
  },
  methods: {
    handleOpenDialog() {
      const dialog = useDialog()
      dialog({
        title: '弹窗标题',
        render: (h) => <MyComponent />
      })
    }
  }
}
```

### 3. 配置说明

| 配置项 | 说明 | 必填 |
|--------|------|------|
| `EsTable.methods.$httpRequest` | 表格数据请求方法 | 是 |
| `EsTable.methods.paginationLayout` | 分页布局配置 | 否 |
| `EsTable.methods.configQueryfieldOutput` | 表格响应字段映射 | 否 |
| `EsForm.methods.$httpRequest` | 表单数据请求方法 | 是 |
| `EsForm.methods.fieldFieldOutput` | 表单值列表响应字段映射 | 否 |

---

## 组件总览

| 组件名 | 说明 | 核心功能 |
|--------|------|----------|
| EsTable | 增强表格 | 分页、排序、筛选、批量操作、自定义列、自动请求 |
| EsForm | 增强表单 | 配置化表单、动态验证、布局控制、联动效果 |
| EsDialog | 增强弹窗 | 拖拽、全屏、置顶、自定义按钮、垂直居中 |
| useDialog | 函数式弹窗 | 命令式调用、状态管理、缓存控制、组件渲染 |
| svgIcon | SVG图标 | 支持自定义SVG图标组件 |

---

## EsTable 表格组件

### 基础用法

```vue
<template>
  <es-table
    :data-source.sync="dataSource"
    :columns="basicColumns"
    :pagination="paginationConfig"
    :options="tableOptions"
  />
</template>

<script>
export default {
  data() {
    return {
      dataSource: [],
      basicColumns: [
        { key: 'id', label: '编号', fixed: 'left' },
        { key: 'name', label: '名称' },
        { key: 'status', label: '状态' }
      ],
      paginationConfig: {
        pageIndex: 1,
        pageSize: 10,
        total: 0
      },
      tableOptions: {
        border: true,
        tabHeight: 500,
        size: 'mini',
        heightType: 'height'
      }
    }
  }
}
</script>
```

### Props 配置

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| dataSource | Array | [] | 表格数据源（支持 .sync 修饰符） |
| columns | Array | [] | 列配置数组 |
| pagination | Object | {} | 分页配置 |
| options | Object | {} | 表格选项配置 |
| configBtn | Array | [] | 表格按钮配置 |
| showHeaderBar | Boolean | true | 是否显示头部栏 |
| headBarClass | String/Object | '' | 头部栏样式类 |

### Columns 列配置

```javascript
{
  key: 'status',              // 字段名
  label: '状态',              // 列标题
  width: 120,                 // 列宽度
  fixed: 'left',              // 固定列：left/right
  align: 'center',            // 对齐方式
  render: (h, { row, index, instance }) => {   // 自定义渲染
    return <el-tag type={row.status === '1' ? 'success' : 'info'}>{row.status}</el-tag>
  }
}
```

#### 列配置属性详解

| 属性名 | 类型 | 说明 |
|--------|------|------|
| key | String | 数据字段名 |
| label | String | 列标题 |
| width | Number/String | 列宽度 |
| minWidth | Number/String | 最小列宽度 |
| fixed | String | 固定列，可选 'left'/'right' |
| align | String | 对齐方式，默认 'center' |
| render | Function | 自定义渲染函数 (h, { row, index, instance }) => VNode |
| scopedSlots | Object | 插槽配置，如 { customRender: 'slotName' } |
| groups | Array | 多级表头配置 |
| hidCol | Boolean | 是否隐藏该列 |

### 高级表格配置（options）

```javascript
tableOptions: {
  // 基础配置
  border: true,                 // 是否显示边框
  size: 'mini',                 // 表格尺寸：mini/small/medium
  tabHeight: 500,               // 表格高度
  heightType: 'height',         // 高度类型：height/max-height
  highlightCurrentRow: true,    // 高亮当前行
  headerCellStyle: { background: '#f5f7fa' }, // 表头样式
  
  // 数据请求配置
  isInitRun: true,              // 初始化时自动请求数据
  apiParams: {
    url: '/api/list',           // 请求地址
    method: 'post',             // 请求方法
    model: {},                  // 额外请求参数
    headers: {},                // 请求头
    options: {}                 // 其他选项
  },
  
  // 响应字段映射
  configTableOut: {
    total: 'total',             // 总数字段
    pageSize: 'pageSize',       // 页数字段
    current: 'pageIndex',       // 页码字段
    tableData: 'data'           // 数据字段
  },
  
  // 生命周期钩子
  listenToCallBack: {
    brcb: (params) => {         // 请求前回调（Before Request CallBack）
      // 格式化请求参数
      return { ...params, timestamp: Date.now() }
    },
    qrcb: (res) => {            // 请求后回调（Query Result CallBack）
      console.log('查询结果:', res)
    }
  },
  
  // 自定义请求方法
  httpRequest: (params) => {
    const { url, formParams, headers, ...options } = params
    return axios.post(url, formParams)
  },
  
  // 选择相关
  cachePageSelection: true,     // 缓存分页选择数据
  rowkey: 'id'                  // 行唯一标识（用于选择缓存去重）
}
```

### 表格方法

通过 `ref` 引用调用：

```javascript
// 刷新表格数据
this.$refs.tableRef.httpRquestInstace({ ...params })

// 切换行选择状态
this.$refs.tableRef.toggleSelection(rows)

// 清空选择
this.$refs.tableRef.clearAllSelection()

// 获取表格实例
this.$refs.tableRef.refsInstance()

// Element UI Table 的所有方法（继承）
this.$refs.tableRef.clearSelection()
this.$refs.tableRef.toggleRowSelection(row, selected)
this.$refs.tableRef.toggleAllSelection()
```

### 表格事件

```vue
<es-table
  @selection-change="handleSelectionChange"
  @sort-change="handleSortChange"
  @pagination-current-change="handleCurrentChange"
  @size-change="handleSizeChange"
/>
```

### 表格插槽

```vue
<es-table :columns="columns" :options="options">
  <!-- 顶部工具栏插槽 -->
  <es-form :form-item-list="FormConfig" :model="formData" />
  
  <!-- 自定义列插槽 -->
  <template #customColumn="{ row, column, index }">
    <span>{{ row.name }}</span>
  </template>
</es-table>
```

### 操作列示例

```javascript
{
  key: 'action',
  label: '操作',
  width: 200,
  fixed: 'right',
  render: (h, { row, index, instance }) => {
    return (
      <div class="action-buttons">
        <el-button size="mini" type="text" on-click={() => this.handleEdit(row)}>
          编辑
        </el-button>
        <el-button size="mini" type="text" on-click={() => this.handleDelete(row, instance)}>
          删除
        </el-button>
      </div>
    )
  }
}
```

### 多级表头配置

```javascript
{
  label: '基本信息',
  groups: [
    { key: 'name', label: '姓名' },
    { key: 'age', label: '年龄' },
    {
      label: '地址',
      groups: [
        { key: 'province', label: '省份' },
        { key: 'city', label: '城市' }
      ]
    }
  ]
}
```

---

## EsForm 表单组件

### 基础用法

```vue
<template>
  <es-form
    ref="policyform"
    :form-item-list="FormConfig"
    :model="formData"
    :layout-form-props="layoutProps"
    :config-btn="btnList"
  />
</template>

<script>
export default {
  data() {
    return {
      FormConfig: [
        {
          prop: 'username',
          label: '用户名',
          span: 8,
          formtype: 'Input',
          formItemOptions: {
            labelWidth: '100px',
            rules: [
              { required: true, message: '请输入用户名', trigger: 'blur' }
            ]
          },
          attrs: {
            placeholder: '请输入用户名',
            clearable: true
          }
        }
      ],
      formData: {
        username: ''
      },
      layoutProps: {
        fromLayProps: {
          labelWidth: '100px',
          size: 'small',
          minfoldRows: 1          // 折叠行数
        },
        rowLayProps: {
          gutter: 20
        }
      },
      btnList: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true }
      ]
    }
  }
}
</script>
```

### Props 配置

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| formItemList | Array | [] | 表单项配置数组 |
| model | Object | {} | 表单数据对象 |
| layoutFormProps | Object | {} | 布局配置 |
| configBtn | Array | [] | 按钮配置 |
| renderBtn | Function/Boolean | false | 自定义按钮渲染函数 |
| btnColSpanRow | Boolean | true | 按钮是否独占一行 |

### 表单项类型（formtype）

| 类型 | 说明 | 示例配置 |
|------|------|----------|
| Input | 输入框 | `{ formtype: 'Input', attrs: { placeholder: '请输入' } }` |
| Select | 下拉选择 | `{ formtype: 'Select', dataOptions: [{label: '选项', value: '1'}] }` |
| datePicker | 日期选择 | `{ formtype: 'datePicker', attrs: { type: 'datetime' } }` |
| TimePicker | 时间选择 | `{ formtype: 'TimePicker' }` |
| Radio | 单选框 | `{ formtype: 'Radio', dataOptions: [...] }` |
| Checkbox | 复选框 | `{ formtype: 'Checkbox', dataOptions: [...] }` |
| Switch | 开关 | `{ formtype: 'Switch' }` |
| Cascader | 级联选择 | `{ formtype: 'Cascader', dataOptions: [...] }` |
| Rate | 评分 | `{ formtype: 'Rate' }` |
| Upload | 上传 | `{ formtype: 'Upload', attrs: { action: '/api/upload' } }` |

### 表单项通用配置

```javascript
{
  prop: 'fieldName',           // 数据绑定字段（必填）
  label: '字段名称',            // 标签文本
  span: 8,                     // 栅格占据列数（1-24）
  formtype: 'Input',           // 表单项类型
  
  // 表单项选项
  formItemOptions: {
    labelWidth: '100px',       // 标签宽度
    rules: [                   // 验证规则
      { required: true, message: '不能为空', trigger: 'blur' }
    ],
    style: { width: '65%' }    // 样式
  },
  
  // 组件属性（透传给 Element UI 组件）
  attrs: {
    placeholder: '请输入',
    clearable: true,
    disabled: false,           // 可以是函数: () => this.disabled
    style: 'width: 100%'
  },
  
  // 事件监听
  on: {
    change: (val) => { console.log(val) },
    input: (val) => { console.log(val) }
  },
  
  // 数据选项（Select/Radio/Checkbox等）
  dataOptions: [
    { label: '选项1', value: '1' },
    { label: '选项2', value: '2' }
  ],
  
  // 动态数据选项（从接口获取）
  apiParams: {
    url: '/api/options',
    model: { type: 'status' },
    headers: {},
    options: {}
  },
  
  // 自定义渲染
  render: (h, model, row) => {
    return <el-input v-model={model.fieldName} />
  }
}
```

### 高级表单项配置

#### 动态禁用状态

```javascript
{
  prop: 'amount',
  label: '金额',
  formtype: 'Input',
  attrs: {
    disabled: () => this.formData.type === 'free'  // 函数形式动态控制
  }
}
```

#### 动态 prop（函数形式）

```javascript
{
  prop: () => this.dynamicFieldName,  // 根据条件动态切换绑定的字段
  label: '动态字段'
}
```

#### 条件隐藏

```javascript
{
  prop: 'extraField',
  label: '额外字段',
  isHiden: (model, item, formProps) => {
    return model.type !== 'advanced'  // 返回 true 则隐藏
  }
}
```

#### 日期范围选择

```javascript
{
  prop: 'timeRange',
  label: '时间范围',
  formtype: 'datePicker',
  attrs: {
    type: 'datetimerange',           // 日期时间范围
    'is-range': true,
    'start-placeholder': '开始时间',
    'end-placeholder': '结束时间',
    valueFormat: 'yyyy-MM-dd HH:mm:ss',
    style: 'width: 100%'
  }
}
```

### 布局配置（layoutFormProps）

```javascript
{
  fromLayProps: {
    labelWidth: '100px',         // 标签宽度
    labelBtnWidth: '100px',      // 按钮标签宽度
    size: 'small',               // 尺寸：mini/small/medium
    isBtnHiden: false,           // 是否隐藏按钮
    minfoldRows: 1,              // 最小折叠行数（0表示不折叠）
    showMessage: false,          // 是否显示校验提示
    rules: {}                    // 动态表单验证规则
  },
  rowLayProps: {
    gutter: 20                   // 栅格间距
  },
  btnColSpan: 6                  // 按钮列宽（未折叠时）
}
```

### 按钮配置

```javascript
configBtnList: [
  {
    name: '新增',
    icon: 'el-icon-plus',
    type: 'primary',
    size: 'mini',
    direction: 'left',           // 按钮位置：left/right
    key: 'add',
    class: ['primaryBtn'],
    disabled: () => false,       // 可以是函数
    onClick: (model, formRef, httpRequest) => {
      // 自定义点击事件
      // httpRequest: 父级表格的查询方法
    }
  },
  {
    name: '查询',
    icon: 'el-icon-search',
    type: 'primary',
    size: 'mini',
    key: 'query',
    triggerEvent: true           // 自动触发表格查询
  },
  {
    name: '重置',
    icon: 'el-icon-refresh',
    size: 'mini',
    key: 'rest',
    triggerEvent: true           // 自动重置表单
  }
]
```

### 表单方法

```javascript
// 表单校验
this.$refs.formRef.validate((valid) => {
  if (valid) {
    console.log('校验通过')
  }
})

// 重置表单
this.$refs.formRef.resetFields()

// 清空验证
this.$refs.formRef.clearValidate()

// 使用 $httpRequest 发送请求（需在 Vue 原型上注册）
this.$refs.formRef.$httpRequest({
  url: '/api/data',
  method: 'post',
  formParams: {}
})
```

---

## EsDialog 弹窗组件

### 基础用法

```vue
<template>
  <es-dialog
    :visible.sync="dialogVisible"
    title="弹窗标题"
    width="60%"
    :is-draggable="true"
    :fullscreen="false"
    :close-on-click-modal="false"
    :center="true"
  >
    <div>弹窗内容</div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </es-dialog>
</template>
```

### Props 配置

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| visible | Boolean | false | 是否显示（支持 .sync） |
| title | String | '' | 标题 |
| width | String | '' | 宽度（如 '60%'） |
| height | String | '' | 高度 |
| maxHeight | String | '' | 最大高度 |
| size | String | 'large' | 预设尺寸：full/large/medium/small/mini/singleCol |
| fullscreen | Boolean | false | 是否全屏 |
| isDraggable | Boolean | false | 是否可拖拽 |
| center | Boolean | true | 是否垂直居中 |
| verticalPosition | String | 'center' | 垂直位置：center/top |
| closeOnClickModal | Boolean | false | 点击遮罩关闭 |
| closeOnPressEscape | Boolean | false | 按 ESC 关闭 |
| showClose | Boolean | true | 显示关闭按钮 |
| hiddenFullBtn | Boolean | false | 隐藏全屏按钮 |
| destroyOnClose | Boolean | true | 关闭时销毁内容 |
| showDefaultButtons | Boolean | true | 显示默认按钮（确定/取消） |
| loading | Boolean | false | 显示加载状态 |
| customClass | String | '' | 自定义类名 |
| configBtn | Array | [] | 底部按钮配置 |

### 事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| open | 弹窗打开时触发 | - |
| opened | 弹窗打开动画结束时触发 | - |
| close | 弹窗关闭时触发 | - |
| closed | 弹窗关闭动画结束时触发 | - |
| dialogConfirm | 点击确定按钮时触发 | hide 函数 |

---

## useDialog 函数式弹窗

### 基础用法

```javascript
import { useDialog } from 'es-eui'
import 'es-eui/dist/es-eui.css'
const myDialog = useDialog()

// 打开弹窗
myDialog({
  title: '新增数据',
  width: '75%',
  key: 'unique-key',              // 唯一标识，用于缓存
  isDraggable: true,              // 可拖拽
  fullscreen: false,              // 全屏
  closeOnClickModal: false,       // 点击遮罩不关闭
  hiddenFullBtn: false,           // 隐藏全屏按钮
  
  // 渲染弹窗内容
  render: (h) => {
    return <MyFormComponent />
  },
  
  // 按钮配置
  configBtn: [
    {
      name: '提交',
      type: 'primary',
      size: 'mini',
      icon: 'CircleCheck',
      class: ['primaryBtn'],
      click: (instance, { close, getRefs, dialogVm }) => {
        // 获取表单引用并校验
        getRefs.policyform.validate((valid) => {
          if (valid) {
            // 获取表单数据
            const formData = instance.formData
            // 提交逻辑...
            close()  // 关闭弹窗
          }
        })
      }
    },
    {
      name: '取消',
      size: 'mini',
      icon: 'CircleClose',
      class: ['normalBtn'],
      click: (instance, { close }) => {
        close()
      }
    }
  ],
  
  // 生命周期
  onOpen: () => console.log('弹窗打开'),
  onClosed: () => console.log('弹窗关闭')
})
```

### 参数配置

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| key | String | '__default__' | 弹窗唯一标识（相同 key 会复用实例） |
| title | String | '' | 标题 |
| width | String | '50%' | 宽度 |
| height | String | '' | 高度 |
| maxHeight | String | '' | 最大高度 |
| center | Boolean | true | 垂直居中 |
| fullscreen | Boolean | false | 是否全屏 |
| isDraggable | Boolean | false | 是否可拖拽 |
| closeOnClickModal | Boolean | false | 点击遮罩关闭 |
| closeOnPressEscape | Boolean | false | 按 ESC 关闭 |
| showClose | Boolean | true | 显示关闭按钮 |
| hiddenFullBtn | Boolean | false | 隐藏全屏按钮 |
| destroyOnClose | Boolean | true | 关闭销毁 |
| showDefaultButtons | Boolean | false | 显示默认按钮 |
| loading | Boolean | false | 加载状态 |
| render | Function | - | 渲染函数，返回 JSX |
| configBtn | Array | [] | 底部按钮配置 |
| onOpen | Function | - | 打开回调 |
| onClosed | Function | - | 关闭回调 |
| onSubmit | Function | - | 提交回调（点击确定时） |
| customClass | String | '' | 自定义类名 |
| appendToBody | Boolean | true | 插入到 body |
| modal | Boolean | true | 显示遮罩 |
| lockScroll | Boolean | true | 锁定滚动 |

### 按钮 click 回调参数

```javascript
click: (instance, { close, getRefs, dialogVm }) => {
  // instance: 渲染组件的实例（如表单组件的 this）
  // close: 关闭弹窗的函数
  // getRefs: 获取渲染组件中 ref 的函数
  // dialogVm: 弹窗组件实例
}
```

### 返回值

```javascript
const { close, instance } = useDialog({ ... })

// close: 关闭弹窗的方法
// instance: 弹窗组件实例
```

### 完整使用示例

```vue
<script>
import { useDialog } from 'es-eui'
import 'es-eui/dist/es-eui.css'
import PolicyForm from './components/PolicyForm.vue'

const addDialog = useDialog()
const editDialog = useDialog()
const viewDialog = useDialog()

export default {
  methods: {
    // 新增
    handleAdd() {
      addDialog({
        title: '新增政策',
        width: '75%',
        key: 'addPolicyDialog',
        isDraggable: true,
        fullscreen: false,
        render: (h) => <PolicyForm policyRow={{}} policyFormStatus="add" />,
        configBtn: [
          {
            name: '提交',
            type: 'primary',
            click: (instance, { close, getRefs }) => {
              getRefs.policyform.validate((valid) => {
                if (valid) {
                  this.saveData(instance.formData).then(() => {
                    this.$message.success('保存成功')
                    close()
                    this.refreshTable()
                  })
                }
              })
            }
          },
          { 
            name: '取消', 
            click: (i, { close }) => close() 
          }
        ]
      })
    },
    
    // 编辑
    handleEdit(row) {
      editDialog({
        title: '编辑政策',
        width: '75%',
        key: 'editPolicyDialog',
        isDraggable: true,
        render: (h) => <PolicyForm policyRow={row} policyFormStatus="edit" />,
        configBtn: [
          {
            name: '保存',
            type: 'primary',
            click: (instance, { close, getRefs }) => {
              // 编辑逻辑
            }
          }
        ]
      })
    },
    
    // 查看
    handleView(row) {
      viewDialog({
        title: '查看详情',
        width: '60%',
        key: 'viewPolicyDialog',
        hiddenFullBtn: true,      // 查看模式隐藏全屏按钮
        render: (h) => <PolicyForm policyRow={row} policyFormStatus="view" />,
        configBtn: [
          {
            name: '关闭',
            click: (instance, { close }) => close()
          }
        ]
      })
    }
  }
}
</script>
```

---

## 最佳实践

### 1. 表格与表单联动

```vue
<template>
  <es-table 
    ref="tableRef"
    :columns="columns" 
    :options="options"
    :data-source.sync="tableData"
    :pagination="pagination"
  >
    <!-- 搜索表单 -->
    <es-form
      :form-item-list="searchConfig"
      :model="searchForm"
      :config-btn="searchBtns"
    />
  </es-table>
</template>

<script>
export default {
  data() {
    return {
      tableData: [],
      pagination: { pageIndex: 1, pageSize: 10, total: 0 },
      options: {
        isInitRun: true,
        apiParams: { url: '/api/list' },
        configTableOut: {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        },
        listenToCallBack: {
          brcb: (params) => {
            // 请求前参数处理
            return { ...params, timestamp: Date.now() }
          },
          qrcb: (res) => {
            // 响应后处理
            console.log('查询结果:', res)
          }
        }
      },
      searchForm: {
        keyword: '',
        status: ''
      },
      searchConfig: [
        {
          prop: 'keyword',
          label: '关键词',
          span: 6,
          formtype: 'Input',
          attrs: { placeholder: '请输入', clearable: true }
        },
        {
          prop: 'status',
          label: '状态',
          span: 6,
          formtype: 'Select',
          attrs: { placeholder: '请选择', clearable: true },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]
        }
      ],
      searchBtns: [
        {
          name: '查询',
          type: 'primary',
          icon: 'el-icon-search',
          key: 'query',
          triggerEvent: true    // 自动触发表格查询
        },
        {
          name: '重置',
          icon: 'el-icon-refresh',
          key: 'rest',
          triggerEvent: true    // 自动重置表单
        },
        {
          name: '新增',
          type: 'primary',
          icon: 'el-icon-plus',
          direction: 'left',    // 左侧按钮
          onClick: () => this.handleAdd()
        }
      ]
    }
  }
}
</script>
```

### 2. 表单验证规则配置

```javascript
{
  prop: 'email',
  label: '邮箱',
  formtype: 'Input',
  formItemOptions: {
    rules: [
      { required: true, message: '请输入邮箱', trigger: 'blur' },
      { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
      { 
        validator: (rule, value, callback) => {
          if (value && value.length > 50) {
            callback(new Error('邮箱长度不能超过50字符'))
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }
}
```

### 3. 表单联动效果

```javascript
{
  prop: 'type',
  label: '类型',
  formtype: 'Select',
  dataOptions: [
    { label: '简单', value: 'simple' },
    { label: '复杂', value: 'complex' }
  ],
  on: {
    change: (val) => {
      // 根据类型清空相关字段或设置验证规则
      if (val === 'simple') {
        this.formData.detail = ''
      }
    }
  }
}
```

### 4. 动态验证规则

```javascript
// 在表单项中使用 render 实现动态验证
{
  prop: 'policyTag',
  label: '政策标签',
  render: (h, model, row) => {
    return (
      <el-row gutter={20}>
        <el-col span={8}>
          <el-input v-model={model.policyTag} />
        </el-col>
        <el-col span={10}>
          <el-radio-group
            v-model={model.isShowTag}
            on-input={() => {
              // 动态设置验证规则
              if (model.isShowTag === 'always') {
                this.$set(this.layoutProps.fromLayProps.rules, 'policyTag', [
                  { required: true, message: '政策标签不能为空', trigger: 'blur' }
                ])
              } else {
                this.$set(this.layoutProps.fromLayProps.rules, 'policyTag', [])
              }
            }}
          >
            <el-radio label="always">显示</el-radio>
            <el-radio label="hide">隐藏</el-radio>
          </el-radio-group>
        </el-col>
      </el-row>
    )
  }
}
```

### 5. 自定义渲染列

```javascript
// 使用 render 函数自定义列内容
{
  key: 'status',
  label: '状态',
  render: (h, { row }) => {
    const statusMap = {
      '0': { text: '草稿', type: 'info' },
      '1': { text: '上架中', type: 'success' },
      '2': { text: '已下架', type: 'warning' }
    }
    const status = statusMap[row.status] || { text: '未知', type: 'info' }
    return <el-tag type={status.type}>{status.text}</el-tag>
  }
}

// 使用 scopedSlots 自定义列（模板方式）
{
  key: 'action',
  label: '操作',
  scopedSlots: { customRender: 'actionSlot' }
}
```

### 6. 弹窗缓存控制

```javascript
// 使用相同的 key 会复用弹窗实例
const dialog1 = useDialog({ key: 'my-dialog', title: '弹窗1' })
const dialog2 = useDialog({ key: 'my-dialog', title: '弹窗2' })  // 复用 dialog1 的实例

// 如需每次都新建，使用不同的 key
const dialog3 = useDialog({ key: `dialog-${Date.now()}` })
```

### 7. 表格选择缓存

```javascript
tableOptions: {
  cachePageSelection: true,    // 开启分页选择缓存
  rowkey: 'id',                // 设置唯一标识字段
  // ...
}

// 获取所有选择的数据（跨分页）
const selectedRows = this.$refs.tableRef.multipleSelection
```

### 8. 错误处理

```javascript
{
  apiParams: {
    url: '/api/data'
  },
  listenToCallBack: {
    qrcb: (res) => {
      if (res.code !== 0) {
        this.$message.error(res.message)
      }
    }
  }
}
```

### 9. 自定义 HTTP 请求

```javascript
tableOptions: {
  httpRequest: (params) => {
    const { url, formParams, headers, ...options } = params
    return axios({
      url,
      method: 'post',
      data: formParams,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...options
    })
  }
}
```

---

## 常见问题

### Q: 表格数据不刷新？

**A:** 确保 `data-source` 使用了 `.sync` 修饰符，或者手动调用表格实例的 `httpRquestInstace` 方法：

```javascript
// 方式1：使用 .sync
<es-table :data-source.sync="tableData" />

// 方式2：手动刷新
this.$refs.tableRef.httpRquestInstace({ ...params })
```

### Q: 表单验证不生效？

**A:** 检查以下几点：
1. `prop` 是否与 `model` 中的字段名一致
2. `rules` 配置在 `formItemOptions` 中
3. `formItemOptions` 中设置了 `labelWidth`

### Q: useDialog 弹窗不居中？

**A:** 确保 `center` 参数为 `true`（默认），且没有设置 `fullscreen: true`。如果仍有问题，检查是否有全局 CSS 覆盖。

### Q: 如何获取表格实例？

**A:** 通过 `ref` 引用：

```javascript
// 获取 EsTable 组件实例
const tableInstance = this.$refs.tableRef

// 获取 Element UI Table 实例
const elTableInstance = this.$refs.tableRef.refsInstance()

// 调用 Element UI Table 方法
elTableInstance.clearSelection()
elTableInstance.toggleRowSelection(row)
```

### Q: 自定义渲染中的事件不触发？

**A:** 使用箭头函数保持 Vue 实例上下文：

```javascript
render: (h, { row }) => {
  return (
    <el-button 
      on-click={() => this.handleClick(row)}  // 使用箭头函数
    >
      点击
    </el-button>
  )
}
```

### Q: 表单折叠功能不生效？

**A:** 确保 `layoutFormProps.fromLayProps.minfoldRows` 设置正确：

```javascript
layoutFormProps: {
  fromLayProps: {
    minfoldRows: 1,    // 只显示1行，超出折叠
    // minfoldRows: 0  // 0表示不折叠
  }
}
```

### Q: 如何监听表格分页变化？

**A:** 使用 `watch` 监听 `pagination` 对象：

```javascript
watch: {
  'pagination.pageIndex'(val) {
    console.log('页码变化:', val)
  }
}
```

---

## 综合评价与市场对比分析

### 一、ES-EUI 组件库优势分析

#### 1. 高度配置化开发

| 维度 | ES-EUI | 评价 |
|------|--------|------|
| 表格开发 | JSON 配置生成完整表格 | 开发效率提升 60%+ |
| 表单开发 | 声明式配置替代模板编写 | 代码量减少 50%+ |
| 弹窗调用 | 函数式命令调用 | 使用简洁直观 |

**优势体现：**
- 通过 `columns` 配置即可生成完整表格，无需编写大量 `<el-table-column>`
- 通过 `formItemList` 配置表单，支持动态渲染、联动验证
- `useDialog` 函数式调用，无需维护大量 `visible` 状态

#### 2. 深度集成能力

| 功能 | ES-EUI | 市场主流方案 |
|------|--------|-------------|
| 表单表格联动 | ✅ 内置支持 | 需手动实现 |
| HTTP 请求集成 | ✅ 配置化 | 需自行封装 |
| 分页状态管理 | ✅ 自动处理 | 需手动管理 |
| 选择数据缓存 | ✅ 跨分页缓存 | 需额外开发 |

#### 3. 企业级功能完备

```
✅ 表格功能
  - 自动请求与分页
  - 多分页选择缓存
  - 多级表头
  - 响应式高度
  - 字段映射配置

✅ 表单功能
  - 12+ 内置组件类型
  - 动态验证规则
  - 联动效果支持
  - 折叠布局
  - 接口数据驱动选项

✅ 弹窗功能
  - 拖拽支持
  - 全屏切换
  - 垂直居中
  - 函数式调用
  - 实例缓存
```

#### 4. 学习成本低

- 基于 Element UI，团队无需学习新的 UI 风格
- 配置语法直观，JSON 结构清晰
- 与 Vue 2 技术栈完全兼容

---

### 二、与市场主流组件库对比

#### 1. 与 Ant Design Vue 对比

| 对比维度 | ES-EUI | Ant Design Vue | 分析 |
|----------|--------|----------------|------|
| 封装层级 | 二次封装 Element UI | 独立组件库 | ES-EUI 更轻量，依赖少 |
| 配置化程度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ES-EUI 表格/表单配置更简洁 |
| 表单联动 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ES-EUI 动态规则更灵活 |
| 弹窗方案 | ⭐⭐⭐⭐⭐ (useDialog) | ⭐⭐⭐ (Modal) | ES-EUI 函数式调用更便捷 |
| 设计规范 | 遵循 Element UI | Ant Design 规范 | AD 视觉更现代 |
| 生态工具 | ProComponents | ProComponents | AD 生态更丰富 |
| Vue 3 支持 | ❌ 仅 Vue 2 | ✅ 支持 | AD 技术栈更新 |
| TypeScript | 部分支持 | 完整支持 | AD 类型支持更好 |

**结论：**
- ES-EUI 适合 Vue 2 项目快速开发，配置化效率更高
- Ant Design Vue 适合大型项目，生态更完善

#### 2. 与 Element UI Plus 对比

| 对比维度 | ES-EUI | Element Plus | 分析 |
|----------|--------|--------------|------|
| 定位 | 企业级二次封装 | Element UI 官方升级版 | 定位不同 |
| 配置化 | ⭐⭐⭐⭐⭐ 高度配置 | ⭐⭐ 模板为主 | ES-EUI 开发更快 |
| 表格增强 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ES-EUI 企业功能更全 |
| Vue 版本 | Vue 2 | Vue 3 | 技术栈差异 |
| 维护状态 | 内部维护 | 官方维护 | EP 社区更活跃 |
| 体积 | 较小（按需引入） | 中等 | ES-EUI 可控性高 |

**结论：**
- ES-EUI 是 Vue 2 项目的高效方案
- Element Plus 是 Vue 3 迁移的首选

#### 3. 与 Vuetify 对比

| 对比维度 | ES-EUI | Vuetify | 分析 |
|----------|--------|---------|------|
| UI 风格 | 简约商务 | Material Design | 风格差异大 |
| 配置化 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ES-EUI 中后台配置更强 |
| 移动端 | ⭐⭐ | ⭐⭐⭐⭐⭐ | Vuetify 响应式更好 |
| 组件数量 | 核心 4 个 | 80+ | Vuetify 更全面 |
| 学习成本 | 低 | 中等 | ES-EUI 上手更快 |

**结论：**
- ES-EUI 专注中后台桌面端
- Vuetify 适合全端应用

#### 4. 与 Naive UI 对比

| 对比维度 | ES-EUI | Naive UI | 分析 |
|----------|--------|----------|------|
| 性能 | 良好 | ⭐⭐⭐⭐⭐ 优秀 | Naive 性能更优 |
| 配置化 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 两者配置能力接近 |
| 定制性 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Naive 主题更灵活 |
| Vue 版本 | Vue 2 | Vue 3 | 技术栈差异 |
| 社区活跃度 | 内部 | ⭐⭐⭐⭐⭐ | Naive 社区更大 |

**结论：**
- Naive UI 是 Vue 3 的性能之选
- ES-EUI 是 Vue 2 的效率之选

---

### 三、综合评价

#### 1. 适用场景评分

| 场景 | 评分 | 说明 |
|------|------|------|
| 中后台管理系统 | ⭐⭐⭐⭐⭐ | 高度契合，开发效率极高 |
| 数据密集型应用 | ⭐⭐⭐⭐⭐ | 表格功能强大 |
| 表单复杂应用 | ⭐⭐⭐⭐⭐ | 动态表单、联动支持好 |
| 快速原型开发 | ⭐⭐⭐⭐⭐ | 配置化快速搭建 |
| 移动端应用 | ⭐⭐ | 非设计目标 |
| 大型开源项目 | ⭐⭐⭐ | 生态和社区待建设 |

#### 2. 技术债务评估

| 维度 | 现状 | 风险等级 |
|------|------|----------|
| Vue 2 依赖 | 基于 Vue 2 | ⚠️ 中等（需规划迁移）|
| Element UI 依赖 | 依赖 EUI | ⚠️ 中等（EUI 维护放缓）|
| 内部维护 | 团队维护 | ⚠️ 中等（文档和培训成本）|
| 代码质量 | 良好 | ✅ 低 |

#### 3. 竞争力分析雷达图

```
                    配置化能力
                       ⭐⭐⭐⭐⭐
                         |
    开发效率 ⭐⭐⭐⭐⭐ ---+--- ⭐⭐⭐⭐ 生态丰富度
                         |
     功能完备 ⭐⭐⭐⭐⭐ ---+--- ⭐⭐⭐ 技术先进性
                         |
                    ⭐⭐⭐⭐ 维护成本
```

---

### 四、市场定位建议

#### 1. 最佳使用场景

- ✅ Vue 2 中后台项目
- ✅ 快速交付的 CRUD 系统
- ✅ 表单表格密集型企业应用
- ✅ 团队熟悉 Element UI

#### 2. 不建议使用场景

- ❌ Vue 3 新项目（建议评估迁移成本）
- ❌ 移动端优先应用
- ❌ 需要高度定制 UI 风格
- ❌ 长期维护的开源项目

#### 3. 发展建议

| 优先级 | 建议项 | 预期收益 |
|--------|--------|----------|
| P0 | Vue 3 版本开发 | 延长技术生命周期 |
| P1 | TypeScript 完整支持 | 提升代码质量 |
| P1 | 文档和示例完善 | 降低使用门槛 |
| P2 | 组件市场/物料库 | 提升生态丰富度 |
| P2 | 可视化配置工具 | 进一步提升效率 |

---

### 五、总结

ES-EUI 是一款**面向 Vue 2 企业级中后台场景的高效二次封装组件库**，其核心价值在于：

1. **极致的配置化开发体验** - JSON 驱动，代码量减少 50%+
2. **深度集成的企业功能** - 表单表格联动、分页缓存等开箱即用
3. **低学习成本** - 基于 Element UI，团队上手快

**与主流组件库相比：**
- 相比 Ant Design Vue：在 Vue 2 场景下配置化效率更高
- 相比 Element Plus：功能增强更多，但受限于 Vue 2
- 相比 Vuetify/Naive UI：专注中后台，定位清晰

**总体评价：⭐⭐⭐⭐ (4/5)**

ES-EUI 是 Vue 2 中后台项目的**效率利器**，适合追求快速交付、表单表格密集的企业应用。随着 Vue 3 的普及，建议团队评估向 Vue 3 + TypeScript 的迁移路径，以保持技术竞争力。

---

## 版本记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2024-01 | 初始版本，包含 Table、Form、Dialog 基础功能 |
| 1.1.0 | 2024-03 | 新增 useDialog 函数式弹窗、拖拽功能 |
| 1.2.0 | 2024-06 | 增强表单类型、优化表格性能、添加折叠功能 |
| 1.3.0 | 2024-09 | 新增多级表头、选择缓存、动态验证规则 |

---

## 贡献指南

1. 遵循现有代码风格和命名规范
2. 新增组件需在 `src/components/es-eui/index.js` 中注册
3. 编写必要的单元测试
4. 更新本文档相关内容

---

**文档维护者**: 前端自由开发者LIUJIAAO 简称：LJA  
**最后更新**: 2026-02
