# ES-EUI 组件库

基于 Element UI 的 Vue 2 组件库，提供对话框、表单、表格等常用组件。

## 安装

```bash
npm install es-eui
# 或
yarn add es-eui
# 或
pnpm add es-eui
```

## 依赖

本组件库依赖以下包，请确保项目中已安装：

- Vue ^2.6.14
- Element UI ^2.15.14

```bash
npm install vue@^2.6.14 element-ui@^2.15.14
```

## 全量引入

在项目入口文件（如 `main.js`）中全量引入：

```javascript
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsEui from 'es-eui'
import 'es-eui/dist/es-eui.css'

Vue.use(ElementUI)
Vue.use(EsEui)
```

## 按需引入

### 使用 babel-plugin-component（推荐）

安装 babel-plugin-component：

```bash
npm install babel-plugin-component -D
```

在 `babel.config.js` 中配置：

```javascript
module.exports = {
  presets: [
    '@vue/cli-plugin-babel/preset'
  ],
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

然后在组件中按需引入：

```javascript
import { EsDialog, EsForm, EsTable } from 'es-eui'

export default {
  components: {
    EsDialog,
    EsForm,
    EsTable
  }
}
```

### 手动按需引入

```javascript
import EsDialog from 'es-eui/esDialog'
import 'es-eui/esDialog/src/esDialog.vue'

export default {
  components: {
    EsDialog
  }
}
```

## useDialog 使用示例

`useDialog` 是一个组合式 API，用于管理对话框状态：

```javascript
import { useDialog } from 'es-eui/esDialog/src/utils/useDialog'

export default {
  setup() {
    const dialog = useDialog({
      title: '示例对话框',
      width: '600px',
      visible: false
    })

    const openDialog = () => {
      dialog.open()
    }

    const closeDialog = () => {
      dialog.close()
    }

    return {
      dialog,
      openDialog,
      closeDialog
    }
  }
}
```

在模板中使用：

```html
<template>
  <div>
    <el-button @click="openDialog">打开对话框</el-button>
    
    <es-dialog
      :title="dialog.title"
      :visible.sync="dialog.visible"
      :width="dialog.width"
      @close="closeDialog"
    >
      <div>对话框内容</div>
    </es-dialog>
  </div>
</template>
```

## 组件列表

### EsDialog

增强型对话框组件，支持拖拽、全屏等功能。

**主要特性：**
- 支持拖拽移动
- 支持全屏切换
- 支持自定义头部和底部
- 支持嵌套对话框

**基本用法：**

```html
<es-dialog
  title="标题"
  :visible.sync="visible"
  width="50%"
  :draggable="true"
  :fullscreen="false"
>
  <div>内容区域</div>
  <template #footer>
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="visible = false">确定</el-button>
  </template>
</es-dialog>
```

### EsForm

增强型表单组件，提供更便捷的表单配置方式。

**主要特性：**
- JSON 配置式表单
- 支持多种表单控件
- 支持表单验证
- 支持动态表单项

**基本用法：**

```html
<es-form
  :form-config="formConfig"
  :form-data="formData"
  @submit="handleSubmit"
/>
```

### EsTable

增强型表格组件，支持列宽调整等功能。

**主要特性：**
- 支持列宽拖拽调整
- 支持自定义列配置
- 支持分页
- 支持自定义操作按钮

**基本用法：**

```html
<es-table
  :columns="columns"
  :data="tableData"
  :pagination="pagination"
  @page-change="handlePageChange"
/>
```

### SvgIcon

SVG 图标组件。

**基本用法：**

```html
<svg-icon icon-class="example" />
```

## 许可证

[MIT](LICENSE)