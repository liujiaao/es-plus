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

## Vite 配置

如果使用子路径导入（如 `import EsForm from 'es-plus-ui/components/es-form'`），需要在 `vite.config.ts` 中配置别名：

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'es-plus-ui/components': 'es-plus-ui/es/components'
    }
  }
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
