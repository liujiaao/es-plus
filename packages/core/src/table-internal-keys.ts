/**
 * 表格「内部键」的单源清单（P2-1）。
 *
 * ## 这些键是什么
 *
 * `tableOptions` 里由**组件自己消费**、不能原样透传给底座表格（el-table / a-table）的键：
 * 请求参数、分页联动、vxe 专属配置、由组件翻译成 spanMethod / customCell 的声明式配置……
 * 它们若漏进 attrs，会变成根节点上一枚名字古怪的死属性（`keepsource="false"`），
 * 既没人读、又污染 DOM。
 *
 * ## 为什么需要单源
 *
 * 三端各维护一份 `TABLE_INTERNAL_KEYS` 是历史事实（修前 43 / 44 / 50 个键）。三份清单
 * 只有「各自包含自己那份」这一条软约定 —— 新增一个跨端键时，改了两端漏一端，构建全绿、
 * 测试全绿，只有那一端的 DOM 上多出一枚死属性。本文件只收**三端都必须剥掉**的公共键；
 * 端专有键（vue2 的 `lazyLoad`，antdv 的 a-table 映射键）留在各自组件里。
 *
 * ## 守卫
 *
 * `scripts/check-table-internal-keys.mjs` 断言：
 *   ① 本清单 ⊆ 三端各自的 `TABLE_INTERNAL_KEYS`（少剥 = 红）；
 *   ② 本清单 === 三端集合的交集（三端共同新增却忘记回填单源 = 红）；
 *   ③ 各端清单内无重复键。
 *
 * 只增不删：删除一个键意味着它开始被透传到底座表格 —— 那是行为变更，得先确认
 * 三端都不再消费它。
 */
export const BASE_TABLE_INTERNAL_KEYS = [
  // 前置非数据列与选中态
  'multiSelect',
  'expand',
  'snIndex',
  'loading',
  'cachePageSelection',
  // 请求 / 响应映射（由 useTableRequest 消费）
  'httpRequest',
  'configTableOut',
  'listenToCallBack',
  'apiParams',
  'actionUrl',
  // 布局 / 高度（由组件的 heightType + tabHeight 计算消费）
  'heightType',
  'tabHeight',
  // 初始化与查询入口
  'isInitRun',
  'entryQuery',
  // 工具栏与行键
  'configBtn',
  'leftText',
  'rowkey',
  // 引擎选择与虚拟滚动调参
  'virtual',
  'engine',
  'rowHeight',
  'estimatedRowHeight',
  'overscanCount',
  'rowClassName',
  // vxe 逃生舱（经 `options` 直达 vxe-engine，不是底座表格的 attr）
  'vxeConfig',
  'vxeOn',
  // vxe 一等公民（AI-31）：JSON 可承载，默认引擎忽略 —— 但同样不能落到 DOM
  'showFooter',
  'footerMethod',
  'footerData',
  'editConfig',
  'exportConfig',
  'toolbarConfig',
  'columnConfig',
  'keyboardConfig',
  'mouseConfig',
  'validConfig',
  'treeConfig',
  'proxyConfig',
  'expandConfig',
  'seqConfig',
  'keepSource',
  'printConfig',
  // 组件侧翻译的声明式配置
  'mergeConfig',
  'sortParam',
] as const

export type BaseTableInternalKey = (typeof BASE_TABLE_INTERNAL_KEYS)[number]
