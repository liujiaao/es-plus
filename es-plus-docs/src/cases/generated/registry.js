/**
 * 自动生成：scripts/sync-cases.mjs —— **禁止手改**（`npm run cases:check` 会红）。
 *
 * 单源：docs/cases/ai-cases.json（manifest）。画廊按它列清单；通用宿主 AiCaseHost 按 id
 * 取 `{ schema, meta, mock }`。定制宿主（旗舰页 / 采购审批 hero 页）的条目只带展示
 * 元数据与路由 —— 它们的产物由各自的叙事页 import。
 */
import employeeRoster from './employee-roster.json'
import employeeRosterMeta from './employee-roster.meta.json'
import * as employeeRosterMock from './employee-roster.mock.js'
import employeeRosterConfig from './employee-roster.config.json'
import engineLab from './engine-lab.json'
import engineLabMeta from './engine-lab.meta.json'
import * as engineLabMock from './engine-lab.mock.js'
import engineLabConfig from './engine-lab.config.json'
import expandRow from './expand-row.json'
import expandRowMeta from './expand-row.meta.json'
import * as expandRowMock from './expand-row.mock.js'
import expandRowConfig from './expand-row.config.json'
import groupedReport from './grouped-report.json'
import groupedReportMeta from './grouped-report.meta.json'
import * as groupedReportMock from './grouped-report.mock.js'
import groupedReportConfig from './grouped-report.config.json'
import legacyErpApi from './legacy-erp-api.json'
import legacyErpApiMeta from './legacy-erp-api.meta.json'
import * as legacyErpApiMock from './legacy-erp-api.mock.js'
import legacyErpApiConfig from './legacy-erp-api.config.json'
import orderBatch from './order-batch.json'
import orderBatchMeta from './order-batch.meta.json'
import * as orderBatchMock from './order-batch.mock.js'
import orderBatchConfig from './order-batch.config.json'
import orgTreeTable from './org-tree-table.json'
import orgTreeTableMeta from './org-tree-table.meta.json'
import * as orgTreeTableMock from './org-tree-table.mock.js'
import orgTreeTableConfig from './org-tree-table.config.json'

export const AI_CASES = {
  "employee-roster": {
    id: "employee-roster",
    title: "员工花名册",
    claim: "execute",
    replay: "frozen-config",
    clusters: ["C1","C3","C6","C10"],
    tokens: ["formtype","validation","cellDataOptions","columnStyle","dialogs"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: employeeRoster,
    meta: employeeRosterMeta,
    mock: employeeRosterMock,
    config: employeeRosterConfig,
  },
  "engine-lab": {
    id: "engine-lab",
    title: "引擎实验室：5000 行虚拟滚动 + 行内编辑",
    claim: "compile",
    replay: "frozen-config",
    clusters: ["C8"],
    tokens: ["virtualScroll","inlineEdit","vxeFirstClass"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: engineLab,
    meta: engineLabMeta,
    mock: engineLabMock,
    config: engineLabConfig,
  },
  "expand-row": {
    id: "expand-row",
    title: "展开行明细（纯 JSON 字段表）",
    claim: "execute",
    replay: "frozen-config",
    clusters: ["C8"],
    tokens: ["expandConfig"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: expandRow,
    meta: expandRowMeta,
    mock: expandRowMock,
    config: expandRowConfig,
  },
  "flagship-approval": {
    id: "flagship-approval",
    title: "合同审批工作台",
    claim: "execute",
    replay: "handcrafted",
    clusters: ["C2","C4","C5","C6"],
    tokens: [],
    host: {"kind":"custom","route":"/flagship-approval"},
  },
  "grouped-report": {
    id: "grouped-report",
    title: "分组报表（合并单元格）",
    claim: "execute",
    replay: "frozen-config",
    clusters: ["C8"],
    tokens: ["mergeConfig"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: groupedReport,
    meta: groupedReportMeta,
    mock: groupedReportMock,
    config: groupedReportConfig,
  },
  "legacy-erp-api": {
    id: "legacy-erp-api",
    title: "异构后端接管",
    claim: "execute",
    replay: "frozen-config",
    clusters: ["C9"],
    tokens: ["apiParams","configTableOut"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: legacyErpApi,
    meta: legacyErpApiMeta,
    mock: legacyErpApiMock,
    config: legacyErpApiConfig,
  },
  "order-batch": {
    id: "order-batch",
    title: "订单批量处理",
    claim: "execute",
    replay: "frozen-config",
    clusters: ["C5","C7","C10"],
    tokens: ["tableBtns","configTableOut","formLayout","defaultSort"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: orderBatch,
    meta: orderBatchMeta,
    mock: orderBatchMock,
    config: orderBatchConfig,
  },
  "org-tree-table": {
    id: "org-tree-table",
    title: "组织架构树表（零构树）",
    claim: "execute",
    replay: "frozen-config",
    clusters: ["C8"],
    tokens: ["treeConfig"],
    host: {"kind":"generic","route":"/ai-gallery"},
    schema: orgTreeTable,
    meta: orgTreeTableMeta,
    mock: orgTreeTableMock,
    config: orgTreeTableConfig,
  },
  "purchase-approval": {
    id: "purchase-approval",
    title: "采购申请审批页",
    claim: "execute",
    replay: "unavailable",
    clusters: ["C2","C3","C4","C5"],
    tokens: ["formtype","validation","reactions","fieldVisibility","permissions","operationColumn","cellDataOptions","toolbarBtns","dialogs"],
    host: {"kind":"custom","route":"/ai-generated"},
  },
}

export const AI_CASE_LIST = Object.values(AI_CASES)

/** 能力簇编号 → 中文名（画廊分组标题；来自 manifest 的 clusters 表）。 */
export const AI_CLUSTERS = {
  "C1": "字段三面扇出",
  "C2": "声明式联动",
  "C3": "码值语义",
  "C4": "权限端到端",
  "C5": "动作编排",
  "C6": "弹窗体系",
  "C7": "跨页选择",
  "C8": "引擎切换",
  "C9": "后端适配",
  "C10": "布局与 i18n",
  "C11": "逃生舱",
  "C12": "片段与宿主"
}
