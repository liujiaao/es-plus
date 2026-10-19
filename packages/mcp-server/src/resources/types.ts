import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  rendererTypesPath,
  bundledPath,
  readFirst,
  type Target,
} from "./source-locator.js";

// Try the live monorepo source first (dev / monorepo checkout), fall back to
// the bundled .d.ts that ships with the npm package, then a compact inline
// reference. Path resolution lives in source-locator.ts (pinned by
// source-locator.spec.ts) — vue2 gets its own bundled variant; vue3/antdv
// share types.d.ts.
function loadTypesFromSource(target: Target): string {
  const bundled = target === "vue2" ? "types-vue2.d.ts" : "types.d.ts";
  return (
    readFirst([rendererTypesPath(target), bundledPath(bundled)]) ??
    TYPES_FALLBACK_VUE3
  );
}

const TYPES_FALLBACK_VUE3 = `// @es-plus/vue3 TypeScript Type Definitions (bundled fallback)
// Run "npm run bundle-types" to update from source

import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'

export type FormType = 'Input' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'

export interface FieldHiddenCondition {
  /** Another field path in the same form model, e.g. "status" or "user.type". */
  field: string
  /** eq (default) | ne | in | nIn | empty | notEmpty | truthy | falsy */
  op?: 'eq' | 'ne' | 'in' | 'nIn' | 'empty' | 'notEmpty' | 'truthy' | 'falsy'
  /** RHS: scalar for eq/ne, array for in/nIn; ignored by empty/notEmpty/truthy/falsy. */
  value?: unknown
}

/**
 * A JSON expression node (JSONLogic-shaped) — only for predicates the plain
 * condition can't express (OR / ordering / nested NOT), e.g.
 * \`{ or: [ { '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] } ] }\`.
 * Ops: var == != > >= < <= in nin empty notEmpty truthy falsy and or not if.
 */
export interface FieldHiddenExprNode {
  var?: string
  [op: string]: unknown
}

export type FieldHiddenExpr = FieldHiddenExprNode | FieldHiddenExprNode[]

export interface FieldReactionFulfill {
  /** Literal option array for this field when the rule is active. NOT an expression. */
  dataOptions?: Array<{ label: string; value: unknown; disabled?: boolean; children?: unknown[] }>
  /** Expression node evaluating to a boolean: make this field required. */
  required?: FieldHiddenExprNode
  /** Expression node evaluating to a boolean: disable this field. */
  disabled?: FieldHiddenExprNode
  /** Expression node returning this field's new value, written back to the model. */
  value?: FieldHiddenExprNode
}

/**
 * Field-level linkage / computed rule (AI-07). PLAIN JSON DATA, never a JS
 * callback. dependencies = model paths that re-evaluate the rule (REQUIRED
 * when fulfill.value is present); when = optional gate expression; fulfill =
 * the values to apply. Applies to the query/add/edit forms, NOT the table column.
 */
export interface FieldReaction {
  dependencies?: string[]
  when?: FieldHiddenExprNode
  fulfill: FieldReactionFulfill
}

export interface FormItemOption {
  prop: string
  label: string
  formtype?: FormType
  span?: number
  attrs?: Record<string, unknown>
  on?: Record<string, unknown>
  dataOptions?: Array<{ label: string; value: unknown }>
  apiParams?: ApiParams
  isInitRun?: boolean
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  width?: number | string
  /**
   * Conditional visibility: the field is HIDDEN while the condition holds.
   * PLAIN JSON DATA — a single condition, a single JSON expression, or an
   * array (AND); never a JS string. Applies to the query/add/edit forms,
   * NOT the table column.
   */
  isHidden?: FieldHiddenCondition | FieldHiddenCondition[] | FieldHiddenExpr
  /**
   * Field linkage / computed (AI-07): an array of declarative rules — this
   * field's options / required / disabled / own value depend on other fields.
   * PLAIN JSON DATA, never a callback; not for the table column.
   */
  reactions?: FieldReaction[]
  [key: string]: unknown
}

export interface ApiParams {
  url: string
  method?: string
  headers?: Record<string, string>
  model?: Record<string, unknown>
  options?: Record<string, unknown>
}

export interface BtnConfig {
  name: string
  key?: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'large' | 'default' | 'small'
  icon?: string
  /** Button position (recommended, self-documenting): 'left' | 'right' */
  position?: 'left' | 'right'
  /** @deprecated Use position instead. 1=left, 2=right */
  code?: 1 | 2
  direction?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean | (() => boolean)
  permissionValue?: string
  triggerEvent?: boolean
  click?: (model: Record<string, unknown>, formRef: unknown, httpRequestInstance?: unknown) => void
  [key: string]: unknown
}

export interface TableColumn {
  prop?: string
  key?: string
  label?: string
  labelKey?: string
  type?: 'selection' | 'index' | 'expand'
  width?: number | string
  minWidth?: number | string
  align?: string
  fixed?: boolean | 'left' | 'right'
  sortable?: boolean
  render?: (h: RenderFunction, ctx: { row: Record<string, unknown>; value: unknown; index: number }) => VNode | string
  scopedSlots?: { customRender?: string }
  groups?: TableColumn[]
  ellipsis?: boolean
  hidCol?: boolean
  formatter?: (row: Record<string, unknown>, column: TableColumn, cellValue: unknown, index: number) => string
  btns?: Array<{ name: string; type?: string; clickEvent?: (row: Record<string, unknown>) => void }>
  [key: string]: unknown
}

export interface TableOptions {
  multiSelect?: boolean
  border?: boolean
  stripe?: boolean
  headerCellStyle?: Record<string, unknown>
  highlightCurrentRow?: boolean
  isInitRun?: boolean
  apiParams?: ApiParams
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  configTableOut?: Record<string, string>
  rowkey?: string
  heightType?: 'auto' | 'height' | 'maxHeight'
  height?: number | string
  virtual?: boolean       // vue3 → el-table-v2; antdv → <a-table virtual>; vue2 → ignored (warns)
  engine?: 'default' | 'virtual' | 'vxe'  // 'vxe' works on all three targets
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
  rowClassName?: string | ((params: { row: Record<string, unknown>; rowIndex: number }) => string)
  [key: string]: unknown
}

export interface PaginationConfig {
  pageSize?: number
  current?: number
  total?: number
  pageSizes?: number[]
}

export interface DialogOptions {
  title?: string
  width?: string | number
  visible?: boolean
  render?: (h: RenderFunction, instance: unknown, components: Record<string, unknown>) => VNode
  renderHeader?: (h: RenderFunction, instance: unknown) => VNode
  renderFooter?: (h: RenderFunction, instance: unknown) => VNode
  configBtn?: BtnConfig[]
  onClosed?: () => void
  isDraggable?: boolean
  hiddenFullBtn?: boolean
  isHiddenFooter?: boolean
  maxHeight?: string | number
  appendTo?: string | HTMLElement
  fullscreen?: boolean
  loading?: boolean
  showClose?: boolean
  destroyOnClose?: boolean
  modal?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  beforeClose?: (done: () => void) => void
  cacheKey?: string
  alignCenter?: boolean
  top?: string
  modalClass?: string
  [key: string]: unknown
}
`;

export function registerTypesResource(server: McpServer) {
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://types", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://types/vue3", target: "vue3", descSuffix: " — @es-plus/vue3" },
    { uri: "esplus://types/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 (Element UI variant; same shapes)" },
    { uri: "esplus://types/antdv", target: "antdv", descSuffix: " — @es-plus/adapter-antdv (Ant Design Vue variant; same shapes)" },
  ];

  for (const { uri, target, descSuffix } of targets) {
    server.resource(
      uri === "esplus://types" ? "types" : `types-${target}`,
      uri,
      {
        description: `Complete TypeScript type definitions${descSuffix} — read from packages/${target}/src when available, falls back to bundled .d.ts`,
        mimeType: "text/plain",
      },
      async () => ({
        contents: [
          { uri, mimeType: "text/plain", text: loadTypesFromSource(target) },
        ],
      })
    );
  }
}
