import type { ComposeCrudInput, SurfaceField } from '../compose-crud-config.js'
import { composeCrudConfig } from '../compose-crud-config.js'
import type { StructuredCrudConfigInput } from '../structured-config.schema.js'
import { dialogTitleFor } from './registry.js'

/**
 * `surfaces` 意图表 → `StructuredCrudConfig`（确定性逆函数）。
 *
 * ## 为什么单独成文件
 *
 * 这段映射此前**内联**在 `scene/emit.ts` 的 `emitCrudScene` 里，于是「回读 → 改 → 再生成」
 * 闭环只能靠发射整页代码来验证：`configToSurfaces` 有出处（`page-source.ts`），逆函数却
 * 没有名字、没有被任何测试直接调用。R6（`config → surfaces → config` 幂等率）要求
 * `toConfig(configToSurfaces(cfg).intent)` 是一个**可测的纯函数** —— 抽出来之后：
 *   - emit 与度量共用同一份实现（两份实现只会让漂移在某次改文案时才暴露）；
 *   - 度量可以在不起发射器、不编译代码的前提下逐条语料跑（`check:provenance`）。
 *
 * ## 边界
 *
 * 只负责**含表格**的子集：`composeCrudConfig` 的产出口径就是
 * `generateFromConfig` 能发射的形态（`es-crud-page` / `<es-table><es-form/></es-table>`）。
 * 不含表格的意图由 `fragment-generator` 的独立发射器处理，不经过这里 —— 调用方用
 * `hasTable` 判定，而不是「调了再说」。
 *
 * 与 `CrudIntent` 的关系：本接口是**结构子集**（emit 的意图表多出的字段它也用得上）。
 * 刻意不 import `CrudIntent` —— 那会让 `emit.ts → surfaces-to-config.ts → emit.ts`
 * 形成类型环。
 */

/** 场景意图表里的一条弹窗：罐头键（add/edit/view）或全参对象。 */
export type SurfacesDialogEntry =
  | string
  | {
      key: string
      title?: string
      width?: string | number
      fullscreen?: boolean
      formItems?: SurfaceField[]
    }

/**
 * 需要的意图键 = `ComposeCrudInput` 去掉三面平铺键与 `dialogs`，再加上 `surfaces`
 * 与顶层 `rowkey`。`configToSurfaces` 产出的 `intent` 形状与此一致。
 */
export interface SurfacesIntentInput extends Omit<ComposeCrudInput, 'query' | 'table' | 'form' | 'dialogs'> {
  surfaces: {
    query?: SurfaceField[]
    table?: SurfaceField[]
    form?: SurfaceField[]
    dialog?: SurfacesDialogEntry[]
  }
  /** 主键：同时进入组合配置与独立弹窗块（AN-06③）。 */
  rowkey?: string
}

export interface SurfacesToConfigResult {
  /** 组合出的配置。`hasTable` 为假时**未定义**（该子集不走组合层）。 */
  config?: StructuredCrudConfigInput
  warnings: string[]
  /** 重复的弹窗 key —— 必须由调用方升级为告警，不能静默覆盖。 */
  duplicateDialogKeys: string[]
  /** 是否有表格面。false ⟹ 应由片段发射器处理，本函数不产出 config。 */
  hasTable: boolean
}

/**
 * AN-06③：顶层 `rowkey` 必须并入 `tableOptions`。
 *
 * 生成器读的是 `tableOptions.rowkey`；只把它交给独立 dialog 块会让页面删除/编辑按
 * 默认 `id` 拼 URL。冲突时取**顶层**（它是本工具的显式参数）并告警，不静默二选一。
 */
function withRowkey(
  tableOptions: Record<string, unknown> | undefined,
  rowkey: string | undefined,
): { tableOptions: Record<string, unknown> | undefined; warning?: string } {
  if (!rowkey) return { tableOptions }
  const prev = tableOptions?.rowkey
  return {
    tableOptions: { ...(tableOptions ?? {}), rowkey },
    warning:
      prev !== undefined && prev !== rowkey
        ? `rowkey 冲突：tableOptions.rowkey="${String(prev)}" vs 顶层 rowkey="${rowkey}" —— 取顶层（弹窗 PUT / 删除 URL 与独立 dialog 块必须用同一个键）。`
        : undefined,
  }
}

export function surfacesToConfig(intent: SurfacesIntentInput): SurfacesToConfigResult {
  const s = intent.surfaces ?? {}
  const query: SurfaceField[] = Array.isArray(s.query) ? s.query : []
  const table: SurfaceField[] = Array.isArray(s.table) ? s.table : []
  const form: SurfaceField[] = Array.isArray(s.form) ? s.form : []
  const dialogEntries: SurfacesDialogEntry[] = Array.isArray(s.dialog) ? s.dialog : []
  const hasTable = table.length > 0
  const hasForm = form.length > 0
  const hasDialog = dialogEntries.length > 0

  if (!hasTable) {
    return { warnings: [], duplicateDialogKeys: [], hasTable: false }
  }

  // 有表单时弹窗共用表单体，否则退回表格面（旧行为逐字保留）。
  const dialogBody = hasForm ? form : table
  const duplicateDialogKeys: string[] = []
  const dialogs = hasDialog
    ? (() => {
        const seen = new Set<string>()
        const entries: Array<[string, any]> = []
        for (const d of dialogEntries) {
          const key = typeof d === 'string' ? d : String(d.key)
          if (seen.has(key)) duplicateDialogKeys.push(key)
          seen.add(key)
          // 罐头键：字符串 → 默认标题 + 共用弹窗体。
          if (typeof d === 'string') {
            entries.push([key, { title: dialogTitleFor(key), formItems: dialogBody }])
            continue
          }
          // 全参对象：自定义 id/标题/宽度/全屏/逐弹窗字段表（AI-21④）。
          // R6：`configToSurfaces` 投影的 dialog 键集是 `DialogBlockOptionsSchema`（比这里的
          // CrudDialogEntry 宽），逆变换必须把它们**原样带回** —— 只挑 title/width/fullscreen/
          // formItems 会让 `destroyOnClose` / `appendTo` / `hiddenFullBtn` 在读回→重生成时静默消失。
          const { key: _key, ...rest } = d as { key: string } & Record<string, unknown>
          entries.push([
            key,
            {
              ...rest,
              title: rest.title !== undefined ? rest.title : dialogTitleFor(key),
              formItems: rest.formItems !== undefined ? rest.formItems : dialogBody,
            },
          ])
        }
        return Object.fromEntries(entries)
      })()
    : undefined

  const rowkeyOpt = withRowkey(intent.tableOptions as Record<string, unknown> | undefined, intent.rowkey)
  const { config, warnings } = composeCrudConfig({
    name: intent.name,
    apiUrl: intent.apiUrl,
    target: intent.target,
    mode: intent.mode,
    typescript: intent.typescript,
    i18n: intent.i18n,
    query,
    table,
    form,
    actions: intent.actions,
    permissions: intent.permissions,
    pagination: intent.pagination,
    tableOptions: rowkeyOpt.tableOptions,
    formLayout: intent.formLayout,
    operationColumn: intent.operationColumn,
    tableBtns: intent.tableBtns,
    toolbarBtns: intent.toolbarBtns,
    dialogs: dialogs as any,
    expandConfig: intent.expandConfig,
    treeConfig: intent.treeConfig,
    mergeConfig: intent.mergeConfig,
  })
  if (rowkeyOpt.warning) warnings.unshift(rowkeyOpt.warning)

  return { config, warnings, duplicateDialogKeys, hasTable }
}
