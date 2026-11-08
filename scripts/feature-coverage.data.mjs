/**
 * AI 可达性台账 · 能力令牌注册表（AI-25）
 *
 * 配套：
 *   - 单一真源数据 `docs/ai/feature-coverage.json`（97 行 = 文档站 97 例特性演示）；
 *   - 静态守卫 `scripts/check-feature-coverage.mjs`（本文件是断言③④⑤的权威）。
 *
 * 层级模型（4 档）——每行的 tier **由其引用的令牌派生**：行内**任一**令牌为 C，整行即 C
 * （最弱可达档决定行档；`rowTier`）。故一行「声明式合并（A）+ 任意闭包（C）」记 C。
 *
 *   A  前门声明式一步可达（`generate_crud`）—— `keys` 必须是**实时可达集**的子集
 *      （crudShape ∪ schema 顶层 ∪ FieldConfig ∪ AI tableOptions），守卫断言④据此咬「声称了
 *      源码里不存在的开关」。
 *   B  声明式，但需 `generate_crud_from_config` —— `via` 指向 `FRONT_DOOR_UNREACHABLE:<k>`，
 *      且 `keys` 必须**真能经 from_config 发射**（断言⑤的**第二腿**：`keys ⊆ AI Zod 声明 ∩
 *      生成器实际发射`）。
 *      —— AI-29 已**退役** `'AI-Zod-absent'` 这一档：它与「第二腿」语义互斥（前者要求键
 *      **缺席**、后者要求键**能发射**），并存只会让 B 档既可证缺席又可证可达。原用它登记的
 *      `vxeFirstClass` 经实测**根本不可声明式达**（两处 AI Zod 零声明 + 生成器零发射），
 *      已按定义降 **C**（逃生舱）。
 *   C  逃生舱 / 函数值（Tier-3 源码串或闭包）——`reason` 必须非空。
 *   D  非 AI 生成目标（宿主编排 / 组件命令式 API）——`reason` 必须非空。
 *
 * 本注册表是**手工维护的语义数据**（如 `renderer-contract.mjs` / `SHARED_AUGMENT_MEMBERS`），
 * 守卫只保证其**结构合法与依据真实**，不替其语义背书（更正一档需人改 + 变异验证）。
 */

/** 档位序（弱→强；`rowTier` 取行内最弱档）。 */
export const TIER_ORDER = ['D', 'C', 'B', 'A']

/** 档位释义单源（写进 `feature-coverage.json` 的 `tiers`，供人读）。 */
export const TIER_MEANING = {
  A: '前门声明式一步可达（generate_crud）',
  B: '声明式，但需 generate_crud_from_config（前门刻意不收）',
  C: '逃生舱 / 函数值（Tier-3 源码串或闭包）',
  D: '非 AI 生成目标（宿主编排 / 组件命令式 API）',
}

/**
 * 能力令牌注册表。字段：
 *   tier   'A' | 'B' | 'C' | 'D'
 *   keys   A 档必填：该能力依据的实时键（须 ⊆ 可达集）
 *          B 档必填：断言⑤第二腿的**被断对象**（须 ⊆ AI Zod 声明 ∩ 生成器实际发射）
 *   via    B 档必填：'FRONT_DOOR_UNREACHABLE:<键>'（'AI-Zod-absent' 档已于 AI-29 退役）
 *   reason C/D 档必填：为何不可声明式覆盖
 *   scenes **哪些场景能用这个能力**（P5 场景×能力矩阵的唯一人工输入）。
 *          A/B/C 档必填且非空；D 档可为空（= 与场景无关的宿主编排）。约束由
 *          `scripts/gen-ai-capability-matrix.mjs` 现场核对：
 *            · 场景 id ⊆ 注册表 SCENE_IDS；
 *            · A/B 档必须含 'crud'（这两档的定义就是「crud 页能生成」）；
 *            · 每个声明的场景都必须能在该场景的**入参表面**里找到该令牌的至少一个键
 *              （键集由 `readSceneSurfaces` 从源码切出）—— 声明一个场景里根本不存在的
 *              容器键（如给 table 片段声明 `dialogs`）直接红；
 *            · 反向不强制：字段级令牌在片段里语义上可能只部分生效（`columnStyle` 在
 *              表单里无意义），故允许**少声明**，不允许**多声明**。
 *   note   可选：人读补充
 */
export const CAPABILITY_TOKENS = {
  // ── A 档：前门声明式一步可达 ──────────────────────────────────────────────
  formtype: { tier: 'A', keys: ['formtype', 'dataOptions', 'attrs'], scenes: ['crud', 'table', 'form', 'dialog'], note: '字段控件类型 / 静态选项 / 透传属性' },
  cellDataOptions: {
    tier: 'A',
    keys: ['dataOptions'],
    scenes: ['crud', 'table', 'form', 'dialog'],
    note: '码值→展示映射（字段级 dataOptions 由生成器复制到派生列；三端分别渲染 ElTag / el-tag / a-tag，未命中回原值）',
  },
  apiParams: { tier: 'A', keys: ['apiParams'], scenes: ['crud', 'table', 'form', 'dialog'], note: '字段级远程选项数据源' },
  validation: { tier: 'A', keys: ['rules', 'required'], scenes: ['crud', 'form', 'dialog'], note: '必填与 rules 校验（自定义 validator 见 validatorFn）' },
  fieldVisibility: { tier: 'A', keys: ['isHidden'], scenes: ['crud', 'table', 'form', 'dialog'], note: '字段条件显隐（声明式）' },
  reactions: { tier: 'A', keys: ['reactions'], scenes: ['crud', 'form', 'dialog'], note: '字段联动 / 计算（声明式）' },
  permissions: { tier: 'A', keys: ['permissionValue', 'permissions'], scenes: ['crud', 'table', 'form', 'dialog'], note: '字段级 + 动作按钮权限码（片段侧只有字段/列级 permissionValue；permissions 动作表仅 crud）' },
  formLayout: { tier: 'A', keys: ['formLayout'], scenes: ['crud', 'form'], note: '查询表单布局 / 折叠 / labelWidth' },
  tableBase: {
    tier: 'A',
    keys: ['tableOptions'],
    scenes: ['crud', 'table'],
    note: '基础表格配置：border/stripe/高度/密度/multiSelect/cachePageSelection/highlightCurrentRow/snIndex/showHeader/emptyText/leftText/localPagination/heightType/tabHeight',
  },
  columnStyle: { tier: 'A', keys: ['fixed', 'width', 'minWidth', 'align', 'ellipsis'], scenes: ['crud', 'table'], note: '列级固定 / 宽度 / 对齐 / 省略' },
  virtualScroll: {
    tier: 'A',
    keys: ['tableOptions', 'virtual', 'engine', 'rowHeight', 'estimatedRowHeight', 'overscanCount'],
    scenes: ['crud', 'table'],
    note: '虚拟滚动 / 引擎切换（virtual / engine:vxe）',
  },
  inlineEdit: { tier: 'A', keys: ['tableOptions', 'editConfig'], scenes: ['crud', 'table'], note: "vxe 行内编辑（editConfig；须配 engine:'vxe'）" },
  defaultSort: { tier: 'A', keys: ['tableOptions', 'defaultSort'], scenes: ['crud', 'table'], note: '首屏默认排序' },
  mergeConfig: { tier: 'A', keys: ['mergeConfig'], scenes: ['crud'], note: '声明式合并单元格（相邻等值分组，跨端）' },
  expandConfig: { tier: 'A', keys: ['expandConfig'], scenes: ['crud'], note: '展开行只读字段列表' },
  treeConfig: { tier: 'A', keys: ['treeConfig'], scenes: ['crud'], note: '树形数据（childrenField 等）' },
  dialogs: { tier: 'A', keys: ['dialogs'], scenes: ['crud'], note: '多弹窗配置（前门经 surfaces.dialog 合成）' },
  operationColumn: { tier: 'A', keys: ['operationColumn', 'actions'], scenes: ['crud'], note: '操作列 / 行操作按钮' },
  toolbarBtns: { tier: 'A', keys: ['toolbarBtns'], scenes: ['crud'], note: '工具栏按钮' },
  tableBtns: { tier: 'A', keys: ['tableBtns'], scenes: ['crud'], note: '表格上方按钮' },
  pagination: { tier: 'A', keys: ['pagination'], scenes: ['crud', 'table'], note: '分页配置' },
  configTableOut: { tier: 'A', keys: ['tableOptions', 'configTableOut'], scenes: ['crud', 'table'], note: '列表响应字段映射（适配任意后端）' },
  crudPage: { tier: 'A', keys: ['surfaces'], scenes: ['crud'], note: 'EsCrudPage 单 schema 渲染整页（AI 主产物）' },

  // ── B 档：声明式，但需 generate_crud_from_config ─────────────────────────
  // `keys` 是断言⑤**第二腿**的被断对象：必须 ⊆（AI Zod 声明 ∩ 生成器实际发射）。
  columnsDecl: {
    tier: 'B',
    via: 'FRONT_DOOR_UNREACHABLE:columns',
    keys: ['columns'],
    scenes: ['crud'],
    note: '富列数组（替换派生列）——前门刻意不收（用户拍板），走 generate_crud_from_config',
  },
  columnGroups: { tier: 'B', via: 'FRONT_DOOR_UNREACHABLE:columns', keys: ['columns'], scenes: ['crud'], note: '多级分组表头（columns.groups）' },
  columnSortable: {
    tier: 'B',
    via: 'FRONT_DOOR_UNREACHABLE:columns',
    keys: ['columns'],
    scenes: ['crud'],
    note: '列级 sortable（FieldConfig 无此键，仅在 columns 上）',
  },

  // ── C 档：逃生舱 / 函数值（Tier-3）────────────────────────────────────────
  // AI-29 降档：原记 B（`via:'AI-Zod-absent'`）暗示 from_config 可达，实测**零可达** ——
  // 11 键在 shared/src + mcp-server/src 只出现在 get-component-api.ts 的文档串，两处 AI Zod
  // 零声明、生成器零发射，且 from_config 的 tableOptions 是闭合 z.object → 静默 strip 零告警。
  // 运行时确有逃生舱（`options.vxeConfig` 深合并、`vxeOn` 事件绑定，见 get-component-api.ts）
  // → 按定义属 **C**（可达但不可声明式达），非 D（D 是「非 AI 生成目标」）。
  vxeFirstClass: {
    tier: 'C',
    scenes: ['crud', 'table'],
    reason:
      'vxe 一等公民的**函数形态**（vxeConfig/vxeOn/proxyConfig.ajax/footerMethod/mergeFooterItems）——' +
      '只能走运行时逃生舱手工注入。声明式子集（showFooter/footerData/exportConfig/toolbarConfig/columnConfig/keepSource）' +
      '已进 AI 契约（AI-31），不再属于本档',
  },
  renderFn: { tier: 'C', scenes: ['crud', 'table', 'form', 'dialog'], reason: '自定义单元格 / 控件 / 弹窗内容 / 详情渲染 = 函数源码串（Tier-3 永久逃生舱）' },
  formatterFn: { tier: 'C', scenes: ['crud', 'table'], reason: '展示格式化 = 函数源码串（formatter / summary-method / footerMethod）' },
  spanMethodFn: { tier: 'C', scenes: ['crud', 'table'], reason: '任意闭包合并（spanMethod）——跨端声明式子集走 mergeConfig，任意逻辑保真走此' },
  validatorFn: { tier: 'C', scenes: ['crud', 'form', 'dialog'], reason: '自定义校验函数（validator）——函数值，非声明式' },
  httpRequestFn: { tier: 'C', scenes: ['crud', 'table', 'form', 'dialog'], reason: '自定义请求 / 响应回调 = 函数（httpRequest / listenToCallBack brcb·qrcb）' },
  fieldEventFn: {
    tier: 'C',
    scenes: ['crud', 'form', 'dialog'],
    reason:
      '表单控件的**事件袋** `on`（如 `{ change: fn, input: fn }`）：值全是函数，载不进 JSON。' +
      '运行时真消费 —— vue3 由 `use-form-inputs.ts` 的 `rowPassThrough` 把每个键转成 `onXxx` 后透传给控件（Upload 另有单独分支）。' +
      'AI 契约零声明（`FieldConfig` 无 `on`），且两处 AI Zod 是闭合对象 → 经 AI 入口传入被**静默 strip**；' +
      '声明式替代是 `reactions`（选项/必填/禁用/值联动）与 `isHidden`（显隐），覆盖其绝大多数实际用途。' +
      '登记见 `check-threeway-consistency` 的「消费未声明」轴（`fields.on` 行，带存活证据）。',
  },
  renderBtnFn: { tier: 'C', scenes: ['crud'], reason: '按钮函数式自定义（renderBtn / configBtn 的 isHide·disabled 谓词 / btns 函数）' },
  sfcSlot: { tier: 'C', scenes: ['crud'], reason: 'SFC 模板插槽（#expand / default slot / scopedSlots）——仅 sfc 模式，schema 不可达' },

  // ── D 档：非 AI 生成目标 ─────────────────────────────────────────────────
  // D 档的 scenes 留空 = 「与场景无关」（宿主编排 / 组件级资源），不是遗漏。
  useDialogApi: { tier: 'D', scenes: ['crud', 'dialog'], reason: 'useDialog 命令式 composable（宿主调用），非 schema 面；独立弹窗场景的产物正是 useDialog 形态' },
  errorBoundary: {
    tier: 'D',
    scenes: [],
    reason:
      '错误边界 `<EsErrorBoundary>`（捕获子树 render / 生命周期 / 侦听器错误并降级）——' +
      '这是**组件树结构**，宿主决定把哪块子树包进边界、降级 UI 长什么样，schema 里没有也不该有对应键',
  },
  svgIcon: {
    tier: 'D',
    scenes: [],
    reason:
      '`<SvgIcon>` 图标出口（雪碧图 `<use>` / 外部 http(s) 图片、尺寸随字号、随 currentColor 着色）——' +
      '图标集与雪碧图由宿主注入，属组件级资源编排，非 schema 面',
  },
  hostOrchestration: { tier: 'D', scenes: [], reason: '宿主编排：ElSteps 分步 / 拖拽 / 异步组件 / ResizeObserver / 运行时增删与手工联动' },
  hostSkeleton: { tier: 'D', scenes: [], reason: '整页骨架 / 布局拼装（后台页等），非单配置可覆盖' },
  siteUncovered: {
    tier: 'D',
    scenes: [],
    reason:
      '站点案例未匹配到同名单源演示（es-eui / es-pc 台账）—— 显式登记为 D，不猜能力令牌；' +
      '补上对应演示后重跑 `npm run sites:coverage:gen` 即自动升档',
  },
}

/**
 * 行档 = 行内令牌的**最弱档**（`TIER_ORDER` 弱→强，取最靠前者）。
 * 空令牌视为 'A'（守卫断言 tokens `minItems:1`，正常不会走到）。
 */
export function rowTier(tokens) {
  let worst = 'A'
  for (const t of tokens) {
    const tier = CAPABILITY_TOKENS[t]?.tier
    if (!tier) continue
    if (TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(worst)) worst = tier
  }
  return worst
}

/**
 * 两份令牌表的**对称差**（P5 单一真源收尾）。
 *
 * `CAPABILITY_TOKENS`（本文件，可达性台账）与 `scripts/lib/ai-token-map.mjs` 的
 * `TOKEN_MAP`（矩阵词表：令牌 → 配置路径）本就该是同一批令牌 —— 两份表各记各的，
 * 新增令牌只改一处时另一处会**静默漏格**（矩阵里没有该令牌，或台账里没有档位）。
 *
 * 这里把「允许的差集」显式登记，每格必须写明原因；`gen-ai-capability-matrix.mjs`
 * 现场比对两表的对称差，**多出任何一个未登记令牌即红**。纪律同 `FRONT_DOOR_UNREACHABLE`：
 * 这张表只应缩小，不应长大。
 */
export const TOKEN_SET_DIFF = {
  /** 矩阵词表有、台账没有。 */
  matrixOnly: {
    sortParam:
      '台账按「文档站演示是否真的用到」收录令牌；演示 table/06-sort 演示的是客户端排序事件，' +
      '没有演示服务端 sortParam 契约（sortField/sortOrder 请求参数），故台账不收。' +
      '矩阵侧仍登记其结构化路径与三端支持（CAPABILITIES.tableOptions.sortParam）。',
  },
  /** 台账有、矩阵词表没有。 */
  ledgerOnly: {
    siteUncovered:
      '站点覆盖专用（AN-28）：未被同名单源演示覆盖的站点案例落档用，本身不是可生成的能力，' +
      '故没有 structuredPath 可进矩阵。',
  },
}
