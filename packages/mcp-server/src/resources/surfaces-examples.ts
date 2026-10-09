import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SurfaceField } from "@es-plus/shared";

/**
 * Curated few-shot NL → `generate_crud` surfaces pairs.
 *
 * The front door's ONLY LLM decision is filling `surfaces` — which of
 * query / table / form / dialog a request implies, and the fields in each.
 * These examples teach that one decision across the FULL subset space the tool
 * supports (standalone form/table/dialog, query+table, table+dialog, full CRUD,
 * and fragments meant to sit next to native/third-party components), so the host
 * never has to reason about "which tool / how many tools".
 *
 * Field-level reasoning (meaning → formtype, options → dataOptions/apiParams,
 * extension points) is IDENTICAL to the config path — see
 * `esplus://examples/nl-to-config`. These examples add only the surface-routing
 * dimension: WHICH list each field belongs in.
 *
 * surfaces-examples.spec.ts routes every example through the SAME shared
 * functions the front door uses (composeCrudConfig → generateFromConfig for
 * table-bearing; the fragment emitters otherwise) and asserts it produces code,
 * so a rotted example fails loudly instead of teaching a dead intent.
 */
export type DialogKey = "add" | "edit" | "view";

export interface SurfacesExample {
  label: string;
  /** The natural-language request a user might give. */
  nl: string;
  /** Why the surfaces partition the way they do — the routing we want the LLM to imitate. */
  reasoning: string;
  /** Which deterministic route this intent takes (for the reader; asserted by the spec). */
  route: "compose→generateFromConfig" | "fragment";
  input: {
    name: string;
    apiUrl: string;
    target?: "vue3" | "vue2" | "antdv";
    surfaces: {
      query?: SurfaceField[];
      table?: SurfaceField[];
      form?: SurfaceField[];
      dialog?: DialogKey[];
    };
  };
}

export const SURFACES_EXAMPLES: SurfacesExample[] = [
  {
    label: "Full CRUD — query + table + form + dialog (the common case)",
    nl: "用户管理：查询用户名、状态（启用/禁用）；表格展示用户名、状态、注册时间；支持新增、编辑、删除。",
    reasoning:
      "既有过滤又有列表又能增改 → 填 query/table/form 三张列表 + dialog:['add','edit']。注册时间是系统列：进 table 不进 form。状态是枚举 → Select + dataOptions（query 与 form 都要）。有表格 → 走组合→generateFromConfig，一次性编译保证现成；删除无需单独面，由 actions 推导。",
    route: "compose→generateFromConfig",
    input: {
      name: "UserManage",
      apiUrl: "/api/users",
      surfaces: {
        query: [
          { prop: "username", label: "用户名", formtype: "Input" },
          { prop: "status", label: "状态", formtype: "Select", dataOptions: [{ label: "启用", value: 1 }, { label: "禁用", value: 0 }] },
        ],
        table: [
          { prop: "username", label: "用户名", formtype: "Input" },
          { prop: "status", label: "状态", formtype: "Select" },
          { prop: "createdAt", label: "注册时间", formtype: "DatePicker" },
        ],
        form: [
          { prop: "username", label: "用户名", formtype: "Input", required: true },
          { prop: "status", label: "状态", formtype: "Select", dataOptions: [{ label: "启用", value: 1 }, { label: "禁用", value: 0 }] },
        ],
        dialog: ["add", "edit"],
      },
    },
  },
  {
    label: "Query + table, no dialog — a filterable read list",
    nl: "订单查询页：按单号、下单日期筛选；表格展示单号、金额、下单时间；只看不改。",
    reasoning:
      "只筛选 + 展示、不增改 → 填 query/table，不填 form、不填 dialog。有表格 → 仍走组合→generateFromConfig；无 form/dialog 时 actions 推导为 ['view']（只读列表 + 行内查看）。金额是明细 → 不进 query。",
    route: "compose→generateFromConfig",
    input: {
      name: "OrderQuery",
      apiUrl: "/api/orders",
      surfaces: {
        query: [
          { prop: "orderNo", label: "单号", formtype: "Input" },
          { prop: "orderDate", label: "下单日期", formtype: "DatePicker" },
        ],
        table: [
          { prop: "orderNo", label: "单号", formtype: "Input" },
          { prop: "amount", label: "金额", formtype: "InputNumber", align: "right", formatter: "(row) => Number(row.amount).toFixed(2)" },
          { prop: "createdAt", label: "下单时间", formtype: "DatePicker" },
        ],
      },
    },
  },
  {
    label: "Table + dialog, no query — a list you can add/edit but not filter",
    nl: "字典项维护：表格展示字典名、键、值、排序；能新增和编辑，不需要查询条件。",
    reasoning:
      "有列表 + 增改、但没有过滤 → 填 table/form + dialog:['add','edit']，不填 query。有表格 → 组合→generateFromConfig。排序是明细列，照常进 table；form 只放可改字段。",
    route: "compose→generateFromConfig",
    input: {
      name: "DictItem",
      apiUrl: "/api/dict-items",
      surfaces: {
        table: [
          { prop: "name", label: "字典名", formtype: "Input" },
          { prop: "key", label: "键", formtype: "Input" },
          { prop: "value", label: "值", formtype: "Input" },
          { prop: "sort", label: "排序", formtype: "InputNumber" },
        ],
        form: [
          { prop: "name", label: "字典名", formtype: "Input", required: true },
          { prop: "key", label: "键", formtype: "Input", required: true },
          { prop: "value", label: "值", formtype: "Input" },
          { prop: "sort", label: "排序", formtype: "InputNumber" },
        ],
        dialog: ["add", "edit"],
      },
    },
  },
  {
    label: "Standalone table — a list that sits beside other UI (no table-less surfaces)",
    nl: "给我一个服务器日志表格：IP、级别、消息、时间，数据来自 /api/logs，我要把它放进自己的面板里。",
    reasoning:
      "用户要的就是一张表、要嵌进自定义面板 → 只填 table。注意：这里 table 存在 → 仍是组合→generateFromConfig 路线（会产出整页 schema+包装 SFC）。若要真正可嵌入的裸 <es-table> 片段，用独立工具 generate_table；前门填 table 面产出的是整页。",
    route: "compose→generateFromConfig",
    input: {
      name: "ServerLog",
      apiUrl: "/api/logs",
      surfaces: {
        table: [
          { prop: "ip", label: "IP", formtype: "Input" },
          { prop: "level", label: "级别", formtype: "Select", dataOptions: [{ label: "INFO", value: "info" }, { label: "ERROR", value: "error" }] },
          { prop: "message", label: "消息", formtype: "Input" },
          { prop: "ts", label: "时间", formtype: "DatePicker" },
        ],
      },
    },
  },
  {
    label: "Standalone form (no table) — a search/filter form on its own",
    nl: "只要一个搜索表单：关键字、分类（下拉）、日期范围，带查询和重置按钮，我自己接列表。",
    reasoning:
      "没有表格、只要一个过滤表单 → 只填 query（无 table/form/dialog）。无表格子集 → 走片段发射器，产出自包含的 <es-form> SFC（query 语境 = 窄 span + 查询/重置按钮）。因为不含表格,它不经过 generateFromConfig。",
    route: "fragment",
    input: {
      name: "SearchForm",
      apiUrl: "/api/search",
      surfaces: {
        query: [
          { prop: "keyword", label: "关键字", formtype: "Input" },
          { prop: "category", label: "分类", formtype: "Select", apiParams: { url: "/api/categories", labelField: "name", valueField: "id" } },
          { prop: "dateRange", label: "日期范围", formtype: "DatePicker" },
        ],
      },
    },
  },
  {
    label: "Standalone dialog (form + dialog, no table) — a reusable add/edit modal",
    nl: "做一个可复用的「新增角色」弹窗：角色名、描述、是否启用，提交到 /api/roles，谁都能调。",
    reasoning:
      "要的是一个独立、可复用的弹窗 → 填 form（弹窗内字段）+ dialog:['add']，不填 table/query。无表格子集 → 走片段发射器，产出 useXxxDialog() 组合式(.tsx 模块)，open(title,row?,onSuccess?) 是集成契约,宿主在 onSuccess 里刷新自己的表。",
    route: "fragment",
    input: {
      name: "RoleDialog",
      apiUrl: "/api/roles",
      surfaces: {
        form: [
          { prop: "roleName", label: "角色名", formtype: "Input", required: true },
          { prop: "description", label: "描述", formtype: "Input", attrs: { type: "textarea", maxlength: 200 } },
          { prop: "enabled", label: "是否启用", formtype: "Switch" },
        ],
        dialog: ["add"],
      },
    },
  },
  {
    label: "Explicit target (vue2) — surfaces shape is identical across targets",
    nl: "（vue2 项目）任务管理：查询任务名、优先级（高/中/低）；表格展示任务名、优先级、截止日期；支持新增、编辑。",
    reasoning:
      "点名 vue2 → target:'vue2'；surfaces 的填法与 vue3/antdv 完全一致（多端同构，只有 target 变）。优先级是枚举 → Select + dataOptions；截止日期进 table/form 不进 query。",
    route: "compose→generateFromConfig",
    input: {
      name: "TaskManage",
      apiUrl: "/api/tasks",
      target: "vue2",
      surfaces: {
        query: [
          { prop: "title", label: "任务名", formtype: "Input" },
          { prop: "priority", label: "优先级", formtype: "Select", dataOptions: [{ label: "高", value: 3 }, { label: "中", value: 2 }, { label: "低", value: 1 }] },
        ],
        table: [
          { prop: "title", label: "任务名", formtype: "Input" },
          { prop: "priority", label: "优先级", formtype: "Select" },
          { prop: "dueDate", label: "截止日期", formtype: "DatePicker" },
        ],
        form: [
          { prop: "title", label: "任务名", formtype: "Input", required: true },
          { prop: "priority", label: "优先级", formtype: "Select", dataOptions: [{ label: "高", value: 3 }, { label: "中", value: 2 }, { label: "低", value: 1 }] },
          { prop: "dueDate", label: "截止日期", formtype: "DatePicker" },
        ],
        dialog: ["add", "edit"],
      },
    },
  },
];

function buildContent(): string {
  const intro = [
    "# Natural-language → `generate_crud` surfaces — few-shot examples",
    "",
    "`generate_crud` is the FRONT DOOR. Your only real decision is filling `surfaces`:",
    "which of **query / table / form / dialog** the request implies, and the fields in each.",
    "Routing is then deterministic — you never pick a tool or orchestrate several:",
    "",
    "- **any `table` present** → composed and compiled through the single golden-covered generator (one-shot compile guaranteed).",
    "- **no `table`** (standalone form / search filter / add-edit dialog / form+dialog) → emitted as self-contained fragments you can drop next to native/third-party components.",
    "",
    "Membership is implied by WHICH list a field is in: a filter field → `surfaces.query`, a visible column → `surfaces.table`, a mutable add/edit field → `surfaces.form`. A field that appears in several surfaces is listed in each; the generator reconciles duplicates deterministically (identity first-wins, semantic from form, display from table).",
    "",
    "Field meaning → formtype mapping is the SAME as the config path (see `esplus://examples/nl-to-config`): enums → Select (dataOptions / apiParams), dates → DatePicker, on/off → Switch, long text → Input + attrs.type:'textarea', etc.",
    "",
    "For an explicit single-component ask (or a fragment next to non-es-plus UI), the standalone tools `generate_form` / `generate_table` / `generate_dialog` take the same field vocabulary.",
    "",
    "---",
    "",
  ].join("\n");

  const blocks = SURFACES_EXAMPLES.map((ex) =>
    [
      `## ${ex.label}`,
      "",
      `**Request:** ${ex.nl}`,
      "",
      `**Reasoning:** ${ex.reasoning}`,
      "",
      `**Route:** \`${ex.route}\``,
      "",
      "**`generate_crud` input:**",
      "",
      "```json",
      JSON.stringify(ex.input, null, 2),
      "```",
      "",
    ].join("\n")
  );

  return intro + blocks.join("\n");
}

export function registerSurfacesExamplesResource(server: McpServer) {
  const uri = "esplus://examples/surfaces";
  server.resource(
    "examples-surfaces",
    uri,
    {
      description:
        "Few-shot natural-language → generate_crud `surfaces` examples with routing reasoning, across the full subset space (standalone form/table/dialog, query+table, table+dialog, full CRUD, vue2/antdv). Read this before calling generate_crud — it teaches the one decision the front door asks of you: which surfaces a request implies and which list each field belongs in.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{ uri, mimeType: "text/markdown", text: buildContent() }],
    })
  );
}
