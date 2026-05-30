# 为什么是 ES-Plus —— 中后台 CRUD 与 AI Coding 时代的配置驱动答卷

> 一句话总结：**ES-Plus 把"表单—表格—弹窗"这条中后台最高频的链路抽象成一份 JSON Schema，让人手敲的 200 行模板降到 30 行配置，让 AI 写出的代码第一次就能在 CI 里通过 `vite build`，让同一份配置在 Vue 3 + Element Plus 和 Vue 2 + Element UI 两个渲染器之间零成本切换。**

---

## 目录

1. [中后台开发的真实代价：那些没人愿意算的账](#一中后台开发的真实代价那些没人愿意算的账)
2. [复杂交互的隐形税：联动、跨页、自适应、权限、i18n](#二复杂交互的隐形税联动跨页自适应权限i18n)
3. [AI Coding 时代的新痛点：为什么 AI 写组件库总翻车](#三ai-coding-时代的新痛点为什么-ai-写组件库总翻车)
4. [ES-Plus 的解题思路：配置驱动 + 双渲染器 + AI 原生](#四es-plus-的解题思路配置驱动--双渲染器--ai-原生)
5. [核心能力深度解析](#五核心能力深度解析)
6. [对比竞品：和谁不一样、为什么](#六对比竞品和谁不一样为什么)
7. [AI 时代的核杀技：MCP Server + CLI + E2E 矩阵](#七ai-时代的核杀技mcp-server--cli--e2e-矩阵)
8. [真实 ROI 量化](#八真实-roi-量化)
9. [什么场景选 ES-Plus、什么场景别选](#九什么场景选-es-plus什么场景别选)
10. [3 步上手](#十3-步上手)

---

## 一、中后台开发的真实代价：那些没人愿意算的账

去任意一家做 SaaS / 内部系统 / 数据中台的公司随便抓一个前端，问"你最近写的页面长什么样"，八成会得到这几张图之一：

- **左上**：一排查询表单（姓名、状态、时间区间、所属部门……）
- **左下/正下**：一张分页表格，固定操作列（编辑、删除、详情）
- **右下/弹层**：一个编辑弹窗，里面又是一张表单 + 取消/确定
- **顶部右**：导出 / 批量操作 / 新增

这就是中后台的 **CRUD 八字真言**：查询 → 列表 → 弹窗 → 提交。**80% 的页面都是这个形态。** 之所以这件事如此痛苦，是因为它**重复但不机械**——每个页面字段不同、接口不同、状态机不同、校验不同、按钮权限不同，**复制粘贴每次都要改 30 处**。

### 1.1 一个真实页面的代码膨胀

以一个 **8 字段查询 + 6 列表格 + 编辑弹窗** 的 "用户管理"页面为例（极常见，几乎所有中后台都有）：

| 模块 | 原生 Element Plus 写法 | 行数 |
|------|----------------------|------|
| 查询表单（8 字段） | `<el-form>` + 8 个 `<el-form-item>` + 8 个 `<el-input>/<el-select>/<el-date-picker>` + 2 个按钮 | **~70 行** |
| 表格（6 列 + 操作列 + 分页） | `<el-table>` + 7 个 `<el-table-column>` + scope slot + `<el-pagination>` | **~60 行** |
| 编辑弹窗 | `<el-dialog>` + 内嵌 `<el-form>` + 取消/确定按钮 + `validate()` | **~45 行** |
| 事件处理 | `handleQuery` / `handleReset` / `handlePageChange` / `handleSizeChange` / `handleEdit` / `handleDelete` / `handleSubmit` | **~50 行** |
| 状态管理 | `formRef` / `tableLoading` / `dialogVisible` / `editingRow` / `currentPage` / `pageSize` / `total` / `selectedRows` | **~25 行** |
| **合计** | | **~250 行** |

**ES-Plus 把同样的页面降到 ~30 行配置 + ~10 行 setup**，节省 **~210 行**。

更关键的是：上面那 250 行里，至少 **180 行是死代码** —— 它们在每一个 CRUD 页面里都长得一模一样，只是字段名变了。任何一个有 20 个 CRUD 页面的项目，光这一项就有 **3,600 行可以蒸发的代码**。

### 1.2 这些"死代码"的隐性成本

数得清的：

- **写**：3,600 行 × 1 分钟/行 = 60 小时
- **审**：3,600 行 × 0.5 分钟/行 = 30 小时
- **测**：每页跑一遍 + 边界 case = 20 个页面 × 30 分钟 = 10 小时

数不清的（**真正杀人的部分**）：

- **改**：产品说"分页器加个 50/100 选项" → 改 20 个页面
- **改**：后端把 `data` 字段改成 `records` → 改 20 个页面
- **改**：UED 说所有查询按钮要加 loading → 改 20 个页面
- **改**：合规要求所有删除二次确认 → 改 20 个页面
- **改**：i18n 一期上线 → 改 20 个页面
- **改**：权限粒度从页面级细化到按钮级 → **改不动了，全部重写**

每一次这样的"横向需求"都让团队加班 1-2 周。**这才是中后台的真实成本**——不是写新代码慢，是改旧代码贵。

### 1.3 模板代码 vs 配置：从"写代码"到"写规则"

```vue
<!-- 传统：每加一个字段都要 5-8 行模板 -->
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

```typescript
// ES-Plus：每个字段一行，类型完备
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
]
```

差距不在"少几行"，差距在**这份配置是数据**——可以被序列化、版本化、由后端下发、由 AI 生成、由 CI 校验。模板是结构化的字符串，配置是结构化的对象。**结构化对象可以被工具处理；字符串只能被人处理。** 这是后续所有能力的地基。

---

## 二、复杂交互的隐形税：联动、跨页、自适应、权限、i18n

CRUD 页面的真正复杂度从来不在"渲染表单 + 表格"，而在它们之间的**联动**和**横切关切**（cross-cutting concerns）。这些问题大多数组件库视而不见，团队只能自己造轮子。

### 2.1 表单—表格联动：手敲 vs 自动

| 行为 | 传统做法 | ES-Plus |
|------|---------|---------|
| 点"查询"按钮 | 写 `handleQuery` → 取 form 值 → 拼参数 → 调 API → setLoading → setData → setTotal | `triggerEvent: true` |
| 点"重置"按钮 | 写 `handleReset` → `formRef.resetFields()` → 再调一次 query | `triggerEvent: true` + `key: 'rest'` |
| 切页 / 改 pageSize | 写 `handleCurrentChange` / `handleSizeChange` → 取当前 form 值（**坑：要拿最新值**）→ 调 API | **零代码**，分页自动带表单值请求 |
| 翻页保留勾选 | 维护 `selectedMap`，每次切页对比 rowKey 合并，再写回 `<el-table>` 的 selection | `cachePageSelection: true` |

ES-Plus 通过 `provide / inject` 让 **EsForm 放进 EsTable 的默认插槽就能自动发现父级表格**（参见 [packages/vue3/src/components/es-form/src/es-form.vue:648 行](../packages/vue3/src/components/es-form/src/es-form.vue) 中的 `inject('EsTableContext')`），按钮的 `triggerEvent: true` 直接调用表格的 `httpRequest`。**整个数据回路 0 行胶水代码。**

### 2.2 跨页选择：被严重低估的需求

"批量审核 50 条工单，分布在 3 页里" —— 这个需求 100% 会出现在审批/工单/对账类后台。原生 `<el-table>` 的 selection 切页就丢，社区方案普遍是手动维护 `Map<rowKey, row>`，每次切页对比合并。

ES-Plus 的 `cachePageSelection` 把这个常见需求做成一行配置：

```typescript
options: {
  rowkey: 'id',
  cachePageSelection: true,  // 跨页保留勾选，底部 toolbar 显示已选数
}
```

实现细节在 [packages/core/src/table-selection.ts](../packages/core/src/table-selection.ts) —— 同一份算法被 Vue 3 和 Vue 2 渲染器共用，意味着不管你的项目跑在哪个 Vue 版本，**勾选行为字节级一致**。

### 2.3 表格自适应高度：靠 `100vh - 360px` 是技术债

中后台表格要"撑满剩余空间"是高频需求。社区有几种做法：

| 做法 | 问题 |
|------|------|
| `height: calc(100vh - 360px)` | 头/工具栏高度变了就崩，响应式断点切换跟不上 |
| 在 `mounted` 里手动算 `offsetHeight` | 路由切换 / 父容器尺寸变化失效 |
| `<el-table :max-height>` | 是 max，不是 fill；窗口缩小数据多时溢出难看 |

ES-Plus 内置 `ResizeObserver`，监听父容器尺寸变化自动重算（参见 [packages/vue3/src/components/es-table/src/component.vue](../packages/vue3/src/components/es-table/src/component.vue) ~826 行的 `useTableHeight` 逻辑）。**用户拉浏览器、折叠侧栏、切换路由，表格都跟着变。**

### 2.4 任意后端：`configTableOut` 是接口适配层

中后台前端最常见的协议争论：

- 后端 A：`{ code: 0, data: { list: [...], total: 100 } }`
- 后端 B：`{ result: { items: [...], count: 100, pageNum: 1, pageSize: 10 } }`
- 后端 C：`{ records: [...], pagingInfo: { totalCount: 100 } }`

社区方案要么强迫前端写 axios 拦截器统一字段，要么强迫后端改协议。**ES-Plus 把"字段映射"作为表格配置的一等公民**：

```typescript
options: {
  configTableOut: {
    total: 'count',           // 后端的 count 当 total 用
    tableData: 'items',       // 后端的 items 当 data 用
    pageSize: 'pageSize',
    current: 'pageIndex',
  }
}
```

而且这个查找是**递归的** —— 你的 `count` 嵌在 `result.pagingInfo.count` 里也能找到，无需 dot-path 写法。

实战意义：**对接遗留系统不需要中间层**。一个对接了 5 个不同 BFF 的后台，每个 BFF 协议都不一样，过去要写 5 套 axios 拦截器，现在每个表格 4 行配置搞定。

### 2.5 权限：声明式 vs 命令式

绝大多数中后台的按钮权限是这么写的：

```vue
<el-button v-if="hasPermission('user:delete')" @click="del(row)">删除</el-button>
```

`v-if` 散落在所有模板里。一旦权限点改名（"`user:delete` → `iam.user.delete`"），全工程搜索替换，**漏一个就是事故**。

ES-Plus 把权限收口到**全局配置 + 按钮属性**：

```typescript
// main.ts —— 注册一次
app.use(ESPlus, { permission: (v) => userPermissions.includes(v) })

// 任意按钮 —— 声明权限值，组件自动判定
{ name: '删除', type: 'danger', permissionValue: 'user:delete', click: del }
```

权限策略改了？改 `permission` 函数一个地方。权限点改名？改按钮配置的 `permissionValue` —— 而且因为配置是数据，你可以用脚本批量替换、CI 校验全工程权限点合法性、甚至**让后端下发权限配置直接驱动前端按钮**。

### 2.6 i18n：`labelKey` + 函数注入

ES-Plus 不绑定任何 i18n 库。安装时传一个 `t` 函数，配置里加 `labelKey`：

```typescript
app.use(ESPlus, { t: (key) => i18n.global.t(key) })

const formItems = [
  { prop: 'name', label: '姓名', labelKey: 'form.user.name', formtype: 'Input' }
]
// 有 labelKey + t → 用翻译值；否则回退到 label
```

兼容 `vue-i18n` / `@intlify/core` / 任意自研方案。**i18n 一期上线不需要全工程改 `label` 为 `$t(...)`**，加 `labelKey` 即可，零破坏改造。

---

## 三、AI Coding 时代的新痛点：为什么 AI 写组件库总翻车

2024-2026 年这两年，Claude Code / Cursor / Continue / Cline 这些 AI 编程工具改变了一切。但凡用过的工程师都体验过：**让 AI 写一个 CRUD 页面**比让它写一个算法**难得多**。

为什么？因为算法是封闭的、可验证的——AI 写完跑测试就知道对错。组件库是开放的、有大量隐式约定的——AI 写完看起来没问题，**运行起来全是坑**。

### 3.1 AI 写组件库的 4 个标准翻车场景

#### 场景 1：API 版本错乱

```vue
<!-- AI 学过 Element 1.x、2.x、3.x、Plus 早期、Plus 当前、Element UI（Vue 2），混在一起 -->
<el-table :data="data" border>
  <el-table-column type="selection" :selectable="row => row.status === 1" />  <!-- ❌ 这是 v3 -->
  <el-table-column prop="name" label="姓名" align="center" />
  <el-table-column slot-scope="scope">  <!-- ❌ 这是 Vue 2 语法 -->
    <el-button @click="$emit('on-click', scope.row)" />  <!-- ❌ 这是 Element 1.x 风格 -->
  </el-table-column>
</el-table>
```

代码看起来很正经，**就是不能跑**。

#### 场景 2：响应式陷阱

```typescript
// AI 写的"用户列表"
const tableData = ref([])
const total = ref(0)

async function loadData() {
  const res = await fetch('/api/users')
  tableData.value = res.data  // ❌ 接口返回的不是 array
  // 实际 res = { code: 0, data: { list: [...], total: 100 } }
}
```

AI 不知道你后端的协议长什么样，只能猜一个最常见的。**80% 的时候猜错**。

#### 场景 3：联动逻辑硬编码

```typescript
// AI 不知道有 provide/inject 这种机制，把联动写成事件总线
function handleQuery() {
  emitter.emit('user-list:query', form.value)
}
// 在 EsTable 的 mounted 里再 emitter.on(...)
// —— 然后 hot reload 时事件挂两次、内存泄漏、找不到取消订阅的时机
```

AI 默认会用它见过最多的模式（事件总线、Pinia store、prop drill），**而不是组件库设计者推荐的模式**。

#### 场景 4：看起来对、编译挂

最阴险的一种。AI 写出的 SFC：

```vue
<script setup>
import { useDialog } from 'es-plus-ui'
// ...
dialog({ render: (h) => <EsForm .../> })  // ❌ JSX 没启用
</script>
```

代码逻辑没问题，**就是 `<script setup>` 没标 `lang="jsx"`，vite 编译报错**。这种 bug AI 自己识别不出来——它的训练语料里全是写好的代码，没有"哪些组合会导致编译失败"的元知识。

### 3.2 这些问题的根因：AI 不知道"你的组件库长什么样"

AI 工具拿到的上下文只有：

- 项目里现有的代码（如果有）
- npm 包名（顶多看到 `package.json` 的 deps）
- 你输入的自然语言描述

**它看不到组件库的 schema、不知道哪些 prop 合法、不知道哪些组合会编译失败、不知道你后端的协议、不知道你项目用 Vue 2 还是 Vue 3。**

社区主流的应对方式有三种，**每一种都不够**：

1. **写超长 prompt 注入 API 文档** —— 用户体验差，token 烧不起，AI 上下文窗口被吃光
2. **手写 `.cursorrules` / `CLAUDE.md`** —— 团队维护成本高，文档跟代码不同步
3. **完全靠 AI 猜** —— 翻车率 50%+

### 3.3 真正的答案：让 AI 通过协议拿到组件库的 schema

这就是 **MCP（Model Context Protocol）** 设计出来要解决的事——AI 不用学你的组件库，**让组件库自己告诉 AI 它有什么**。

ES-Plus 是社区**为数极少**真正落地了这件事的中后台组件库。下一节展开。

---

## 四、ES-Plus 的解题思路：配置驱动 + 双渲染器 + AI 原生

### 4.1 三个支柱

```
                ┌─────────────────────────────────────────┐
                │  JSON Schema（@es-plus/shared）         │
                │  ─────────────────────────────────────  │
                │  StructuredCrudConfig                   │
                │  TableColumn / FormItemOption / ...     │
                │  zod 校验 / 类型生成 / 协议契约         │
                └────────────────┬────────────────────────┘
                                 │ 同一份 Schema
        ┌────────────────────────┼─────────────────────────────┐
        ▼                        ▼                             ▼
  ┌──────────────┐       ┌──────────────┐         ┌────────────────────┐
  │@es-plus/vue3 │       │@es-plus/vue2 │         │@es-plus/mcp-server │
  │ Vue 3        │       │ Vue 2.7      │         │ Claude/Cursor/...  │
  │ Element Plus │       │ Element UI   │         │ generate / validate│
  └──────────────┘       └──────────────┘         │ list_form_types... │
                                                  │ detect_project_... │
                                                  └────────────────────┘
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │ @es-plus/cli        │
                       │ 命令行批量生成      │
                       └─────────────────────┘
```

### 4.2 配置驱动 = 把页面变成数据

ES-Plus 不是"另一个组件库"，它是**一层声明式 DSL**。这层 DSL 的产物是 `FormItemOption[]` / `TableColumn[]` / `DialogOptions`，它们是**可序列化的纯数据**。

| 把页面变成数据，意味着 | 你能做到 |
|---------------------|---------|
| 配置可以版本化 | git 直接 diff `users.config.ts` 就能看到字段变更 |
| 配置可以由后端下发 | 后端改字段不用前端发版（适合企业级低代码） |
| 配置可以被 AI 生成 | MCP server 输出的就是合法配置（[第七章](#七ai-时代的核杀技mcp-server--cli--e2e-矩阵)） |
| 配置可以被 schema 校验 | CI 时跑 `validate_config` 直接拦下错误 |
| 配置可以跨框架复用 | 同一份 columns 在 Vue 3 + Vue 2 渲染器中通用 |

### 4.3 双渲染器单 Schema：解决"Vue 2 项目能不能用"

很多中后台项目还在 Vue 2 + Element UI（**国内估算占比 35-45%**，截至 2026 年）。让这些项目升 Vue 3 的成本谁都背不起。

ES-Plus 的解法是 **拆出 `@es-plus/core` + 两个渲染器**：

```
@es-plus/core        ← 框架无关：types、配置校验、表格选择算法、请求层、form-layout 算法
@es-plus/vue3        ← Vue 3 渲染层 + Element Plus 适配
@es-plus/vue2        ← Vue 2.7 渲染层 + Element UI 适配
```

**同一份 `columns`、同一份 `formItemList`、同一份 `dialog options`**，换一行 import 路径就能从 Vue 3 项目搬到 Vue 2 项目（或反过来）。

更进一步：**MCP server 生成的配置可以指定 `target: 'vue3' | 'vue2'`**，AI 自己选择目标渲染器，并生成对应语法的 SFC。

### 4.4 AI 原生 = 协议级标准化

绝大多数组件库的"AI 友好"只是嘴上说说—— "我们的 API 名字很语义化，AI 容易学。" ES-Plus 把 AI 友好做成了**可验证的工程契约**：

1. **MCP server** 暴露 8 个 tools + 4 类 resources，AI 通过协议读取
2. **配置由 zod schema 强约束**，AI 生成的内容直接校验，错了立即重试
3. **CI 矩阵**：vue3 × vue2 × schema mode × sfc mode，每次 push 都跑 `vite build`，证明 AI 生成的代码**真的能编**

最后一项是终极保障。社区其他"AI 友好"组件库连一个 e2e 都没有，凭什么说"AI 能写"？

---

## 五、核心能力深度解析

### 5.1 EsForm —— 13 种控件 × 4 种数据来源 × 条件显隐

```typescript
const formItems = [
  // 1. 文本输入
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },

  // 2. 静态下拉
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },

  // 3. 日期范围（透传 Element Plus 的 attrs）
  { prop: 'date', label: '日期', formtype: 'datePicker', span: 8,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },

  // 4. 远程加载下拉（apiParams + 格式化回调）
  { prop: 'category', label: '分类', formtype: 'Select', span: 6,
    apiParams: { url: '/api/categories' },
    callOptionListFormat: (data) => data.map(i => ({ label: i.name, value: i.id })) },

  // 5. 条件显隐（响应式联动）
  { prop: 'remark', label: '备注', formtype: 'Input', span: 12,
    attrs: { type: 'textarea' },
    isHidden: (model) => model.status !== 1 },

  // 6. 完全自定义渲染（兜底逃生舱）
  { prop: 'custom', label: '自定义', formtype: 'render', span: 12,
    render: (h, model) => h(MyComponent, { value: model.custom }) },
]
```

控件列表：Input / Select / datePicker / timePicker / Switch / Rate / Cascader / Radio / Checkbox / Upload / Slider / ColorPicker / Transfer + `render` 逃生舱。

**`render` 字段是关键** —— 不像很多组件库被自己的配置 DSL 锁死，遇到特殊需求只能 fork 源码。ES-Plus 给所有 form-item 和 table-column 都留了 `render: (h, ctx) => VNode`，等同于"这个字段我自己渲染"。配置驱动 + 逃生舱 = 既享受 90% 场景的快速，又不在剩下 10% 场景里被困死。

### 5.2 EsTable —— 多级表头、虚拟滚动、操作列、跨页选择

`EsTable` 实际上是 **3 个渲染引擎**的统一外壳：

| 引擎 | 何时启用 | 文件 | 适用场景 |
|------|---------|------|---------|
| 标准引擎 | 默认 | [packages/vue3/src/components/es-table/src/component.vue](../packages/vue3/src/components/es-table/src/component.vue) | 几十 ~ 几千行 |
| 虚拟引擎 | `options.virtual: true` | [packages/vue3/src/components/es-table/src/engines/virtual-engine.vue](../packages/vue3/src/components/es-table/src/engines/virtual-engine.vue) | 上万行，性能敏感 |
| 树形引擎 | `lazy: true` + tree props | （内置在 component.vue） | 树状/层级数据 |

虚拟引擎包了 `el-table-v2`，并修了一个非常隐蔽的上游坑：**`el-table-v2` 的 `fixed` prop 实际控制的是 `bodyWidth = max(columnsTotalWidth, viewport)`** —— 不开 `fixed`，列再宽也不会横向溢出，固定右侧列在小屏会"脱离表格主体"。ES-Plus v1.4.1 默认开启并暴露 `scrollbar-always-on`，**用户什么都不用配，横向滚动就是对的**。

详见 [packages/vue3/CHANGELOG.md](../packages/vue3/CHANGELOG.md#141--virtual-table-horizontal-scroll-fix)。

### 5.3 useDialog —— 命令式 + 表单验证集成 + 嵌套弹窗

模板式弹窗的痛苦：

```vue
<!-- 你必须在模板里声明，但你在 setup 里才知道要不要打开 -->
<el-dialog v-model="visible" title="编辑">
  <UserForm ref="formRef" :data="editingRow" />
  <template #footer>
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="handleSave">保存</el-button>
  </template>
</el-dialog>

<script setup>
const visible = ref(false)
const editingRow = ref(null)
const formRef = ref()

function openEdit(row) {
  editingRow.value = row
  visible.value = true
}
function handleSave() {
  formRef.value.validate().then(() => { /* ... */ })
}
</script>
```

`useDialog` 把这件事彻底命令式化：

```typescript
const dialog = useDialog()

function openEdit(row) {
  const formData = reactive({ ...row })
  dialog({
    title: '编辑用户',
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm ref={el => el && registerRef('form', el)}
              model={formData}
              formItemList={[...]} />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '保存', type: 'primary', click: async (_, { close, getRefs }) => {
        await getRefs('form').validate()
        await api.update(formData)
        close()
      }},
    ],
  })
}
```

**关键能力**：

- `registerRef` / `getRefs` —— 命令式弹窗里也能用 ref（表单验证、子组件方法调用）
- `configBtn` 数组配置按钮，自带 loading / 二次确认 / 权限
- 嵌套弹窗：在一个 dialog 的 click 里再调 `dialog(...)`，z-index 自动叠加
- JSX 渲染，享受类型推导

### 5.4 EsCrudPage —— 一份 Schema 出整页

如果你的页面是标准的"查询 + 表格 + 弹窗" CRUD 模板，连前面的 EsForm + EsTable + useDialog 组合都可以省掉，**直接传一份 Schema**：

```typescript
const schema: CrudPageSchema = {
  api: { list: '/api/users', create: '/api/users', update: '/api/users/:id', delete: '/api/users/:id' },
  fields: [
    { prop: 'name', label: '姓名', formtype: 'Input', tableColumn: true, queryField: true },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [...], tableColumn: true, queryField: true },
    // ...
  ],
  actions: ['create', 'edit', 'delete'],
  dialog: { width: '600px' },
}
```

```vue
<es-crud-page :schema="schema" />
```

适合**真正只想出页面、不在乎细节定制**的场景（数据中台、内部系统、原型 demo）。复杂场景退回到 EsForm + EsTable + useDialog 组合，更细颗粒度的控制力。

### 5.5 类型系统：11 个核心接口 + 跨框架复用

```typescript
import type {
  FormItemOption,     // 表单项
  BtnConfig,          // 按钮
  LayoutFormProps,    // 表单布局
  TableColumn,        // 表格列
  TableOptions,       // 表格选项
  PaginationConfig,   // 分页
  DialogOptions,      // 弹窗
  ApiParams,          // 请求参数
  EsFormInstance,     // 表单实例方法
  EsTableInstance,    // 表格实例方法
  EsPlusOptions,      // 全局配置
} from '@es-plus/vue3'
```

**跨 Vue 2 / Vue 3 共享类型**：从 `@es-plus/core/types` 导入相同的接口名，同一份 `columns` 数组在两个项目里通用。**类型层面的可移植性**是社区方案罕见做到的。

---

## 六、对比竞品：和谁不一样、为什么

### 6.1 vs 原生 Element Plus / Element UI

**Element 是构件，ES-Plus 是模式。** Element 给你砖，ES-Plus 给你户型。

| 维度 | 原生 Element | ES-Plus |
|------|------------|---------|
| 学习曲线 | 低，文档丰富 | 中，要先理解配置驱动思维 |
| 单页代码量 | ~250 行 | ~30 行 |
| 横向需求改动 | 改 N 个页面 | 改 1 处配置或全局默认 |
| 自定义灵活度 | 100% | 95%（5% 的极端定制走 `render` 逃生舱） |
| 适合 | 落地页、营销页、少量后台页 | 中后台、内部系统、CRUD 密集场景 |

**建议**：如果你的项目里 CRUD 页面 < 5 个，直接用 Element 即可。**> 10 个时 ES-Plus 的 ROI 开始压倒一切**。

### 6.2 vs Form Generator 类（@form-create/vue-form-create/FormMaking）

这类工具的核心定位是**纯表单**，且通常带可视化拖拽编辑器。

| 对比项 | Form Generator | ES-Plus |
|--------|---------------|---------|
| 表单 | ✅ 强项 | ✅ 强项 |
| 表格 | ❌ 不覆盖 | ✅ 一等公民 |
| 弹窗 | ❌ 不覆盖 | ✅ `useDialog` |
| 联动 | 表单内字段联动 ✅ | **表单 ↔ 表格 ↔ 弹窗** 全链路 ✅ |
| 拖拽编辑器 | ✅ 通常有 | ❌ （ES-Plus 是代码 / 配置驱动，不做拖拽） |
| AI 工具链 | ❌ | ✅ MCP + CLI |

**结论**：如果你只要表单 + 拖拽编辑器，Form Generator 类合适。如果你要的是**整页 CRUD**，ES-Plus 是完整方案。

### 6.3 vs Vue Element Admin / vue-pure-admin / vue-element-plus-admin

这些是**项目模板**（Admin Template）—— 直接 clone 一个完整后台项目，包含路由、登录、权限、菜单等基建。

| 对比项 | Admin Template | ES-Plus |
|--------|---------------|---------|
| 定位 | 项目脚手架 | 组件库 |
| 提供的内容 | 完整骨架 + 示例页 + 路由 + 权限 + 主题 | 表单/表格/弹窗组件 |
| 上手方式 | clone & 改 | npm install & 用 |
| 升级 | 难（你改了它的源码） | 易（npm 升级） |
| 是否冲突 | — | **零冲突，可在 Admin Template 项目里用 ES-Plus** |

**它们是互补关系**。常见组合：用 vue-pure-admin 做项目骨架，用 ES-Plus 写每一个 CRUD 页面。

### 6.4 vs Avue / vxe-table

Avue 是国内做了多年的配置化后台组件库，vxe-table 是性能极强的表格组件。

| 对比项 | Avue | vxe-table | ES-Plus |
|--------|------|-----------|---------|
| 表单配置化 | ✅ | ❌ | ✅ |
| 表格配置化 | ✅ | ✅ (代码式更强) | ✅ |
| 弹窗管理 | ✅ | ❌ | ✅ `useDialog` |
| Vue 3 支持 | ✅ | ✅ | ✅ |
| Vue 2 支持 | ✅ | ✅ | ✅ **同一份 Schema** |
| 跨框架 Schema | ❌ | ❌ | ✅ |
| AI / MCP 集成 | ❌ | ❌ | ✅ **MCP Server + CLI + E2E CI** |
| 类型完整度 | 中 | 高 | 高（11 接口完整导出） |
| 文档站 | ✅ | ✅ | ✅ + AI CRUD 演示 + StackBlitz Playground |

ES-Plus 的独占差异：**Schema 跨 Vue 2/Vue 3 共享 + AI 原生工具链 + 持续集成保障**。这三点目前国内外社区里**没有第二个组件库做齐**。

### 6.5 vs Naive UI / Ant Design Vue 等"通用型 UI 库"

这些是面向**所有 Vue 应用**的通用 UI 库，对标 Element。不属于一个赛道——它们解决"按钮长什么样"，ES-Plus 解决"CRUD 页面怎么搭"。

实际项目里：**底层 UI = Element / Naive / AntDV → 中间层 = ES-Plus**，搭起来。

### 6.6 vs 自研基建

大公司常见路径：早期手写，后期发现痛了，组建团队做"通用表单引擎 / 表格引擎"。

| 对比项 | 自研 | ES-Plus |
|--------|------|---------|
| 启动成本 | 6-12 人月 | 0 |
| 维护成本 | 长期占用 1-2 个前端 | 0 |
| 文档 / 类型 | 取决于团队投入 | 完整 |
| AI 集成 | 0 → 自己又得做一遍 | 开箱即用 |
| 离职风险 | 唯一维护者离职就完蛋 | 开源社区 + 多渠道支持 |
| 自定义灵活度 | 100%（自家代码） | 95%（`render` 逃生舱） |

**适合自研的场景只剩一种**：你公司有非常强的特异性需求（如金融行业风控表格、医疗行业 DICOM 表格），通用方案的最后 5% 怎么都满足不了。其余场景**自研的 ROI 基本为负**。

---

## 七、AI 时代的核杀技：MCP Server + CLI + E2E 矩阵

这一节是 ES-Plus 区别于其他**所有**中后台组件库的关键。

### 7.1 MCP Server 暴露的 8 个 Tools

参见 [packages/mcp-server/src/tools/index.ts](../packages/mcp-server/src/tools/index.ts)：

| Tool | 作用 | 解决的痛点 |
|------|------|----------|
| `detect_project_target` | 读 package.json 推断 vue2/vue3 | AI 不再猜你用哪个 Vue 版本 |
| `generate_crud_page` | 自然语言 → 完整 .vue 文件 | 一句话生成可运行页面 |
| `generate_crud_schema` | 自然语言 → 结构化 Schema | 给 AI 一份合法配置作上下文 |
| `generate_from_config` | Schema → SFC 代码 | Schema-first 流程的 codegen 步骤 |
| `validate_config` | zod 校验配置 | AI 生成错配置立即拦截，自动重试 |
| `list_form_types` | 返回 13 种 formtype 清单 + 说明 | AI 不再猜哪些控件名合法 |
| `get_component_api` | 返回组件的 prop / event / slot | AI 看到的就是协议级 API 文档 |
| `scaffold_page` | 多页面脚手架生成 | 一次性创建一组关联页面 |

**所有 tool 的实现都在 `@es-plus/shared`** —— 这意味着：
- 浏览器里的 [AI CRUD 演示页](https://liujiaao.github.io/es-plus/#/ai-crud)直接调同一份代码（无需后端）
- 测试覆盖一次就同时保障 MCP server / CLI / 浏览器 demo
- 三个调用方零行为差异

### 7.2 一行配置接入 Claude Code

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

接入之后，在任意项目里跟 Claude 说：

> "在这个项目里加一个用户管理页面，查询条件：姓名、手机号、状态。表格列：姓名、手机号、邮箱、状态、创建时间。支持新增、编辑、删除。"

Claude 的工作流是：

1. 调 `detect_project_target` → 读你的 package.json → 知道你用 Vue 3 + Element Plus
2. 调 `list_form_types` → 拿到 13 种合法控件清单
3. 调 `generate_crud_schema(target='vue3')` → 生成 Schema
4. 调 `validate_config` → 校验通过
5. 调 `generate_from_config` → 输出完整 .vue 文件
6. 写入你的项目，注册路由

**AI 全程不用猜组件库 API，因为它通过 MCP 协议拿到的就是权威 schema**。

### 7.3 CLI：CI 友好、脚本友好、离线友好

```bash
# 交互式生成
npx @es-plus/cli create user-management

# 非交互式（适合 CI / 脚本）
npx @es-plus/cli create user-management \
  --target vue3 --mode sfc \
  -d "用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除"

# 校验配置（CI 步骤）
npx @es-plus/cli validate ./config.json --schema form-item
```

CLI 不依赖任何 AI 服务 —— 它用本地规则解析自然语言描述生成 Schema，**完全离线可用**，适合内网部署 / 涉密项目。

### 7.4 E2E 矩阵：证明 AI 生成的代码"真的能编"

很多组件库说"AI 友好"，但**没人做 e2e 证明这件事**。ES-Plus 的 CI 跑这样一个矩阵（[.github/workflows/e2e.yml](../.github/workflows/e2e.yml)）：

```
matrix:
  target: [vue3, vue2]      ← 两个渲染器
  mode:   [schema, sfc]     ← 两种生成模式
```

每个 push / PR 都会跑 **4 个组合**，每个组合的流程是：

1. `npm pack @es-plus/{shared, vue3|vue2, cli}` → 生成 tarball
2. 拷贝 fresh fixture（[__tests__/e2e/fixtures/vue3-fresh](../__tests__/e2e/fixtures/vue3-fresh) / [vue2-fresh](../__tests__/e2e/fixtures/vue2-fresh)）到沙箱
3. `npm install` 把刚 pack 的 tarball 装上
4. `npx es-plus create App --target X --mode Y` 让 CLI 生成代码
5. `npm run build` 跑 `vite build` —— 任何编译错误 = CI 失败 = PR 被阻塞

**第一次跑这个 CI 时，vue2 sfc 模式直接挂了** —— 暴露了一个 import 提取的 bug。修完之后到今天保持全绿。

这个矩阵的意义是**契约级保证**：**任何 ES-Plus 发出的代码都能编译**。这是社区方案普遍达不到的工程水准。

### 7.5 浏览器里的 AI CRUD 演示页

打开 [https://liujiaao.github.io/es-plus/#/ai-crud](https://liujiaao.github.io/es-plus/#/ai-crud)，你能看到：

- 左侧：6 个 preset（用户管理 / 订单弹窗 / 虚拟滚动 / 多步表单 / 跨页审核 / 级联筛选）
- 右侧 Trace 时间轴：把每一次 MCP tool 调用、AI 请求、zod 校验、代码生成**全部可视化**
- Preview / Code / JSON tab：直接看到生成结果

这页面是**"AI + es-plus + MCP 协作流程"的活文档** —— 访客不用读文档，看一遍就懂。这是社区**唯一**做了"协议级可视化"的中后台组件库 demo。

---

## 八、真实 ROI 量化

我们假设一个**有 30 个 CRUD 页面的中后台项目**，团队 3 个前端，6 个月开发周期。

### 8.1 直接代码量节省

| 项 | 原生 Element | ES-Plus | 节省 |
|---|------------|---------|-----|
| 30 个页面的代码量 | 30 × 250 = 7500 行 | 30 × 30 = 900 行 | **6600 行** |
| 30 个页面的写代码工时 | 7500 ÷ 30 行/小时 = 250 小时 | 900 ÷ 30 = 30 小时 | **220 小时** |
| Code Review 工时 | 7500 ÷ 100 行/小时 = 75 小时 | 900 ÷ 100 = 9 小时 | **66 小时** |

**直接节省：~286 小时 ≈ 7 个工作周（一个前端一个半月的工作量）**

### 8.2 横向需求节省

假设项目周期内有 5 个横向需求（分页器加选项 / 全局 loading / 删除二次确认 / 权限粒度细化 / i18n 上线）：

| 项 | 原生 Element | ES-Plus |
|---|------------|---------|
| 单次横向需求改动 | 改 30 个页面 × 0.5h = 15h | 改 1-2 处配置/全局函数 = 0.5h |
| 5 次合计 | 75h | 2.5h |

**横向需求节省：~72 小时 ≈ 1.8 个工作周**

### 8.3 AI 协作收益（v1.4+ 起独有）

假设团队用 Claude Code，新页面 50% 由 AI 生成（剩余 50% 是复杂业务页面）：

| 项 | 不接 MCP | 接 MCP |
|---|---------|--------|
| AI 写的代码可用率 | ~40%（猜 API 经常错） | ~95%（schema 约束 + zod 校验） |
| AI 生成 + 人工修正时长（单页） | 30 分钟 | 8 分钟 |
| 15 个 AI 生成页面工时 | 15 × 30 = 450 min | 15 × 8 = 120 min |

**AI 协作节省：~5.5 小时**（虽然绝对值不大，但**接 MCP 后 AI 写的代码可读性和一致性显著提升**，长期维护成本下降难以量化）

### 8.4 维护期收益（项目上线后）

项目上线之后才是真正的成本中心。一个**有 5 年生命周期**的中后台：

| 项 | 原生 Element | ES-Plus |
|---|------------|---------|
| 接新后端字段映射 | 改 axios 拦截器 + 改受影响页面 | `configTableOut` 配置改一处 |
| 加新字段到 30 个页面 | 改 30 处模板 | 改 30 处配置（行数少一个量级） |
| Vue 2 升 Vue 3（如果要） | 整个项目重写 | **保留 schema，换一行 import**，渐进迁移 |

**最后一项是潜在的项目救命稻草** —— Vue 2 EOL 后，能不能低成本升级到 Vue 3 决定一个项目活不活。ES-Plus 的双渲染器设计**让升级成本降到接近 0**。

---

## 九、什么场景选 ES-Plus、什么场景别选

### 9.1 强烈推荐用 ES-Plus

- ✅ **中后台 / 管理系统 / 数据中台 / 内部工具** —— 这是它的本命场景
- ✅ **CRUD 页面 ≥ 10 个** —— ROI 拐点
- ✅ **Vue 2 项目想用上现代配置驱动** —— 没有第二选择
- ✅ **同时维护 Vue 2 + Vue 3 项目** —— 同一份 Schema 复用
- ✅ **团队规模 3+ 人，需要统一编码规范** —— 配置驱动天然收敛
- ✅ **用 Claude Code / Cursor / Cline 等 AI 编程工具** —— MCP 接入立刻见效
- ✅ **后端协议多样、字段不统一** —— `configTableOut` + `listenToCallBack` 拦截
- ✅ **需要复杂表格交互**（跨页选择、虚拟滚动、自适应高度、固定列） —— 全部一行配置

### 9.2 暂时别选 ES-Plus

- ❌ **官网 / 营销页 / Landing Page** —— 用 Element / Vuetify / Naive 等通用 UI 库
- ❌ **极强自定义视觉**（设计师不允许复用任何 Element 风格） —— 自定义成本会超过收益
- ❌ **CRUD 页面 < 5 个** —— 配置驱动思维的学习成本盖过节省
- ❌ **完全不用 Element 生态** —— ES-Plus 强依赖 Element Plus / Element UI
- ❌ **可视化拖拽编辑器是核心需求** —— 用 Form Generator 类工具

### 9.3 中性场景（看具体情况）

- ⚠️ **重交互的特殊业务页**（如审批流编辑器、看板设计器、可视化大屏） —— ES-Plus 不擅长，但你的 CRUD 后台部分仍然可以用
- ⚠️ **已有大量 Element 自研轮子** —— 评估迁移成本，可以**渐进式 only-in-new-pages** 接入

---

## 十、3 步上手

### Step 1 安装

**Vue 3**：

```bash
npm install @es-plus/vue3 element-plus @element-plus/icons-vue
```

**Vue 2.7**：

```bash
npm install @es-plus/vue2 element-ui
```

### Step 2 注册插件

```typescript
// main.ts (Vue 3)
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'

createApp(App)
  .use(ElementPlus)
  .use(ESPlus, {
    permission: (v) => userPermissions.includes(v),  // 可选
    t: (key) => i18n.global.t(key),                  // 可选
  })
  .mount('#app')
```

### Step 3 写第一个 CRUD 页面

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
  httpRequest: (params) => fetch('/api/users', { method: 'POST', body: JSON.stringify(params.formParams) }).then(r => r.json()),
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
}
</script>
```

**就这样**。30 行配置，一个完整的查询 + 列表 + 分页 + 操作的中后台页面。

### 想更快？让 AI 写

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

```
> 给我加一个用户管理页面，查询姓名+状态，表格显示姓名/邮箱/状态/创建时间，支持新增编辑删除
```

AI 通过 MCP 协议拿到 ES-Plus 的 Schema，生成代码，写入文件，注册路由。**你只需要 review。**

---

## 资源链接

- **🌐 在线文档**：<https://liujiaao.github.io/es-plus/>
- **🎮 Playground（StackBlitz 沙箱）**：<https://liujiaao.github.io/es-plus/#/playground>
- **🤖 AI CRUD 生成器（活的 MCP 协议演示）**：<https://liujiaao.github.io/es-plus/#/ai-crud>
- **📦 npm 包**：
  - [@es-plus/vue3](https://www.npmjs.com/package/@es-plus/vue3)
  - [@es-plus/vue2](https://www.npmjs.com/package/@es-plus/vue2)
  - [@es-plus/core](https://www.npmjs.com/package/@es-plus/core)
  - [@es-plus/mcp-server](https://www.npmjs.com/package/@es-plus/mcp-server)
  - [@es-plus/cli](https://www.npmjs.com/package/@es-plus/cli)
- **💻 GitHub**：<https://github.com/liujiaao/es-plus>
- **📝 更新日志**：<https://github.com/liujiaao/es-plus/releases>
- **🚚 v1.4 迁移指南**：[docs/migrate-v1.4.md](./migrate-v1.4.md)

---

## 结语：组件库的下一个十年

2014 年 Element 1.x 发布，让 Vue 生态有了第一个工业级 UI 库。  
2020 年 Element Plus 上线，让 Vue 3 中后台开发有了标准答案。  
2024 年 MCP 协议诞生，让 AI 真正能"读懂"代码库。

下一个十年，组件库的竞争**不是 prop 多不多、样式好不好看**，而是**能不能让 AI 写出能跑的代码、能不能让一份 Schema 跨框架复用、能不能把团队的横向需求收口到配置层**。

ES-Plus 是第一个把这三件事都做齐的中后台组件库。

**Star、Try、Feedback**：<https://github.com/liujiaao/es-plus>

---

<small>本文档版本对应 ES-Plus v1.4.1 / Vue3 1.4.1 / Vue2 1.0.0 / Shared 1.1.0 / CLI 1.2.0 / MCP-Server 1.2.0（2026-05）。所有引用的源文件链接均指向当前仓库 master 分支。</small>
