/**
 * vxe-only 表格键的运行时守门（P0-1）。
 *
 * ## 为什么需要它
 *
 * 下面这些 `TableOptions` 键只有 `engine: 'vxe'` 消费；默认 / 虚拟引擎会把它们从
 * `TABLE_INTERNAL_KEYS` 里剥掉（不透传给 el-table / a-table），于是**配了等于没配**：
 * 页面正常、单元格点不动、控制台零输出。生成器（`generateFromConfig`）早已在生成阶段
 * 告警，但手写 `<es-table :options>` 不经过生成器 —— 这里补上运行时那一半。
 *
 * ## 清单的真源
 *
 * 能力矩阵（`@es-plus/shared` 的 `capability.ts`）里 `requires: { engine: 'vxe' }` 的条目。
 * core 不能依赖 shared，故在此保留一份同集合的清单，由 `check:capability-parity` 的 D2
 * 判据断言两者**集合全等**（任何一侧增删不同步即红）。
 *
 * 刻意不在清单里的：
 *   - `exportConfig`：默认 / 虚拟引擎用它的 `filename` / `type:'csv'` 驱动 core 的 CSV 兜底，
 *     不是「被忽略」；
 *   - `treeConfig` / `expandConfig`：默认引擎也消费其中的跨端子集（childrenField / expandAll）；
 *   - `footerMethod` / `proxyConfig` / `vxeConfig` / `vxeOn`：函数或任意逃生舱，不在 AI 契约内。
 */

/** 只有 `engine: 'vxe'` 才消费的 `TableOptions` 键（与能力矩阵 `requires.engine === 'vxe'` 全等）。 */
export const VXE_ONLY_TABLE_KEYS = [
  'editConfig',
  'showFooter',
  'footerData',
  'toolbarConfig',
  'columnConfig',
  'keepSource',
  'keyboardConfig',
  'mouseConfig',
  'validConfig',
  'seqConfig',
  'printConfig',
] as const

export type VxeOnlyTableKey = (typeof VXE_ONLY_TABLE_KEYS)[number]

/** 「设置了」：非 undefined、非显式 false（`showFooter: false` 不该触发告警）。 */
function isSetValue(value: unknown): boolean {
  return value !== undefined && value !== false && value !== null
}

/**
 * 当前引擎不是 vxe 时，返回 `options` 里设置了的 vxe-only 键（按清单顺序）。
 * 引擎是 vxe 或一个都没设 → 空数组。纯函数。
 */
export function findVxeOnlyKeysOutsideVxe(
  options: Record<string, unknown> | null | undefined
): VxeOnlyTableKey[] {
  if (!options || options.engine === 'vxe') return []
  return VXE_ONLY_TABLE_KEYS.filter((key) => isSetValue(options[key]))
}

/** 已告警过的键组合（同一页面多张表、或同一张表反复挂载时不刷屏）。 */
const warnedVxeOnlySignatures = new Set<string>()

/**
 * 运行时一次性告警：配了 vxe-only 键但引擎不是 vxe。
 *
 * @param options  组件解析后的 `TableOptions`
 * @param renderer 告警前缀里的渲染端名（`vue3` / `vue2` / `antdv`），便于定位
 * @returns        本次命中的键（测试与调用方可据此断言；未告警也照样返回）
 */
export function warnVxeOnlyKeysOutsideVxe(
  options: Record<string, unknown> | null | undefined,
  renderer: string
): VxeOnlyTableKey[] {
  const keys = findVxeOnlyKeysOutsideVxe(options)
  if (keys.length === 0) return keys
  const engine = (options?.engine as string | undefined) || 'default'
  const signature = `${renderer}|${engine}|${keys.join(',')}`
  if (!warnedVxeOnlySignatures.has(signature)) {
    warnedVxeOnlySignatures.add(signature)
    console.warn(
      `[es-plus/${renderer}] options.${keys.join(' / options.')} 只在 engine: 'vxe' 下生效 —— ` +
        `当前引擎为 '${engine}'，这些配置会被忽略（行内编辑、合计行、工具栏、键盘导航等都不会出现）。` +
        `请在 options 里加上 engine: 'vxe'（需安装 vxe-table）。`
    )
  }
  return keys
}

/** 仅供测试：清空去重记录。 */
export function __resetVxeOnlyWarnings(): void {
  warnedVxeOnlySignatures.clear()
}
