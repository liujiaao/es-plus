/**
 * 能力令牌 → 配置路径的**声明式词表**（AI 展示案例矩阵的取证基础）。
 *
 * ## 为什么要这张表
 *
 * `docs/ai/feature-coverage.json` 的 40 个令牌是**自由文本**，只挂在 demo 上，没有指向
 * 任何配置键。于是出现两件事（见 `docs/internal/ai-showcase-matrix-plan.md` §3 G3）：
 *   1. 案例写一句「演示了 xxx 能力」，没有任何东西能验证它真的用了那个键；
 *   2. 令牌的 tier 来自「某个 demo 怎么写」，而不是「能力能不能被前门生成」——
 *      `defaultSort` / `tableBtns` / `mergeConfig` / `vxeFirstClass` 因此被误降到 B/C。
 *
 * 本表把每个令牌钉到两条路径上：
 *   · `structuredPath` —— 在 **StructuredCrudConfig** 里的位置（可达性的判据）；
 *   · `artifactPaths` —— 在生成产物 **pageSchema** 里的位置（「真的用了」的判据）。
 *
 * ## 三条诚实边界
 *
 * 1. `kind: 'auto'`（`tableBase` / `pagination` / `columnsDecl` / `crudPage`）是**无条件发射**的
 *    键：任何一份产物都有，拿它撑覆盖是白送分。故案例 manifest **不得**把它们写进
 *    `tokens[]`（守卫直接判红），要提就写进 `alwaysOn[]`。
 * 2. `kind: 'string-source' / 'host' / 'component'` 是**逃生舱**：函数值 / 宿主编排 / 独立组件，
 *    纯 JSON 表达不了。它们可以出现在案例的 `escapeHatch[]` 里，但该案例的 claim 最多
 *    `compile`（不得说成「AI 一步生成」）。
 * 3. `artifactPaths` 里的每个路径都必须能被 `scripts/check-ai-cases.mjs` 在真实产物上取到
 *    非空值；取不到的令牌不许写进 `tokens[]`。
 *
 * 新增令牌时**只改这张表**：矩阵（`docs/ai/ai-capability-matrix.json`）由
 * `scripts/gen-ai-capability-matrix.mjs` 现场生成，`structuredPath` 会被拿去和权威 schema
 * 对账（拼错的键会让生成脚本直接报错，而不是安静地少一格）。
 */

/** `declarative` = 纯 JSON 可表达；`auto` = 无条件发射；其余均为逃生舱。 */
export const TOKEN_KINDS = ['declarative', 'auto', 'string-source', 'host', 'component']

/**
 * @type {Array<{
 *   token: string,
 *   kind: 'declarative'|'auto'|'string-source'|'host'|'component',
 *   structuredPath?: string,
 *   artifactPaths?: string[],
 *   note: string,
 * }>}
 */
export const TOKEN_MAP = [
  // ── 字段三面扇出与表单 ────────────────────────────────────────────────
  {
    token: 'formtype',
    kind: 'declarative',
    structuredPath: 'fields[].formtype',
    artifactPaths: ['formItems[].formtype'],
    note: '字段的数据类型 → 控件类型（Input/Select/DatePicker…）',
  },
  {
    token: 'validation',
    kind: 'declarative',
    structuredPath: 'fields[].rules',
    // `required: true` 与 `rules[]` 是同一件事的两种写法（生成器把两者都翻成表单校验），
    // 故产物里任一存在即算证据。
    artifactPaths: [
      'formItems[].formItemOptions.rules',
      'dialogs[].formItems[].formItemOptions.rules',
      'formItems[].rules',
      'formItems[].required',
    ],
    note: '字段级校验规则（required 只是其中一种写法）',
  },
  {
    token: 'formLayout',
    kind: 'declarative',
    structuredPath: 'formLayout',
    artifactPaths: ['formLayout'],
    note: '查询区布局（折叠行数等）',
  },
  {
    token: 'reactions',
    kind: 'declarative',
    structuredPath: 'fields[].reactions',
    artifactPaths: ['formItems[].reactions', 'dialogs[].formItems[].reactions'],
    note: '声明式字段联动（选项/必填/禁用/赋值随另一字段变化）',
  },
  {
    token: 'fieldVisibility',
    kind: 'declarative',
    structuredPath: 'fields[].isHidden',
    artifactPaths: ['formItems[].isHidden', 'dialogs[].formItems[].isHidden'],
    note: '声明式条件显隐（纯 JSON 条件，非函数）',
  },
  {
    token: 'permissions',
    kind: 'declarative',
    structuredPath: 'fields[].permissionValue',
    artifactPaths: [
      'operationColumn.btns[].permissionValue',
      'toolbarBtns[].permissionValue',
      'tableBtns[].permissionValue',
      'formItems[].permissionValue',
      'columns[].permissionValue',
    ],
    note: '字段/按钮级权限码（权限判定由宿主注入）',
  },
  {
    token: 'operationColumn',
    kind: 'declarative',
    structuredPath: 'operationColumn',
    artifactPaths: ['operationColumn.btns[]'],
    note: '操作列按钮编排（dialogKey / permissionValue / 事件标识）',
  },
  {
    token: 'cellDataOptions',
    kind: 'declarative',
    structuredPath: 'fields[].dataOptions',
    artifactPaths: ['columns[].dataOptions'],
    note: '码值列（label/value/tagType 渲染成彩色标签）',
  },
  {
    token: 'columnStyle',
    kind: 'declarative',
    structuredPath: 'fields[].align',
    artifactPaths: ['columns[].align', 'columns[].width', 'columns[].ellipsis', 'columns[].fixed'],
    note: '列样式（宽/对齐/省略/固定）',
  },
  {
    token: 'apiParams',
    kind: 'declarative',
    structuredPath: 'fields[].apiParams',
    artifactPaths: ['formItems[].apiParams'],
    note: '字段级远程选项源（表级 tableOptions.apiParams 是自动发射的，不算证据）',
  },

  // ── 动作与弹窗 ──────────────────────────────────────────────────────
  {
    token: 'toolbarBtns',
    kind: 'declarative',
    structuredPath: 'toolbarBtns',
    artifactPaths: ['toolbarBtns[]'],
    note: '工具栏按钮（左/右区、批量动作）',
  },
  {
    token: 'tableBtns',
    kind: 'declarative',
    structuredPath: 'tableBtns',
    artifactPaths: ['tableBtns[]'],
    note: '表格自身的按钮（行选批量动作走 toolbarBtns）',
  },
  {
    token: 'dialogs',
    kind: 'declarative',
    structuredPath: 'dialogs',
    artifactPaths: ['dialogs'],
    // 前门不是收一个顶层 `dialogs` 键，而是收意图表的 `surfaces.dialog`（字符串罐头键或
    // 全参对象），再由 handler 确定性展开成 dialogs。因此可达性判据是「有 dialog 面」。
    reachOverride: 'front-door:surface-dialog',
    note: '多弹窗体系（每弹窗标题/宽度/全屏/字段覆盖）',
  },

  // ── 表格引擎与结构 ──────────────────────────────────────────────────
  {
    token: 'treeConfig',
    kind: 'declarative',
    structuredPath: 'treeConfig',
    artifactPaths: ['tableOptions.treeConfig'],
    note: '树形表格（childrenField / expandAll）',
  },
  {
    token: 'expandConfig',
    kind: 'declarative',
    structuredPath: 'expandConfig',
    // 两个不同的家，别混：
    //   · 声明式展开内容（跨端）落成**展开列** `columns[].expandConfig` —— schema 模式下
    //     生成器把顶层 expandConfig 前置成 `{ type:'expand', expandConfig }`（structured-
    //     generator 的 applyExpandConfig）。这是本令牌的运行时家。
    //   · `tableOptions.expandConfig` 是 vxe 的行展开**开关**（accordion / lazy），
    //     不是内容。此前只登记后者，于是任何真用声明式展开的产物都取不到证据。
    artifactPaths: ['columns[].expandConfig', 'tableOptions.expandConfig'],
    note: '展开行',
  },
  {
    token: 'mergeConfig',
    kind: 'declarative',
    structuredPath: 'mergeConfig',
    artifactPaths: ['tableOptions.mergeConfig'],
    note: '单元格合并（三端同一语义）',
  },
  {
    token: 'virtualScroll',
    kind: 'declarative',
    structuredPath: 'tableOptions.virtual',
    artifactPaths: ['tableOptions.virtual', 'tableOptions.engine'],
    note: '虚拟滚动（vue2 无 el-table-v2，见 AN-09 能力矩阵）',
  },
  {
    token: 'inlineEdit',
    kind: 'declarative',
    structuredPath: 'tableOptions.editConfig',
    artifactPaths: ['tableOptions.editConfig'],
    note: '行内编辑（仅 vxe 引擎消费）',
  },
  {
    token: 'vxeFirstClass',
    kind: 'declarative',
    structuredPath: 'tableOptions.engine',
    artifactPaths: ['tableOptions.engine'],
    note: 'vxe 一等公民（引擎切换 + 其专属子键）',
  },
  {
    token: 'configTableOut',
    kind: 'declarative',
    structuredPath: 'tableOptions.configTableOut',
    artifactPaths: ['tableOptions.configTableOut'],
    note: '异构后端字段映射（rows/records/pageNo 之外的后端形状）',
  },
  {
    token: 'defaultSort',
    kind: 'declarative',
    structuredPath: 'tableOptions.defaultSort',
    artifactPaths: ['tableOptions.defaultSort'],
    note: '默认排序（派生列自动补 sortable）',
  },
  {
    token: 'sortParam',
    kind: 'declarative',
    structuredPath: 'tableOptions.sortParam',
    artifactPaths: ['tableOptions.sortParam'],
    note: '服务端排序契约：表头 → 请求参数（sortField/sortOrder），defaultSort 播种首屏、变化保留当前页重取',
  },
  {
    token: 'columnGroups',
    kind: 'declarative',
    structuredPath: 'columns[].groups',
    artifactPaths: ['columns[].children'],
    note: '多级表头（B 级：前门不收 columns，需 from_config）',
  },
  {
    token: 'columnSortable',
    kind: 'declarative',
    structuredPath: 'columns[].sortable',
    artifactPaths: ['columns[].sortable'],
    note: '显式列的排序开关（B 级：同上）',
  },

  // ── 无条件发射：不得当证据用 ────────────────────────────────────────
  {
    token: 'columnsDecl',
    kind: 'auto',
    structuredPath: 'columns',
    artifactPaths: ['columns[]'],
    note: '列声明本身 —— 任何产物都有，不算证据',
  },
  {
    token: 'tableBase',
    kind: 'auto',
    structuredPath: 'tableOptions',
    artifactPaths: ['tableOptions'],
    note: '表格基础选项 —— 生成器无条件发射 border/stripe/apiParams 等',
  },
  {
    token: 'pagination',
    kind: 'auto',
    structuredPath: 'pagination',
    artifactPaths: ['pagination'],
    note: '分页 —— 生成器无条件发射',
  },
  {
    token: 'crudPage',
    kind: 'auto',
    structuredPath: 'name',
    artifactPaths: ['columns[]'],
    note: '整页 CRUD 编排 —— 案例页本身即是证据，故不算令牌证据',
  },

  // ── 逃生舱：函数值 / 宿主编排 / 独立组件 ────────────────────────────
  {
    token: 'renderFn',
    kind: 'string-source',
    structuredPath: 'fields[].render',
    note: '自定义单元格渲染（源码字符串；schema 模式降级为插槽 / TODO 标记）—— 不是纯 JSON',
  },
  {
    token: 'formatterFn',
    kind: 'string-source',
    structuredPath: 'fields[].formatter',
    note: '只读格式化函数源码字符串（进 pageSchema 时按列契约剥掉）',
  },
  {
    token: 'validatorFn',
    kind: 'string-source',
    structuredPath: 'fields[].rules',
    note: '自定义校验函数（rules 里的函数值无法进纯 JSON）',
  },
  {
    token: 'renderBtnFn',
    kind: 'string-source',
    structuredPath: 'operationColumn',
    note: '按钮自定义渲染函数',
  },
  {
    token: 'fieldEventFn',
    kind: 'host',
    structuredPath: 'fields[].attrs',
    note: '字段事件回调 —— 函数进不了 schema，只能由宿主在 wrapper 里补',
  },
  {
    token: 'spanMethodFn',
    kind: 'host',
    note: '手写 spanMethod（声明式替身是 mergeConfig，已在 declarative 里）',
  },
  {
    token: 'httpRequestFn',
    kind: 'host',
    note: '请求函数由宿主注入（组件 prop / 全局配置）',
  },
  {
    token: 'sfcSlot',
    kind: 'host',
    note: 'SFC 插槽逃生舱（仅 mode: sfc）',
  },
  {
    token: 'useDialogApi',
    kind: 'host',
    note: 'useDialog 的编程式弹窗 API —— 宿主代码，不在配置里',
  },
  {
    token: 'hostOrchestration',
    kind: 'host',
    note: '宿主编排（把片段与别的组件拼装）',
  },
  {
    token: 'hostSkeleton',
    kind: 'host',
    note: '宿主骨架（scaffold_page 生成的项目骨架）',
  },
  {
    token: 'errorBoundary',
    kind: 'component',
    note: '独立组件 EsErrorBoundary（不属于 CRUD 配置面）',
  },
  {
    token: 'svgIcon',
    kind: 'component',
    note: '独立组件 SvgIcon（不属于 CRUD 配置面）',
  },
]

/** 便捷索引。 */
export const TOKEN_BY_NAME = new Map(TOKEN_MAP.map((t) => [t.token, t]))

/** 可以被案例当「证据」声明的令牌（有产物路径且非无条件发射）。 */
export const EVIDENCE_TOKENS = TOKEN_MAP.filter((t) => t.kind === 'declarative' && (t.artifactPaths?.length ?? 0) > 0)

/** 逃生舱令牌（可出现在 `escapeHatch[]`，但 claim 必须 ≤ compile）。 */
export const ESCAPE_TOKENS = TOKEN_MAP.filter((t) => ['string-source', 'host', 'component'].includes(t.kind))
