/**
 * AI 可达性台账 · 能力令牌注册表（AI-25）
 *
 * 配套：
 *   - 单一真源数据 `docs/ai/feature-coverage.json`（96 行 = 文档站 96 例特性演示）；
 *   - 静态守卫 `scripts/check-feature-coverage.mjs`（本文件是断言③④⑤的权威）。
 *
 * 层级模型（4 档）——每行的 tier **由其引用的令牌派生**：行内**任一**令牌为 C，整行即 C
 * （最弱可达档决定行档；`rowTier`）。故一行「声明式合并（A）+ 任意闭包（C）」记 C。
 *
 *   A  前门声明式一步可达（`generate_crud`）—— `keys` 必须是**实时可达集**的子集
 *      （crudShape ∪ schema 顶层 ∪ FieldConfig ∪ AI tableOptions），守卫断言④据此咬「声称了
 *      源码里不存在的开关」。
 *   B  声明式，但需 `generate_crud_from_config` —— `via` 指向 `FRONT_DOOR_UNREACHABLE:<k>` 或
 *      `'AI-Zod-absent'`。守卫断言⑤：`via:'FRONT_DOOR_UNREACHABLE:columns'` 要求该键**仍在**
 *      前门不可达表里 —— 一旦前门扩宽到它，本令牌立刻变红、**强制重新分类**（台账自动重开）；
 *      `via:'AI-Zod-absent'` 要求所声明的 `keys` **确实不在**实时可达集。
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
 *   keys   A 档必填：该能力依据的实时键（须 ⊆ 可达集）；vxeFirstClass(B) 也带 keys 做「缺失」断言
 *   via    B 档必填：'FRONT_DOOR_UNREACHABLE:<键>' 或 'AI-Zod-absent'
 *   reason C/D 档必填：为何不可声明式覆盖
 *   note   可选：人读补充
 */
export const CAPABILITY_TOKENS = {
  // ── A 档：前门声明式一步可达 ──────────────────────────────────────────────
  formtype: { tier: 'A', keys: ['formtype', 'dataOptions', 'attrs'], note: '字段控件类型 / 静态选项 / 透传属性' },
  apiParams: { tier: 'A', keys: ['apiParams'], note: '字段级远程选项数据源' },
  validation: { tier: 'A', keys: ['rules', 'required'], note: '必填与 rules 校验（自定义 validator 见 validatorFn）' },
  fieldVisibility: { tier: 'A', keys: ['isHidden'], note: '字段条件显隐（声明式）' },
  reactions: { tier: 'A', keys: ['reactions'], note: '字段联动 / 计算（声明式）' },
  permissions: { tier: 'A', keys: ['permissionValue', 'permissions'], note: '字段级 + 动作按钮权限码' },
  formLayout: { tier: 'A', keys: ['formLayout'], note: '查询表单布局 / 折叠 / labelWidth' },
  tableBase: {
    tier: 'A',
    keys: ['tableOptions'],
    note: '基础表格配置：border/stripe/高度/密度/multiSelect/cachePageSelection/highlightCurrentRow/snIndex/showHeader/emptyText/leftText/localPagination/heightType/tabHeight',
  },
  columnStyle: { tier: 'A', keys: ['fixed', 'width', 'minWidth', 'align', 'ellipsis'], note: '列级固定 / 宽度 / 对齐 / 省略' },
  virtualScroll: {
    tier: 'A',
    keys: ['tableOptions', 'virtual', 'engine', 'rowHeight', 'estimatedRowHeight', 'overscanCount'],
    note: '虚拟滚动 / 引擎切换（virtual / engine:vxe）',
  },
  inlineEdit: { tier: 'A', keys: ['tableOptions', 'editConfig'], note: "vxe 行内编辑（editConfig；须配 engine:'vxe'）" },
  defaultSort: { tier: 'A', keys: ['tableOptions', 'defaultSort'], note: '首屏默认排序' },
  mergeConfig: { tier: 'A', keys: ['mergeConfig'], note: '声明式合并单元格（相邻等值分组，跨端）' },
  expandConfig: { tier: 'A', keys: ['expandConfig'], note: '展开行只读字段列表' },
  treeConfig: { tier: 'A', keys: ['treeConfig'], note: '树形数据（childrenField 等）' },
  dialogs: { tier: 'A', keys: ['dialogs'], note: '多弹窗配置（前门经 surfaces.dialog 合成）' },
  operationColumn: { tier: 'A', keys: ['operationColumn', 'actions'], note: '操作列 / 行操作按钮' },
  toolbarBtns: { tier: 'A', keys: ['toolbarBtns'], note: '工具栏按钮' },
  tableBtns: { tier: 'A', keys: ['tableBtns'], note: '表格上方按钮' },
  pagination: { tier: 'A', keys: ['pagination'], note: '分页配置' },
  configTableOut: { tier: 'A', keys: ['tableOptions', 'configTableOut'], note: '列表响应字段映射（适配任意后端）' },
  crudPage: { tier: 'A', keys: ['surfaces'], note: 'EsCrudPage 单 schema 渲染整页（AI 主产物）' },

  // ── B 档：声明式，但需 generate_crud_from_config ─────────────────────────
  columnsDecl: {
    tier: 'B',
    via: 'FRONT_DOOR_UNREACHABLE:columns',
    note: '富列数组（替换派生列）——前门刻意不收（用户拍板），走 generate_crud_from_config',
  },
  columnGroups: { tier: 'B', via: 'FRONT_DOOR_UNREACHABLE:columns', note: '多级分组表头（columns.groups）' },
  columnSortable: { tier: 'B', via: 'FRONT_DOOR_UNREACHABLE:columns', note: '列级 sortable（FieldConfig 无此键，仅在 columns 上）' },
  vxeFirstClass: {
    tier: 'B',
    via: 'AI-Zod-absent',
    keys: ['vxeConfig', 'vxeOn', 'toolbarConfig', 'exportConfig', 'proxyConfig', 'footerMethod', 'keyboardConfig', 'mouseConfig', 'columnConfig', 'showFooter', 'mergeFooterItems'],
    note: 'vxe 一等公民块（toolbarConfig/exportConfig/proxyConfig/vxeConfig…）——两处 AI Zod 零声明',
  },

  // ── C 档：逃生舱 / 函数值（Tier-3）────────────────────────────────────────
  renderFn: { tier: 'C', reason: '自定义单元格 / 控件 / 弹窗内容 / 详情渲染 = 函数源码串（Tier-3 永久逃生舱）' },
  formatterFn: { tier: 'C', reason: '展示格式化 = 函数源码串（formatter / summary-method / footerMethod）' },
  spanMethodFn: { tier: 'C', reason: '任意闭包合并（spanMethod）——跨端声明式子集走 mergeConfig，任意逻辑保真走此' },
  validatorFn: { tier: 'C', reason: '自定义校验函数（validator）——函数值，非声明式' },
  httpRequestFn: { tier: 'C', reason: '自定义请求 / 响应回调 = 函数（httpRequest / listenToCallBack brcb·qrcb）' },
  renderBtnFn: { tier: 'C', reason: '按钮函数式自定义（renderBtn / configBtn 的 isHide·disabled 谓词 / btns 函数）' },
  sfcSlot: { tier: 'C', reason: 'SFC 模板插槽（#expand / default slot / scopedSlots）——仅 sfc 模式，schema 不可达' },

  // ── D 档：非 AI 生成目标 ─────────────────────────────────────────────────
  useDialogApi: { tier: 'D', reason: 'useDialog 命令式 composable（宿主调用），非 schema 面' },
  hostOrchestration: { tier: 'D', reason: '宿主编排：ElSteps 分步 / 拖拽 / 异步组件 / ResizeObserver / 运行时增删与手工联动' },
  hostSkeleton: { tier: 'D', reason: '整页骨架 / 布局拼装（后台页等），非单配置可覆盖' },
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
