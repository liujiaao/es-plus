# ES-EUI 组件库 - 详细文档

<p align="center">
  <img src="https://img.shields.io/badge/vue-2.6+-brightgreen.svg" alt="Vue">
  <img src="https://img.shields.io/badge/element--ui-2.15+-blue.svg" alt="Element UI">
  <img src="https://img.shields.io/npm/v/es-eui.svg" alt="npm version">
  <img src="https://img.shields.io/npm/l/es-eui.svg" alt="license">
</p>

## 目录

- [简介](#简介)
- [快速开始](#快速开始)
- [组件总览](#组件总览)
- [EsDialog - 增强型对话框](#esdialog---增强型对话框)
- [EsForm - 增强型表单](#esform---增强型表单)
- [EsTable - 增强型表格](#estable---增强型表格)
- [SvgIcon - SVG 图标](#svgicon---svg-图标)
- [useDialog 组合式 API](#usedialog-组合式-api)
- [按需引入](#按需引入)
- [进阶使用](#进阶使用)
- [API 参考](#api-参考)

---

## 简介

**ES-EUI** 是一个基于 **Vue 2** 和 **Element UI** 的企业级组件库，提供了一系列增强型业务组件，旨在简化中后台管理系统的开发。

### 核心特性

| 特性 | 说明 |
|------|------|
| 🎯 **开箱即用** | 基于 Element UI 扩展，无需额外学习成本 |
| 🚀 **功能增强** | 在原生组件基础上增加实用功能 |
| 📦 **按需加载** | 支持 babel-plugin-component 按需引入 |
| 🎨 **高度可配** | 丰富的配置项满足各种业务场景 |
| 💪 **企业级** | 经过生产环境验证的稳定组件 |

### 适用场景

- 中后台管理系统
- 数据管理后台
- 企业内部工具
- 需要大量表单、表格、对话框的应用

---

## 快速开始

### 安装

```bash
# npm
npm install es-eui

# yarn
yarn add es-eui

# pnpm
pnpm add es-eui
```

### 依赖

```bash
# 确保已安装 Vue 2 和 Element UI
npm install vue@^2.6.14 element-ui@^2.15.14
```

### 全量引入

```javascript
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsEui from 'es-eui'
import 'es-eui/dist/es-eui.css'

Vue.use(ElementUI)
Vue.use(EsEui)
```

---

## 组件总览

| 组件名 | 说明 | 主要功能 |
|--------|------|----------|
| **EsDialog** | 增强型对话框 | 拖拽移动、全屏切换、自定义按钮 |
| **EsForm** | 增强型表单 | JSON 配置、动态渲染、自动布局 |
| **EsTable** | 增强型表格 | 自动高度、分页管理、列配置 |
| **SvgIcon** | SVG 图标 | 自动尺寸、外部链接支持 |
| **useDialog** | 组合式 API | 命令式调用对话框 |


---

## EsDialog - 增强型对话框

基于 Element UI Dialog 的增强版本，提供更灵活的交互体验。

### 功能特性

- ✅ **拖拽移动** - 通过标题栏拖拽移动对话框
- ✅ **全屏切换** - 一键切换全屏/窗口模式
- ✅ **垂直居中** - 支持内容垂直居中显示
- ✅ **自定义按钮** - 灵活配置底部操作按钮
- ✅ **响应式内容** - 自动计算最大内容高度
- ✅ **置顶显示** - 点击自动置顶
- ✅ **多位置支持** - 顶部对齐、居中、默认偏移

### 基础用法

```vue
<template>
  <es-dialog
    :visible.sync="visible"
    title="基础对话框"
    width="50%"
  >
    <p>对话框内容</p>
  </es-dialog>
</template>

<script>
export default {
  data() {
    return {
      visible: false
    }
  }
}
</script>
```

### 拖拽功能

```vue
<template>
  <es-dialog
    :visible.sync="visible"
    title="可拖拽对话框"
    v-draggable
    width="600px"
  >
    <p>拖动标题栏可移动对话框</p>
  </es-dialog>
</template>

<script>
import { EsDialog } from 'es-eui'
import draggable from 'es-eui/esDialog/src/utils/draggable'

export default {
  directives: { draggable },
  components: { EsDialog }
}
</script>
```

### 全屏对话框

```vue
<template>
  <es-dialog
    :visible.sync="visible"
    title="全屏对话框"
    :fullscreen="true"
    width="80%"
  >
    <p>全屏模式下可查看更多内容</p>
  </es-dialog>
</template>
```

### 自定义按钮

```vue
<template>
  <es-dialog
    :visible.sync="visible"
    title="自定义按钮"
    :config-btn="buttons"
  >
    <p>自定义操作按钮</p>
  </es-dialog>
</template>

<script>
export default {
  data() {
    return {
      visible: false,
      buttons: [
        {
          name: '保存草稿',
          type: 'info',
          onClick: () => this.saveDraft()
        },
        {
          name: '提交',
          type: 'primary',
          onClick: () => this.submit()
        },
        {
          name: '取消',
          onClick: () => { this.visible = false }
        }
      ]
    }
  },
  methods: {
    saveDraft() {
      console.log('保存草稿')
    },
    submit() {
      console.log('提交')
    }
  }
}
</script>
```

### 预设尺寸

```vue
<template>
  <div>
    <!-- 全屏 -->
    <es-dialog :visible.sync="visible1" size="full" title="全屏">
      内容...
    </es-dialog>
    
    <!-- 大尺寸（80%） -->
    <es-dialog :visible.sync="visible2" size="large" title="大尺寸">
      内容...
    </es-dialog>
    
    <!-- 中等尺寸（60%） -->
    <es-dialog :visible.sync="visible3" size="medium" title="中等">
      内容...
    </es-dialog>
    
    <!-- 小尺寸（30%） -->
    <es-dialog :visible.sync="visible4" size="small" title="小尺寸">
      内容...
    </es-dialog>
    
    <!-- 迷你尺寸（20%） -->
    <es-dialog :visible.sync="visible5" size="mini" title="迷你">
      内容...
    </es-dialog>
  </div>
</template>
```

### Props 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| visible | Boolean | false | 是否显示对话框（支持 .sync） |
| title | String | '' | 对话框标题 |
| width | String | '' | 对话框宽度（如 '50%'、'600px'） |
| height | String | '' | 对话框高度 |
| maxHeight | String | '' | 最大高度 |
| fullscreen | Boolean | false | 是否全屏 |
| size | String | 'large' | 预设尺寸：full/large/medium/small/mini |
| center | Boolean | true | 是否垂直居中 |
| verticalPosition | String | 'center' | 垂直位置：top/center |
| modal | Boolean | true | 是否显示遮罩 |
| closeOnClickModal | Boolean | false | 点击遮罩关闭 |
| closeOnPressEscape | Boolean | false | ESC 键关闭 |
| showClose | Boolean | true | 显示关闭按钮 |
| hiddenFullBtn | Boolean | false | 隐藏全屏按钮 |
| showDefaultButtons | Boolean | true | 显示默认按钮（确定/取消） |
| configBtn | Array | [] | 自定义按钮配置 |
| loading | Boolean | false | 加载状态 |
| destroyOnClose | Boolean | false | 关闭时销毁 |
| customClass | String | '' | 自定义类名 |
| appendToBody | Boolean | true | 插入到 body |
| beforeClose | Function | - | 关闭前的回调 |

### Events 事件

| 事件名 | 说明 | 参数 |
|--------|------|------|
| open | 对话框打开时触发 | - |
| opened | 对话框打开动画结束时触发 | - |
| close | 对话框关闭时触发 | - |
| closed | 对话框关闭动画结束时触发 | - |
| dialogConfirm | 点击确定按钮时触发 | hide 函数 |

### 按钮配置项

```javascript
{
  name: '按钮文字',           // 按钮显示文字
  type: 'primary',           // 按钮类型：primary/success/warning/danger/info/text
  size: 'mini',              // 按钮尺寸：medium/small/mini
  plain: false,              // 是否朴素按钮
  round: false,              // 是否圆角按钮
  circle: false,             // 是否圆形按钮
  disabled: false,           // 是否禁用（可传函数）
  loading: false,            // 是否加载中
  icon: 'el-icon-check',     // 图标类名
  onClick: Function          // 点击回调函数
}
```


---

## EsForm - 增强型表单

基于 Element UI Form 的增强版本，支持 JSON 配置化渲染，大幅简化表单开发。

### 功能特性

- ✅ **JSON 配置化** - 通过配置数组自动生成表单
- ✅ **自动布局** - 智能计算行列布局，支持自适应
- ✅ **折叠展开** - 表单项过多时支持折叠
- ✅ **远程数据** - 支持下拉选项从接口动态加载
- ✅ **丰富组件** - 内置 12+ 种表单组件类型
- ✅ **联动控制** - 支持表单项显示/隐藏联动
- ✅ **自定义渲染** - 支持 render 函数自定义表单项

### 基础用法

```vue
<template>
  <es-form
    :form-item-list="formItems"
    :model="formData"
  />
</template>

<script>
export default {
  data() {
    return {
      formData: {
        name: '',
        age: '',
        gender: ''
      },
      formItems: [
        { label: '姓名', prop: 'name', formtype: 'Input', span: 8 },
        { label: '年龄', prop: 'age', formtype: 'InputNumber', span: 8 },
        { 
          label: '性别', 
          prop: 'gender', 
          formtype: 'Select',
          span: 8,
          dataOptions: [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' }
          ]
        }
      ]
    }
  }
}
</script>
```

### 带按钮的表单

```vue
<template>
  <es-form
    :form-item-list="formItems"
    :model="formData"
    :config-btn="buttons"
    :layout-form-props="layoutConfig"
  />
</template>

<script>
export default {
  data() {
    return {
      formData: { name: '', status: '' },
      formItems: [
        { label: '名称', prop: 'name', formtype: 'Input', span: 6 },
        { 
          label: '状态', 
          prop: 'status', 
          formtype: 'Select',
          span: 6,
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 }
          ]
        }
      ],
      buttons: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true }
      ],
      layoutConfig: {
        rowLayProps: { gutter: 20 },
        fromLayProps: { 
          labelWidth: '80px',
          isBtnHiden: false,
          btnColSpan: 6
        }
      }
    }
  }
}
</script>
```

### 折叠表单

```vue
<template>
  <es-form
    :form-item-list="formItems"
    :model="formData"
    :layout-form-props="layoutConfig"
  />
</template>

<script>
export default {
  data() {
    return {
      formData: {},
      layoutConfig: {
        fromLayProps: {
          minfoldRows: 2  // 超过2行时显示折叠按钮
        }
      },
      formItems: [
        { label: '字段1', prop: 'f1', formtype: 'Input', span: 6 },
        { label: '字段2', prop: 'f2', formtype: 'Input', span: 6 },
        { label: '字段3', prop: 'f3', formtype: 'Input', span: 6 },
        { label: '字段4', prop: 'f4', formtype: 'Input', span: 6 },
        { label: '字段5', prop: 'f5', formtype: 'Input', span: 6 },
        { label: '字段6', prop: 'f6', formtype: 'Input', span: 6 },
        { label: '字段7', prop: 'f7', formtype: 'Input', span: 6 },
        { label: '字段8', prop: 'f8', formtype: 'Input', span: 6 }
      ]
    }
  }
}
</script>
```

### 表单组件类型

| 组件类型 | 说明 | 特殊属性 |
|----------|------|----------|
| Input | 输入框 | attrs.placeholder |
| InputNumber | 数字输入 | attrs.min, attrs.max |
| Select | 下拉选择 | dataOptions |
| DatePicker | 日期选择 | attrs.type |
| TimePicker | 时间选择 | - |
| Cascader | 级联选择 | dataOptions |
| Radio | 单选框 | dataOptions |
| Checkbox | 多选框 | dataOptions |
| Switch | 开关 | attrs.activeText |
| Rate | 评分 | attrs.max |
| Upload | 上传 | attrs.action |

### Props 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| formItemList | Array | [] | 表单配置项数组 |
| model | Object | {} | 表单数据模型 |
| formModel | Object | null | 独立表单模型 |
| configBtn | Array | [] | 底部按钮配置 |
| layoutFormProps | Object | {} | 布局配置 |
| renderBtn | Function/Boolean | false | 自定义按钮渲染函数 |
| btnColSpanRow | Boolean | true | 按钮是否独占一行 |

### 表单项配置

```javascript
{
  label: '字段标签',          // 标签文字
  prop: 'fieldName',          // 字段名（对应 model 的 key）
  formtype: 'Input',          // 组件类型
  span: 6,                    // 列宽（24栅格）
  isHiden: Function,          // 是否隐藏（返回 true 隐藏）
  isfold: Boolean,            // 是否在折叠区域
  dataOptions: Array,         // 选项数据（Select/Radio/Checkbox 等）
  apiParams: Object,          // 远程加载配置
  attrs: Object,              // 组件属性
  props: Object,              // 组件 props
  on: Object,                 // 事件监听
  render: Function,           // 自定义渲染函数
  components: Object,         // 自定义组件注册
  formItemOptions: Object     // el-form-item 属性
}
```

### 远程加载配置 (apiParams)

```javascript
{
  url: '/api/options',        // 接口地址
  method: 'GET',              // 请求方法
  headers: {},                // 请求头
  model: {},                  // 固定请求参数
  options: {},                // 其他请求配置
  httpRequest: Function       // 自定义请求函数
}
```

### 监听回调 (listenToCallBack)

```javascript
{
  // 请求前回调 - 可修改请求参数
  brcb: (params) => ({ ...params, pageSize: 100 }),
  // 数据转换回调 - 可过滤/转换返回数据
  crtn: (listData) => listData.filter(item => item.active)
}
```


---

## EsTable - 增强型表格

基于 Element UI Table 的增强版本，提供自动高度计算、分页管理等功能。

### 功能特性

- ✅ **自动高度** - 根据容器自动计算表格高度
- ✅ **分页管理** - 内置分页逻辑，支持同步/异步
- ✅ **列配置** - 支持自定义列渲染、隐藏
- ✅ **树形数据** - 支持懒加载树形表格
- ✅ **展开行** - 支持行展开显示详情
- ✅ **多选缓存** - 跨分页保留选中状态
- ✅ **自适应布局** - 监听容器尺寸变化自动调整

### 基础用法

```vue
<template>
  <es-table
    :data-source="tableData"
    :columns="columns"
  />
</template>

<script>
export default {
  data() {
    return {
      tableData: [
        { id: 1, name: '张三', age: 25 },
        { id: 2, name: '李四', age: 30 }
      ],
      columns: [
        { type: 'selection', width: 55 },
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'age', label: '年龄', width: 100 }
      ]
    }
  }
}
</script>
```

### 带分页的表格

```vue
<template>
  <es-table
    :data-source="tableData"
    :columns="columns"
    :pagination.sync="pagination"
    @pagination-current-change="handlePageChange"
  />
</template>

<script>
export default {
  data() {
    return {
      tableData: [],
      pagination: {
        current: 1,
        pageSize: 10,
        total: 0
      },
      columns: [
        { prop: 'name', label: '姓名' },
        { prop: 'email', label: '邮箱' },
        { prop: 'phone', label: '电话' }
      ]
    }
  },
  methods: {
    handlePageChange(pagination) {
      this.loadData(pagination.current, pagination.pageSize)
    },
    loadData(page, size) {
      // 加载数据逻辑
    }
  }
}
</script>
```

### 自动请求数据

```vue
<template>
  <es-table
    :columns="columns"
    :options="tableOptions"
  />
</template>

<script>
export default {
  data() {
    return {
      columns: [
        { prop: 'name', label: '姓名' },
        { prop: 'status', label: '状态' }
      ],
      tableOptions: {
        isInitRun: true,  // 初始化时自动请求
        apiParams: {
          url: '/api/users',
          method: 'GET',
          model: { type: 'all' }
        },
        httpRequest: this.$httpRequest,  // 自定义请求方法
        configTableOut: {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageNo',
          tableData: 'rows'
        }
      }
    }
  }
}
</script>
```

### 自定义列渲染

```vue
<template>
  <es-table
    :data-source="tableData"
    :columns="columns"
  >
    <!-- 使用作用域插槽自定义列 -->
    <template #status="{ scope }">
      <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
        {{ scope.row.status === 1 ? '启用' : '禁用' }}
      </el-tag>
    </template>
    
    <template #action="{ scope }">
      <el-button type="text" @click="edit(scope.row)">编辑</el-button>
      <el-button type="text" @click="delete(scope.row)">删除</el-button>
    </template>
  </es-table>
</template>

<script>
export default {
  data() {
    return {
      tableData: [],
      columns: [
        { prop: 'name', label: '姓名' },
        { 
          prop: 'status', 
          label: '状态',
          scopedSlots: { customRender: 'status' }
        },
        { 
          label: '操作',
          scopedSlots: { customRender: 'action' }
        }
      ]
    }
  }
}
</script>
```

### 树形表格（懒加载）

```vue
<template>
  <es-table
    :data-source="tableData"
    :columns="columns"
    row-key="id"
    :options="treeOptions"
  />
</template>

<script>
export default {
  data() {
    return {
      tableData: [
        { id: 1, name: '部门1', hasChildren: true },
        { id: 2, name: '部门2', hasChildren: true }
      ],
      columns: [
        { prop: 'name', label: '部门名称', treeNode: true },
        { prop: 'leader', label: '负责人' }
      ],
      treeOptions: {
        lazy: true,
        lazyLoad: (row, treeNode, resolve) => {
          // 加载子节点数据
          this.loadChildren(row.id).then(children => {
            resolve(children)
          })
        }
      }
    }
  }
}
</script>
```

### 展开行

```vue
<template>
  <es-table
    :data-source="tableData"
    :columns="columns"
    :options="{ expand: true }"
  >
    <template #tableExpand="{ scope }">
      <div>
        <p>详情信息：</p>
        <p>地址：{{ scope.row.address }}</p>
        <p>备注：{{ scope.row.remark }}</p>
      </div>
    </template>
  </es-table>
</template>

<script>
export default {
  data() {
    return {
      tableData: [],
      columns: [
        { prop: 'name', label: '姓名' },
        { prop: 'phone', label: '电话' }
      ]
    }
  }
}
</script>
```

### Props 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| dataSource | Array | [] | 表格数据源 |
| columns | Array | [] | 列配置数组 |
| options | Object | {} | 表格选项配置 |
| pagination | Object | {} | 分页配置（支持 .sync） |
| configBtn | Array | [] | 顶部按钮配置 |
| showHeaderBar | Boolean | true | 显示头部栏 |
| headBarClass | String/Object | '' | 头部栏样式类 |

### 表格选项 (options)

```javascript
{
  // 基础配置
  multiSelect: false,        // 是否多选
  expand: false,             // 是否可展开行
  snIndex: false,            // 是否显示序号列
  loading: false,            // 加载状态
  border: false,             // 是否显示边框
  size: 'small',             // 表格尺寸
  highlightCurrentRow: true, // 高亮当前行
  cachePageSelection: true,  // 跨页缓存选中
  
  // 高度配置
  heightType: 'auto',        // 高度类型：auto/max-height
  tabHeight: 300,            // 固定高度值
  
  // 树形配置
  lazy: false,               // 懒加载
  rowKey: 'id',              // 行唯一标识
  treeProps: { children: 'children', hasChildren: 'hasChildren' },
  
  // 接口配置
  isInitRun: false,          // 初始化时请求
  apiParams: {               // 请求参数
    url: '',
    method: 'GET',
    headers: {},
    model: {}
  },
  httpRequest: Function,     // 自定义请求方法
  configTableOut: {          // 响应字段映射
    total: 'total',
    pageSize: 'pageSize', 
    current: 'pageNo',
    tableData: 'rows'
  },
  listenToCallBack: {        // 请求回调
    brcb: Function,          // 请求前
    qrcb: Function           // 请求后
  }
}
```

### 列配置 (columns)

```javascript
{
  type: 'selection',         // 列类型：selection/index/expand
  prop: 'fieldName',         // 字段名
  label: '列标题',           // 标题
  width: 120,                // 宽度
  minWidth: 100,             // 最小宽度
  fixed: 'left',             // 固定列：left/right
  sortable: true,            // 可排序
  align: 'center',           // 对齐方式
  headerAlign: 'center',     // 表头对齐
  hidCol: false,             // 是否隐藏
  treeNode: false,           // 树节点列
  scopedSlots: {             // 自定义渲染插槽
    customRender: 'slotName'
  },
  render: Function           // render 函数渲染
}
```

### Methods 方法

| 方法名 | 说明 | 参数 |
|--------|------|------|
| httpRquestInstace | 手动触发数据请求 | (model) |
| toggleSelection | 切换行选中状态 | (rows) |
| clearSelection | 清空所有选中 | - |
| clearAllSelection | 清空所有分页选中 | - |
| refsInstance | 获取表格实例 | - |
| getFormInstace | 获取关联表单实例 | - |


---

## SvgIcon - SVG 图标

支持本地 SVG 和外部链接的图标组件。

### 功能特性

- ✅ **自动尺寸** - 根据字体大小自动调整
- ✅ **外部链接** - 支持 URL 外部图标
- ✅ **CSS 控制** - 可通过 CSS 修改颜色
- ✅ **SVG Sprite** - 支持 symbol 引用方式

### 基础用法

```vue
<template>
  <div>
    <!-- 使用本地 SVG -->
    <svg-icon icon-class="user" />
    <svg-icon icon-class="settings" />
    
    <!-- 使用外部链接 -->
    <svg-icon icon-class="https://example.com/icon.svg" />
  </div>
</template>
```

### 配合 SVG Sprite 使用

```javascript
// 在入口文件导入所有 SVG
const req = require.context('./assets/icons', false, /\.svg$/)
req.keys().map(req)
```

```vue
<template>
  <!-- icon-class 对应 SVG 文件名 -->
  <svg-icon icon-class="dashboard" class-name="icon-large" />
</template>

<style>
.icon-large {
  font-size: 24px;
  color: #409EFF;
}
</style>
```

### Props 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| iconClass | String | 必填 | 图标类名或 URL |
| className | String | '' | 自定义 CSS 类名 |

---

## useDialog 组合式 API

通过 JavaScript 命令式创建对话框，无需在模板中声明。

### 功能特性

- ✅ **命令式调用** - 通过 JS 代码创建对话框
- ✅ **动态内容** - 支持 render 函数渲染内容
- ✅ **状态管理** - 自动管理对话框状态
- ✅ **缓存机制** - 相同 key 的对话框不会重复创建
- ✅ **Store 注入** - 支持 Vuex 状态访问

### 基础用法

```javascript
import { useDialog } from 'es-eui'

export default {
  methods: {
    openDialog() {
      const dialog = useDialog()({
        title: '提示',
        width: '500px',
        render: (h) => h('p', '这是一条消息')
      })
    }
  }
}
```

### 使用组件作为内容

```javascript
import MyForm from './MyForm.vue'
import { useDialog } from 'es-eui'

export default {
  methods: {
    openFormDialog() {
      const { close, getRefs } = useDialog()({
        title: '新建用户',
        width: '600px',
        render: (h) => h(MyForm, {
          ref: 'myForm',
          props: { initialData: {} }
        }),
        configBtn: [
          {
            name: '取消',
            onClick: (component, { close }) => close()
          },
          {
            name: '确定',
            type: 'primary',
            onClick: async (component, { close, getRefs }) => {
              const formRef = getRefs('myForm')
              const valid = await formRef.validate()
              if (valid) {
                await formRef.submit()
                close()
              }
            }
          }
        ]
      })
    }
  }
}
```

### 使用 JSX

```javascript
import { useDialog } from 'es-eui'

export default {
  methods: {
    openJSXDialog() {
      useDialog()({
        title: 'JSX 对话框',
        width: '700px',
        render: (h) => (
          <div>
            <h3>JSX 内容</h3>
            <el-input v-model={this.inputValue} />
          </div>
        )
      })
    }
  }
}
```

### 防重复打开（key 缓存）

```javascript
import { useDialog } from 'es-eui'

export default {
  methods: {
    openUniqueDialog() {
      // 使用 key 防止重复创建
      useDialog()({
        key: 'unique-dialog',  // 相同 key 不会重复创建
        title: '唯一对话框',
        render: (h) => h('p', '只能同时打开一个')
      })
    }
  }
}
```

### 参数配置

```javascript
useDialog()({
  // 基础配置
  key: 'dialog-key',           // 唯一标识（用于缓存）
  title: '标题',               // 对话框标题
  width: '50%',               // 宽度
  height: '',                 // 高度
  maxHeight: '',              // 最大高度
  
  // 显示配置
  center: true,               // 垂直居中
  fullscreen: false,          // 是否全屏
  showClose: true,            // 显示关闭按钮
  hiddenFullBtn: false,       // 隐藏全屏按钮
  showDefaultButtons: false,  // 显示默认按钮
  
  // 交互配置
  closeOnClickModal: false,   // 点击遮罩关闭
  closeOnPressEscape: false,  // ESC 关闭
  isDraggable: false,         // 是否可拖拽
  destroyOnClose: true,       // 关闭时销毁
  
  // 内容配置
  render: Function,           // render 函数
  onSubmit: Function,         // 提交回调
  onClosed: Function,         // 关闭回调
  onOpen: Function,           // 打开回调
  
  // 按钮配置
  configBtn: []               // 自定义按钮数组
})
```

### 返回值

```javascript
const { close, instance } = useDialog()({...})

// close - 关闭对话框的函数
close()

// instance - 对话框组件实例
instance.visible  // 当前可见状态
```


---

## 按需引入

### 使用 babel-plugin-component（推荐）

```bash
npm install babel-plugin-component -D
```

配置 babel.config.js：

```javascript
module.exports = {
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: [
    [
      'component',
      {
        libraryName: 'es-eui',
        styleLibraryName: 'theme-chalk'
      }
    ]
  ]
}
```

组件中使用：

```vue
<template>
  <div>
    <es-dialog :visible.sync="visible" title="对话框">
      内容
    </es-dialog>
    <es-form :form-item-list="items" :model="form" />
  </div>
</template>

<script>
import { EsDialog, EsForm } from 'es-eui'

export default {
  components: {
    EsDialog,
    EsForm
  }
}
</script>
```

### 手动按需引入

```vue
<template>
  <es-dialog :visible.sync="visible" title="对话框" />
</template>

<script>
import EsDialog from 'es-eui/esDialog'
import 'es-eui/esDialog/src/esDialog.vue'

export default {
  components: { EsDialog }
}
</script>
```

---

## 进阶使用

### EsDialog + EsForm 组合使用

```vue
<template>
  <es-dialog
    :visible.sync="visible"
    title="编辑信息"
    width="700px"
    :config-btn="dialogButtons"
  >
    <es-form
      ref="formRef"
      :form-item-list="formItems"
      :model="formData"
      :layout-form-props="layoutConfig"
    />
  </es-dialog>
</template>

<script>
export default {
  data() {
    return {
      visible: false,
      formData: {},
      formItems: [
        { label: '姓名', prop: 'name', formtype: 'Input', span: 12 },
        { label: '邮箱', prop: 'email', formtype: 'Input', span: 12 },
        { label: '部门', prop: 'dept', formtype: 'Select', span: 12, dataOptions: [] },
        { label: '状态', prop: 'status', formtype: 'Switch', span: 12 }
      ],
      layoutConfig: {
        fromLayProps: { labelWidth: '80px' }
      }
    }
  },
  computed: {
    dialogButtons() {
      return [
        { name: '取消', onClick: () => { this.visible = false } },
        { 
          name: '确定', 
          type: 'primary',
          onClick: () => this.handleSubmit()
        }
      ]
    }
  },
  methods: {
    async handleSubmit() {
      const valid = await this.$refs.formRef.validate()
      if (valid) {
        await saveData(this.formData)
        this.visible = false
        this.$message.success('保存成功')
      }
    }
  }
}
</script>
```

### EsForm + EsTable 搜索表格

```vue
<template>
  <div>
    <!-- 搜索表单 -->
    <es-form
      :form-item-list="searchItems"
      :model="searchForm"
      :config-btn="searchButtons"
      :layout-form-props="{ fromLayProps: { isBtnHiden: true }}"
    />
    
    <!-- 数据表格 -->
    <es-table
      :data-source="tableData"
      :columns="columns"
      :pagination.sync="pagination"
      :options="tableOptions"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      searchForm: {},
      searchItems: [
        { label: '关键词', prop: 'keyword', formtype: 'Input', span: 6 },
        { label: '状态', prop: 'status', formtype: 'Select', span: 6, dataOptions: [] }
      ],
      searchButtons: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true }
      ],
      tableData: [],
      columns: [
        { prop: 'name', label: '名称' },
        { prop: 'status', label: '状态' },
        { label: '操作', scopedSlots: { customRender: 'action' } }
      ],
      pagination: { current: 1, pageSize: 10, total: 0 },
      tableOptions: {
        isInitRun: true,
        apiParams: {
          url: '/api/list',
          model: {}
        }
      }
    }
  }
}
</script>
```

### 自定义请求封装

```javascript
// httpRequest.js
export const httpRequest = (config) => {
  const { url, formParams, headers, method = 'POST' } = config
  
  return axios({
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    data: formParams
  }).then(res => res.data)
}

// main.js
import { httpRequest } from './httpRequest'
Vue.prototype.$httpRequest = httpRequest

// 组件中使用
export default {
  data() {
    return {
      tableOptions: {
        apiParams: { url: '/api/data' }
        // 会自动使用 this.$httpRequest 发送请求
      }
    }
  }
}
```

---

## API 参考

### 工具函数

#### draggable 指令

```javascript
import draggable from 'es-eui/esDialog/src/utils/draggable'

export default {
  directives: { draggable }
}
```

#### zIndexManager

```javascript
import zIndexManager from 'es-eui/esDialog/src/utils/zIndexManager'

// 获取对话框层级
const zIndex = zIndexManager.getDialogZIndex()
```

### 类型定义

```typescript
// EsDialog Props
interface EsDialogProps {
  visible: boolean
  title?: string
  width?: string
  height?: string
  maxHeight?: string
  fullscreen?: boolean
  size?: 'full' | 'large' | 'medium' | 'small' | 'mini'
  center?: boolean
  verticalPosition?: 'top' | 'center'
  modal?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  showClose?: boolean
  hiddenFullBtn?: boolean
  showDefaultButtons?: boolean
  configBtn?: ButtonConfig[]
  loading?: boolean
  destroyOnClose?: boolean
  customClass?: string
  appendToBody?: boolean
  beforeClose?: (done: () => void) => void
}

// Button Config
interface ButtonConfig {
  name: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'text'
  size?: 'medium' | 'small' | 'mini'
  plain?: boolean
  round?: boolean
  circle?: boolean
  disabled?: boolean | (() => boolean)
  loading?: boolean
  icon?: string
  onClick?: () => void
}

// Form Item
interface FormItem {
  label: string
  prop: string
  formtype: string
  span?: number
  isHiden?: (model: any, item: FormItem, props: any) => boolean
  dataOptions?: Array<{label: string, value: any}>
  apiParams?: ApiParams
  attrs?: Record<string, any>
  props?: Record<string, any>
  on?: Record<string, Function>
  render?: (h: Function, model: any, row: FormItem) => VNode
}

// Table Column
interface TableColumn {
  type?: 'selection' | 'index' | 'expand'
  prop?: string
  label?: string
  width?: string | number
  minWidth?: string | number
  fixed?: 'left' | 'right'
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  scopedSlots?: { customRender: string }
  render?: (h: Function, { row, index, column }: any) => VNode
}
```

---

## 更新日志

### v1.0.2 (2026-03-04)

- 修复 sass-loader 兼容性问题
- 优化构建配置

### v1.0.1

- 优化表格高度计算逻辑
- 修复表单远程加载问题

### v1.0.0 (2026-02-11)

- 首次发布
- 包含 EsDialog、EsForm、EsTable、SvgIcon 组件
- 提供 useDialog 组合式 API

---

## 许可证

[MIT](LICENSE)

## 相关链接

- [Element UI 文档](https://element.eleme.io/)
- [Vue 2 文档](https://v2.vuejs.org/)
- [npm 包页面](https://www.npmjs.com/package/es-eui)

