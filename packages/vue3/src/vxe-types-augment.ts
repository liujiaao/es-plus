/**
 * vxe-table 逃生舱类型增强
 *
 * 此文件为 vxe-grid 逃生舱字段（vxeConfig / vxeColumn / vxeOn）提供完整的
 * VxeGridProps / VxeColumnProps 原生类型推断，无运行时开销。
 *
 * 使用方式（二选一）：
 *   1. 在项目入口 import '@es-plus/vue3/vxe-types-augment'
 *   2. 在 tsconfig.json 的 include 数组中添加此文件路径
 *
 * 注意：此文件依赖 vxe-table 包提供类型，仅在项目已安装 vxe-table 时生效。
 *
 * ── 一等公民 API（无需此文件即有类型） ──────────────────────────────────────
 * showFooter / footerMethod / footerData / editConfig / exportConfig /
 * toolbarConfig / columnConfig / keyboardConfig / mouseConfig /
 * clipboardConfig / validConfig 已在 @es-plus/core 中定义完整类型，
 * 直接在 TableOptions 中使用即可获得 IntelliSense。
 *
 * column.editRender / column.footerFormatter 同样已在 @es-plus/core 中定义。
 *
 * ── Excel xlsx 导出依赖 ───────────────────────────────────────────────────────
 * 若使用 exportConfig: { type: 'xlsx' }，需额外安装并注册 xlsx 插件：
 *   npm i @vxe-table/plugin-export-xlsx
 *
 *   // main.ts（在 app.use() 之前）
 *   import VXETable from 'vxe-table'
 *   import VxeTablePluginExportXLSX from '@vxe-table/plugin-export-xlsx'
 *   VXETable.use(VxeTablePluginExportXLSX)
 */
import type { VxeGridProps } from 'vxe-table'
import type { VxeColumnProps } from 'vxe-table'

declare module '@es-plus/core' {
  interface TableOptions {
    /**
     * vxe-grid 原生配置（逃生舱）
     * 在 engine:'vxe' 下生效，其他 adapter 安全忽略此字段。
     * 完整类型推断：所有 VxeGridProps 均可用（优先级高于一等公民字段）。
     *
     * 常用场景：
     * - treeConfig: { transform: true, rowField: 'id', parentField: 'parentId' }
     * - scrollY: { enabled: true, gt: 100 }  // 强制虚拟滚动
     * - menuConfig: { body: { options: [...] } }  // 右键菜单
     * - dragConfig: { row: true }  // 行拖拽排序
     * - filterConfig: { remote: true }  // 服务端过滤
     */
    vxeConfig?: Partial<Omit<VxeGridProps, 'data' | 'columns'>>
    /**
     * vxe 事件配置（替代 @event 的配置式写法）
     * 支持所有 vxe-table 事件名（kebab-case），如：
     * { 'edit-closed': ({ row }) => ..., 'filter-change': (data) => ... }
     */
    vxeOn?: Record<string, (...args: any[]) => any>
  }

  interface TableColumn {
    /**
     * vxe 列原生配置（逃生舱）
     * 深合并到 VxeColumnOption，可启用 filterRender/rules/treeNode 等原生特性。
     * 完整类型推断：所有 VxeColumnProps 均可用。
     *
     * 注意：editRender 已作为一等公民字段 column.editRender 提供，
     * 优先使用 column.editRender；vxeColumn.editRender 会覆盖它。
     */
    vxeColumn?: Partial<Omit<VxeColumnProps, 'field' | 'title'>>
  }
}

export {}
