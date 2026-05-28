# `@es-plus/vue2` 接入 es-eui 文档工程的本地集成测试指南

本指南描述如何把本仓库中刚实现的 Vue 2 适配包 (`@es-plus/vue2` + `@es-plus/core`) 接入到现有的 **es-eui** 文档工程（位于 [es-eui/](../es-eui/)），用于本地端到端验证：

1. 同一份 JSON Schema 配置在 Vue 2（Element UI）与 Vue 3（Element Plus）下渲染一致；
2. 表格 / 表单 / Dialog / CrudPage 等核心交互在 Element UI 下行为正常；
3. MCP / CLI 生成的 vue2 代码可以**直接落地** es-eui 工程中。

> 验证目标：`@es-plus/vue2` 的 API 与 `es-plus-ui` 完全对齐，仅差**底层 UI 库**。配置文件可在两个工程间无感迁移。

---

## 0. 前置条件

| 项 | 要求 |
|---|---|
| Node.js | ≥ 16（推荐 18+；es-eui 工程使用 vue-cli-service 5，至少需要 14） |
| npm | ≥ 7（es-plus monorepo 使用 npm workspaces） |
| Vue | es-eui 当前为 `vue@^2.6.14` |
| Element UI | es-eui 当前为 `element-ui@^2.15.14` |
| @vue/composition-api | **需要新增**（Vue 2.6 必须，Vue 2.7+ 可选） |

> es-eui 文档工程已使用 Element UI `mini` size，与 `@es-plus/vue2` 默认尺寸约定一致。

---

## 1. 构建 `@es-plus/core` 与 `@es-plus/vue2`

`@es-plus/vue2` 在运行时依赖编译产物（`dist/`），所以接入前必须先在 monorepo 内执行构建。

```bash
# 在 monorepo 根目录
cd e:/wokerCode/es-plus/es-plus

# 1) 安装依赖（如已安装可跳过；建议升级 Node 14 → 18 后再执行）
npm install

# 2) 构建框架无关核心
npm -w @es-plus/core run build

# 3) 类型检查 + 构建 vue2 渲染层
npm -w @es-plus/vue2 run typecheck
npm -w @es-plus/vue2 run build
```

构建成功后，应该在 [packages/vue2/dist/](../packages/vue2/dist/) 看到：

```
dist/
├── es-plus-vue2.js        ← ES Module 入口
├── es-plus-vue2.umd.cjs   ← CommonJS 入口
├── style.css              ← 内置样式
└── index.d.ts             ← TypeScript 类型声明
```

> ⚠️ **如果 typecheck 报 “Cannot find module 'vue'”**：那是因为 `vue` 是 peerDependency，monorepo 根目录没有装。要么在根 package.json 加 `vue@2.7.x` 作为 devDependency，要么直接跳过 typecheck（消费方安装时会自动满足 peer dep）。

---

## 2. 把构建产物链接到 es-eui

我们提供 **三种链接方式**，按推荐度排序：

### 方式 A — `npm link`（推荐：最贴近真实安装）

```bash
# 1) 在 monorepo 内为两个包注册全局软链
cd e:/wokerCode/es-plus/es-plus/packages/core && npm link
cd e:/wokerCode/es-plus/es-plus/packages/vue2 && npm link

# 2) 切到 es-eui 工程，把两个包都 link 进来
cd e:/wokerCode/es-plus/es-plus/es-eui
npm link @es-plus/core @es-plus/vue2

# 3) 同时安装新增的 peer 依赖
npm install --save @vue/composition-api
```

> 在 Windows 上 `npm link` 创建的是 junction，重启 IDE 后可能需要重新激活。

### 方式 B — `file:` 协议（最简单，不污染全局）

修改 `es-eui/package.json` 中 `dependencies`：

```diff
{
  "dependencies": {
    "axios": "^0.27.2",
    "element-ui": "^2.15.14",
    "vue": "^2.6.14",
    "vue-router": "^3.5.3",
-   "vuex": "^3.6.2"
+   "vuex": "^3.6.2",
+   "@vue/composition-api": "^1.7.2",
+   "@es-plus/core": "file:../packages/core",
+   "@es-plus/vue2": "file:../packages/vue2"
  }
}
```

```bash
cd e:/wokerCode/es-plus/es-plus/es-eui
npm install
```

> ⚠️ `file:` 协议会把整个目录**复制**到 `node_modules`。每次重新构建 vue2 包后必须 `npm install` 一次，否则旧产物不会刷新。

### 方式 C — `yalc`（适合频繁迭代）

```bash
# 一次性安装
npm i -g yalc

# 在 monorepo 端发布到本地仓库
cd e:/wokerCode/es-plus/es-plus/packages/core && yalc publish
cd e:/wokerCode/es-plus/es-plus/packages/vue2 && yalc publish

# 在 es-eui 端引入
cd e:/wokerCode/es-plus/es-plus/es-eui
yalc add @es-plus/core @es-plus/vue2
npm install
```

每次 vue2/core 改完代码：

```bash
cd packages/core && npm run build && yalc push
cd packages/vue2 && npm run build && yalc push
```

es-eui 工程会**热更新** `node_modules/@es-plus/*`，dev server 自动 reload。

---

## 3. 修改 es-eui 的 `main.js`

[es-eui/src/main.js](../es-eui/src/main.js) 当前同时使用 `Vue.use(esEui, { ... })` 注册自研组件。我们要把 `esEui` 替换或并行成 `@es-plus/vue2`。**推荐并行注册**，方便对比。

### 3.1 最小接入（仅安装插件）

```diff
  import Vue from 'vue'
  import App from './App.vue'
  import router from './router'
  import store from './store'
+ import VueCompositionAPI from '@vue/composition-api'        // Vue 2.6 必须
  import ElementUI from 'element-ui'
  import http from '@/utils/server/request.js'
  import 'element-ui/lib/theme-chalk/index.css'
  import esEui from './components/es-eui'
+ import EsPlus from '@es-plus/vue2'
+ // import '@es-plus/vue2/dist/style.css'                    // 如果 vite build 产出独立 CSS

+ Vue.use(VueCompositionAPI)
  Vue.use(ElementUI, { size: 'mini' })
  Vue.use(esEui, { /* 原有配置 */ })
+ Vue.use(EsPlus, {
+   permission: () => true,
+   // 全局 httpRequest（与 EsTable.options.apiParams 配合）
+   httpRequest({ url, headers, formParams, ...options }) {
+     const opt = {
+       baseURL: '',
+       url,
+       method: options.method || 'POST',
+       headers: { ...(headers || {}) },
+     }
+     if (opt.method.toUpperCase() === 'GET') opt.params = formParams
+     else opt.data = formParams
+     return http(opt)
+   },
+ })
```

> es-eui 的 `esEui` 组件名为 `es-table` / `es-form` / `es-dialog`，`@es-plus/vue2` 的全局组件名也是相同的小写连字符。两者**会冲突**——后注册的会覆盖前注册的。
>
> **如果只想验证 `@es-plus/vue2`**：注释掉 `Vue.use(esEui)` 即可。
>
> **如果想并行对比**：在 `Vue.use(EsPlus, { skipComponentRegistration: true })`，然后通过 `import { EsTable as EsPlusTable } from '@es-plus/vue2'` 局部注册并改组件名。

### 3.2 解决组件名冲突（如需并行）

在你的对比测试页里：

```vue
<template>
  <div>
    <h2>es-eui 原生</h2>
    <es-table :data-source="data" :columns="columns" :options="{ border: true }" />

    <h2>@es-plus/vue2</h2>
    <es-plus-table :data-source="data" :columns="columns" :options="{ border: true }" />
  </div>
</template>

<script>
import { EsTable as EsPlusTable } from '@es-plus/vue2'

export default {
  components: { EsPlusTable },
  data() {
    return {
      data: [{ name: 'Alice', age: 28 }, { name: 'Bob', age: 35 }],
      columns: [
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'age', label: '年龄' },
      ],
    }
  },
}
</script>
```

---

## 4. 在 es-eui 路由中注册测试页面

新建 [es-eui/src/views/component/EsPlusVue2Smoke.vue](../es-eui/src/views/component/) 作为冒烟测试入口。这个文件**完全照搬**了 es-eui 现有 EsTable 测试页的数据，只是把组件换成 `@es-plus/vue2` 提供的版本。

```vue
<template>
  <div class="container" style="padding: 24px">
    <h2>@es-plus/vue2 冒烟测试（与 Vue 3 版相同的 JSON 配置）</h2>

    <h3>1. 基础表格 + 静态数据</h3>
    <es-table
      :data-source="basicData"
      :columns="basicColumns"
      :options="{ border: true, stripe: true }"
    />

    <h3>2. 自动请求 + 分页（依赖全局 httpRequest）</h3>
    <es-table
      :columns="autoColumns"
      :pagination.sync="autoPagination"
      :options="{
        border: true,
        apiParams: { url: '/api/users', method: 'POST' },
        configTableOut: { total: 'total', tableData: 'data', current: 'pageIndex', pageSize: 'pageSize' },
        configBtn: [
          { name: '查询', key: 'query', type: 'primary', triggerEvent: true },
          { name: '重置', key: 'rest', type: 'default' },
        ],
      }"
    >
      <template #queryForm>
        <es-form :form-item-list="queryItems" :model="queryModel" :form-props="{ inline: true }" />
      </template>
    </es-table>

    <h3>3. 编程式 Dialog</h3>
    <el-button type="primary" @click="openDialog">打开 Dialog</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  name: 'EsPlusVue2Smoke',
  data() {
    return {
      basicData: [
        { name: 'Alice', age: 28, status: '在职' },
        { name: 'Bob', age: 35, status: '离职' },
      ],
      basicColumns: [
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'age', label: '年龄', width: 100 },
        { prop: 'status', label: '状态' },
      ],
      autoColumns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'name', label: '名称' },
        { prop: 'createdAt', label: '创建时间', width: 180 },
      ],
      autoPagination: { pageSize: 10, current: 1, total: 0 },
      queryModel: { keyword: '' },
      queryItems: [
        { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6 },
      ],
    }
  },
  methods: {
    openDialog() {
      useDialog({
        title: '测试 Dialog',
        width: '480px',
        render: (h) => h('div', { style: { padding: '12px' } }, '从 @es-plus/vue2 弹出的 Dialog'),
        configBtn: [
          { name: '取消', key: 'cancel' },
          { name: '确定', key: 'submit', type: 'primary' },
        ],
        onSubmit: (close) => {
          this.$message.success('已提交')
          close()
        },
      })
    },
  },
}
</script>
```

在 [es-eui/src/router/index.js](../es-eui/src/router/index.js) 增加一条路由：

```js
{
  path: '/es-plus-vue2-smoke',
  name: 'EsPlusVue2Smoke',
  component: () => import('@/views/component/EsPlusVue2Smoke.vue'),
}
```

启动 dev server：

```bash
cd e:/wokerCode/es-plus/es-plus/es-eui
npm run serve
# → http://localhost:8080/es-plus-vue2-smoke
```

---

## 5. 用 CLI / MCP 生成 vue2 代码并落地

`@es-plus/cli` 已经新增 `--target vue2`，验证它能产出可直接放进 es-eui 工程的代码。

```bash
# 在 monorepo 根目录
cd e:/wokerCode/es-plus/es-plus

# 5.1 NL 模式生成（schema 拆分模式）
node packages/cli/dist/index.js create user-management \
  --target vue2 \
  --description "用户管理：姓名、邮箱、状态查询；表格列含操作按钮" \
  --mode schema \
  --output ../es-eui/src/views/component/user-management

# 5.2 from-config 模式（使用结构化 JSON）
node packages/cli/dist/index.js create employee \
  --target vue2 \
  --from-config ./examples/employee.json \
  --output ../es-eui/src/views/component/employee
```

预期：

- `schema.ts` 中的 `import type { CrudPageSchema } from '@es-plus/vue2'`（**不是** `es-plus-ui`）
- `*.vue` 包装器使用 `defineComponent({ setup() })` 而非 `<script setup>`
- Element UI 名称（`Message`/`MessageBox`，无 `El` 前缀）

把生成出的文件夹挂到路由上，刷新页面即可验证渲染。

---

## 6. 验收清单

| # | 测试场景 | 预期结果 |
|---|---|---|
| 1 | EsTable 静态数据 + columns | 渲染正确，border / stripe 生效 |
| 2 | EsTable apiParams 自动请求 | 触发 httpRequest，分页参数 = `{ pageIndex, pageSize }`（受 configQueryfieldOutput 约束） |
| 3 | EsTable configBtn (query/rest) | 点击查询触发请求；点击重置清空 form 后再请求 |
| 4 | EsTable 多选 + 跨页缓存 | `multiSelect: true` + `cachePageSelection: true` 切页选中保留 |
| 5 | EsForm formItemList 各类 formtype | Input / Select / DatePicker / Radio / Checkbox / Switch / Slider 全部能输入 |
| 6 | EsForm 校验 | required + rules 触发 el-form-item 红色提示 |
| 7 | EsForm layoutFormProps 折叠 | minFoldRows: 1 时展开/收起按钮工作正常 |
| 8 | EsDialog 模板用法 | `<es-dialog :visible.sync>` 弹出 / 关闭正常 |
| 9 | useDialog 编程式 | `this.$useDialog({ render })` 弹出，configBtn / onSubmit 正常 |
| 10 | EsCrudPage 配置驱动 | 同一份 schema JSON 在 vue3 / vue2 demo 中视觉对齐 |
| 11 | render 函数自定义列 | `render(h, { row })` 用 createElement 创建 VNode，正常显示 |
| 12 | 权限按钮过滤 | `Vue.use(EsPlus, { permission })` 后，`permissionValue` 不通过的按钮不渲染 |
| 13 | 全局 size 注入 | `Vue.use(EsPlus, { componentSize: 'small' })` 后，子组件 size 默认值生效 |
| 14 | i18n labelKey | 注入 `t` 后，columns / formItemList 的 `labelKey` 优先于 `label` |
| 15 | virtual: true 不报错 | Vue 2 不支持虚拟滚动，应**降级为普通表格**并打印一次 warning（不能 throw） |

---

## 7. 已知差异与限制

| 维度 | 说明 |
|---|---|
| 虚拟滚动 | Element UI 没有 el-table-v2，`options.virtual=true` 会自动降级 |
| ConfigProvider | Element UI 无 ConfigProvider，i18n 走 ElementUI 自身 locale 机制 |
| 图标 | render 函数返回 `<i class="el-icon-xxx" />` 字符串类名，不是 Vue 3 的图标组件 |
| `<script setup>` | Vue 2 不支持，CLI 生成出的 vue2 包装器使用 `defineComponent({ setup })` |
| `v-model:visible` | Vue 2 用 `:visible.sync`，CLI 已自动改写 |
| TypeScript 类型 | EsTable / EsForm 的实例类型在 Vue 2 下没有 IDE 自动联想（受限于 Vue 2 编译器），运行时正确 |

---

## 8. 排错手册

### Q: 启动报 `Cannot resolve '@es-plus/vue2'`
- 检查 [es-eui/node_modules/@es-plus/vue2/dist/](../es-eui/node_modules/@es-plus/vue2/dist/) 是否存在
- 如果使用 `file:` 协议，记得每次构建后重跑 `npm install`
- 如果用 `npm link`，重启 IDE / dev server

### Q: 控制台报 `[Vue warn]: Cannot find element` 或 dialog 不显示
- 检查是否安装了 `@vue/composition-api` 并 `Vue.use(VueCompositionAPI)` 在 `Vue.use(EsPlus)` **之前**
- Vue 2.7+ 不需要这一步，Vue 2.6 必须

### Q: 同一份 schema 在 vue3 工程能跑、vue2 工程报错
- 检查 schema 中是否使用了 vue3-only 字段（如 `virtual: true` + `engine: 'virtual'`）
- 检查自定义 `render` 是否使用了 `h(Comp, { modelValue: x, 'onUpdate:modelValue': fn })` 格式 → vue2 必须改为 `h(Comp, { props: { value: x }, on: { input: fn } })`

### Q: Message / MessageBox is undefined
- es-eui 现有的 [main.js](../es-eui/src/main.js) 已用 `Vue.use(ElementUI)` 全局注册，CLI 生成的代码会用 `this.$message` / `this.$confirm`，正常工作
- 如果手写代码 `import { Message, MessageBox } from 'element-ui'`，记得**全量导入**而非按需导入

---

## 9. 后续工作

完成本指南验证后，建议把 [es-eui/src/views/component/EsPlusVue2Smoke.vue](../es-eui/src/views/component/) 的对比页做成持续回归用例，每次 `@es-plus/vue2` 发版前手动跑一遍。

进一步自动化：

```bash
# 生成两个版本的代码，diff 检查 schema 一致性
node packages/cli/dist/index.js create test --target vue3 --from-config ./fixtures/golden.json --output /tmp/v3
node packages/cli/dist/index.js create test --target vue2 --from-config ./fixtures/golden.json --output /tmp/v2

# 关键不变量：schema.ts 内容除 import 外应完全一致
diff <(grep -v "^import" /tmp/v3/test/schema.ts) <(grep -v "^import" /tmp/v2/test/schema.ts)
# 期望：无差异
```

---

**文档版本**：1.0.0  
**对应 `@es-plus/vue2` 版本**：1.0.0  
**最后更新**：2026-05-28
