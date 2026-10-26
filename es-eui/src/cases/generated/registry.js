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
  "flagship-approval": {
    id: "flagship-approval",
    title: "合同审批工作台",
    claim: "execute",
    replay: "handcrafted",
    clusters: ["C2","C4","C5","C6"],
    tokens: [],
    host: {"kind":"custom","route":"/flagship-approval"},
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
