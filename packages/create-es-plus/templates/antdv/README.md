# ES-Plus Starter · Vue 3 + Ant Design Vue

由 [`create-es-plus`](https://www.npmjs.com/package/create-es-plus) 生成。渲染器：**`@es-plus/adapter-antdv`**（Vue 3 + Ant Design Vue 4.x）。

## 跑起来

```bash
npm install
npm run dev
```

打开后你会看到一个 CRUD 页（查询表单 + 表格），它由 **一份配置** 驱动：

- 配置：[`src/views/demo.config.json`](src/views/demo.config.json)
- 用法：[`src/views/DemoCrud.vue`](src/views/DemoCrud.vue) 把配置传给 `<es-crud-page>`，`http-request` 返回 `{ data, total }`

同一份 `demo.config.json`，在 `@es-plus/vue3`（Element Plus）与 `@es-plus/vue2`（Element UI）两个脚手架里得到结构一致的页面——这就是 ES-Plus 的「一份配置，三端一致」。

> 表格默认走 Ant Design Vue 的 `<a-table>`。只有显式用 `engine: 'vxe'` 时才需额外安装并注册 `vxe-table`。

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
