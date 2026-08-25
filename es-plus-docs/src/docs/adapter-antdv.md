# Ant Design Vue 适配器

`@es-plus/adapter-antdv` 是 ES-Plus 的 **Ant Design Vue 4.x** 渲染适配器。它与 `@es-plus/vue3`（Element Plus 版）共享**完全相同的 JSON 配置 Schema**，将同一份配置映射为 Ant Design Vue 组件。

```
同一份 JSON 配置
    ├── @es-plus/vue3          → Element Plus 组件 (Vue 3)
    ├── @es-plus/vue2          → Element UI 组件 (Vue 2)
    └── @es-plus/adapter-antdv → Ant Design Vue 组件 (Vue 3)  ← 本页
```

:::tip 配置层 100% 兼容
所有 `FormItemOption`、`TableColumn`、`TableOptions`、`DialogOptions`、`CrudPageSchema` 等类型由 `@es-plus/core` 统一定义，三个渲染器共享。你可以在三个渲染器之间无缝迁移，**无需修改任何 JSON 配置**。
:::

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Vue | `^3.2.0` | 渲染框架 |
| ant-design-vue | `^4.0.0` | UI 组件库 |
| @ant-design/icons-vue | `^7.0.0` | 图标 |
| dayjs | `^1.10.5` | 与 ant-design-vue 共用同一实例，必须由宿主提供 |

## 安装

```bash
# npm
npm install @es-plus/adapter-antdv ant-design-vue @ant-design/icons-vue dayjs

# pnpm
pnpm add @es-plus/adapter-antdv ant-design-vue @ant-design/icons-vue dayjs

# yarn
yarn add @es-plus/adapter-antdv ant-design-vue @ant-design/icons-vue dayjs
```

## 注册插件

### 全量引入

```ts
// main.ts
import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import ESPlus from '@es-plus/adapter-antdv'
import 'ant-design-vue/dist/reset.css'
import '@es-plus/adapter-antdv/dist/style.css'
import axios from 'axios'

const app = createApp(App)
app.use(Antd)
app.use(ESPlus, {
  // 全局权限校验（按钮 permissionValue → boolean）
  permission: (value) => userStore.permissions.includes(value),
  // 全局 i18n 翻译（labelKey / nameKey → text）
  t: (key) => i18n.global.t(key),
  // EsTable 全局方法
  EsTable: {
    methods: {
      // 全局请求方法（未传 options.httpRequest 时使用）
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageIndex, pageSize })
        return data
      },
      // API 响应字段映射
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'data',
        pageSize: 'pageSize',
        current: 'pageIndex',
      }),
    },
  },
  // EsForm 全局方法
  EsForm: {
    methods: {
      $httpRequest: async ({ url, formParams }) => {
        const { data } = await axios.post(url, { ...formParams })
        return data
      },
    },
  },
})
app.mount('#app')
```

### 按需引入

直接使用命名导出，配合打包工具的 Tree Shaking：

```ts
import { EsForm, EsTable, EsCrudPage, useDialog } from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
```

### 自动导入（unplugin-vue-components）

```ts
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { EsPlusResolver } from '@es-plus/adapter-antdv/resolver'

export default {
  plugins: [
    Components({
      resolvers: [
        EsPlusResolver(),
        // 如需同时自动注入 ant-design-vue 基础样式：
        // EsPlusResolver({ importAntdStyles: true }),
      ],
    }),
  ],
}
```

配置后，模板中直接使用 `<EsForm>`、`<EsTable>`、`<EsCrudPage>`、`<EsDialog>`、`<SvgIcon>` 即可自动导入，并自动注入 `@es-plus/adapter-antdv/dist/style.css`。

## 组件 API

| 组件 | 说明 | 与 vue3 版本兼容 |
|------|------|------------------|
| `EsForm` | 动态表单，14 种控件 | ✅ 100% |
| `EsTable` | 动态表格，虚拟滚动 | ✅ 兼容 |
| `EsDialog` | 动态弹窗 | ✅ 兼容 |
| `EsCrudPage` | CRUD 编排组件 | ✅ 兼容 |
| `useDialog` | 命令式弹窗 | ✅ 100% |

:::tip 配置 API 与 vue3 完全一致
EsForm 的 `formItemList`、EsTable 的 `columns` / `options`、EsCrudPage 的 `schema` 等配置字段与 `@es-plus/vue3` 完全相同。请参考左侧导航「组件」分类下的 [EsForm](#/components/es-form)、[EsTable](#/components/es-table)、[EsCrudPage](#/components/es-crud-page) 文档。
:::

## 与 @es-plus/vue3 的差异

配置 Schema 100% 兼容，仅底层 UI 组件与少量交互细节不同：

| 功能 | vue3 (Element Plus) | adapter-antdv (Ant Design Vue) |
|------|--------------------|------------------------|
| 表格组件 | `<el-table>` | `<a-table>` |
| 弹窗组件 | `<el-dialog>` | `<a-modal>` |
| 虚拟滚动 | `engine: 'virtual'` → `<el-table-v2>` | `virtual: true` → ADV 原生虚拟滚动 |
| 加载状态 | `v-loading` 指令 | `<a-spin>` 包裹 |
| 确认弹窗 | `ElMessageBox.confirm()` | `Modal.confirm()` |
| ColorPicker | `<ElColorPicker>` | `input[type=color]`（降级，ADV 4.x 无内置） |
| 表单 v-model | `modelValue` / `onUpdate:modelValue` | `value` / `onUpdate:value` 等（内部已映射） |

v-model 字段名差异由适配器内部的 composables 自动映射，**配置层无需关心**；仅在自定义 `Slot` 透传 attrs 时需注意该差异。

## 常见问题

### DatePicker 报错 `isDayjs is not a function` 或语言包失效？

`dayjs` 是 peerDependency，必须由宿主项目安装，确保 `ant-design-vue` 与 `@es-plus/adapter-antdv` 使用同一个 dayjs 实例。本包构建时已将 `dayjs` 设为 external，切勿被打包工具重复打包进产物。

### ColorPicker 为什么是原生 `<input type="color">`？

Ant Design Vue 4.x 早期版本没有独立的 ColorPicker 组件，故降级为原生颜色选择器，以保持配置 Schema 与 vue3 版一致。如需高级取色器，可通过 `formtype: 'Slot'` + 自定义 `render` 实现。

### 可以和 `@es-plus/vue3` 同时使用吗？

不推荐。两者导出的组件同名（`EsForm` / `EsTable` 等），同时全局注册会冲突。同一项目请选择一种 UI 适配器；配置 JSON 可在两者间无缝迁移。

### 如何从 `@es-plus/vue3` 迁移到 `@es-plus/adapter-antdv`？

1. 替换依赖：`npm uninstall @es-plus/vue3 element-plus @element-plus/icons-vue` → `npm install @es-plus/adapter-antdv ant-design-vue @ant-design/icons-vue dayjs`
2. 修改 `main.ts` 的引入（见上方「注册插件」）
3. **JSON 配置无需任何修改** —— `formItemList` / `columns` / `schema` 原样保留
4. 检查自定义 `render` 函数中是否直接使用了 Element Plus 组件（如 `ElTag`），替换为对应的 ADV 组件（如 `Tag`）

## JSON Schema 支持

本包随包发布 JSON Schema 文件（位于 `node_modules/@es-plus/adapter-antdv/schemas/`），可在 VS Code 中为 JSON 配置文件提供自动补全与校验：

```json
{
  "$schema": "node_modules/@es-plus/adapter-antdv/schemas/form-item.schema.json",
  "prop": "name",
  "label": "姓名",
  "formtype": "Input"
}
```

详细的 IDE 配置方式见左侧 [IDE 配置自动补全](#/guide/schema-setup)。

## 下一步

- [EsForm 高级表单](#/components/es-form) — 14 种控件、联动、异步选项
- [EsTable 高级表格](#/components/es-table) — 虚拟滚动、跨页选择、远程数据
- [EsCrudPage 高级 CRUD](#/components/es-crud-page) — Schema 驱动的一站式 CRUD
- [权限与国际化](#/guide/permission-i18n) — `permissionValue` + `labelKey`
