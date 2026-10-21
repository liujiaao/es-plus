#!/usr/bin/env node
/**
 * 弹窗场景（`scene='dialog'`）的**合约透镜**（AN-16）。
 *
 * ## 为什么不新写一套记分卡
 *
 * 片段记分卡（`fragment-scorers.mjs`）自 AI-47..AI-52 起已经带 dialog 分支：
 * `apiUrl` / `noApiUrl` / `rowkey` / `mode` / `composableName` / `defaultTitle` /
 * `dialogMaskNonClosing` / `options.<key>` 都是**按 gold 声明**动态启用的维度。
 * 再写一份只是把同一批键换个文件实现 —— 两份实现必然漂移，而漂移的那一份
 * 仍然会给出「通过」。所以本模块是那套维度的**弹窗合约视图**（单一真源的再导出 +
 * dialog 特有的事实），不复制判定逻辑。
 *
 * ## 它补的是什么（记分卡看不到的三件事）
 *
 * 1. **两形态的合法键集**：`mode='component'` 下的 `cacheKey` 没有消费者
 *    （`useDialog()` hook 的实例缓存键；声明式 `<es-dialog>` 不走那条通道），
 *    生成器会**告警并丢弃**。gold 若声明它，就得到一个产物里根本不存在的维度 ——
 *    模型写不写都测不到（幻影度量）。`dialogGoldProblems()` 把这类标注错误报出来。
 * 2. **选项键白名单**：`options` 只收 `fragment-generator.ts` 里
 *    `DialogBlockOptions` 那 13 个键（`scripts/check-fragment-contract.mjs` 已把它
 *    与 MCP 的 zod 副本、core `DialogOptions` 对账）。gold 里拼错一个键
 *    （`closeOnclickModal`）不会让生成器报错，只会静默变成一条无人消费的维度；
 *    本模块的 `DIALOG_OPTION_KEYS` 供 meta-eval 咬住拼写。
 * 3. **提交合约是派生的，不是声明的**：POST/PUT 由**运行时传进来的 title**决定
 *    （`'新增'` → POST，其余 → PUT），view 只读由 `title === '查看'` 决定。
 *    这三条在配置里没有独立字段，因此**不能**做成 config 维度（会变成恒真）；
 *    它们的见证只能在运行时（Tier 1/2 mount），本模块只把「派生规则」集中定义，
 *    让语料检查与运行时见证引用同一份常量。
 *
 * ## 与运行时见证的边界
 *
 * `READ_ONLY_TITLE` / `NEW_TITLE` 是**生成器源码里的字面量**（composable 与 component
 * 两支逐字一致）。改那两个字面量必须同时改这里 —— `dialog-scorers.test.mjs` 会读
 * `fragment-generator.ts` 的源码断言两者一致，否则「只读」会在运行时悄悄退化为可编辑。
 */

import {
  scoreFragment,
  fragmentScorableDims,
  isValidFragmentPinnedDim,
} from './fragment-scorers.mjs'
import { DIALOG_MODES } from './scenes.mjs'

/** 生成器用这个标题推导「只读查看」：只出一个「关闭」按钮，不发请求。 */
export const READ_ONLY_TITLE = '查看'
/** 生成器用这个标题推导 POST（新增）；其余标题一律 PUT。 */
export const NEW_TITLE = '新增'

/**
 * `DialogBlockOptions`（`packages/shared/src/fragment-generator.ts`）的可声明键全集。
 * **冻结**：顺序与接口书写顺序一致，供 meta-eval 与源码逐键对账。
 */
export const DIALOG_OPTION_KEYS = Object.freeze([
  'width',
  'maxHeight',
  'isDraggable',
  'fullscreen',
  'isHiddenFooter',
  'showClose',
  'destroyOnClose',
  'modal',
  'closeOnClickModal',
  'closeOnPressEscape',
  'hiddenFullBtn',
  'appendTo',
  'cacheKey',
])

/** 两种产物形态（与 `scenes.mjs` 的 dialog 轴同源）。 */
export const DIALOG_BLOCK_MODES = DIALOG_MODES

/** 该配置的产物形态；缺省 `composable`（与工具 zod 的 `.default('composable')` 一致）。 */
export function dialogModeOf(cfg) {
  return cfg?.mode ?? 'composable'
}

/**
 * 从配置推导**提交合约**（运行时行为，不是独立配置字段）。
 *
 * - `kind:'callback'` —— 无 `apiUrl`：只校验并 `onSuccess(formData)`，不发请求；
 * - `kind:'http'` —— 有 `apiUrl`：open('新增') 时 POST `apiUrl`，其余标题 PUT
 *   `` `${apiUrl}/${row[rowkey]}` ``；`rowkey` 缺省 `'id'`（生成器同口径）。
 */
export function dialogSubmitContract(cfg) {
  const apiUrl = cfg?.apiUrl
  const rowkey = cfg?.rowkey || 'id'
  if (!apiUrl) {
    return { kind: 'callback', methodNew: null, methodEdit: null, url: null, rowkey: null }
  }
  return {
    kind: 'http',
    methodNew: 'POST',
    methodEdit: 'PUT',
    url: apiUrl,
    rowkey,
    /** 编辑分支的 URL —— 与生成器模板串逐字同口径。 */
    editUrlFor(row) {
      const key = row?.[rowkey]
      return `${apiUrl}/${key === undefined || key === null ? '' : key}`
    },
  }
}

/** 运行时标题 → 按钮形态（与两支产物共用同一启发式）。 */
export function dialogShapeForTitle(title) {
  return title === READ_ONLY_TITLE ? 'read-only' : 'editable'
}

/**
 * 语料标注体检：返回问题列表（空 = 健康）。
 *
 * 只检查**会让维度失去消费者**的标注错误 —— 不检查「NL 该说什么」（那是 meta-eval
 * 的 pinned/stated 断言管的事）。
 */
export function dialogGoldProblems(gold) {
  const problems = []
  if (!Array.isArray(gold?.fields) || gold.fields.length === 0) {
    problems.push('fields 为空：弹窗体没有可度量的字段')
  }
  const mode = dialogModeOf(gold)
  if (!DIALOG_BLOCK_MODES.includes(mode)) {
    problems.push(`mode='${mode}' 不在 ${DIALOG_BLOCK_MODES.join(' / ')} 内`)
  }
  const opts = gold?.options ?? {}
  for (const key of Object.keys(opts)) {
    if (!DIALOG_OPTION_KEYS.includes(key)) {
      problems.push(`options.${key} 不是 DialogBlockOptions 的键（生成器/工具都不会消费它）`)
    }
  }
  if (mode === 'component' && opts.cacheKey !== undefined) {
    problems.push(
      "mode='component' 声明了 options.cacheKey —— 该类产物没有实例缓存通道，" +
        '生成器告警并忽略；把它计分等于度量一个不存在的键'
    )
  }
  if (gold?.defaultTitle !== undefined && !(typeof gold.defaultTitle === 'string' && gold.defaultTitle.trim())) {
    problems.push('defaultTitle 必须是非空字符串（空串会生成 title = \'\' 的缺省值）')
  }
  if (gold?.composableName !== undefined) {
    if (!/^[A-Za-z_$][\w$]*$/.test(gold.composableName)) {
      problems.push(`composableName='${gold.composableName}' 不是合法标识符（生成器会照抄进 export function）`)
    }
    if (mode === 'component') {
      problems.push("mode='component' 不导出 composable，composableName 无消费者")
    }
  }
  return problems
}

/** 该 gold 下 dialog 场景启用的全部维度名（含动态 `options.*`）。 */
export function dialogScorableDims(gold) {
  return fragmentScorableDims('dialog', gold)
}

/** pinned/stated token 在该 gold 下是否合法（与片段 meta-eval 同一把尺子）。 */
export function isValidDialogDim(gold, token) {
  return isValidFragmentPinnedDim('dialog', gold, token)
}

/** dialog 场景打分（`gold`/`pred` 与片段同形；`mask` 见 fragment-scorers）。 */
export function scoreDialog(gold, pred, mask) {
  return scoreFragment('dialog', gold, pred, mask)
}
