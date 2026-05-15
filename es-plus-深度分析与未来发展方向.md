# ES-Plus 组件库深度剖析与发展战略

## 目录

- [一、核心特色价值剖析](#一核心特色价值剖析)
- [二、市场主流组件库横向对比](#二市场主流组件库横向对比)
- [三、AI 编程时代的价值审视](#三ai-编程时代的价值审视)
- [四、未来发展方向与路线图](#四未来发展方向与路线图)
- [五、行动建议与优先级排序](#五行动建议与优先级排序)

---

## 一、核心特色价值剖析

### 1.1 定位：中后台 CRUD 场景的配置化引擎

ES-Plus 不是"另一个 Element Plus 封装"，而是面向 **中后台 CRUD 页面** 的配置化运行时引擎。它的核心命题是：

> **用一个 JSON 配置对象替代 200-400 行的模板 + 脚本代码，同时保留完全的扩展能力。**

这个定位决定了它的价值不在于 UI 组件的丰富度（那是 Element Plus 的事），而在于 **运行时编排能力** —— 自动数据请求、字段映射、组件联动、回调管线。

### 1.2 三大核心支柱

#### 支柱一：配置化 —— JSON 即 UI

传统 Element Plus 开发中，一个 10 字段表单需要：

```vue
<!-- 传统写法：~100 行 -->
<el-form :model="form" :rules="rules" ref="formRef">
  <el-row :gutter="20">
    <el-col :span="8">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="form.name" placeholder="请输入姓名" />
      </el-form-item>
    </el-col>
    <el-col :span="8">
      <el-form-item label="部门" prop="dept">
        <el-select v-model="form.dept" placeholder="请选择" clearable>
          <el-option v-for="item in deptOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
    </el-col>
    <!-- 重复 8 次... -->
  </el-row>
</el-form>
```

ES-Plus 等价写法：

```js
// 配置化写法：~25 行
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 8, attrs: { placeholder: '请输入姓名' } },
  { prop: 'dept', label: '部门', formtype: 'Select', span: 8, dataOptions: deptOptions, attrs: { clearable: true } },
  // ...8 个字段，每行 1 行配置
]
```

**量化对比：**

| 场景 | 传统 Element Plus | ES-Plus | 缩减比 |
|------|-------------------|---------|--------|
| 10 字段查询表单 | ~100 行模板 + 30 行脚本 | ~25 行配置 | 75% |
| 6 列分页远程表格 | ~80 行模板 + 60 行脚本 | ~20 行列配置 + 10 行选项 | 78% |
| CRUD 弹窗（表单 + 确认） | ~60 行模板 + 40 行脚本 | ~25 行 `useDialog()` | 65% |
| 完整查询+表格+弹窗页面 | ~300 行 | ~80 行 | 73% |

#### 支柱二：联动化 —— 组件间零胶水通信

这是 ES-Plus 最具差异化的能力。主流方案中，表单查询触发表格刷新需要手动编写：

```js
// 传统写法：手动连线
const handleQuery = async () => {
  const valid = await formRef.value.validate()
  if (!valid) return
  const params = { ...formModel, pageIndex: pagination.current, pageSize: pagination.pageSize }
  const res = await api.getList(params)
  tableData.value = res.rows
  pagination.total = res.total
}
```

ES-Plus 中，只需将 `<es-form>` 放入 `<es-table>` 的默认插槽，查询按钮（`key: 'query'`）自动调用表格的 `httpRequestInstance(model)`：

```vue
<!-- ES-Plus 写法：零胶水代码 -->
<es-table :columns="columns" :options="tableOptions">
  <es-form :model="searchModel" :formItemList="formItems" :configBtn="queryBtns" />
</es-table>
```

**联动机制原理：**

```
EsTable (provide: getTableInstance)
  └─ EsForm (inject: getTableInstance)
       └─ 按钮 key:'query' → 自动调用 table.httpRequestInstance(model)

EsDialog (provide: bodyFormInstance)
  └─ EsForm (inject: bodyFormInstance)
  └─ EsTable (inject: bodyFormInstance → 获取表单数据加入请求)
```

这种 provide/inject 耦合意味着：
- 表单查询自动触发表格刷新
- 表单模型自动合并进表格的 API 请求
- 弹窗中的表单引用自动暴露给弹窗按钮回调

#### 支柱三：抽象化 —— 运行时管线编排

ES-Plus 将后端对接中最繁琐的部分抽象为声明式配置：

**字段映射（configTableOut）：**
```js
// 后端返回 { result_data, total_count, page_size, page_num }
// 前端期望 { data, total, pageSize, current }
configTableOut: {
  total: 'total_count',
  tableData: 'result_data',
  pageSize: 'page_size',
  current: 'page_num'
}
```

**回调管线（listenToCallBack）：**
```js
listenToCallBack: {
  brcb: (params) => ({ ...params, pageNum: params.pageIndex }),  // 请求前：前端字段 → 后端字段
  qrcb: (res) => { /* 响应后：后端数据 → 前端格式 */ return res }
}
```

**自动请求（apiParams + httpRequest）：**
```js
apiParams: { url: '/api/users', method: 'GET', model: { typeCode: 1 } },  // 声明式接口配置
httpRequest: customAxios,  // 自定义请求函数
isInitRun: true            // 挂载自动请求
```

这三个能力组合在一起，形成了一条完整的 **请求→转换→映射→渲染** 管线，而开发者只需声明配置。

### 1.3 独有能力清单

以下能力在主流方案中均需要手动实现或不可用：

| 能力 | 说明 | 主流方案 |
|------|------|----------|
| 表单-表格零胶水联动 | 表单查询自动触发表格刷新 | 需手动编写事件处理 |
| 自动折叠展开表单 | `minFoldRows` 自动折叠多余行 | 需手动计算 + v-show |
| 后端字段映射 | `configTableOut` 一行配置 | 需手动转换响应数据 |
| 请求回调管线 | `brcb`/`qrcb` 双向转换 | 需在请求层编写拦截器 |
| 跨页选择记忆 | `cachePageSelection` + `rowkey` | 需手动维护分页选择缓存 |
| 弹窗命令式 API | `useDialog()` 编程式调用 | 需声明 `visible` ref + 模板 |
| 动态列显隐 | `hidCol` 布尔值切换 | 需动态过滤 columns |
| 行操作按钮自动渲染 | `btns` 配置自动生成操作列 | 需手动 render 函数 |
| 条件字段显隐 | `isHidden: (model) => boolean` | 需逐个 v-if |
| 容器高度自适应 | `heightType: 'height'` + ResizeObserver | 需手动计算 |

---

## 二、市场主流组件库横向对比

### 2.1 综合对比矩阵

| 维度 | Element Plus | Ant Design Vue + ProComp | Naive UI | Vxe-table | FormKit | Formily | **ES-Plus** |
|------|-------------|-------------------------|----------|-----------|---------|---------|-------------|
| 表单配置化 | 模板驱动 | ProForm schema | 模板驱动 | 部分（vxe-form） | Schema 驱动 | JSON Schema 标准 | FormItemOption 配置 |
| 表格配置化 | 模板驱动 | ProTable columns | columns prop | 全配置 | - | - | columns + options |
| 自动数据请求 | 无 | ProTable 支持 | 无 | proxy-config | 无 | 部分（effects） | **apiParams + httpRequest** |
| 后端字段映射 | 无 | valueEnum | 无 | props-config | 无 | 无 | **configTableOut** |
| 回调管线 | 无 | 部分 | 无 | 事件链 | 无 | effects | **brcb/qrcb** |
| 表单-表格联动 | 无 | 部分 | 无 | 无 | 无 | 无 | **provide/inject 零胶水** |
| 折叠展开表单 | 手动 | 手动 | 手动 | - | - | - | **内置** |
| 弹窗编程式 API | 无 | 无 | 无 | 无 | 无 | 无 | **useDialog()** |
| 动态列显隐 | 手动 v-if | hideInTable | 手动 | 手动 | - | - | **hidCol** |
| 行操作按钮 | 手动 render | 手动 | 手动 | 手动 | - | - | **btns 自动渲染** |
| 条件字段显隐 | 逐个 v-if | hideInSearch | 手动 | - | - | x-reactions | **isHidden 函数** |
| 容器高度自适应 | 手动 | 手动 | 手动 | 手动 | - | - | **heightType + ResizeObserver** |
| 学习曲线 | 低 | 中 | 低 | 高 | 低 | **高** | **低** |
| 包体积 | 大 | 大 | 中 | 大 | 小 | **大** | **小** |
| 社区规模 | 19k+ stars | 20k+ stars | 16k+ stars | 7k+ stars | 4.5k stars | 11k+ stars | 早期 |
| AI 编程兼容性 | 优秀 | 良好 | 良好 | 一般 | 良好 | 较差 | 较差 |

### 2.2 关键差异深度分析

#### vs Element Plus（原厂方案）

Element Plus 提供"原子积木"，ES-Plus 提供"预制板"。核心区别：

- **Element Plus**：每个表单项需要 `<el-form-item>` + 具体组件 + v-model + rules；每个表格列需要 `<el-table-column>`；分页需要 `<el-pagination>` + 手动连线
- **ES-Plus**：`formItemList` 数组驱动表单、`columns` 数组驱动表格、`options.httpRequest` + `apiParams` 驱动数据、`configTableOut` 驱动映射

ES-Plus 是 Element Plus 的 **超集**——所有 Element Plus 的能力（render 函数、attrs 透传、事件监听）均可使用，但常用模式已被封装为配置。

#### vs Ant Design Vue ProComponents

ProComponents 是最接近 ES-Plus 理念的方案：

| 对比项 | ProComponents | ES-Plus |
|--------|--------------|---------|
| 配置化范围 | 表单 + 表格 | 表单 + 表格 + 弹窗 |
| 联动深度 | search ↔ table 部分 | form ↔ table ↔ dialog 深度联动 |
| 后端对接 | valueEnum + request | configTableOut + brcb/qrcb 管线 |
| 学习成本 | 中（需理解 ProComponents 概念） | 低（配置对象即 API） |
| 独立性 | 需额外安装 @vueComponent/procomponents | 单包安装 |

ProComponents 的 `ProTable` 支持 `request` + `columns.search` 实现搜索表格，但表单-表格的联动不如 ES-Plus 的 provide/inject 深度耦合，且缺少弹窗编程式 API。

#### vs Vxe-table

Vxe-table 在 **纯表格能力** 上远超 ES-Plus：

- 虚拟滚动（10万+ 行）
- 单元格编辑（内置）
- Excel 导入导出
- 拖拽排序
- 键盘导航
- 右键菜单

但 Vxe-table 缺少：
- 表单-表格联动（无 Form 组件耦合）
- 自动字段映射和回调管线
- 弹窗编程式 API
- 与 Element Plus 生态的无缝集成

**结论**：Vxe-table 是"表格领域的瑞士军刀"，ES-Plus 是"CRUD 页面的流水线"。二者互补而非竞争。

#### vs Formily

Formily 是最强大的 JSON Schema 表单方案（阿里出品），但：

| 对比项 | Formily | ES-Plus |
|--------|---------|---------|
| Schema 标准 | JSON Schema 标准 | 自有 FormItemOption |
| 学习曲线 | **陡峭**（响应式模型、Path 系统、Effects） | **平缓**（Vue 原生响应式） |
| 表单能力 | 极强（复杂嵌套、联动、副作用） | 够用（isHidden、on.change、apiParams） |
| 表格能力 | 无 | 有（EsTable 完整配置化） |
| 表单-表格联动 | 无 | 有 |
| 包体积 | 大（@formily/reactive + core + vue） | 小（轻量封装） |
| 双响应式 | 是（Formily Reactive + Vue Reactive） | 否（纯 Vue 响应式） |

**核心差异**：Formily 追求"表单的极致能力"，ES-Plus 追求"CRUD 页面的极致效率"。对于 80% 的中后台场景，ES-Plus 的简单配置比 Formily 的复杂 Schema 更实用。

### 2.3 ES-Plus 的不可替代性评估

| 场景 | ES-Plus 是否不可替代 | 原因 |
|------|---------------------|------|
| 标准 CRUD 页面（查询+表格+弹窗） | **接近不可替代** | 三组件零胶水联动是独特能力 |
| 复杂嵌套动态表单 | 可替代 | Formily 更强 |
| 大数据量表格（10万+ 行） | 可替代 | Vxe-table 更强 |
| 简单表单页面 | 部分可替代 | Element Plus + AI 生成即可 |
| 后端字段差异大的项目 | **接近不可替代** | configTableOut + brcb/qrcb 管线是独特能力 |
| 低代码/可视化搭建平台 | **不可替代** | 配置化架构天然适配动态 Schema 渲染 |

---

## 三、AI 编程时代的价值审视

### 3.1 核心问题：AI 能否替代配置化组件库？

**短答案**：AI 替代的是"写模板代码"，但替代不了"运行时编排"。

**长答案**：

AI 编程工具（Claude Code、Cursor、GitHub Copilot）擅长：
- 根据自然语言生成模板代码
- 复制粘贴重复的 `<el-form-item>` 模式
- 编写事件处理函数和数据请求逻辑

AI 不擅长：
- **保证跨文件一致性**——AI 可能在 A 页面用一种模式，B 页面用另一种模式
- **处理运行时动态性**——AI 生成的是静态代码，无法应对"配置来自后端接口"的场景
- **编排复杂交互**——表单查询触发表格刷新、字段联动、分页状态同步，AI 生成的代码容易遗漏边界情况
- **长期维护**——AI 生成的 200 行模板代码，每次修改都需要人工逐行审查

### 3.2 配置化 vs AI 生成：本质区别

```
传统开发：  需求 → 开发者写 300 行代码 → 运行
AI 辅助：   需求 → AI 生成 300 行代码 → 开发者审查 → 运行
配置化：    需求 → 开发者写 80 行配置 → 运行
AI + 配置化：需求 → AI 生成 80 行配置 → 运行（审查成本降低 75%）
```

关键洞察：**配置化让 AI 的产出更精准、审查成本更低**。

- AI 生成 300 行模板代码 → 开发者需要审查 300 行，关注 v-model 绑定、事件处理、生命周期等
- AI 生成 80 行配置 → 开发者只需审查配置项的正确性，运行时编排由组件库保证

### 3.3 ES-Plus 在 AI 时代的三大持久价值

#### 价值一：运行时引擎（AI 无法生成运行时）

ES-Plus 的 `httpRequest` + `apiParams` + `configTableOut` + `brcb`/`qrcb` 是一个 **运行时数据管线**。AI 可以生成调用这个管线的配置代码，但无法生成这个管线本身。

类比：AI 可以生成 SQL 查询语句，但不能替代数据库引擎。

#### 价值二：一致性保障（AI 生成代码容易漂移）

100 个 CRUD 页面如果都用 ES-Plus 配置，它们的数据请求模式、字段映射方式、分页逻辑完全一致。如果用 AI 逐页生成模板代码，每个页面的写法可能微妙不同，给长期维护带来隐患。

#### 价值三：动态 Schema 渲染（AI 只能生成静态代码）

ES-Plus 的 `formItemList` 和 `columns` 可以来自后端 API 返回的 JSON，实现 **运行时动态表单/表格**。这是 AI 生成的静态模板代码永远无法做到的。

```js
// 配置来自后端 → 动态渲染
const formItems = ref([])
onMounted(async () => {
  formItems.value = await api.getFormConfig('order-form')
})
```

这个能力是 ES-Plus 通向 **低代码平台** 和 **AI 驱动的页面生成** 的桥梁。

### 3.4 风险与挑战

| 风险 | 严重性 | 应对策略 |
|------|--------|----------|
| AI 工具让"减少样板代码"的价值减弱 | 中 | 转向强调"运行时引擎"价值，而非"代码量减少" |
| 自有 DSL 学习成本 vs AI 生成标准代码 | 高 | 提升 AI 对 ES-Plus 配置语法的理解（文档、示例、LLM 友好） |
| 主流库补齐配置化能力 | 中 | 加速迭代，建立先发优势 |
| 社区规模不足影响采用 | 高 | 专注垂直场景，打造标杆案例 |

---

## 四、未来发展方向与路线图

### 4.1 战略定位升级

**从"Element Plus 增强封装"升级为"中后台 CRUD 运行时引擎"**

当前定位侧重"封装增强"，容易被视为"可替代的语法糖"。升级后的定位强调：

- **运行时引擎**：不只是减少代码量，而是提供数据管线、组件编排、动态渲染的运行时能力
- **配置标准**：FormItemOption / TableColumn / TableOptions 成为企业级 CRUD 页面的配置标准
- **AI 协作层**：配置化架构天然适配 AI 生成——AI 生成配置，引擎渲染页面

### 4.2 四大发展方向

#### 方向一：深度 —— 强化运行时引擎能力

目标：让 90% 的中后台 CRUD 页面只需配置，无需编写 render 函数。

| 能力 | 当前状态 | 目标 | 优先级 |
|------|----------|------|--------|
| 表单验证 | 支持 rules | 支持 rules + 异步验证 + 联动验证 | P0 |
| 表格内编辑 | 需手写 render | 内置 `editable` 列配置 | P0 |
| 表格导出 | 不支持 | 内置 Excel/CSV 导出 | P1 |
| 表格虚拟滚动 | 不支持 | 集成 el-table-v2 或虚拟滚动方案 | P1 |
| 表格列拖拽排序 | 不支持 | 支持列拖拽调整顺序 | P2 |
| 表单步进/分步表单 | 需手动组合 | 内置 `steps` 配置 | P1 |
| 表单字段分组 | 需手动组合 | 内置 `group` 分组配置 | P2 |

**关键实现建议**：

```js
// 表格内编辑（目标 API）
const columns = [
  { prop: 'name', label: '姓名', editable: true, editType: 'Input' },
  { prop: 'status', label: '状态', editable: true, editType: 'Select', editOptions: statusOptions },
]

// 表单字段分组（目标 API）
const formItems = [
  { group: '基本信息', items: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'age', label: '年龄', formtype: 'Input' },
  ]},
  { group: '联系方式', items: [
    { prop: 'phone', label: '手机', formtype: 'Input' },
    { prop: 'email', label: '邮箱', formtype: 'Input' },
  ]}
]
```

#### 方向二：广度 —— 扩展组件覆盖面

目标：覆盖中后台页面全生命周期，从页面框架到业务组件。

| 新组件 | 解决的问题 | 优先级 |
|--------|-----------|--------|
| **EsPage** | CRUD 页面框架：查询 + 表格 + 弹窗一体化 | P0 |
| **EsTreeSelect** | 树形选择器：组织架构、地区选择 | P1 |
| **EsDescription** | 详情展示：配置化描述列表 | P1 |
| **EsTabs** | 标签页：配置化 Tab + 各 Tab 内容 | P2 |
| **EsFilter** | 筛选条：多条件组合筛选 | P2 |
| **EsImport** | 数据导入：上传 + 校验 + 预览 + 确认 | P2 |

**EsPage 核心设计**（最高优先级）：

```vue
<!-- 目标：一个配置对象定义完整 CRUD 页面 -->
<es-page :config="pageConfig" />

<script setup>
const pageConfig = {
  search: { formItems: [...], layout: { minFoldRows: 2 } },
  table: { columns: [...], options: { httpRequest: api.getList, ... } },
  dialog: { formItems: [...], width: '600px' },
  actions: { add: true, edit: true, delete: true, export: true }
}
</script>
```

这个组件是 ES-Plus 从"组件库"升级为"页面引擎"的关键一步。

#### 方向三：生态 —— 构建 AI 协作层

目标：让 AI 工具能高效生成 ES-Plus 配置，成为 AI 编程的"后端协议"。

| 举措 | 说明 | 优先级 |
|------|------|--------|
| **LLM 友好文档** | 为每个配置项提供结构化的 JSON Schema 定义 + 丰富示例 | P0 |
| **配置 Schema 导出** | 导出 FormItemOption / TableColumn / TableOptions 的 JSON Schema，供 AI 工具校验 | P0 |
| **AI Prompt 模板** | 提供"用 ES-Plus 配置生成 XXX 页面"的标准 Prompt | P1 |
| **MCP Server** | 开发 ES-Plus MCP Server，让 Claude Code 等 AI 工具可以直接查询 API 文档 | P1 |
| **VS Code 插件** | 配置项智能提示、校验、预览 | P2 |
| **CLI 脚手架** | `npx create-es-plus-page` 一键生成 CRUD 页面 | P2 |

**LLM 友好文档示例**：

```json
{
  "$schema": "https://es-plus.dev/schema/form-item.json",
  "title": "FormItemOption",
  "description": "ES-Plus 表单字段配置项",
  "type": "object",
  "properties": {
    "prop": { "type": "string", "description": "模型绑定路径，支持嵌套如 'address.city'" },
    "label": { "type": "string", "description": "字段标签" },
    "formtype": {
      "type": "string",
      "enum": ["Input", "Select", "datePicker", "timePicker", "Radio", "Checkbox", "Switch", "Slider", "ColorPicker", "Rate", "Upload", "Cascader", "Transfer"],
      "description": "表单控件类型"
    },
    "span": { "type": "number", "default": 6, "description": "栅格占位（24栅格制）" },
    "isHidden": { "type": "function", "description": "条件显隐函数，接收 (model, item, formProps) 返回 boolean" },
    "apiParams": { "$ref": "#/definitions/ApiParams", "description": "自动请求配置" }
  },
  "required": ["prop", "label"]
}
```

#### 方向四：标准 —— 推进配置协议标准化

目标：将 FormItemOption / TableColumn / TableOptions 从"ES-Plus 私有格式"升级为"行业通用协议"。

| 阶段 | 里程碑 | 时间线 |
|------|--------|--------|
| 阶段 1 | 完善 TypeScript 类型定义，导出 JSON Schema | 近期 |
| 阶段 2 | 支持导入/导出标准 JSON Schema 格式 | 中期 |
| 阶段 3 | 后端接口返回配置 Schema，前端动态渲染 | 中期 |
| 阶段 4 | 多 UI 框架适配器（Element Plus / Ant Design Vue / Naive UI） | 远期 |

**阶段 4 的关键设计**——UI 框架适配层：

```js
// 当前：绑定 Element Plus
import EsForm from 'es-plus/components/es-form'

// 目标：可切换 UI 框架
import { createEsPlus } from 'es-plus'
const esPlus = createEsPlus({
  adapter: 'element-plus'  // 或 'ant-design-vue'、'naive-ui'
})
```

这需要将 `useFormInputs` 从 Element Plus 硬编码改为适配器模式：

```js
// 当前：硬编码 13 种 Element Plus 组件
const inputRegistry = new Map([
  ['Input', (h, model, opts) => h(ElInput, { modelValue: ..., ... })],
  ['Select', (h, model, opts) => h(ElSelect, { modelValue: ..., ... })],
  // ...
])

// 目标：适配器模式
const adapters = {
  'element-plus': {
    Input: (h, model, opts) => h(ElInput, { modelValue: ..., ... }),
    Select: (h, model, opts) => h(ElSelect, { modelValue: ..., ... }),
  },
  'ant-design-vue': {
    Input: (h, model, opts) => h(AInput, { value: ..., ... }),
    Select: (h, model, opts) => h(ASelect, { value: ..., ... }),
  }
}
```

### 4.3 路线图总览

```
2025 Q3-Q4（近期）                    2026 Q1-Q2（中期）                   2026 Q3+（远期）
┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
│ ● 表格内编辑 editable     │     │ ● EsPage 一体化组件       │     │ ● UI 框架适配层           │
│ ● 表单联动验证            │     │ ● Excel/CSV 导出         │     │ ● 低代码平台集成          │
│ ● JSON Schema 导出       │     │ ● 虚拟滚动               │     │ ● 可视化页面搭建器        │
│ ● LLM 友好文档           │     │ ● MCP Server             │     │ ● 后端配置驱动前端渲染    │
│ ● TypeScript 类型完善    │     │ ● EsDescription 组件     │     │ ● 行业配置标准推广        │
│ ● EsTreeSelect 组件      │     │ ● 表单分组/步骤配置       │     │                          │
└──────────────────────────┘     └──────────────────────────┘     └──────────────────────────┘
      ↑ 核心价值强化                  ↑ 生态扩展                      ↑ 平台化
```

---

## 五、行动建议与优先级排序

### 5.1 立即行动（1-2 周）

| 序号 | 行动 | 理由 |
|------|------|------|
| 1 | 导出完整的 TypeScript 类型定义 | 类型定义是 JSON Schema、AI 协作、IDE 提示的基础 |
| 2 | 为每个配置项补充 JSDoc 注释 | LLM 友好文档的最低成本实现 |
| 3 | 编写 3-5 个真实业务场景的完整示例 | 现有示例偏技术演示，需要贴近真实业务的端到端案例 |

### 5.2 短期行动（1-2 月）

| 序号 | 行动 | 理由 |
|------|------|------|
| 4 | 实现 `editable` 列配置 | 表格内编辑是最高频需求，目前需手写 render |
| 5 | 实现 Excel/CSV 导出 | 中后台刚需，Vxe-table 有此能力 |
| 6 | 导出 JSON Schema 文件 | AI 工具可直接消费，提升 AI 生成准确率 |
| 7 | 编写 AI Prompt 模板文档 | 降低 AI 辅助开发 ES-Plus 的门槛 |

### 5.3 中期行动（3-6 月）

| 序号 | 行动 | 理由 |
|------|------|------|
| 8 | 开发 EsPage 一体化组件 | 从组件库升级为页面引擎的关键产品 |
| 9 | 开发 MCP Server | 让 Claude Code 等原生支持 ES-Plus 配置生成 |
| 10 | 集成虚拟滚动 | 大数据量表格的刚需，弥补与 Vxe-table 的差距 |
| 11 | 重构 useFormInputs 为适配器模式 | 为多 UI 框架支持打下架构基础 |

### 5.4 关键决策点

| 决策 | 选项 A | 选项 B | 建议 |
|------|--------|--------|------|
| 虚拟滚动方案 | 集成 el-table-v2 | 接入 Vxe-table | **选项 A**——保持 Element Plus 生态一致性，el-table-v2 可覆盖 90% 场景 |
| 多 UI 框架支持 | 适配器抽象层 | 维持 Element Plus 绑定 | **近期选项 B，远期选项 A**——先做深做透 Element Plus 生态，再考虑扩展 |
| EsPage 组件形式 | 纯配置组件 | 配置 + 插槽混合 | **选项 B**——纯配置无法覆盖所有定制需求，保留插槽逃逸口 |
| 低代码方向 | 自建可视化搭建器 | 对接现有低代码平台 | **选项 B**——ES-Plus 作为低代码平台的渲染引擎，而非自建平台 |

---

## 附录：ES-Plus 核心架构图

```
┌─────────────────────────────────────────────────────────┐
│                     ES-Plus 运行时引擎                    │
├─────────────┬──────────────┬───────────────┬────────────┤
│   EsForm    │   EsTable    │   EsDialog    │  Composables│
│             │              │               │             │
│ formItemList│ columns      │ useDialog()   │ useFormInputs│
│ formtype    │ options      │ render        │ useFormLayout│
│ apiParams   │ httpRequest  │ configBtn     │ useFormRequest│
│ isHidden    │ configTableOut│ isDraggable  │ useTableSelection│
│ on.change   │ listenToCallBack│ maxHeight  │ useTableResize│
│ render      │ btns/hidCol  │ getRefs()     │             │
├─────────────┴──────────────┴───────────────┴────────────┤
│              Provide/Inject 联动层                       │
│   EsTable.provide(getTableInstance)                      │
│       └─ EsForm.inject → query 按钮 → httpRequestInstance│
│   EsDialog.provide(bodyFormInstance)                     │
│       └─ EsTable.inject → 表单数据自动合并进请求          │
├─────────────────────────────────────────────────────────┤
│              数据管线层                                   │
│   apiParams → httpRequest → brcb → 后端                  │
│   后端 → qrcb → configTableOut → 前端渲染                │
├─────────────────────────────────────────────────────────┤
│              Element Plus 渲染层                         │
│   ElForm / ElTable / ElDialog / ElSelect / ElInput ...  │
└─────────────────────────────────────────────────────────┘
```

---

*文档版本：v1.0 | 生成日期：2026-05-14 | 基于 ES-Plus 1.0.0 源码分析*
