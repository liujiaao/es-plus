import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Target = "vue3" | "vue2";

// File layout (relative to this file when built):
//   packages/mcp-server/build/resources/types.js  ← __dirname
//   packages/mcp-server/bundled/types.d.ts        ← shipped fallback
//   packages/vue3/src/types/index.ts              ← live vue3 source
//   packages/vue2/src/types/index.ts              ← live vue2 source
//
// Try the live source first (for dev / when the user has the monorepo checked
// out), fall back to the bundled .d.ts that ships with the npm package.
function loadTypesFromSource(target: Target): string {
  const sourcePath = target === "vue2"
    ? join(__dirname, "../../../../vue2/src/types/index.ts")
    : join(__dirname, "../../../../vue3/src/types/index.ts");
  const fallback = target === "vue2"
    ? join(__dirname, "../../bundled/types-vue2.d.ts")
    : join(__dirname, "../../bundled/types.d.ts");

  for (const p of [sourcePath, fallback]) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  // Last-resort fallback: a compact reference inline. Use vue3 shape — vue2
  // package re-exports the same shapes.
  return TYPES_FALLBACK_VUE3;
}

const TYPES_FALLBACK_VUE3 = `// @es-plus/vue3 TypeScript Type Definitions (bundled fallback)
// Run "npm run bundle-types" to update from source

import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'

export type FormType = 'Input' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'

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
  direction?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean | (() => boolean)
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
  tabHeight?: number | string
  virtual?: boolean       // vue3 only — silently ignored on vue2
  engine?: 'default' | 'virtual'
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
  render?: (h: RenderFunction, instance: unknown, components: Record<string, unknown>) => VNode
  configBtn?: BtnConfig[]
  isDraggable?: boolean
  [key: string]: unknown
}
`;

export function registerTypesResource(server: McpServer) {
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://types", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://types/vue3", target: "vue3", descSuffix: " — @es-plus/vue3" },
    { uri: "esplus://types/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 (Element UI variant; same shapes)" },
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
