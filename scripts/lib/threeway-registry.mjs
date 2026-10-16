/**
 * 三向一致性登记表（AI-34）
 *
 * ## 为什么需要它
 *
 * es-plus 的「AI 契约 → 生成器 → 三端运行时」是一条三段链，每一段的词汇**各自手写**：
 *
 *   ① AI 契约（两处手写 Zod 副本：shared zod4 权威 + mcp 内联 zod3）
 *   ② 生成器发射面（`structured-generator.ts`，**两种模式两份产物**）
 *   ③ 三端运行时消费面（core 类型 + vue3/vue2/adapter-antdv 源码）
 *
 * 相邻两段之间已经各有一道守卫（`check-schema-contract` 守 ①② 的选键、
 * `check-contract-consumption` 守 ③ 的「声明即消费」）。**没有人守的是「任一段多出一个键、
 * 而另一段还没跟上」这条完整链路** —— 历史缺陷全部是这个形状：
 *
 *   - `cachePageSelection` / `isHidden` / `configTableOut`：AI 契约有、生成器不发射
 *     → 宿主 LLM 设了它、解析成功、零告警，产物里没有这个键（**声明未发射**）；
 *   - `estimatedRowHeight` / `overscanCount` / `rowClassName`：schema 模式发射、
 *     **SFC 模式不发射** → 同 config 两产物不等价（AI-30，本守卫 2026-10-16 实测咬出）；
 *   - `isInitRun` / `entryQuery` / `on` / `httpRequest` / `listenToCallBack`：
 *     运行时真消费、AI 契约零声明 → 经 AI 入口传入被 Zod 静默 strip（**消费未声明**）。
 *
 * 本表把这条链上的**四类漏算**逐行写下来，每行必须给出档位与原因。它与
 * `FRONT_DOOR_UNREACHABLE` / `SURFACE_FIELD_UNREACHABLE` / `DIALOG_KEY_UNREACHABLE`
 * 同一纪律：**是缺口清单，应只减不增**；补上某个键后必须删掉对应行，删漏即红。
 *
 * ## 四类漏算（axis）
 *
 * | axis | 含义 | 判据 |
 * |---|---|---|
 * | `declared-not-emitted` | AI 契约声明了、生成器（两模式）都不发射 | 键在 AI 键集 ∧ 不在任一模式产物 ∪ 本表 |
 * | `emitted-not-consumed` | 生成器发射了、三端运行时契约里没有 | 键在产物 ∧ 不在 core 契约类型 ∪ 本表 |
 * | `consumed-not-declared` | 运行时消费了、AI 契约零声明（Zod 静默 strip） | 键在 core/三端源码被读 ∧ 不在 AI 键集；**反向陈旧**：一旦进 AI 契约必须删行 |
 * | `unmodeled` | 两端都没有：既非 AI 可达、也非运行时消费（多半是端特化/死键的观察位） | 显式登记，无机械判据 |
 *
 * ## 档位（tier，沿用 AI 可达性台账的 4 档）
 *
 * `A` 前门声明式一步可达 / `B` 声明式但经 from_config / `C` 逃生舱·函数值 /
 * `D` 非 AI 生成目标（宿主编排）。
 */

/** 四类漏算的定义（脚本用它逐类报告，并断言「四类都有名字」）。 */
export const THREE_WAY_AXES = {
  'declared-not-emitted': 'AI 契约声明了、生成器（schema/sfc 两模式）都不发射',
  'emitted-not-consumed': '生成器发射了、三端运行时契约（core 类型）里没有 → 幽灵键',
  'consumed-not-declared': '运行时/渲染器真消费、AI 契约零声明 → 经 AI 入口传入被 Zod 静默 strip',
  unmodeled: '两端都无（既非 AI 可达、也非运行时消费）——端特化或死键的显式观察位',
}

/**
 * 类别 ①：**声明未发射**。
 *
 * 判据（脚本机械执行，三态）：
 *   - 键不在任一模式产物 ∧ 无本表行 → 红（真缺口）；
 *   - 键在产物 ∧ 有本表行 → 红（陈旧行：能发射了就必须删行）；
 *   - 键不在产物 ∧ 有本表行 → 行承重；若声明了 `emittedAs`，脚本当场核对那个产物键存在。
 *
 * `emittedAs: { key, domain }` 是**改名 / 条件发射**的可验证声明：domain ∈
 * `tableOptions | formItem | column | dialog | formLayout`（产物域），key 是产物里的词形。
 * 这不是免责声明 —— 断言失败即红（改名后产物里没有那个键 = 键真的丢了，只是换了套说法）。
 *
 * 每行都要回答同一个问题：**这个键到底是怎么生效的？**（生成期消费 / 改名后发射 /
 * 只在另一面发射 / 条件发射 / 确实无处可去）。答案含糊 = 该键的真实状态没人知道，
 * 那正是要消灭的状态。
 */
export const DECLARED_NOT_EMITTED = {
  // ── FieldConfig：生成期消费（驱动「生成什么」，本身不进产物）────────────────
  'fields.inQuery': {
    tier: 'B',
    reason: '面成员标志。生成期由 `generateSchema`/`generateSFC` 读它决定字段进不进查询表单（`queryFields`），是**驱动器**而非产物键 —— 产物侧对应的是「该字段在不在 formItems 里」。',
  },
  'fields.inTable': {
    tier: 'B',
    reason: '面成员标志。生成期读它决定派生表格列（`tableFields`）；`inTable:false` 的字段不进 columns（也就够不到列级 render）。同为驱动器。',
  },
  'fields.inForm': {
    tier: 'B',
    reason: '面成员标志。生成期读它决定弹窗表单字段（`formFields`）与 `required`/`rules` 是否落进 `formItemOptions`。同为驱动器。',
  },
  // ── FieldConfig：**改名**后发射（AI 面名字 ≠ 产物键名）────────────────────
  'fields.querySpan': {
    tier: 'B',
    reason: '**改名发射**：查询面列宽落成 formItem 的 `span`（`buildFormItem` 的 `context==="query"` 分支，默认 DatePicker/TimePicker 8、其余 6）。故产物里词形是 `span` 而非 `querySpan` —— 语义已到位，仅键名不同。',
    emittedAs: { key: 'span', domain: 'formItem' },
  },
  'fields.formSpan': {
    tier: 'B',
    reason: '**改名发射**：表单面列宽落成 formItem 的 `span`（`context==="form"` 分支，默认 24）。同 `querySpan`。',
    emittedAs: { key: 'span', domain: 'formItem' },
  },
  'fields.ellipsis': {
    tier: 'B',
    reason: '**改名发射**：`buildTableColumn`（schema 模式）与 `buildTableColumnSFC`（sfc 模式）都把它落成列的 `showOverflowTooltip: true` —— 即 Element（Plus/UI）`el-table-column` 的原生 prop 名。语义到位、键名不同；但**该词形不在 core `TableColumn` 里**，见 EMITTED_NOT_CONSUMED 的 `column.showOverflowTooltip` 行（virtual/vxe 引擎读的是 `ellipsis`，不读它）。',
    emittedAs: { key: 'showOverflowTooltip', domain: 'column' },
  },
  'fields.required': {
    tier: 'B',
    reason: '**改形发射**：落成 formItem 的 `formItemOptions.rules[]`（`buildFormItem` 的 `context==="form"` 分支，含 Select/Radio 等 → 中文「请选择」文案 + trigger:change）。**仅表单面**：查询面不校验，故 `inQuery:true ∧ inForm:false` 的字段上 `required` 无可达面（语义上本就无意义）。',
  },
  'fields.rules': {
    tier: 'B',
    reason: '**改形发射**：落进 `formItemOptions.rules[]`（逐条保留 message/required/pattern/min/max/type/trigger）。同 `required`，仅表单面生效。',
  },
  'fields.label': {
    tier: 'B',
    reason: '**条件发射**：`i18n:true` 且未显式给 `labelKey` 时，label 被 `labelKey: field.<prop>` 取代（i18n 派生优先序的最末一级）。故两模式产物里 label 可能缺席 —— 是优先序的正常结果，不是丢弃。',
  },
  // ── FieldConfig：源码扩展点（两模式产物形态不同，逐模式登记）────────────────
  // `render`/`formatter` 探针取真值时**两个模式都发射**，故它们不落本表（轴① 直接过）。
  // 记录在这里的是它们的**形态差**，供读者不必再翻源码：
  //   render：schema 模式 → 列 `scopedSlots: { customRender: 'column-<prop>' }`（配合 wrapper
  //           的 `<template #column-<prop>>` 作用域槽）；sfc 模式 → 列 `render: <源码>` 内联。
  //   formatter：schema 模式 → **不发射**（JSON 载不动函数）→ 含原文的降级告警
  //           （`formatterFields`，mark-not-drop）；sfc 模式 → 列 `formatter: <源码>` 内联。
  // ── TableOptions：无（26 键全部发射，见轴①/轴①b）─────────────────────────
  // ── DialogConfig：生成期控制位 ────────────────────────────────────────────
  'dialogs.hasCustomRender': {
    tier: 'B',
    reason: '**生成期控制位 + 条件发射**：`true` 时（a）放行 MCP 的「变更型弹窗无 formItems」语义告警（`generate-from-config.ts`）、（b）生成器走「自定义主体」分支并发射 `hasCustomRender: true` 供宿主/wrapper 识别、（c）发 TODO 槽告警；`false`（缺省）不发射任何东西。故探针取 false 时它不在产物里 —— 是条件发射而非丢弃。它同时是 `check-schema-contract` 的 `RESOURCE_MIRROR_ALLOWED_EXTRAS` 里唯一的「AI-only 注解键」。',
  },
  // ── FieldConfig：只在**另一面**发射（表格列）──────────────────────────────
  // width/minWidth/align/fixed/formatter 由 `buildTableColumn`/`buildTableColumnSFC` 发射，
  // 不进 formItem。脚本的轴①判据用的是「formItem ∪ column」的并集，故这些键不会落到本表
  // —— 只有连表格面都不发射的键才需要登记（见脚本实测输出）。
}

/**
 * 类别 ②：**发射未消费**。
 *
 * 判据（脚本机械执行）：`key ∈ 生成器产物（任一模式、任一域）` ∧ `key ∉ core 契约类型
 * （TableOptions / FormItemOption / TableColumn）∪ 三端 CrudDialogConfig（交集）` → 必须在本表有一行。
 *
 * core 契约类型是**三端消费面的上界**：三端把 `options` 展开到引擎 props、把 formItem
 * 交给组件、把 column 交给列组件，键只要在 core 契约里就有消费通道；不在则无端可接。故这条
 * 断言是「发射 ⊆ 可消费」的**精确代理**，比按字段名 grep 三端源码更少假阳（后者对
 * `size`/`key`/`type` 这类通用词会恒真 —— 该局限已记在 `check-contract-consumption.mjs` 的文件头）。
 */
export const EMITTED_NOT_CONSUMED = {
  'column.showOverflowTooltip': {
    tier: 'D',
    consumedAt: [
      { file: 'packages/vue3/src/components/es-table/src/column-item.vue', pattern: /const columnBindAttr = / },
      { file: 'packages/vue2/src/components/es-table/column-item.vue', pattern: /const columnBindAttr = / },
    ],
    reason:
      '**半通道键（本表首行，实缺陷）**：core `TableColumn` 命名的同义键是 `ellipsis`，但派生的表格列由 `buildTableColumn`（schema 模式）与 `buildTableColumnSFC`（sfc 模式）发射成 `showOverflowTooltip: true` —— 三端只把它当**未知键**经 `columnBindAttr` 原样透传给 `el-table-column`（Element Plus/UI 恰好有同名原生 prop，故走 Element 默认引擎时「碰巧能用」）。三端自己的省略号读取点读的是 `ellipsis`：vue3 `engines/use-column-adapter.ts`（virtual 引擎）与 `engines/use-vxe-column-adapter.ts`（vxe → `showOverflow: tooltip`）、vue3/vue2 `column-item.vue` 的 `v-else-if="cols.ellipsis"` 模板分支。结论：**配了 `ellipsis` 的字段在 virtual/vxe 引擎下静默失去省略号**；core `TableColumn` 不收该词形，故登记在此而非「修 contract」。正解是派生路径改发 `ellipsis`（与显式列路径 `pushSfcColumn` 一致），需一次产物快照/golden 对齐裁决，故本轮只登记、不改。',
  },
}

/**
 * 类别 ③：**消费未声明**（AI-31② 的首批落点）。
 *
 * 判据（脚本机械执行，双条件）：
 *   (a) 反向陈旧：键若**已在** AI 键集 → 本表该行过期，必须删除（收编后不得留行）；
 *   (b) 证据存活：`consumedAt` 列的每个 `{ file, pattern }` 必须真在源码里命中 ——
 *       消费者被删/改名后本行**立刻变红**，不会退化成一句无凭据的断言。
 *
 * 与 `check-contract-consumption.mjs` 的分工：那道守卫管「core 契约接口声明的键在三端是否被读」；
 * 本表的键**根本不在 AI 契约里**，是另一条边（AI 入口够不到运行时真实存在的能力）。
 *
 * 覆盖边界（刻意，非疏漏）：本表是**人工裁决清单**，不是机械发现的全集 —— 机械发现
 * 「运行时读了一个不在 AI 契约里的键」需要对三端做 AST 级键读取分析，噪音（局部变量、
 * 通用词 `key`/`type`/`size`）会淹没信号。故发现路径是「人读到一处真消费 → 登记一行 +
 * 证据」，守卫负责**防止这些行腐烂**。新增行永远欢迎，删行只在收编后。
 */
export const CONSUMED_NOT_DECLARED = {
  'tableOptions.isInitRun': {
    tier: 'C',
    reason:
      '首次运行标志（`false` 时跳过「挂载即请求」，用于需要宿主先注入参数的页面）。表级与字段级两级都存在（core `TableOptions.isInitRun` / `FormItemOption.isInitRun`），AI 契约两级都零声明 → 经 AI 入口传入被 Zod 静默 strip。属**宿主编排**语义（什么时候算「首次」由宿主决定），故不补声明，登记为不可达。',
    consumedAt: [
      { file: 'packages/core/src/types.ts', pattern: /^ {2}isInitRun\?:\s*boolean/m },
      { file: 'packages/vue3/src/components/es-table/src/component.vue', pattern: /props\.options\.isInitRun !== false/ },
      { file: 'packages/vue3/src/components/es-form/src/es-form.vue', pattern: /it\.isInitRun !== false/ },
    ],
  },
  'tableOptions.entryQuery': {
    tier: 'C',
    reason:
      '进入页面时的初始查询参数（`Record<string, unknown>`）：由宿主在编排时注入（例如从路由 query 带上）——语义上是**宿主上下文**而非可从自然语言推导的字段声明，故不补声明。注意它只在 **tableOptions 级**（core `TableOptions.entryQuery`），字段级无此键。',
    consumedAt: [
      { file: 'packages/core/src/types.ts', pattern: /^ {2}entryQuery\?:\s*Record/m },
      { file: 'packages/vue3/src/components/es-table/src/component.vue', pattern: /props\.options\.entryQuery/ },
    ],
  },
  'tableOptions.httpRequest': {
    tier: 'C',
    reason:
      '自定义请求函数（表级逃生舱，宿主注入自己的 fetch 实现）。字段级另有同名的 `FormItemOption.httpRequest`（远端下拉）。AI 契约以 `apiParams.url` 表达数据源、不承载函数；函数值本就不进 AI 配置（Tier-3）。',
    consumedAt: [
      { file: 'packages/core/src/types.ts', pattern: /^ {2}httpRequest\?:\s*\(params/m },
      { file: 'packages/vue3/src/components/es-table/src/component.vue', pattern: /'httpRequest', 'configTableOut', 'listenToCallBack'/ },
    ],
  },
  'tableOptions.listenToCallBack': {
    tier: 'C',
    reason:
      '外部重载回调注册（函数值）：宿主订阅「别的组件触发了本表刷新」。同为宿主编排的函数值通道，AI 契约不收 —— 需要刷新时宿主调 `tableRef.value.httpRequestInstance()`，那是命令式 API（Tier-3）。表级与字段级两级都存在。',
    consumedAt: [
      { file: 'packages/core/src/types.ts', pattern: /^ {2}listenToCallBack\?:\s*ListenToCallBack/m },
      { file: 'packages/vue3/src/components/es-table/src/component.vue', pattern: /props\.options\.listenToCallBack/ },
    ],
  },
  'fields.on': {
    tier: 'C',
    reason:
      '表单控件的**事件袋**（`FormItemOption.on`，如 `{ change: (v) => … }`）：值全是函数，AI 配置载不动（JSON）。运行时真消费 —— vue3 经 `use-form-inputs.ts` 的 `rowPassThrough` 把 `on` 的每个键转成 `onXxx` 后透传给控件（另有 Upload 分支单独处理）。声明式替代是 `reactions`（选项/必填/禁用/值联动）与 `isHidden`（显隐），覆盖了 `on` 的绝大多数实际用途，故本键不补声明。',
    consumedAt: [
      { file: 'packages/mcp-server/src/resources/types.ts', pattern: /^ {2}on\?:\s*Record<string,\s*unknown>/m },
      { file: 'packages/vue3/src/composables/use-form-inputs.ts', pattern: /if \(row\.on\) \{/ },
      { file: 'packages/vue3/src/composables/use-form-inputs.ts', pattern: /function toOnKey/ },
    ],
  },
}

/**
 * 类别 ④：**未建模**。
 *
 * 既不在 AI 契约、也不被运行时消费的观察位。**刻意为空**：本表不是垃圾桶 —— 任何被发现的
 * 静默键都必须先归到前三类里去裁决（补声明 / 补发射 / 补消费 / 删），归不进去才落这里并说明
 * 它为什么两边都不该有。
 */
export const UNMODELED = {}

/**
 * SFC 能力表（AI-30②）——`mode: 'sfc'` 相对 `mode: 'schema'` **降级**的顶层 surface。
 *
 * 为什么不能复用 AI 可达性台账（`feature-coverage.data.mjs`）：那张表的行是**文档站 demo
 * 维度**（96 例特性演示），它的键是「能力令牌」；而这里描述的是**生成器 surface 的两种模式
 * 之差** —— 同一份 config，`mode: 'schema'` 全量支持、`mode: 'sfc'` 只支持一部分。两个维度
 * 装不进一张表，硬塞进去只会让「A 档可达」既指 demo 又指 mode，语义糊掉。
 *
 * 为什么必须**公开**（而不是只留在生成器的一句 `warnings.push`）：告警是**运行时**的（宿主
 * 得先跑一遍生成器才看得到），而「SFC 到底不支持什么」是**选型时**就要知道的事实。宿主 LLM
 * 决定 `mode` 的那一刻，需要一张能读的表。
 *
 * ## 双向绑定（守卫机械执行）
 *
 * 本表**不是**文档，是被断言绑死的：
 *   - 生成器 `ignoredInSfc.push('<key> …')` 里出现的每个 key **必须**在本表有一行 ——
 *     新降级一个 surface 却忘了登记 → 红；
 *   - 本表每行的 key **必须**仍在生成器里被 push —— 某天补齐了消费却没删行 → 红
 *     （同「只减不增」纪律）。
 * 每行还要给出 `evidence`（在生成器源码里命中那个 push 点）—— 证据一没，行就红。
 *
 * 行形状：`{ reason（为什么降级 / 丢了什么）, escape（想要全量怎么办）, evidence }`。
 * 刻意**不用** tier：tier 是 AI 可达性档位，与「模式之差」不是一个轴，混用会让两套语义互相
 * 稀释（这张表的判据是「生成器真不消费」，不是「AI 够不够得到」）。
 */
export const SFC_DEGRADATIONS = {
  dialogs: {
    reason:
      'SFC 只从 `actions` 派生**单个通用弹窗**（含 `const dialog` 骨架 + `const dialogFormItems`），不消费 `config.dialogs` 的逐弹窗 title/width/formItems/formLayout/isDraggable/maxHeight/fullscreen/isHiddenFooter —— 多弹窗、自定义宽度、独立表单布局在 SFC 模式下全部丢失。',
    escape: '改用 mode=schema（逐弹窗全量发射），或按 `warnings` 引导手工补全 `const dialog`：把派生弹窗换成手写 `useDialog` 调用。',
    evidence: { file: 'packages/shared/src/structured-generator.ts', pattern: /ignoredInSfc\.push\('dialogs \(/ },
  },
  tableBtns: {
    reason:
      'SFC 不消费 `config.tableBtns`（表格上方按钮及其 `code:1/2` 左右定位）。SFC 的表格工具栏由 `queryBtns` 派生，表头区的批量操作按钮无处安放。',
    escape: '改用 mode=schema，或手工在 SFC 模板里补 `<template #configBtn>` 插槽与按钮。',
    evidence: { file: 'packages/shared/src/structured-generator.ts', pattern: /ignoredInSfc\.push\('tableBtns \(/ },
  },
  toolbarBtns: {
    reason:
      'SFC 不消费 `config.toolbarBtns`（表单区按钮及其 `name/position/dialogKey`）—— SFC 的表单区按钮由 `queryBtns`/`actions` 派生。此键**曾经漏在告警清单外**（既不生效也不告警，违反本函数自己的约定），已补。',
    escape: '改用 mode=schema，或手工在 SFC 模板的表单区补按钮并自行绑定 `dialogKey`。',
    evidence: { file: 'packages/shared/src/structured-generator.ts', pattern: /ignoredInSfc\.push\('toolbarBtns \(/ },
  },
  operationColumn: {
    reason:
      'SFC 不消费 `config.operationColumn`（操作列的 `label/width/fixed`），而是按 `actions`/`btns` 派生的操作列写死 `label: \'操作\'`、`width: 按钮数×80+20`、`fixed: \'right\'`。',
    escape: '改用 mode=schema（操作列全由运行时按 `operationColumn` 渲染），或在 SFC 的 `const columns` 里手工改那一列的 `label/width/fixed`。',
    evidence: { file: 'packages/shared/src/structured-generator.ts', pattern: /ignoredInSfc\.push\('operationColumn \(/ },
  },
}
