# 更新日志

记录 es-plus-ui 各版本的变更内容。完整发布记录请查看 [GitHub Releases](https://github.com/liujiaao/es-plus/releases)。

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
