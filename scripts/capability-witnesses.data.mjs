/**
 * 能力矩阵「人证」登记表（`CAPABILITIES` 每一格的可追溯证据）。
 *
 * ## 为什么需要这张表
 *
 * `CAPABILITIES` 的每一格都是一条**主张**：`full` = 三端同语义，`none` = 该端不支持。
 * 修前的 `note` 是散文，写完就没人再回头核对 —— antdv 的 `tableOptions.virtual: full`
 * 正是这样漂出来的：代码里从来没有虚拟引擎，矩阵却一直说支持。
 *
 * `scripts/check-capability-witnesses.mjs` 把「主张」变成「可失效的锚点」：
 *
 *   - **full** 必须指向能证明它落地的东西（spec 用例标题，或运行时接线源码）；
 *   - **none** 必须指向**运行时降级 / 明确不绑定**的那段源码（不能只指生成器告警）；
 *   - 锚点是正则：源码重构改名 → 守卫变红 → 人回来重新判断，而不是继续撒谎。
 *
 * ## 字段
 *
 * - `key`    必须与 `CAPABILITIES[].key` 完全一致；
 * - `target` `vue3` | `vue2` | `antdv`；
 * - `kind`   `spec`（测试证据）| `source`（源码接线证据）；
 * - `file`   相对仓根的路径；
 * - `pattern` 正则源码（字符串），必须在该文件里命中；
 * - `why`    一句话说明这段证据证明了什么（评审时看这里）。
 *
 * 新增矩阵格子时，守卫会要求同步登记人证；漏了直接红。
 */
export const WITNESSES = [
  // ── 前置列开关：三端都有真实渲染用例 ─────────────────────────────────────
  {
    key: 'tableOptions.multiSelect',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/es-table.spec.ts',
    pattern: 'multiSelect \\+ snIndex → 选择列、序号列前置',
    why: '默认 el-table 引擎真的把 multiSelect 变成选择列（AN-09 用例）',
  },
  {
    key: 'tableOptions.multiSelect',
    target: 'vue2',
    kind: 'spec',
    file: 'packages/vue2/__tests__/es-table.spec.ts',
    pattern: 'multiSelect \\+ snIndex → 选择列、序号列前置',
    why: 'Element UI 默认引擎的选择列前置用例',
  },
  {
    key: 'tableOptions.multiSelect',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/es-table.spec.ts',
    pattern: 'EsTable — 选择 \\(multiSelect\\)',
    why: 'a-table rowSelection 的专用用例组',
  },
  {
    key: 'tableOptions.snIndex',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/es-table.spec.ts',
    pattern: 'multiSelect \\+ snIndex → 选择列、序号列前置',
    why: '序号列与选择列同一条前置合成断言',
  },
  {
    key: 'tableOptions.snIndex',
    target: 'vue2',
    kind: 'spec',
    file: 'packages/vue2/__tests__/es-table.spec.ts',
    pattern: 'multiSelect \\+ snIndex → 选择列、序号列前置',
    why: '同上（Vue 2 默认引擎）',
  },
  {
    key: 'tableOptions.snIndex',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/es-table.spec.ts',
    pattern: 'snIndex → 序号列取 core 默认',
    why: 'a-table 序号列取 core 默认值（非本地重算）',
  },

  // ── 顶层 expandConfig：列上的展开明细 ────────────────────────────────────
  {
    key: 'expandConfig',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/generated-runtime.spec.ts',
    pattern: '62-supplier（声明式行展开 expandConfig）',
    why: '生成物里列上的 expandConfig 真的驱动了展开明细渲染',
  },
  {
    key: 'expandConfig',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/column-item.vue',
    pattern: 'cols\\.expandConfig\\.fields',
    why: 'Vue 2 列渲染器按声明式字段明细产出展开内容',
  },
  {
    key: 'expandConfig',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/table-expand-config.spec.ts',
    pattern: '声明式行展开 expandConfig',
    why: '仅凭列上 expandConfig 即渲染展开器并展示 label:value',
  },

  // ── 引擎 ──────────────────────────────────────────────────────────────────
  {
    key: 'tableOptions.virtual',
    target: 'vue3',
    kind: 'source',
    file: 'packages/vue3/src/components/es-table/src/engines/virtual-engine.vue',
    pattern: 'el-table-v2',
    why: 'vue3 的虚拟引擎是真实存在的 el-table-v2 渲染器',
  },
  {
    key: 'tableOptions.engine',
    target: 'vue3',
    kind: 'source',
    file: 'packages/vue3/src/components/es-table/src/engines/virtual-engine.vue',
    pattern: 'el-table-v2',
    why: 'virtual 引擎存在（default / vxe 分别由默认模板与 vxe-engine.vue 承担）',
  },
  {
    key: 'tableOptions.engine',
    target: 'vue2',
    kind: 'spec',
    file: 'packages/vue2/__tests__/vxe-engine.spec.ts',
    pattern: 'vxe-engine\\(vue2\\)',
    why: 'vue2 的 vxe 引擎由独立用例覆盖；default 引擎即基础渲染组',
  },

  // ── 顶层 treeConfig / mergeConfig ─────────────────────────────────────────
  {
    key: 'treeConfig',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/generated-runtime.spec.ts',
    pattern: '77-dept-tree（声明式树表 treeConfig',
    why: '嵌套 rows 真的渲染出父子层级（expandAll 初始全展开）',
  },
  {
    key: 'treeConfig',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/component.vue',
    pattern: 'const treeCfg = tableOptions\\.value\\.treeConfig',
    why: 'Vue 2 把 treeConfig 映射到 el-table 原生树属性',
  },
  {
    key: 'treeConfig',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/table-tree-config.spec.ts',
    pattern: '声明式树表 treeConfig',
    why: 'childrenField → childrenColumnName、expandAll → defaultExpandAllRows',
  },
  {
    key: 'mergeConfig',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/merge-span-witness.spec.ts',
    pattern: 'AI-23 声明式合并单元格',
    why: '生成物 mergeConfig 喂进真实 EsTable 后 DOM 出现 rowspan',
  },
  {
    key: 'mergeConfig',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/component.vue',
    pattern: 'buildRowSpanMethod\\(',
    why: 'Element UI 的 span-method 由 core 同一个合并闭包产出',
  },
  {
    key: 'mergeConfig',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/table-merge-config.spec.ts',
    pattern: '声明式合并单元格 mergeConfig',
    why: 'a-table 列级 customCell 真的产出 rowspan',
  },

  // ── 跨页选择 / 服务端排序 ─────────────────────────────────────────────────
  {
    key: 'tableOptions.cachePageSelection',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/es-table.spec.ts',
    pattern: 'clearSelection 清空全部（含跨页缓存）',
    why: '跨页缓存 + 清空语义的端到端用例',
  },
  {
    key: 'tableOptions.cachePageSelection',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/composables/use-table-selection.ts',
    pattern: 'restoreSelectionForPage\\(',
    why: 'Vue 2 翻页后按 rowkey 恢复勾选（跨页缓存的落地点）',
  },
  {
    key: 'tableOptions.cachePageSelection',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/es-table.spec.ts',
    pattern: 'clearSelection 清空全部（含跨页缓存）',
    why: 'ADV 侧同一条跨页缓存 / 清空用例',
  },
  {
    key: 'tableOptions.sortParam',
    target: 'vue3',
    kind: 'spec',
    file: 'packages/vue3/__tests__/es-table.spec.ts',
    pattern: '服务端排序（tableOptions\\.sortParam）',
    why: '请求漏斗真的带上 sortField / sortOrder',
  },
  {
    key: 'tableOptions.sortParam',
    target: 'vue2',
    kind: 'spec',
    file: 'packages/vue2/__tests__/es-table.spec.ts',
    pattern: '服务端排序（tableOptions\\.sortParam）',
    why: 'Vue 2 请求漏斗同口径',
  },
  {
    key: 'tableOptions.sortParam',
    target: 'antdv',
    kind: 'spec',
    file: 'packages/adapter-antdv/__tests__/es-table.spec.ts',
    pattern: '服务端排序（tableOptions\\.sortParam）',
    why: 'a-table sorter:true + 漏斗重取',
  },

  // ── none：必须指向运行时降级 / 明确不绑定的源码 ──────────────────────────
  {
    key: 'tableOptions.virtual',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/component.vue',
    pattern: '虚拟滚动 \\(virtual: true\\) 在 Vue 2',
    why: '运行时真的告警并降级为普通 el-table',
  },
  {
    key: 'tableOptions.virtual',
    target: 'antdv',
    kind: 'source',
    file: 'packages/adapter-antdv/src/components/es-table/src/component.vue',
    pattern: '不支持 options\\.virtual',
    why: '运行时真的告警并忽略（a-table 无虚拟滚动）',
  },
  {
    key: 'tableOptions.rowHeight',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/component.vue',
    pattern: "'rowHeight',",
    why: '该键在内部键清单里，不会绑定到 el-table',
  },
  {
    key: 'tableOptions.rowHeight',
    target: 'antdv',
    kind: 'source',
    file: 'packages/adapter-antdv/src/components/es-table/src/component.vue',
    pattern: "'rowHeight'",
    why: '该键在 TABLE_INTERNAL_KEYS 里，不会绑定到 a-table',
  },
  {
    key: 'tableOptions.estimatedRowHeight',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/component.vue',
    pattern: "'estimatedRowHeight',",
    why: '内部键，默认引擎与 vxe 引擎都不消费',
  },
  {
    key: 'tableOptions.estimatedRowHeight',
    target: 'antdv',
    kind: 'source',
    file: 'packages/adapter-antdv/src/components/es-table/src/component.vue',
    pattern: "'estimatedRowHeight'",
    why: '内部键，不会被 a-table 接收',
  },
  {
    key: 'tableOptions.overscanCount',
    target: 'vue2',
    kind: 'source',
    file: 'packages/vue2/src/components/es-table/component.vue',
    pattern: "'overscanCount',",
    why: '内部键，Element UI 无虚拟滚动可调',
  },
  {
    key: 'tableOptions.overscanCount',
    target: 'antdv',
    kind: 'source',
    file: 'packages/adapter-antdv/src/components/es-table/src/component.vue',
    pattern: "'overscanCount'",
    why: '内部键，a-table 不接收',
  },
]
