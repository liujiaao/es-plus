# 安装

ES-Plus 在 npm 上以多包形式发布。根据使用的 Vue 版本选择对应渲染层：

| 包 | 适用 | 安装命令 |
|---|---|---|
| **`@es-plus/vue3`** | Vue 3 + Element Plus | `npm install @es-plus/vue3 element-plus` |
| **`@es-plus/vue2`** | Vue 2 + Element UI | `npm install @es-plus/vue2 element-ui` |
| `@es-plus/core` | 框架无关核心（自动安装） | — |
| `@es-plus/cli` | CLI 工具（可选） | `npm install -D @es-plus/cli` |
| `@es-plus/mcp-server` | AI MCP 集成（可选） | 见 [MCP Server](/guide/mcp-server) |

:::tip v1.4.0 包名重命名
旧包 `es-plus-ui` 已重命名为 **`@es-plus/vue3`**。`es-plus-ui@1.4.0` 仍以 stub 形式可用（再导出 `@es-plus/vue3`），但已被 `npm deprecate`。新项目请直接安装 `@es-plus/vue3`，老项目按 [迁移指南](/guide/migration) 调整。
:::

## Vue 3 — `@es-plus/vue3`

### 环境要求

| 依赖 | 版本 |
|---|---|
| Vue | ^3.2.0 |
| Element Plus | ^2.2.0 |

ES-Plus 基于 Element Plus 构建，**必须先安装 Element Plus**。

### 包管理器安装

**npm**

```bash
npm install @es-plus/vue3 element-plus @element-plus/icons-vue
```

**yarn**

```bash
yarn add @es-plus/vue3 element-plus @element-plus/icons-vue
```

**pnpm**

```bash
pnpm add @es-plus/vue3 element-plus @element-plus/icons-vue
```

### 完整引入

推荐在入口文件中一次性注册所有组件：

```typescript
// main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
```

注册后即可在模板中直接使用 `<es-form>`、`<es-table>` 等组件，以及 `useDialog` Hook。

### 按需引入

如果只需部分组件，可以单独导入：

```typescript
import { EsForm, EsTable } from '@es-plus/vue3'
import { useDialog } from '@es-plus/vue3'

app.component('EsForm', EsForm)
app.component('EsTable', EsTable)
```

或直接在组件内导入：

```vue
<script setup>
import { EsForm } from '@es-plus/vue3'
</script>
```

:::warning
按需引入时仍需确保 Element Plus 已全局注册或按需导入其基础组件（如 ElInput、ElSelect 等），ES-Plus 内部依赖这些组件。
:::

### Vite 配置

如果使用子路径导入（如 `import EsForm from '@es-plus/vue3/components/es-form'`），需要在 `vite.config.ts` 中配置别名：

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@es-plus/vue3/components': '@es-plus/vue3/es/components'
    }
  }
})
```

### JSX 支持（高级用法）

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

## Vue 2 — `@es-plus/vue2`

如果你的项目还在 Vue 2 + Element UI 上，使用 `@es-plus/vue2`。完整用法参考 [Vue 2 指南](/guide/vue2)。

### 环境要求

| 依赖 | 版本 |
|---|---|
| Vue | ^2.6.14 |
| Element UI | ^2.15.0 |
| @vue/composition-api | ^1.7.0（仅 Vue 2.6 需要，2.7 内置） |

### 包管理器安装

**Vue 2.7+（推荐，内置 Composition API）**

```bash
npm install @es-plus/vue2 element-ui
```

**Vue 2.6（需要 Composition API 插件）**

```bash
npm install @es-plus/vue2 element-ui @vue/composition-api
```

### 注册插件

```javascript
// main.js — Vue 2.7+
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)
```

```javascript
// main.js — Vue 2.6
import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'
import ElementUI from 'element-ui'
import EsPlus from '@es-plus/vue2'

Vue.use(VueCompositionAPI)
Vue.use(ElementUI)
Vue.use(EsPlus)
```

:::tip 配置完全一致
Vue 2 与 Vue 3 共用同一份 `columns` / `formItemList` / `options` JSON 配置。同一份业务配置在两个项目中渲染结果一致，可通过 `@es-plus/core/types` 共享类型定义。
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
- [Vue 2 指南](/guide/vue2) — Vue 2 渲染层差异、限制与示例
- [迁移指南](/guide/migration) — 从 `es-plus-ui` 迁移到 `@es-plus/vue3`
- [快速开始](/guide/getting-started) — 快速体验 ES-Plus
