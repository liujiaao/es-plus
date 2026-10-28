---
title: '高级联动组合'
route: '/advanced/linkage'
canonical: 'https://liujiaao.github.io/es-plus/advanced/linkage/'
source: 'es-plus-docs/src/views/advanced-doc.data.ts'
type: 'advanced'
---

# 高级联动组合

> EsForm、EsTable、useDialog 组合使用，实现复杂的业务场景。

## 能力

- **零代码查询** —— triggerEvent + apiParams.model 无事件代码
- **配置驱动** —— 声明式配置替代命令式编码
- **极简开发** —— 10行配置替代50行传统写法

## 示例

- 查询表格完整版 —— EsForm + EsTable + triggerEvent 实现零事件代码查询。
- 零代码查询 —— triggerEvent + apiParams.model 自动联动，无需手写查询/重置事件。传统50行→es-plus 10行。
- 跨页选择持久化 —— rowkey + cachePageSelection 解决 el-table 切换分页选择丢失的痛点。getSelectionRows() 跨页获取全部选中。
- 分步表单 —— 分步骤填写的复杂表单，每步独立校验。
- 表单 + 表格 + useDialog 增改 —— EsForm 查询 + EsTable 列表 + useDialog 声明式弹窗，增删改全部落到本地数据。
- 订单展开明细 —— 展开行内嵌套表格，显示订单商品明细与汇总行。
- 极简CRUD弹窗 —— useDialog + JSX EsForm — 一个函数完成增/编辑弹窗，registerRef 获取表单实例验证。
- 行操作审批流程 —— btns条件行操作 + 批量选择 + 弹窗(表格+表单)审批。
- 自适应高度表格 —— heightType + tabHeight + ResizeObserver 自动重算，表单展开/收起时表格高度自适应。
- 适配任意后端接口 —— configTableOut 声明响应信封（嵌套 key 递归查找）+ qrcb 集中重命名行字段：换后端只动配置，页面代码不变。
- 条件行操作按钮 —— btns 声明式行操作 — 替代 el-table 冗长 v-if slot，按钮行为随行数据动态变化。
- 弹窗内表格嵌套表单 —— 两级useDialog嵌套：弹窗表格 → 行btns → 嵌套弹窗表单编辑。
- 动态表单查询 —— isHidden 函数式显隐 + 级联选项加载 + apiParams.model 自动同步，零模板代码。
- 级联表单联动表格 —— 三级级联(isHidden) + httpRequest远程数据 + triggerEvent自动查询。
- 可回滚的批量导入 —— CSV 前端校验（必填/枚举/数字/重复）→ 错误行就地修正 → 每 3 条一批提交；服务端只裁决审批阈值，被拒行修正后只补交待导入行；结果表由 entryQuery 带入批次号重查，整批可回滚。
- 完整后台管理页 —— 搜索表单 + 分页表格 + CRUD弹窗 + 删除确认 — 一个文件完整后台页面，覆盖 90% 中后台场景。
- EsCrudPage 一键 CRUD —— EsCrudPage 组件：一个 schema 对象即可渲染完整的查询+表格+弹窗 CRUD 页面，支持 Server-Driven UI。
- 虚拟滚动：10 万行 —— options.virtual: true 切换 el-table-v2 引擎，10 万行只渲染可视区，滚动依旧流畅。
- 虚拟表格排序+固定列 —— 虚拟模式下排序、固定列、序号列、斑马纹完整兼容，5 万行数据即时排序。
- 虚拟表格多选+操作 —— 虚拟模式多选 + 行高亮 + 操作按钮(render/btns) + getSelectionRows 获取选中。
- 虚拟表格自定义渲染 —— 虚拟模式 render/scopedSlots/ellipsis/formatter 四种自定义渲染方式完整兼容。
- 虚拟表格行样式+事件 —— 虚拟模式 rowClassName（按数据上色）+ highlightCurrentRow 当前行 + @row-click / @row-dblclick 事件。
- 虚拟表格完整CRUD —— 虚拟模式 EsForm+EsTable+useDialog 完整 CRUD 场景：查询筛选+新增编辑删除+批量操作。
- 主表点选 → 从表重查 —— 点订单行 → 从表按订单号重查（嵌套信封用 configTableOut 声明映射）；编辑明细 → 主表金额与「已修改」标记回写。listenToCallBack 只做响应加工，不是跨组件信号。
- 全局请求：整页零请求代码 —— httpRequest 在站点入口 app.use(ESPlus, { httpRequest }) 配一次，查询表单 + 表格 + 分页只声明 apiParams：整份 schema 可 JSON 序列化，页面里没有一行请求代码。
