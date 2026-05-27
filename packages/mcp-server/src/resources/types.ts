import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadTypesFromSource(): string {
  const paths = [
    join(__dirname, "../../../../es-plus/src/types/index.ts"),
    join(__dirname, "../../bundled/types.d.ts"),
  ];

  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  return TYPES_FALLBACK;
}

const TYPES_FALLBACK = `// es-plus-ui TypeScript Type Definitions (bundled fallback)
// Run "npm run bundle-types" to update from source

import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'

export type FormType = 'Input' | 'Select' | 'datePicker' | 'timePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'

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
  virtual?: boolean
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
  server.resource(
    "types",
    "esplus://types",
    {
      description:
        "Complete TypeScript type definitions for all es-plus-ui components (read from source when available)",
      mimeType: "text/plain",
    },
    async () => {
      const content = loadTypesFromSource();
      return {
        contents: [
          {
            uri: "esplus://types",
            mimeType: "text/plain",
            text: content,
          },
        ],
      };
    }
  );
}
