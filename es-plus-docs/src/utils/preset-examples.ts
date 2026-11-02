// Curated prompt presets for the AI CRUD page. Each one is designed to exercise
// a different facet of @es-plus/vue3 so the trace panel ends up showing distinct
// tool-call shapes (basic CRUD, dialog mode, virtual scrolling, multi-step
// form, cross-page selection, cascading filters) — not just the same generated
// table six times. The last three cover the **single-scene fragments**
// (`generate_table` / `generate_form` / `generate_dialog`), which are AI-only:
// the offline rule engine emits full CRUD pages and has no fragment entry point.
//
// `id` is stable so it can be used as a Vue key. Labels live here (small set,
// 12 strings total) so they get bundled with the page chunk; for larger i18n
// expansion these should move into locales/.

export interface Preset {
  id: string
  icon: string                           // Element Plus icon name (resolved by name in template)
  label: { zh: string; en: string }
  prompt: { zh: string; en: string }
  showcases: string[]                    // Free-form tags surfaced in tooltip
  /**
   * 这个预设**声称**产物具备的事实。`scripts/check-ai-presets.mjs` 会拿它跑
   * 真正上线的那条函数（shared 的 `generateCrudSchema`）逐条断言 —— 预设不是
   * 宣传语，而是可验证的契约。声明了却做不到的能力，守卫会红，必须二选一：
   * 补实现，或删掉这条宣称（并在 hints 里承认它是「识别但未实现」）。
   */
  capabilities?: {
    /** `schema.actions` 必须精确等于这组值（顺序无关） */
    actions: string[]
    /** `schema.tableOptions` 必须包含的键值（子集匹配） */
    tableOptions?: Record<string, unknown>
    /** 必须在 `featureHints` 里点名的关键词（识别到但产物无法表达的能力） */
    hints?: string[]
  }
  /**
   * 单场景片段预设（表格 / 表单 / 弹窗）。片段路由由模型判断，**离线规则引擎
   * 没有片段入口**，所以这类预设只在配置了模型时出现（见 AiCrud 的 visiblePresets）。
   *
   * 它们没有 `capabilities`：`check-ai-presets` 的断言口径是「跑上线那条函数拿到产物」，
   * 而片段产物的入口是「模型按信封协议调用片段工具」，离线无法复现。守卫改为
   * 只校验工具名与字段声明，并在输出里**明确说明这部分未被重算**。
   */
  fragment?: {
    tool: 'generate_table' | 'generate_form' | 'generate_dialog'
    /** 预设声称会出现在产物里的字段 label */
    fields: string[]
  }
  /** 需要配置 AI 模型才可用（离线隐藏这类预设） */
  requiresAi?: boolean
}

export const PRESETS: Preset[] = [
  {
    id: 'user-mgmt',
    icon: 'User',
    label: {
      zh: '用户管理（基础 CRUD）',
      en: 'User mgmt (basic CRUD)',
    },
    prompt: {
      zh: '用户管理页面，查询条件：姓名、手机号、状态（启用/禁用）。表格列：姓名、手机号、邮箱、状态、创建时间。支持新增、编辑、删除。',
      en: 'User management page. Search by name, phone, status (active/disabled). Columns: name, phone, email, status, created at. Supports add, edit, delete.',
    },
    showcases: ['EsForm', 'EsTable', 'basic CRUD'],
    capabilities: { actions: ['add', 'edit', 'delete'] },
  },
  {
    id: 'order-detail-dialog',
    icon: 'List',
    label: {
      zh: '订单管理（详情多 tab 弹窗）',
      en: 'Orders (multi-tab detail dialog)',
    },
    prompt: {
      zh: '订单列表，查询订单号、客户姓名、订单状态、下单日期范围。列表显示订单号、客户、金额、状态、下单时间。每行有"详情"按钮，点击打开弹窗，弹窗内三个 tab：订单信息、收货地址、商品列表。',
      en: 'Order list. Search by order id, customer, status, order-date range. Columns: order id, customer, amount, status, ordered at. Each row has a Detail button that opens a dialog with three tabs: order info, shipping address, items.',
    },
    showcases: ['useDialog', 'multi-tab', 'render slot'],
    capabilities: { actions: ['view'], hints: ['多 Tab'] },
  },
  {
    id: 'product-virtual',
    icon: 'Goods',
    label: {
      zh: '商品管理（10 万行虚拟滚动）',
      en: 'Products (100k-row virtual)',
    },
    prompt: {
      zh: '商品列表，10 万行数据，启用虚拟滚动。查询条件：商品名（模糊）、分类、价格区间。列：商品名、分类、价格、库存、上架状态。支持批量上下架。',
      en: 'Product list with 100k rows and virtual scrolling. Search by name (fuzzy), category, price range. Columns: name, category, price, stock, listing status. Supports batch list/unlist.',
    },
    showcases: ['EsTable virtual', 'large dataset'],
    capabilities: {
      actions: ['toggleListing'],
      tableOptions: { virtual: true, multiSelect: true, cachePageSelection: true },
      hints: ['虚拟滚动', '跨页批量选择'],
    },
  },
  {
    id: 'article-multi-step',
    icon: 'Document',
    label: {
      zh: '文章发布（多步表单）',
      en: 'Article publish (multi-step form)',
    },
    prompt: {
      zh: '文章发布页面。多步表单：第一步基础信息（标题、分类、标签），第二步内容（富文本），第三步发布设置（定时发布时间、可见范围）。每步可以前后跳。',
      en: 'Article publishing page. Multi-step form: step 1 basic info (title, category, tags), step 2 content (rich text), step 3 publishing settings (scheduled time, visibility). Each step can go forward and back.',
    },
    showcases: ['multi-step form', 'complex layout'],
    capabilities: { actions: ['add', 'edit', 'delete'], hints: ['多步表单', '富文本'] },
  },
  {
    id: 'audit-cross-page',
    icon: 'Check',
    label: {
      zh: '跨页批量审核',
      en: 'Cross-page batch audit',
    },
    prompt: {
      zh: '审核工单列表。查询工单号、申请人、类型、状态。表格支持跨页选择，底部固定栏显示已选数量 + 批准/拒绝按钮。',
      en: 'Approval ticket list. Search by ticket id, applicant, type, status. Table supports cross-page selection, with a sticky footer showing selected count + Approve / Reject buttons.',
    },
    showcases: ['cross-page selection', 'sticky toolbar'],
    capabilities: {
      actions: ['approve', 'reject'],
      tableOptions: { multiSelect: true, cachePageSelection: true },
      hints: ['跨页批量选择'],
    },
  },
  {
    id: 'cascade-form',
    icon: 'Connection',
    label: {
      zh: '级联筛选（省/市/区）',
      en: 'Cascade filter (region)',
    },
    prompt: {
      zh: '会员管理。查询条件包含级联筛选：省 → 市 → 区。表格显示会员姓名、手机、地址（省市区拼接）、注册时间。',
      en: 'Member management. Search includes cascading filter: province → city → district. Columns: member name, phone, address (joined region), registered at.',
    },
    showcases: ['cascading select', 'computed column'],
    capabilities: { actions: ['add', 'edit', 'delete'], hints: ['级联筛选'] },
  },
  // ── 单场景片段（AI 原生全场景）─────────────────────────────────────────
  // 这三条演示「不生成整页」：表格 / 表单 / 弹窗各自独立产出。离线规则引擎
  // 只产 CRUD 整页，所以它们在没配模型时**不出现** —— 与其给出一个错的东西，
  // 不如先不给。
  {
    id: 'scene-table',
    icon: 'Grid',
    label: {
      zh: '只要表格（含行操作）',
      en: 'Table only (with row actions)',
    },
    prompt: {
      zh: '只要一个订单结果表格：列有订单号、客户、金额、状态（待发货/已发货/已签收），每行一个查看按钮。不需要查询条件，也不需要页面外壳。',
      en: 'Just an order results table: columns order id, customer, amount, status (pending / shipped / received), with a View button per row. No search form, no page shell.',
    },
    showcases: ['generate_table', 'fragment'],
    requiresAi: true,
    fragment: { tool: 'generate_table', fields: ['订单号', '客户', '金额', '状态'] },
  },
  {
    id: 'scene-form',
    icon: 'Search',
    label: {
      zh: '只要筛选表单',
      en: 'Filter form only',
    },
    prompt: {
      zh: '只要一个筛选表单：关键词输入框、状态下拉（启用/停用）、日期范围，底部查询和重置按钮。不要表格。',
      en: 'Just a filter form: keyword input, status select (active / disabled), date range, with Query and Reset buttons at the bottom. No table.',
    },
    showcases: ['generate_form', 'fragment'],
    requiresAi: true,
    fragment: { tool: 'generate_form', fields: ['关键词', '状态'] },
  },
  {
    id: 'scene-dialog',
    icon: 'Edit',
    label: {
      zh: '只要编辑弹窗',
      en: 'Edit dialog only',
    },
    prompt: {
      zh: '只要一个编辑客户的弹窗，标题"编辑客户"：客户名（必填）、金额、状态（启用/停用）。不要列表，也不要页面外壳。',
      en: 'Just an edit-customer dialog titled "Edit customer": customer name (required), amount, status (active / disabled). No list, no page shell.',
    },
    showcases: ['generate_dialog', 'fragment'],
    requiresAi: true,
    fragment: { tool: 'generate_dialog', fields: ['客户', '金额', '状态'] },
  },
]

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}
