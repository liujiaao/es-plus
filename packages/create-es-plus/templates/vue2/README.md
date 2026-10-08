# ES-Plus Starter · Vue 2 + Element UI

由 [`create-es-plus`](https://www.npmjs.com/package/create-es-plus) 生成。渲染器：**`@es-plus/vue2`**（Vue 2.7 + Element UI）。

## 跑起来

```bash
npm install
npm run dev
```

打开后你会看到一个 CRUD 页（查询表单 + 表格），它由 **一份配置** 驱动：

- 配置：[`src/views/demo.config.json`](src/views/demo.config.json)
- 用法：[`src/views/DemoCrud.vue`](src/views/DemoCrud.vue) 把配置传给 `<es-crud-page>`，`http-request` 返回 `{ data, total }`

同一份 `demo.config.json`，在 `@es-plus/vue3`（Element Plus）与 `@es-plus/adapter-antdv`（Ant Design Vue）两个脚手架里得到结构一致的页面——这就是 ES-Plus 的「一份配置，三端一致」。

> 本模板基于 **Vue 2.7**，用 `@vitejs/plugin-vue2` 跑 Vite，几处细节与 vue3 / antdv 模板不同：
>
> - **`.vue` 用常规 `<script lang="ts">` + `defineComponent`**，不是 `<script setup lang="ts">`。plugin-vue2 对 script setup 里的 TS 类型语法（`: Type` / `as` / `import type`）支持有缺陷，会在 build 时抛 babel 解析错误；defineComponent 写法则能稳定承载完整 TS。
> - **装了 `@vue/composition-api`**（见 `package.json`）。Vue 2.7 运行时并不用它，但 `@es-plus/vue2` 的发布产物里有一条静态 `import … from "@vue/composition-api"`（兼容 Vue 2.6 用），打包时必须能解析到。配套的 `.npmrc`（`legacy-peer-deps=true`）用于绕开该包声明里过时的 `vue <2.7` peer，使 `npm install` 不报 ERESOLVE。
> - **构建只做 `vite build`**，不内置 `vue-tsc` 类型检查步骤（Vue 2 + vue-tsc 组合坑多）。

## 接 AI（可选）

如果脚手架时选了「接入 MCP」，项目根已有 `.mcp.json`。在 **Claude Code / Cursor** 里直接说：

> 用 es-plus 做一个订单管理 CRUD 页，带状态筛选和批量删除

AI 会产出一份配置，由 ES-Plus 校验并确定性编译成页面。

- `.mcp.json` 默认用 `npx -y @es-plus/mcp-server`（零预装，但首跑冷启动较慢，可能触发客户端连接超时——等它下完即可）。
- 想免等：全局安装后把 `.mcp.json` 的 `command` 改成 `mcp-server-es-plus`、`args` 改成 `[]`：
  ```bash
  npm i -g @es-plus/mcp-server
  ```

## 文档

- 文档 & Playground：https://liujiaao.github.io/es-plus/
- 源码：https://github.com/liujiaao/es-plus
