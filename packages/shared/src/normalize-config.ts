/**
 * AN-08 / AN-24 —— 配置的**宽松入口归一**（只做有据可查的别名/搬迁/形态展开）。
 *
 * 与 `validateAndRepair` 的分工：校验器**只判不改**（这是 C2·A3 的刻意边界，见其头注），
 * 而生成入口需要「旧写法照样能落地」。归一逻辑因此独立成纯函数，返回 `renames[]`
 * 让调用方（生成器 / `repairConfig`）能把「我替你改了什么」讲给宿主。
 *
 * ## 只做有据可查的归一
 *
 * 1. **按钮别名** `label→name`、`action→actionType`。
 *    依据：渲染器契约 `BtnConfig` 只有 `name`/`actionType`，而旧示例写法把显示名写成
 *    `label`、把动作写成 `action`。`tableBtns[]` 自 AN-07 起就在 schema 里收这两个别名；
 *    AN-24 把同一份语义扩展到 **`toolbarBtns[]`**、**`operationColumn.btns[]`** 与
 *    **`dialogs[k].configBtn[]`**（三者都是"有名字的按钮"，别名不会多义）。
 *    归一后**删除别名键**——留着会让下游同时看到 `name` 与 `label` 两个可能不一致的真相。
 *    注意：弹窗底部按钮的 `action` 是**语义键**（confirm/cancel/custom），不是
 *    `actionType` 的别名，故该处不做 action 归一。
 *
 * 2. **顶层 `rowkey` → `tableOptions.rowkey`**。
 *    依据：`generate_crud` 的前门今天就收一个**顶层** `rowkey`，并把它并进
 *    `tableOptions`（AN-06③，冲突时取顶层，因为弹窗 PUT / 删除 URL 与表格必须用同一个键）。
 *    结构化配置 schema 没有顶层 `rowkey`；宿主照着前门文档写配置时，这个键会落到顶层。
 *    搬迁保持与 AN-06③ **同一优先级**（顶层覆盖 `tableOptions.rowkey`）。
 *
 * 3. **`dialogs` 罐头键展开**（AN-24）。
 *    依据：前门 `surfaces.dialog` 收 `["add","edit"]` 这样的罐头键数组，LLM 很容易把它
 *    直接写进结构化配置；而 schema 的 `dialogs` 是 record。`['add','edit']` →
 *    `{ add: {}, edit: {} }`、`{ add: true }` → `{ add: {} }` 都是**零信息损失**的展开
 *    （空对象 = 全部取默认）。只展开**全部**元素都是 canonical 罐头键的数组——部分可识别
 *    时原样保留，避免"悄悄丢掉看不懂的那一项"。
 *
 * 4. **`dialogs[k].formItems` 简写展开**（AN-24）。
 *    依据：顶层 `fields` 已经是字段的权威定义；弹窗里写 `['name']` 或 `[{ prop:'name' }]`
 *    显然是在引用同一字段。展开 = 用顶层同 `prop` 字段补全缺失键，**条目自身给的键优先**。
 *    `prop` 在顶层找不到时原样保留（不猜）。
 *    展开**只投影表单面**（`DIALOG_FORM_ITEM_KEYS`）：`inQuery/inTable/inForm` 是生成器侧
 *    的归属推导，`querySpan/align/width` 之类是表格/查询面的布局，弹窗里没有消费者 ——
 *    抄进去既让每条简写都发一条「自动归一」把真问题淹掉，又可能把一个本该在弹窗里渲染的
 *    条目标成 `inForm: false`（见 `projectDialogFormItem` 头注）。
 *
 * 刻意**不**做的：「猜意图」的改名（`rowKey`→`rowkey`、`type`→`formtype`…）。
 * 那些是拼写错误，应当由 `collectUnknownKeys` 报出来让宿主自己改 —— 静默改写在
 * 多义键上会把「写错了」变成「看起来对了但不是我想要的」。
 */
import { normalizeTableBtn } from './structured-config.schema.js'

/** 一条归一记录（给宿主看的「我改了什么」）。 */
export interface ConfigRename {
  /** 源路径，如 `/tableBtns/0/label`、`/rowkey`。 */
  from: string
  /** 目标路径，如 `/tableBtns/0/name`、`/tableOptions/rowkey`。 */
  to: string
  /** 人话说明（含依据）。 */
  note: string
}

export interface NormalizeConfigResult<T = unknown> {
  config: T
  renames: ConfigRename[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** 前门 / `dialogs` 认可的罐头键（与 generate-crud.ts 的 surfaces.dialog 同集）。 */
const CANNED_DIALOG_KEYS = new Set(['add', 'edit', 'view'])

function cloneValue<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <V>(v: V) => V }).structuredClone
  if (typeof sc === 'function') return sc(value)
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * 按钮别名归一（`label→name`，可选 `action→actionType`）。
 *
 * `renameAction` 只在 **`actionType` 是规范键**的按钮上开（tableBtns / toolbarBtns）；
 * 弹窗底部按钮的 `action` 是 confirm/cancel/custom 的语义键，传 false。
 */
function normalizeButtonAliases(
  raw: Record<string, unknown>,
  basePath: string,
  renames: ConfigRename[],
  renameAction: boolean,
): Record<string, unknown> {
  const out = { ...raw }
  const hasName = isNonEmptyString(out.name)
  const hasLabel = isNonEmptyString(out.label)

  if (hasLabel && !hasName) {
    out.name = out.label
    renames.push({
      from: `${basePath}/label`,
      to: `${basePath}/name`,
      note: '按钮的 label 是 name 的旧别名，已按规范键归一。',
    })
  } else if (hasLabel && hasName && out.label !== out.name) {
    renames.push({
      from: `${basePath}/label`,
      to: `${basePath}/name`,
      note: `按钮同时给了 name 与 label 且不一致，规范键 name 优先，已删除 label（"${String(out.label)}"）。`,
    })
  }
  delete out.label

  if (renameAction) {
    const hasActionType = isNonEmptyString(out.actionType)
    const hasAction = isNonEmptyString(out.action)
    if (hasAction && !hasActionType) {
      renames.push({
        from: `${basePath}/action`,
        to: `${basePath}/actionType`,
        note: '按钮的 action 是 actionType 的旧别名，已按规范键归一。',
      })
      out.actionType = out.action
    } else if (hasAction && hasActionType && out.action !== out.actionType) {
      renames.push({
        from: `${basePath}/action`,
        to: `${basePath}/actionType`,
        note: `按钮同时给了 actionType 与 action 且不一致，规范键 actionType 优先，已删除 action（"${String(out.action)}"）。`,
      })
    }
    delete out.action
  }

  return out
}

function normalizeButtonArray(
  raw: unknown,
  basePath: string,
  renames: ConfigRename[],
  renameAction: boolean,
): unknown {
  if (!Array.isArray(raw)) return raw
  return raw.map((btn, index) =>
    isPlainObject(btn)
      ? normalizeButtonAliases(btn, `${basePath}/${index}`, renames, renameAction)
      : btn,
  )
}

/**
 * `dialogs` 罐头键展开（AN-24）。
 *
 * 只处理两种**零信息损失**的形态：
 *   - `['add','edit']`（全部元素都是罐头键）→ `{ add:{}, edit:{} }`
 *   - `{ add: true }` → `{ add: {} }`
 *
 * 数组里只要有一项不是 canonical 罐头键就**整段不动** —— 局部展开会静默丢掉看不懂的项，
 * 那正是本项要消灭的「看起来成功、其实少了东西」。
 */
function expandDialogs(raw: unknown, renames: ConfigRename[]): unknown {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return raw
    if (!raw.every((k) => isNonEmptyString(k) && CANNED_DIALOG_KEYS.has(k))) return raw
    const out: Record<string, unknown> = {}
    for (const key of raw as string[]) {
      if (key in out) continue
      out[key] = {}
    }
    renames.push({
      from: '/dialogs',
      to: '/dialogs',
      note: `dialogs 是罐头键数组（${raw.join(', ')}），已展开为 record；空对象表示全部取默认。`,
    })
    return out
  }

  if (!isPlainObject(raw)) return raw

  const out: Record<string, unknown> = {}
  let changed = false
  for (const [key, value] of Object.entries(raw)) {
    if (value === true) {
      out[key] = {}
      changed = true
      renames.push({
        from: `/dialogs/${key}`,
        to: `/dialogs/${key}`,
        note: `dialogs.${key} 是 true，已展开为空对象（全部取默认）。`,
      })
    } else {
      out[key] = value
    }
  }
  return changed ? out : raw
}

/**
 * 弹窗表单项（`dialogs[k].formItems[*]`）真正消费的键 —— 展开顶层字段时的**投影白名单**。
 *
 * 依据：三个渲染端把弹窗 `formItems` 原样交给 EsForm（`formItemList`），表单面只读
 * `prop/label/labelKey/formtype/required/rules/attrs/dataOptions/apiParams/formSpan/
 * permissionValue/isHidden/reactions`。三成员布尔 `inQuery/inTable/inForm` 是**生成器侧
 * 的归属推导**（`structured-generator` 按 `field.inForm !== false` 收字段），表格/查询面
 * 专有的 `querySpan`/`align`/`width`/`minWidth`/`fixed`/`ellipsis`/`formatter`/`render`
 * 在弹窗里没有任何消费者。
 *
 * 不投影会制造两类**错**（都不只是噪音）：
 *   ① 每条 `formItems` 简写都发一条「自动归一」，把真正的映射问题淹掉；
 *   ② 顶层字段的 `inForm: false`（只查不录）被抄进弹窗表单项 —— 一个明明要在弹窗里渲染的
 *      条目被标成「不进表单」，语义自相矛盾。（同理 `inQuery: true` 会让弹窗条目看起来像
 *      查询字段。）这与 `repair-config` 头注「不补 `.default()`」是同一条纪律：
 *      省略就保持省略，绝不替宿主编造归属。
 */
export const DIALOG_FORM_ITEM_KEYS = [
  'prop',
  'label',
  'labelKey',
  'formtype',
  'required',
  'rules',
  'attrs',
  'dataOptions',
  'apiParams',
  'formSpan',
  'permissionValue',
  'isHidden',
  'reactions',
] as const

/** 把顶层字段投影成弹窗表单项（丢掉表格/查询面与归属键）。只带**有值**的键。 */
export function projectDialogFormItem(field: Record<string, unknown>): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const key of DIALOG_FORM_ITEM_KEYS) {
    if (field[key] !== undefined) item[key] = cloneValue(field[key])
  }
  return item
}

/**
 * `dialogs[k].formItems` 简写展开（AN-24）：`'name'` / `{ prop:'name' }` → 顶层同 prop 字段。
 *
 * 展开**只补表单面**的键（见 `DIALOG_FORM_ITEM_KEYS`）：顶层字段的
 * `inQuery/inTable/inForm`、`querySpan`、`align` 之类在弹窗里没有消费者，抄进去只会
 * 制造「自动归一」噪音与自相矛盾的归属标记。
 * 条目自身给出的键优先；只补**条目没给**的键。顶层找不到同 prop 字段时原样保留。
 */
function expandDialogFormItems(
  raw: unknown,
  dialogKey: string,
  fieldsByProp: Map<string, Record<string, unknown>>,
  renames: ConfigRename[],
): unknown {
  if (!Array.isArray(raw) || fieldsByProp.size === 0) return raw

  let changed = false
  const out = raw.map((item, index) => {
    const basePath = `/dialogs/${dialogKey}/formItems/${index}`

    // 形态①：纯字符串 = 引用顶层字段的 prop
    if (isNonEmptyString(item)) {
      const field = fieldsByProp.get(item)
      if (!field) return item
      changed = true
      renames.push({
        from: basePath,
        to: basePath,
        note: `弹窗表单项写成了字符串 "${item}"，已按顶层 fields 中同 prop 的字段定义展开（补全 label/formtype 等）。`,
      })
      return projectDialogFormItem(field)
    }

    // 形态②：{ prop } 简写 = 顶层字段（表单面投影）+ 条目自身的覆盖
    if (isPlainObject(item) && isNonEmptyString(item.prop)) {
      const field = fieldsByProp.get(item.prop)
      if (!field) return item
      const projected = projectDialogFormItem(field)
      const missing = Object.keys(projected).filter((k) => !(k in item))
      if (missing.length === 0) return item
      changed = true
      renames.push({
        from: basePath,
        to: basePath,
        note: `弹窗表单项只给了部分键，已用顶层 fields 中 prop="${item.prop}" 的字段补全缺失键（${missing.join(', ')}）；条目自身给的键优先。`,
      })
      return { ...projected, ...item }
    }

    return item
  })

  return changed ? out : raw
}

function fieldsByPropOf(config: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(config.fields)) return map
  for (const field of config.fields) {
    if (!isPlainObject(field) || !isNonEmptyString(field.prop)) continue
    if (!map.has(field.prop)) map.set(field.prop, field)
  }
  return map
}

/**
 * 归一配置。不修改入参：只克隆被触碰的层级（顶层 / `tableOptions` / 被改写的按钮）。
 *
 * 输入不是对象时原样返回、零 renames —— 类型错误由 schema 校验负责报。
 */
export function normalizeConfig<T = unknown>(input: T): NormalizeConfigResult<T> {
  const renames: ConfigRename[] = []
  if (!isPlainObject(input)) return { config: input, renames }

  let config: Record<string, unknown> = { ...input }

  // ① tableBtns 别名（AN-07 的同一份归一实现，不复制规则）。
  //    每个按钮都过 `normalizeTableBtn`（它同时收敛 position→code 的既有语义）；
  //    没有别名的按钮也走一遍，产物与 AN-07 逐字节一致。
  if (Array.isArray(config.tableBtns)) {
    const buttons = config.tableBtns.map((raw, index) => {
      if (!isPlainObject(raw)) return raw
      const hasName = isNonEmptyString(raw.name)
      const hasLabel = isNonEmptyString(raw.label)
      const hasActionType = isNonEmptyString(raw.actionType)
      const hasAction = isNonEmptyString(raw.action)

      if (hasLabel && !hasName) {
        renames.push({
          from: `/tableBtns/${index}/label`,
          to: `/tableBtns/${index}/name`,
          note: 'tableBtns[] 的 label 是 name 的旧别名（AN-07），已按规范键归一。',
        })
      } else if (hasLabel && hasName && raw.label !== raw.name) {
        renames.push({
          from: `/tableBtns/${index}/label`,
          to: `/tableBtns/${index}/name`,
          note: `tableBtns[] 同时给了 name 与 label 且不一致，规范键 name 优先，已删除 label（"${String(raw.label)}"）。`,
        })
      }
      if (hasAction && !hasActionType) {
        renames.push({
          from: `/tableBtns/${index}/action`,
          to: `/tableBtns/${index}/actionType`,
          note: 'tableBtns[] 的 action 是 actionType 的旧别名（AN-07），已按规范键归一。',
        })
      } else if (hasAction && hasActionType && raw.action !== raw.actionType) {
        renames.push({
          from: `/tableBtns/${index}/action`,
          to: `/tableBtns/${index}/actionType`,
          note: `tableBtns[] 同时给了 actionType 与 action 且不一致，规范键 actionType 优先，已删除 action（"${String(raw.action)}"）。`,
        })
      }
      // 复用 AN-07 的单源归一（它同时收敛 position→code 的既有语义）。
      return normalizeTableBtn(raw)
    })
    config = { ...config, tableBtns: buttons }
  }

  // ② toolbarBtns 别名（AN-24：与 tableBtns 同一份按钮语义，但兜底方向/字段集不同，
  //    故不复用 normalizeTableBtn —— 后者会把 position 落成默认左侧的 code）。
  if (config.toolbarBtns !== undefined) {
    config = {
      ...config,
      toolbarBtns: normalizeButtonArray(config.toolbarBtns, '/toolbarBtns', renames, true),
    }
  }

  // ③ operationColumn 对象里的行按钮别名（label→name）。false / 非对象原样保留。
  if (isPlainObject(config.operationColumn)) {
    const operationColumn = { ...config.operationColumn }
    if (operationColumn.btns !== undefined) {
      operationColumn.btns = normalizeButtonArray(
        operationColumn.btns,
        '/operationColumn/btns',
        renames,
        false,
      )
    }
    config = { ...config, operationColumn }
  }

  // ④ dialogs：罐头键展开 + formItems 简写展开 + configBtn 别名。
  if (config.dialogs !== undefined) {
    const dialogs = expandDialogs(config.dialogs, renames)
    if (isPlainObject(dialogs)) {
      const fieldsByProp = fieldsByPropOf(config)
      const nextDialogs: Record<string, unknown> = {}
      let changed = dialogs !== config.dialogs
      for (const [key, value] of Object.entries(dialogs)) {
        if (!isPlainObject(value)) {
          nextDialogs[key] = value
          continue
        }
        const dialog = { ...value }
        if (dialog.formItems !== undefined) {
          const expanded = expandDialogFormItems(dialog.formItems, key, fieldsByProp, renames)
          if (expanded !== dialog.formItems) {
            dialog.formItems = expanded
            changed = true
          }
        }
        if (dialog.configBtn !== undefined) {
          const normalized = normalizeButtonArray(
            dialog.configBtn,
            `/dialogs/${key}/configBtn`,
            renames,
            false,
          )
          if (normalized !== dialog.configBtn) {
            dialog.configBtn = normalized
            changed = true
          }
        }
        nextDialogs[key] = dialog
      }
      config = { ...config, dialogs: changed ? nextDialogs : dialogs }
    } else {
      config = { ...config, dialogs }
    }
  }

  // ⑤ 顶层 rowkey → tableOptions.rowkey（与 generate_crud 前门 / AN-06③ 同优先级）。
  if (isNonEmptyString(config.rowkey)) {
    const rowkey = config.rowkey
    const rest = { ...config }
    delete rest.rowkey
    const tableOptions = isPlainObject(rest.tableOptions) ? { ...rest.tableOptions } : {}
    if (tableOptions.rowkey !== rowkey && isNonEmptyString(tableOptions.rowkey)) {
      renames.push({
        from: '/rowkey',
        to: '/tableOptions/rowkey',
        note: `顶层 rowkey 覆盖了 tableOptions.rowkey（"${tableOptions.rowkey}" → "${rowkey}"）：弹窗 PUT / 删除 URL 与表格必须用同一个键（AN-06③）。`,
      })
    } else {
      renames.push({
        from: '/rowkey',
        to: '/tableOptions/rowkey',
        note: '顶层 rowkey 已并入 tableOptions（结构化配置的唯一家，同 generate_crud 前门）。',
      })
    }
    tableOptions.rowkey = rowkey
    rest.tableOptions = tableOptions
    config = rest
  }

  return { config: config as T, renames }
}
