// Curated prompt presets for the AI CRUD page. Each one is designed to exercise
// a different facet of @es-plus/vue3 so the trace panel ends up showing distinct
// tool-call shapes (basic CRUD, dialog mode, virtual scrolling, multi-step
// form, cross-page selection, cascading filters) — not just the same generated
// table six times.
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
  },
]

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}
