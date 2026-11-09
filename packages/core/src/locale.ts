/**
 * 内置文案与 locale（W3-1）
 *
 * 为什么需要它：`EsPlusGlobalConfig.t` 只服务 `labelKey`（业务字段文案），库里还有一批
 * **框架自己产生的**用户可见文案 —— 空态、加载中、CRUD 自动派生的按钮名、操作列标题、
 * 删除确认、弹窗底部的取消/确定。这些此前在三个渲染器里各写一份中文字面量，于是：
 *
 *   1. 英文宿主拿到的是一半英文（自己的业务文案）、一半中文（库的默认按钮）；
 *   2. 改一句措辞要改 3 个包、9 个文件，且守卫抓不到漏改；
 *   3. 业务想覆盖「操作」列标题只能绕道 `operationColumn.label`，改不了自动派生路径。
 *
 * 设计约束（刻意**不复用** `t`）：
 *   - `t` 是宿主注入的翻译函数，命名空间属于业务（`labelKey`）。拿它查库文案会和业务键
 *     撞车，也会让「只想翻库文案」的宿主被迫实现整张表。
 *   - 本模块的字典是**库的契约**：键由库定义、值可被 `messages` 单键覆盖，缺省 zh-CN。
 *
 * Phase 1 是**安装时静态**语义：`resolveBuiltinText` 在渲染/求值时读全局单例，因此
 * `app.use(EsPlus, { locale })` 必须在首屏渲染前完成（一直是这个要求）。运行期热切换
 * 需要订阅器 + 组件内版本号，属 Phase 2，不在本期。
 */
import { getGlobalConfig } from './config.js'

/**
 * 库内置文案的键。
 *
 * 新增键时必须同时：① 在 `ZH_CN_MESSAGES` / `EN_US_MESSAGES` 两处填值（类型强制）；
 * ② 把调用点从字面量改成 `resolveBuiltinText(key)`；③ `check:i18n-literals` 会禁止
 * 字典里的 zh 值再次以字面量出现在运行时代码里。
 */
export type BuiltinTextKey =
  | 'emptyText'
  | 'loading'
  | 'add'
  | 'edit'
  | 'view'
  | 'delete'
  | 'export'
  | 'import'
  | 'query'
  | 'reset'
  | 'operation'
  | 'cancel'
  | 'ok'
  | 'confirm'
  | 'tip'
  | 'deleteConfirm'
  | 'confirmAction'
  | 'fullscreen'
  | 'exitFullscreen'
  | 'close'
  | 'fold'
  | 'unfold'
  | 'other'
  | 'prev'
  | 'next'

/** 简体中文（缺省）。**值即 v1.5 三个渲染器里原有的字面量**，默认行为逐字节不变。 */
export const ZH_CN_MESSAGES: Record<BuiltinTextKey, string> = {
  emptyText: '暂无数据',
  loading: '努力加载中...',
  add: '新增',
  edit: '编辑',
  view: '查看',
  delete: '删除',
  export: '导出',
  import: '导入',
  query: '查询',
  reset: '重置',
  operation: '操作',
  cancel: '取消',
  ok: '确定',
  confirm: '确认',
  tip: '提示',
  deleteConfirm: '确定删除该条数据吗？',
  confirmAction: '确定执行此操作吗？',
  // 弹窗头部的图标按钮没有可见文字，这三个键只作为 `aria-label` 供读屏使用
  fullscreen: '全屏',
  exitFullscreen: '退出全屏',
  close: '关闭',
  fold: '展开',
  unfold: '收起',
  other: '其他',
  prev: '上一步',
  next: '下一步',
}

/** English. */
export const EN_US_MESSAGES: Record<BuiltinTextKey, string> = {
  emptyText: 'No data',
  loading: 'Loading...',
  add: 'Add',
  edit: 'Edit',
  view: 'View',
  delete: 'Delete',
  export: 'Export',
  import: 'Import',
  query: 'Search',
  reset: 'Reset',
  operation: 'Actions',
  cancel: 'Cancel',
  ok: 'OK',
  confirm: 'Confirm',
  tip: 'Notice',
  deleteConfirm: 'Delete this record?',
  confirmAction: 'Proceed with this action?',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  close: 'Close',
  fold: 'Expand',
  unfold: 'Collapse',
  other: 'Other',
  prev: 'Previous',
  next: 'Next',
}

/**
 * 全局 locale 配置的形态。
 *
 * - `'zh-CN' | 'en-US'`：用内置字典；
 * - `{ name, messages }`：自定义语言，`name` 以 `en` 开头时以英文为底，再用 `messages`
 *   覆盖单键（这样「只翻一句」也可行，不必抄整张表）。
 */
export type LocaleOption =
  | 'zh-CN'
  | 'en-US'
  | { name: string; messages?: Partial<Record<BuiltinTextKey, string>> }

/** `messages` 覆盖表的形状：键必须是内置键，但允许部分覆盖。 */
export type BuiltinMessages = Partial<Record<BuiltinTextKey, string>>

/**
 * 取一条内置文案。
 *
 * 优先级：`messages[key]`（全局单键覆盖）> `locale.messages[key]` > 按 locale 选的字典。
 * 未知 locale 名（非 en 开头）按 zh-CN 兜底 —— 与历史行为一致（默认中文）。
 */
export function resolveBuiltinText(key: BuiltinTextKey): string {
  const cfg = getGlobalConfig() as { locale?: LocaleOption; messages?: BuiltinMessages }
  const override = cfg.messages?.[key]
  if (typeof override === 'string') return override

  const locale = cfg.locale
  if (locale && typeof locale === 'object') {
    const own = locale.messages?.[key]
    if (typeof own === 'string') return own
    return String(locale.name).toLowerCase().startsWith('en') ? EN_US_MESSAGES[key] : ZH_CN_MESSAGES[key]
  }
  return locale === 'en-US' ? EN_US_MESSAGES[key] : ZH_CN_MESSAGES[key]
}

/** 供测试/排查用：当前 locale 解析到哪本字典（不读 messages 覆盖）。 */
export function resolveLocaleName(): string {
  const cfg = getGlobalConfig() as { locale?: LocaleOption }
  const locale = cfg.locale
  if (!locale) return 'zh-CN'
  return typeof locale === 'object' ? String(locale.name) : locale
}

/**
 * 默认工具栏按钮（locale 感知）。
 *
 * `constants.ts` 里的 `DEFAULT_TOOLBAR_BTNS` / `DEFAULT_ROW_BTNS` 是**兼容导出**：
 * 它们是模块加载时求值的静态对象，无法感知 install 时的 locale，且被
 * `check:schema-contract` 与 shared 的手写副本逐值比对，不能改成函数调用。
 * 运行时要文案的地方一律走这两个 getter；新代码不要再用那两份静态常量。
 */
export function getDefaultToolbarBtns() {
  return {
    ADD: { name: resolveBuiltinText('add'), type: 'primary', key: 'add', icon: 'Plus', dialogKey: 'add' },
    EXPORT: { name: resolveBuiltinText('export'), key: 'export', icon: 'Download', actionType: 'export' },
    IMPORT: { name: resolveBuiltinText('import'), key: 'import', icon: 'Upload', actionType: 'import' },
  }
}

/** 默认行内按钮（locale 感知）。删除按钮自带确认文案。 */
export function getDefaultRowBtns() {
  return {
    VIEW: { name: resolveBuiltinText('view'), type: 'primary', key: 'view', dialogKey: 'view' },
    EDIT: { name: resolveBuiltinText('edit'), type: 'primary', key: 'edit', dialogKey: 'edit' },
    DELETE: {
      name: resolveBuiltinText('delete'),
      type: 'danger',
      key: 'delete',
      confirm: resolveBuiltinText('deleteConfirm'),
    },
  }
}
