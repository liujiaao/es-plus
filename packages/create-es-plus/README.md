# create-es-plus

一行命令生成一个**装上就能跑**的 [ES-Plus](https://github.com/liujiaao/es-plus) CRUD 项目：选渲染器、可选接入 AI（MCP）工具链，产出的示例页「一份配置，三端一致」。

```bash
npm create es-plus@latest
```

等价写法：`npm init es-plus@latest`、`npx create-es-plus@latest`、`pnpm create es-plus`、`yarn create es-plus`。

## 它会做什么

交互式问三件事，然后把对应模板拷进目标目录并还原 `.gitignore` / `.npmrc`：

1. **项目目录** —— 省略则询问；`.` 表示当前目录。
2. **渲染器** —— 三选一：
   - `vue3` —— Vue 3 + Element Plus（`@es-plus/vue3`）
   - `vue2` —— Vue 2.7 + Element UI（`@es-plus/vue2`）
   - `antdv` —— Vue 3 + Ant Design Vue（`@es-plus/adapter-antdv`）
3. **是否接入 MCP** —— 选是则写入 `.mcp.json`，在 Claude Code / Cursor 里可直接用自然语言让 AI 产出配置、由 ES-Plus 校验并确定性编译成页面。

生成的项目里有一个 CRUD 示例页（查询表单 + 表格，零后端可跑），由一份 `src/views/demo.config.json` 驱动 —— 这份配置在三个渲染器下结构一致。

```bash
cd your-project
npm install
npm run dev
```

## 命令行参数（跳过交互 / CI）

```
npm create es-plus@latest [dir] [options]

  [dir]                 项目目录（省略则交互询问；"." 表示当前目录）
  -t, --target <t>      渲染器: vue3 | vue2 | antdv
      --mcp             写入 MCP (AI 生成) 配置
      --no-mcp          跳过 MCP 配置
  -y, --yes             全部用默认值，不交互（CI / 一把梭）
  -f, --force           目标目录非空时仍写入
```

例：

```bash
npm create es-plus@latest my-app -- -t vue3 --no-mcp -y
```

> 用 `npm create` 时，`--` 之后的参数才会透传给脚手架。

## 三端差异（刻意为之）

模板尽量一致，少数几处因底层框架约束而不同，`create-es-plus` 已替你处理好：

- **vue3 / antdv** 用 `<script setup lang="ts">`，`build` 跑 `vue-tsc --noEmit && vite build`。
- **vue2** 用常规 `<script lang="ts">` + `defineComponent`（`@vitejs/plugin-vue2` 对 script setup 里的 TS 类型语法支持有缺陷），`build` 只跑 `vite build`；并额外带一份 `.npmrc`（`legacy-peer-deps=true`）与 `@vue/composition-api` 依赖，用于满足 `@es-plus/vue2` 产物里一条兼容 Vue 2.6 的静态 import。细节见生成项目的 README。

## 质量保证

- `check:scaffold`（随 `npm run check:consistency` 每次运行）静态校验：三份模板结构齐全、`package.json` 脚本与渲染器依赖正确、`main.ts` 导入正确、三份 `demo.config.json` 逐字节一致、其 `formtype` 均在 `VALID_FORM_TYPES` 内。
- `scaffold-smoke` CI workflow 在脚手架相关文件变动时，对三端真实跑一遍 `scaffold → npm install → npm run build`。

## 文档

- 在线文档 & Playground：https://liujiaao.github.io/es-plus/
- 源码：https://github.com/liujiaao/es-plus

## License

MIT
