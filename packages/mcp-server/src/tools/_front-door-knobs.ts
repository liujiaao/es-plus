import { z } from "zod";

/**
 * 前门（`generate_crud`）的「旋钮」显式形状 —— AN-21。
 *
 * 为什么不能直接用 shared 的 Zod 对象：shared 是 zod 4，mcp-server 是 zod 3，
 * 两代 ZodObject 不能跨版本复用。这里是 shared 权威 schema 的 **zod 3 镜像**：
 * `scripts/check-tool-shapes.mjs` 会把每一颗旋钮的键树与 shared 运行时 schema 对账，
 * 少一个键 / 多一个键都会红。
 *
 * 与 `generate-from-config.ts` 里同名形状的**唯一有意差异**：这里**不写 `.default()`**。
 * 前门把旋钮原样转发给 `composeCrudConfig`，若 schema 注入默认值（border/stripe/rowkey…），
 * `withRowkey` 会把「默认的 id」误判成用户显式配置的 rowkey 并产生假冲突告警；
 * 也会让经 MCP 的真实调用与直接驱动 handler 的 eval 看到不同的入参。
 *
 * 全部 `.strict()`：未知旋钮必须在工具层报错，而不是被 Zod 静默 strip（AN-21 验收）。
 * 这是有意的**比 shared 更严**：shared 用默认 strip 是为了兼容历史配置，
 * 而 AI 入口是受约束解码，拼错键应当立刻失败。
 */

const rowBtnSchema = z
  .object({
    name: z.string().min(1),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    dialogKey: z.string().optional(),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
  })
  .strict();

/** 表格选项（shared `StructuredCrudConfigSchema.shape.tableOptions` 的键集，无默认值）。 */
export const tableOptionsSchema = z
  .object({
    border: z.boolean().optional(),
    stripe: z.boolean().optional(),
    rowkey: z.string().optional(),
    heightType: z
      .enum(["height", "auto", "maxHeight"])
      .optional()
      .describe(
        "'height' = fixed height (value from `height`, or `tabHeight` if set); 'maxHeight' = capped at `tabHeight`; 'auto' = no container height constraint. Default 'auto'."
      ),
    tabHeight: z
      .union([z.number(), z.string()])
      .optional()
      .describe("Height consumed for EVERY heightType: under 'height' it overrides `height`; under 'maxHeight' it is the cap."),
    height: z
      .union([z.number(), z.string()])
      .optional()
      .describe("Container height used ONLY when heightType is 'height' (ignored for 'auto'/'maxHeight' — use tabHeight there)."),
    multiSelect: z.boolean().optional(),
    highlightCurrentRow: z.boolean().optional(),
    headerCellStyle: z.record(z.string()).optional(),
    virtual: z
      .boolean()
      .optional()
      .describe("Enable virtual scrolling (vue3 el-table-v2; antdv a-table; vue2 degrades with a warning — use engine:'vxe' there)."),
    engine: z.enum(["default", "virtual", "vxe"]).optional(),
    rowHeight: z.number().optional(),
    estimatedRowHeight: z.number().optional(),
    overscanCount: z.number().int().optional(),
    rowClassName: z.string().optional(),
    size: z.enum(["large", "default", "small"]).optional(),
    showHeader: z.boolean().optional(),
    emptyText: z.string().optional(),
    snIndex: z.boolean().optional(),
    leftText: z.string().optional(),
    cachePageSelection: z.boolean().optional(),
    refetchKeepPage: z.boolean().optional(),
    localPagination: z.boolean().optional(),
    // 与 shared 的 StructuredCrudConfigSchema 同形（zod3 vs zod4 不能共享对象）：
    // union 而不是嵌套 .object()，两种形态都能过前门，不会把改键形态静默剥掉。
    sortParam: z
      .union([
        z.boolean(),
        z
          .object({ field: z.string().optional(), order: z.string().optional() })
          .strict(),
      ])
      .optional(),
    defaultSort: z
      .object({ prop: z.string(), order: z.enum(["ascending", "descending"]) })
      .strict()
      .optional(),
    editConfig: z
      .object({
        trigger: z.enum(["click", "dblclick", "manual"]).optional(),
        mode: z.enum(["cell", "row"]).optional(),
        showStatus: z.boolean().optional(),
        showUpdateStatus: z.boolean().optional(),
        showInsertStatus: z.boolean().optional(),
        autoClear: z.boolean().optional(),
        enabled: z.boolean().optional(),
      })
      .strict()
      .optional()
      .describe("vxe inline editing (requires engine:'vxe' and a column-level `editRender`)."),
    configTableOut: z
      .object({
        total: z.string().optional(),
        tableData: z.string().optional(),
        pageSize: z.string().optional(),
        current: z.string().optional(),
      })
      .strict()
      .optional()
      .describe("Map the LIST response onto table semantics when the backend shape differs from { rows, records, pageSize, pageNo }."),
    treeConfig: z
      .object({
        transform: z.boolean().optional(),
        rowField: z.string().optional(),
        parentField: z.string().optional(),
        childrenField: z.string().optional(),
        children: z.string().optional(),
        mapChildren: z.string().optional(),
        expandAll: z.boolean().optional(),
        lazy: z.boolean().optional(),
      })
      .strict()
      .optional()
      .describe("vxe-only rich tree config (distinct from the top-level cross-renderer `treeConfig`)."),
    expandConfig: z
      .object({
        expandAll: z.boolean().optional(),
        accordion: z.boolean().optional(),
        lazy: z.boolean().optional(),
      })
      .strict()
      .optional()
      .describe("vxe-only row-expand switch (distinct from the top-level declarative `expandConfig`)."),
  })
  .strict();

/** 查询表单布局 —— 只有 labelWidth / minFoldRows；列数由字段级 querySpan/formSpan 决定。 */
export const formLayoutSchema = z
  .object({
    labelWidth: z.union([z.string(), z.number()]).optional(),
    minFoldRows: z.number().int().optional(),
  })
  .strict();

/** 操作列（`false` = 隐藏）。 */
export const operationColumnSchema = z.union([
  z.literal(false),
  z
    .object({
      label: z.string().optional(),
      width: z.union([z.number(), z.string()]).optional(),
      fixed: z.union([z.boolean(), z.literal("left"), z.literal("right")]).optional(),
      btns: z.array(rowBtnSchema).min(1),
    })
    .strict(),
]);

/** 声明式行展开内容（只读字段表；与 tableOptions.expandConfig 不同层）。 */
export const expandConfigSchema = z
  .object({
    title: z.string().optional(),
    fields: z
      .array(
        z
          .object({
            prop: z.string().min(1),
            label: z.string().optional(),
            labelKey: z.string().optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

/** 跨端树表窄子集（嵌套 children 数组）。 */
export const treeConfigSchema = z
  .object({
    childrenField: z.string().optional(),
    expandAll: z.boolean().optional(),
  })
  .strict();

/** 跨端行合并窄子集。 */
export const mergeConfigSchema = z
  .object({
    rowsBy: z.array(z.string().min(1)).min(1),
  })
  .strict();
