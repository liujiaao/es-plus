# 更新日志

记录 es-plus-ui 各版本的变更内容。完整发布记录请查看 [GitHub Releases](https://github.com/liujiaao/es-plus/releases)。

## v1.3.5

> 2026-05-27 发布

**EsTable 虚拟滚动（el-table-v2）**

- 新增 `virtual: true` 一键启用虚拟滚动引擎，支持 10 万行数据流畅渲染
- 基于 Strategy Pattern + 条件渲染架构，现有 EsTable 用法零改动
- 完整兼容：`type: 'selection'`、`type: 'index'`、`type: 'expand'`、`render`、`scopedSlots`、`ellipsis`、`formatter`、`btns`、`fixed`、`sortable` 全部适配
- O(1) 选择性能：基于 Set 跟踪，勾选/全选无 O(n) 遍历
- 新增 TableOptions 字段：`virtual`、`engine`、`rowHeight`、`estimatedRowHeight`、`overscanCount`、`rowClassName`
- 新增 expose 方法：`scrollToRow(index)` — 虚拟模式按行索引滚动
- 支持 `highlightCurrentRow`、`stripe`、`border` 样式与普通表格一致

**文档**

- 新增 6 个虚拟表格高级场景示例：
  - 10 万行基础虚拟滚动
  - 排序 + 固定列 + 序号列 + 斑马纹
  - 多选 + 高亮 + 操作按钮
  - render / scopedSlots / ellipsis / formatter 自定义渲染
  - rowClassName + highlightCurrentRow + 行事件
  - httpRequest + 分页 + useDialog 完整 CRUD
- EsTable API 文档更新：补充虚拟滚动配置说明

**MCP Server & CLI 同步**

- `@es-plus/mcp-server@1.1.2`：`get_component_api` 补充虚拟滚动文档，`generate_crud_from_config` 支持 virtual 配置
- `@es-plus/cli@1.1.2`：`validate` 命令自动识别虚拟表格配置并校验
- `@es-plus/shared@1.0.2`：`table-options.schema.json` 新增虚拟滚动字段，`StructuredCrudConfigSchema` 支持 virtual 选项，代码生成器输出虚拟模式配置
- `esplus://conventions` 资源文档新增 Virtual Scrolling 章节

---

## v1.3.4

> 2026-05-26 发布

**EsCrudPage 增强**

- 新增 `tableBtns` schema 属性，支持表格工具栏按钮分区（`code: 1` 左侧 / `code: 2` 右侧）
- 新增 `formLayout.minFoldRows` 支持查询表单自动展开/收起
- Dialog `render` 支持 JSX 语法，可嵌套 EsCrudPage 实现复杂弹窗
- 新增 `operationColumn` 配置行操作按钮（支持 `dialogKey` 绑定弹窗、`confirm` 删除确认）
- 新增事件：`@dialog-confirm`、`@dialog-cancel`、`@dialog-open`、`@btn-click`
- 新增 expose：`openDialog(key, row)`、`closeDialog(key)`

**尺寸统一**

- EsForm 按钮默认 `size: 'small'`
- EsForm 表单项通过 `el-form size` prop 级联统一为 `small`
- 文档示例全局设置 `app.use(ElementPlus, { size: 'small' })`

**MCP Server & CLI 同步**

- `@es-plus/mcp-server@1.1.1`：Zod schema 适配 `tableBtns`、`formLayout.minFoldRows`、`operationColumn`、`dialogs`
- `@es-plus/cli@1.1.1`：通过 `@es-plus/shared` 自动继承新配置能力
- `@es-plus/shared@1.0.1`：`StructuredCrudConfigSchema` 新增多弹窗模式完整支持
- `esplus://conventions` 资源文档更新，新增 tableBtns / formLayout / operationColumn 使用说明

**文档**

- CrudPage 示例重写：订单管理 CRUD（11 个查询字段、表单折叠、工具栏按钮分离、嵌套弹窗）
- 文档项目启用 Vue JSX（`@vitejs/plugin-vue-jsx`）

---

## v1.3.3

> 2026-05-25 发布

**TypeScript & 类型安全**

- 修复全部 35 个 TypeScript 编译错误，`vue-tsc --noEmit` 零错误通过
- 新增 `tsconfig.build.json`，分离生产构建和测试的类型检查范围
- `useDialog` 添加函数重载，精确区分 `DialogCallableWithDestroy`（默认模式）和 `DialogCallable`（onlyInstance 模式）类型
- `TableOptions` 类型补全：显式声明 `configBtn`、`leftText`、`height` 属性
- `heightType` 新增 `'maxHeight'` 选项支持

**测试覆盖**

- 单元测试从 82 增至 254 个用例（11 个测试文件）
- 新增测试文件：
  - `use-form-inputs.spec.ts` — 41 个用例覆盖所有 13 种 formtype 和嵌套路径
  - `use-form-request.spec.ts` — 38 个用例覆盖请求编排和响应映射
  - `use-table-resize.spec.ts` — 25 个用例覆盖 ResizeObserver 和高度计算
  - `svg-icon.spec.ts` — 13 个用例覆盖内部/外部图标渲染
  - `es-crud-page.spec.ts` — 37 个用例覆盖一键 CRUD 组件

**工程化**

- `vue-tsc` 升级至 v3.3.1（兼容 TypeScript 5.9）
- `prepublishOnly` 脚本增加 `typecheck` 步骤，确保发布前零类型错误
- `vite-plugin-dts` 配置 `tsconfigPath` 指向 build 专用配置

---

## v1.3.2

> 2026-05-24 发布

- 新增 JSON Schema 文件（`schemas/` 目录），支持 AI 工具链集成
- 配置 changesets 自动版本管理，monorepo 多包协同发布
- 发布 `@es-plus/shared@1.0.0`、`@es-plus/mcp-server@1.1.0`、`@es-plus/cli@1.1.0`

---

## v1.2.0

> 2026-03-15 发布

- 导出全部 TypeScript 类型定义（FormItemOption、TableColumn 等 11 个核心接口）
- 新增 EsCrudPage 一键 CRUD 页面组件
- 新增权限控制（`permissionValue` 声明式按钮权限）
- 新增国际化支持（`labelKey` + 自定义翻译函数）
- 新增 `@es-plus/mcp-server` AI 编码工具集成
- 新增 `@es-plus/cli` 命令行工具
- 修复 EsForm 按钮模板嵌套问题
- 修复 EsDialog v-if/v-for 优先级问题

---

## v1.0.0

> 2026-02-11 发布

- 初始发布
- EsForm 配置化表单组件（支持 13 种 formtype）
- EsTable 配置化表格组件（支持远程数据、跨页选择、自适应高度）
- EsDialog 增强弹窗组件
- useDialog 编程式弹窗 Hook
- SvgIcon 图标组件
- 全局配置系统（`app.use(EsPlus, options)`）
- Form + Table + Dialog 联动模式
