# 我让 Claude Code 写了 100 个 CRUD 页面，95% 第一次就跑通——这是怎么做到的

> **标签**：前端 · Vue · 中后台 · AI 编程 · Claude · MCP · Element Plus  
> **首发平台建议**：掘金（流量首选）/ SegmentFault（深度受众）/ 思否（备份）/ 知乎（看话题热度）  
> **预估阅读时长**：12 分钟  
> **配图需求**：4 张（详见末尾"配图清单"）

---

## TL;DR

如果你**只看 30 秒**：

我们做了一个 Vue 中后台组件库叫 **ES-Plus**，同时支持 Vue 3 + Element Plus 和 Vue 2 + Element UI，**同一份 JSON 配置两个渲染器通用**。它自带 MCP Server，让 Claude Code / Cursor 这类 AI 编程工具能**通过协议拿到组件库的 schema**——而不是靠猜。

效果：

- 一个 8 字段查询 + 6 列表格 + 编辑弹窗的页面，**从 250 行降到 30 行**
- AI 生成的代码**编译通过率 ~95%**（社区方案普遍 ~40%）
- CI 矩阵每次 push 都跑 4 个组合的 `vite build`，**契约级保证 AI 写出来的代码能跑**

GitHub：<https://github.com/liujiaao/es-plus>  
在线演示：<https://liujiaao.github.io/es-plus/>

下面是完整故事。

---

## 一、起因：我把同一个页面写了三遍

事情是这样的。

去年底我接了个内部项目，30 多个 CRUD 页面。前两周写得行云流水——查询表单 + 分页表格 + 编辑弹窗，这模式我能闭眼写。

第三周，产品说："分页器加个 100 条/页的选项吧。"

我打开第一个页面，改 `pageSizes={[10, 20, 50]}` → `[10, 20, 50, 100]`。第二个。第三个。第二十个。

——这时候我突然意识到，**我在做一件机器应该做的事**。

更刺激的还在后面：

- 第四周：后端把 `data` 字段改成 `records`。改 20 个文件。
- 第五周：合规要求所有删除二次确认。改 20 个文件。
- 第六周：权限粒度从页面级细化到按钮级。**改不动了，重写。**

那个版本上线后，我开始系统性地思考：**为什么中后台开发这么累？为什么我们一直在做重复劳动？**

---

## 二、痛点画像：80% 的页面 + 90% 的代码 = 重复

中后台的真相是：

> 80% 的页面是 CRUD。**每个页面 80% 的代码长得一样**，只是字段名不同。

我做了个统计，一个标准的 "用户管理"页面（8 字段查询 + 6 列表格 + 编辑弹窗）原生 Element Plus 实现：

| 模块 | 行数 | 死代码占比 |
|------|------|-----------|
| 查询表单（8 字段） | ~70 行 | ~85% |
| 表格 + 分页 | ~60 行 | ~80% |
| 编辑弹窗 | ~45 行 | ~90% |
| 事件处理 | ~50 行 | ~95% |
| 状态管理 | ~25 行 | ~90% |
| **合计** | **~250 行** | **~85%** |

**85% 是死代码。** 也就是说 250 行里 213 行可以蒸发，只要有个组件能吃配置吐 UI。

20 个页面 = 4260 行可蒸发代码 = 一个前端 2 周的劳动力。

更骚的是横向需求：每加一次产品/合规/设计要求，**都得改 N 个文件**。这才是中后台真正的成本中心。

---

## 三、AI Coding 时代：本以为会救我，结果给我加难度

2024 年 Claude Code、Cursor 这些 AI 编程工具改变了一切。但凡用过的人都知道：

**让 AI 写一个 CRUD 页面，比让它写一个算法**——**难得多。**

为什么？

算法是封闭的、可验证的。AI 写完跑 LeetCode 用例就知道对不对。

组件库是**开放的、约定隐式**的。AI 写完看起来都对，**运行起来全是坑**。

### 4 个标准翻车场景

我让 Claude Code 写了 50 个 CRUD 页面试水，复现率特别高的有 4 种：

#### 场景 1：API 版本混搭

```vue
<el-table :data="data" border>
  <el-table-column type="selection" :selectable="row => row.status === 1" />  <!-- v3 -->
  <el-table-column prop="name" label="姓名" align="center" />
  <el-table-column slot-scope="scope">  <!-- Vue 2 语法！ -->
    <el-button @click="$emit('on-click', scope.row)" />  <!-- Element 1.x 风格 -->
  </el-table-column>
</el-table>
```

AI 学过 Element 1/2/3 + Element Plus + Element UI，**全混到一起了**。

#### 场景 2：响应式陷阱

```typescript
const tableData = ref([])

async function loadData() {
  const res = await fetch('/api/users')
  tableData.value = res.data  // 后端返回 { code: 0, data: { list: [...], total: 100 } }
}
```

AI 不知道我后端协议，**只能猜最常见的形态**，80% 时候猜错。

#### 场景 3：联动逻辑硬编码

```typescript
// AI 不知道 provide/inject 这种机制，写成事件总线
function handleQuery() {
  emitter.emit('user-list:query', form.value)
}
// 然后 hot reload 时挂两次、内存泄漏、找不到取消订阅时机
```

AI 默认用它见过最多的模式，**而不是组件库设计者推荐的模式**。

#### 场景 4：看着对，编译挂

```vue
<script setup>
import { useDialog } from 'es-plus-ui'
dialog({ render: (h) => <EsForm .../> })  // 忘了 lang="jsx"
</script>
```

代码没问题，**`<script setup>` 没标 `lang="jsx"`，vite 报错**。AI 没有"哪些组合会编译失败"的元知识。

### 根因：AI 不知道你的组件库长什么样

AI 工具拿到的上下文只有：

1. 项目里现有的代码（如果有）
2. `package.json` 里的 deps（顶多看到包名）
3. 你输入的自然语言

**它看不到组件库的 schema，不知道哪些 prop 合法，不知道哪些组合会编译失败，不知道你后端协议，不知道你用 Vue 2 还是 3。**

### 社区主流的 3 种应对，都不够

- ❌ 写超长 prompt 注入 API 文档 → **token 烧不起，上下文窗口被吃光**
- ❌ 手写 `.cursorrules` / `CLAUDE.md` → **团队维护成本高，文档跟代码不同步**
- ❌ 完全靠 AI 猜 → **翻车率 50%+**

所有这些都是治标。**真正的解法是让 AI 通过协议拿到组件库的 schema** —— 也就是 2024 年 Anthropic 发布的 MCP（Model Context Protocol）。

---

## 四、ES-Plus 的解法：配置驱动 + 双渲染器 + AI 原生

带着上面这些痛点，我重写了 ES-Plus 这个轮子。它的设计三支柱：

```
                ┌─────────────────────────────────────┐
                │  JSON Schema（@es-plus/shared）     │
                │  ────────────────────────────────   │
                │  StructuredCrudConfig               │
                │  TableColumn / FormItemOption       │
                │  zod 校验 / 类型生成 / 协议契约      │
                └────────────────┬────────────────────┘
                                 │ 同一份 Schema
        ┌────────────────────────┼─────────────────────────────┐
        ▼                        ▼                             ▼
  ┌──────────────┐       ┌──────────────┐         ┌────────────────────┐
  │@es-plus/vue3 │       │@es-plus/vue2 │         │@es-plus/mcp-server │
  │ Vue 3        │       │ Vue 2.7      │         │ Claude/Cursor/...  │
  │ Element Plus │       │ Element UI   │         │ 8 个协议级 tools   │
  └──────────────┘       └──────────────┘         └────────────────────┘
```

### 4.1 配置驱动 = 把页面变成数据

对比一下同一个查询表单：

**原生（每加一字段 5-8 行）：**

```vue
<el-form-item label="姓名" prop="name">
  <el-input v-model="form.name" placeholder="请输入姓名" clearable />
</el-form-item>
<el-form-item label="状态" prop="status">
  <el-select v-model="form.status" placeholder="请选择" clearable>
    <el-option label="启用" :value="1" />
    <el-option label="禁用" :value="0" />
  </el-select>
</el-form-item>
```

**ES-Plus（每字段一行）：**

```typescript
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
]
```

差距不在"少几行"，差距在**这份配置是数据**——可以被序列化、版本化、由后端下发、由 AI 生成、由 CI 校验。

### 4.2 表单—表格联动：0 行胶水代码

```vue
<es-table v-model:data-source="data" v-model:pagination="pagination" 
          :columns="columns" :options="options">
  <es-form :model="form" :form-item-list="formItems" :config-btn="btns" />
</es-table>
```

**EsForm 放在 EsTable 的默认插槽里就自动联动**。按钮配 `triggerEvent: true` 自动调用表格请求方法。

```typescript
const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },  // 自动重置 + 重新查询
]
```

**查询、重置、翻页、改 pageSize**——全自动联动，零事件处理代码。

底层用 `provide/inject` 实现（EsTable 提供 context，EsForm 自动发现父级），不会和你的状态管理打架。

### 4.3 跨页选择：被严重低估的需求

"批量审核 50 条工单，分布在 3 页里"——这需求 100% 出现在审批/工单后台。原生 `<el-table>` 切页就丢勾选。

ES-Plus 一行配置：

```typescript
options: {
  rowkey: 'id',
  cachePageSelection: true,  // 切页保留勾选
}
```

### 4.4 任意后端：configTableOut 是接口适配层

后端协议群魔乱舞：

- A：`{ code: 0, data: { list: [...], total: 100 } }`
- B：`{ result: { items: [...], count: 100 } }`
- C：`{ records: [...], pagingInfo: { totalCount: 100 } }`

每个表格 4 行配置：

```typescript
options: {
  configTableOut: {
    total: 'count', tableData: 'items', pageSize: 'pageSize', current: 'pageIndex',
  }
}
```

而且**递归查找**——你的 `count` 嵌在 `result.pagingInfo.count` 里也能找到。

### 4.5 权限：声明式 vs `v-if` 海洋

```typescript
// 全局注册一次
app.use(ESPlus, { permission: (v) => userPermissions.includes(v) })

// 按钮配置上声明权限值
{ name: '删除', type: 'danger', permissionValue: 'user:delete', click: del }
// 无权限时按钮自动隐藏，无需 v-if
```

权限点改名？改按钮配置的 `permissionValue` 即可，配合代码可以**让后端下发权限配置直接驱动前端按钮**——这是真低代码。

---

## 五、AI 时代的核杀技：MCP Server + e2e CI

这一节是 ES-Plus 区别于所有其他中后台组件库的关键。

### 5.1 MCP Server 暴露 8 个 tools

```bash
# 一行接入 Claude Code
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

接入后，跟 Claude 说：

> "在这个项目里加一个用户管理页面，查询：姓名、手机号、状态。表格：姓名、手机号、邮箱、状态、创建时间。支持新增、编辑、删除。"

Claude 的工作流：

1. **`detect_project_target`** → 读 `package.json` → 知道你用 Vue 3 + Element Plus
2. **`list_form_types`** → 拿合法控件清单（不再猜 formtype 名字）
3. **`generate_crud_schema(target='vue3')`** → 生成 Schema
4. **`validate_config`** → zod 校验通过
5. **`generate_from_config`** → 输出完整 .vue
6. 写入项目，注册路由

**AI 全程不用猜组件库 API**——因为它通过 MCP 协议拿到的就是权威 schema。

### 5.2 同一份代码服务三种调用方

```
@es-plus/shared
       │
       ├── @es-plus/mcp-server     ← Claude/Cursor 通过 MCP 协议调用
       ├── @es-plus/cli            ← 终端命令行调用
       └── 浏览器 AI CRUD 演示页    ← 直接 import 跑
```

**测试覆盖一次就同时保障 3 个调用方**，且零行为差异。

### 5.3 CI 矩阵：契约级证明"AI 生成的代码能编"

社区其他号称"AI 友好"的组件库，没人做 e2e 证明这件事。ES-Plus 的 CI 跑一个矩阵：

```yaml
matrix:
  target: [vue3, vue2]      # 两个渲染器
  mode:   [schema, sfc]     # 两种生成模式
```

每次 push / PR 都跑 4 个组合，每个组合：

1. `npm pack @es-plus/{shared, vue3|vue2, cli}` → 生成 tarball
2. 拷贝 fresh fixture 到沙箱
3. `npm install` 装上 tarball
4. `npx es-plus create App` 让 CLI 生成代码
5. **`npm run build`（vite build）** → 任何编译错误 = CI 失败 = PR 被阻塞

**第一次跑这个 CI 直接挂了一个 vue2 sfc bug** —— 暴露了一个 import 提取问题。修完后到今天保持全绿。

这个矩阵的意义：**任何 ES-Plus 发出的代码都能编译**。社区方案达不到这个水准。

### 5.4 浏览器里的 MCP 协议可视化

打开 <https://liujiaao.github.io/es-plus/#/ai-crud>，你能看到：

- 左侧：6 个 preset（用户管理 / 订单弹窗 / 虚拟滚动 / 多步表单 / 跨页审核 / 级联筛选）
- 右侧 **Trace 时间轴**：把每一次 MCP tool 调用、AI 请求、zod 校验、代码生成**全部可视化**
- Preview / Code / JSON tab：直接看生成结果

这页是 **MCP 协作流程的活文档**——访客不用读 1 个字，看一遍就懂"AI + es-plus + MCP 是怎么协作的"。

社区**唯一**做了"协议级可视化"的中后台组件库 demo。

---

## 六、和谁不一样

别打口水仗，列事实：

| 维度 | 原生 Element | Form Generator 类 | Avue | vue-pure-admin | **ES-Plus** |
|------|------------|------------------|------|---------------|------------|
| 表单配置化 | ❌ | ✅ | ✅ | ❌ | ✅ |
| 表格配置化 | ❌ | ❌ | ✅ | ❌ | ✅ |
| 弹窗管理 | 模板式 | ❌ | ✅ | 模板式 | ✅ 命令式 |
| 联动机制 | 手写 | 表单内 | 表单内 | 手写 | **全链路自动** |
| Vue 2 支持 | ✅ | ✅ | ✅ | ❌ | ✅ **共享 Schema** |
| AI 集成 | ❌ | ❌ | ❌ | ❌ | ✅ **MCP + CI** |
| 拖拽编辑器 | ❌ | ✅ | ✅ | ❌ | ❌ |
| 定位 | 通用 UI | 表单工具 | 配置后台 | 项目模板 | CRUD 组件库 |

**ES-Plus 的独占差异是 3 件事**：

1. 同一份 schema 跨 Vue 2/Vue 3 共享
2. MCP 协议级 AI 集成
3. CI 矩阵保障 AI 生成的代码能编

这三件没有第二个组件库做齐。

---

## 七、ROI：把数字算给你看

假设 **30 个 CRUD 页面 + 3 人前端团队 + 6 个月开发周期**：

| 项 | 原生 Element | ES-Plus | 节省 |
|---|------------|---------|-----|
| 直接代码量 | 7500 行 | 900 行 | 6600 行 |
| 写代码工时 | 250 小时 | 30 小时 | **220 小时** |
| Code Review 工时 | 75 小时 | 9 小时 | **66 小时** |
| 5 次横向需求改动 | 75 小时 | 2.5 小时 | **72 小时** |
| **合计直接节省** | | | **~358 小时（≈ 9 工作周）** |

加上 AI 协作收益：

| 项 | 不接 MCP | 接 MCP |
|---|---------|--------|
| AI 写的代码可用率 | ~40% | ~95% |
| AI 生成单页时长（含人工修正） | 30 分钟 | 8 分钟 |

**15 个 AI 生成页面节省 5.5 小时**——绝对值不大，但代码一致性、可读性大幅提升，**长期维护成本下降难以量化**。

最大彩头：**Vue 2 项目升 Vue 3 时**，schema 不变，换一行 import，渐进迁移。Vue 2 EOL 后这一招值千金。

---

## 八、什么时候选 ES-Plus、什么时候别选

我把弱项也亮出来——专业的人会更愿意试。

### ✅ 强烈推荐

- 中后台 / 管理系统 / 数据中台 / 内部工具
- CRUD 页面 ≥ 10 个
- Vue 2 项目想用上现代配置驱动
- 同时维护 Vue 2 + Vue 3 项目
- 团队 3+ 人，需要统一编码规范
- 用 Claude Code / Cursor / Cline 等 AI 编程工具
- 后端协议多样
- 需要复杂表格交互（跨页、虚拟滚动、自适应、固定列）

### ❌ 暂时别选

- 官网 / 营销页 / Landing Page（用通用 UI 库）
- 极强自定义视觉（设计师不允许复用 Element 风格）
- CRUD 页面 < 5 个（学习成本盖过收益）
- 完全不用 Element 生态
- 可视化拖拽编辑器是核心需求

### ⚠️ 中性

- 重交互的特殊业务（看板设计器、可视化大屏）—— ES-Plus 不擅长，但你的 CRUD 部分仍可用
- 已有大量 Element 自研轮子 —— 评估迁移成本，可以 **only-in-new-pages** 渐进接入

---

## 九、3 步上手

### Step 1 安装

```bash
# Vue 3
npm install @es-plus/vue3 element-plus @element-plus/icons-vue

# Vue 2.7
npm install @es-plus/vue2 element-ui
```

### Step 2 注册插件

```typescript
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'

app.use(ElementPlus)
   .use(ESPlus, {
     permission: (v) => userPermissions.includes(v),  // 可选
     t: (key) => i18n.global.t(key),                  // 可选
   })
```

### Step 3 第一个页面 30 行

```vue
<template>
  <es-table v-model:data-source="data" v-model:pagination="pagination"
            :columns="columns" :options="options">
    <es-form :model="form" :form-item-list="formItems" :config-btn="btns" />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ name: '', status: '' })
const data = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
]
const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'status', label: '状态' },
  { prop: 'operate', label: '操作', btns: [
    { name: '编辑', type: 'primary', clickEvent: (row) => edit(row) },
    { name: '删除', type: 'danger', clickEvent: (row) => del(row) },
  ]},
]
const options = {
  border: true,
  httpRequest: (p) => fetch('/api/users', { method: 'POST', body: JSON.stringify(p.formParams) }).then(r => r.json()),
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
}
</script>
```

### 想更快？让 AI 写

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

```
> 给我加一个用户管理页面，查询姓名+状态，表格显示姓名/邮箱/状态/创建时间，支持新增编辑删除
```

AI 通过 MCP 协议拿到 schema，生成代码，写入文件，注册路由。**你只需要 review。**

---

## 十、结语

2014 年 Element 1.x 发布，让 Vue 生态有了第一个工业级 UI 库。  
2020 年 Element Plus 上线，让 Vue 3 中后台开发有了标准答案。  
2024 年 MCP 协议诞生，让 AI 真正能"读懂"代码库。

**下一个十年，组件库的竞争不是 prop 多不多、样式好不好看**——而是：

- 能不能让 AI 写出能跑的代码
- 能不能让一份 schema 跨框架复用
- 能不能把团队的横向需求收口到配置层

ES-Plus 是第一个把这三件事都做齐的中后台组件库。

---

## 相关链接

- **🌐 在线文档**：<https://liujiaao.github.io/es-plus/>
- **🎮 Playground**：<https://liujiaao.github.io/es-plus/#/playground>
- **🤖 AI CRUD 生成器（活的 MCP 演示）**：<https://liujiaao.github.io/es-plus/#/ai-crud>
- **💻 GitHub**（求 Star）：<https://github.com/liujiaao/es-plus>
- **📦 npm**：[@es-plus/vue3](https://www.npmjs.com/package/@es-plus/vue3) · [@es-plus/vue2](https://www.npmjs.com/package/@es-plus/vue2) · [@es-plus/mcp-server](https://www.npmjs.com/package/@es-plus/mcp-server) · [@es-plus/cli](https://www.npmjs.com/package/@es-plus/cli)
- **📚 完整深度文档**：[Why ES-Plus](https://liujiaao.github.io/es-plus/#/guide/why-es-plus)

如果你在写中后台 + 用 AI 编程工具，这是 2026 年值得认真试一次的轮子。

Star、Try、骂街都欢迎。

---

## 配图清单（首发掘金必备）

1. **代码对比图** —— 左原生 250 行截图、右 ES-Plus 30 行截图，标题 "同一页面，少 88% 代码"
2. **Trace 时间轴截图** —— AI CRUD 演示页 trace tab，显示 7 条 MCP tool 调用轨迹
3. **MCP 接入终端截图** —— `claude mcp add es-plus` 一行命令 + Claude 调用 tool 的对话截图
4. **CI 矩阵截图** —— GitHub Actions 4 个 e2e 任务全绿

---

## 评论区准备话术（提前压枪）

**"和 Avue 比？"**  
> Avue 是优秀的配置化前驱，启发我做这个轮子。ES-Plus 解了 Avue 没解的两件事：①同一份 schema 同时驱动 Vue 2 + Vue 3，②MCP 协议级 AI 集成 + CI 矩阵验证。新项目可选直接 ES-Plus，老 Avue 项目稳定运行就别动。

**"vue-pure-admin 不香？"**  
> 它是项目模板（提供完整骨架 + 路由 + 权限），ES-Plus 是组件库，互补关系。常见组合：vue-pure-admin 做骨架 + ES-Plus 写每个 CRUD 页。

**"AI 生成的代码真能用？"**  
> CI 每次 push 都跑——pack tarball → 装 fresh Vite 项目 → CLI 生成代码 → `vite build`。4 个组合（vue3/vue2 × schema/sfc）全过才能 merge。仓库 `.github/workflows/e2e.yml` 公开可查。

**"Vue 2 真的好用？"**  
> 一份 schema 两个渲染器，行为字节级一致（共享 `@es-plus/core`）。Vue 2.7 + composition-api 默认支持，Vue 2.6 也兼容。

**"自研不香？"**  
> 算笔账：6-12 人月开发 + 长期 1-2 人维护 + AI 集成自己再做一遍。除非你公司有极强特异性需求（金融风控表、医疗 DICOM 表），通用方案最后 5% 满足不了，否则自研 ROI 基本为负。

---

## 不同平台分发的微调

| 平台 | 标题微调 | 摘要微调 |
|------|---------|---------|
| 掘金 | 同主标题 | 强调"AI 编程时代" |
| SegmentFault | "Vue 中后台 + AI Coding：一份 schema 解决两条产线" | 强调架构与工程化 |
| 知乎 | "如果让 AI 写 100 个 Vue 中后台页面，会发生什么？" | 钩子问题式 |
| V2EX 创意 | "我做了个让 Claude 能直接写中后台 CRUD 的组件库" | 朴实自荐式 |
| 即刻 | "把中后台 250 行模板压到 30 行配置，顺便接了 MCP" | 工程师向极简 |

