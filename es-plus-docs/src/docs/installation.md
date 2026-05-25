# 安装

## 环境要求

| 依赖 | 版本 |
|---|---|
| Vue | ^3.2.0 |
| Element Plus | ^2.2.0 |

ES-Plus 基于 Element Plus 构建，**必须先安装 Element Plus**。

## 包管理器安装

:::tip
ES-Plus 的 npm 包名为 `es-plus-ui`
:::

### npm

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
```

### yarn

```bash
yarn add es-plus-ui element-plus @element-plus/icons-vue
```

### pnpm

```bash
pnpm add es-plus-ui element-plus @element-plus/icons-vue
```

## 完整引入

推荐在入口文件中一次性注册所有组件：

```typescript
// main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ESPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
```

注册后即可在模板中直接使用 `<es-form>`、`<es-table>` 等组件，以及 `useDialog` Hook。

## 按需引入

如果只需部分组件，可以单独导入：

```typescript
import { EsForm, EsTable } from 'es-plus-ui'
import { useDialog } from 'es-plus-ui'

app.component('EsForm', EsForm)
app.component('EsTable', EsTable)
```

或直接在组件内导入：

```vue
<script setup>
import { EsForm } from 'es-plus-ui'
</script>
```

:::warning
按需引入时仍需确保 Element Plus 已全局注册或按需导入其基础组件（如 ElInput、ElSelect 等），ES-Plus 内部依赖这些组件。
:::

## 自动导入（unplugin-vue-components）

如果你的项目使用 `unplugin-vue-components` + `ElementPlusResolver` 做按需自动导入，**必须额外配置 `EsPlusResolver`**，否则 es-plus 内部依赖的 Element Plus 组件样式不会被注入。

### 为什么需要 EsPlusResolver？

`ElementPlusResolver` 只扫描你自己 `.vue` 模板中的 `<el-xxx>` 标签。es-plus 是预编译的第三方包，它内部使用的 `<el-table>`、`<el-form>`、`<el-pagination>` 等组件存在于已编译的 JS bundle 中，resolver 扫描不到它们，导致对应的 Element Plus 样式不会被注入。

### 安装配置

```bash
npm install -D unplugin-vue-components unplugin-auto-import
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { EsPlusResolver } from 'es-plus-ui/resolver'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [
        ElementPlusResolver(),
        EsPlusResolver()  // 自动注入 es-plus 依赖的 EP 组件样式
      ]
    })
  ]
})
```

配置后，模板中使用 `<es-table>`、`<es-form>` 时，构建工具会自动注入：
- `es-plus-ui/dist/style.css`（es-plus 自身样式）
- es-plus 内部依赖的所有 Element Plus 组件的按需样式

:::tip 不会重复引入
如果你同时配了 `ElementPlusResolver()`，相同组件的样式构建工具会自动去重，不会重复打包。
:::

### EsPlusResolver 选项

```typescript
EsPlusResolver({
  // 如果你已经全量引入了 Element Plus 样式，可以关闭 EP 样式注入
  importElementStyles: false,

  // 使用 SASS 源文件（适合自定义 Element Plus 主题）
  importStyle: 'sass'  // 默认 'css'
})
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `importElementStyles` | `boolean` | `true` | 是否注入 es-plus 依赖的 EP 组件样式 |
| `importStyle` | `'css' \| 'sass'` | `'css'` | CSS 编译后文件 / SASS 源文件 |

### 常见场景对照

| 你的项目配置 | 需要做什么 |
|---|---|
| 全量引入 `import 'element-plus/dist/index.css'` | 只需 `import 'es-plus-ui/dist/style.css'`，无需 resolver |
| `ElementPlusResolver()` 按需导入 | 必须添加 `EsPlusResolver()` |
| `ElementPlusResolver()` + 自定义主题 | 添加 `EsPlusResolver({ importStyle: 'sass' })` |

:::warning 不配置 EsPlusResolver 的后果
如果只配了 `ElementPlusResolver()` 而没有 `EsPlusResolver()`：
- es-plus 组件功能正常（JS 逻辑不受影响）
- 但内部 Element Plus 组件**无样式**（表格无边框、表单无布局、弹窗无遮罩等）
:::

## Vite 基础配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()]
})
```

## JSX 支持（高级用法）

如果你需要使用 `useDialog` 的 JSX `render` 能力（如分步弹窗、动态表单弹窗），项目需要配置 JSX 插件：

```bash
npm install -D @vitejs/plugin-vue-jsx
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue(), vueJsx()]
})
```

:::tip
如果只使用模板语法（`<es-form>`、`<es-table>` 等），无需安装此插件。JSX 仅在使用 `useDialog` 的 `render` / `renderFooter` 等函数式渲染场景时需要。
:::

## 浏览器兼容性

| 浏览器 | 最低版本 |
|---|---|
| Chrome | >= 80 |
| Firefox | >= 78 |
| Safari | >= 13 |
| Edge | >= 80 |

## 下一步

- [使用](/guide/usage) — 全局配置与组件用法
- [快速开始](/guide/getting-started) — 快速体验 ES-Plus
