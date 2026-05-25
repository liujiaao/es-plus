import { VALID_FORM_TYPES, SPECIAL_BTN_KEYS, BUILT_IN_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, VALID_CRUD_ACTIONS, DEFAULT_CONFIG_TABLE_OUT, CRUD_PAGE_BTN_CLICK_KEYS, } from "@es-plus/shared";
function buildConventionsContent() {
    return `# es-plus-ui Code Generation Conventions

## Form Types (formtype)
Valid values: ${VALID_FORM_TYPES.join(", ")}
- Note: "datePicker" and "timePicker" are camelCase (not PascalCase)
- All other types are PascalCase

## Button Keys
Built-in keys: ${BUILT_IN_BTN_KEYS.join(", ")}
- IMPORTANT: Reset button key MUST be "${SPECIAL_BTN_KEYS.RESET}" (NOT "reset")
- Query button key: "${SPECIAL_BTN_KEYS.QUERY}"
- Both query and reset buttons need \`triggerEvent: true\`

## Operation Column
- In SFC mode (EsTable + EsForm): use prop "${OPERATION_COLUMN_PROP_SFC}"
- In CrudPage mode (EsCrudPage): use prop "${OPERATION_COLUMN_PROP_CRUD_PAGE}"

## CRUD Actions
Valid values: ${VALID_CRUD_ACTIONS.join(", ")}
- Default actions when none specified: add, edit, delete

## Table Configuration
configTableOut (API response field mapping):
${Object.entries(DEFAULT_CONFIG_TABLE_OUT)
        .map(([k, v]) => `  - ${k}: "${v}"`)
        .join("\n")}

## Global Config Pattern
When using app.use(ESPlus), configure globally:
\`\`\`typescript
app.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: (params) => axios(params),
      configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
    }
  }
})
\`\`\`
With global config, use \`apiParams: { url: '/api/xxx' }\` instead of inline httpRequest.

## EsCrudPage btn-click Event Keys
- Add confirm: "${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}"
- Edit confirm: "${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}"

## Import Requirements
- When using status render with ElTag: import { ElTag } from 'element-plus'
- When using delete confirmation: import { ElMessageBox, ElMessage } from 'element-plus'
- When using EsCrudPage: the component is globally registered via ESPlus plugin

## CrudPageSchema Mode (Recommended)
Prefer generating CrudPageSchema JSON + wrapper SFC over full SFC mode:
- Simpler output (~30 lines wrapper vs ~200 lines full SFC)
- Runtime handles query/reset buttons, operation column, dialog lifecycle
- Schema is pure JSON (no render functions) — easy to validate and store
`;
}
export function registerConventionsResource(server) {
    server.resource("conventions", "esplus://conventions", {
        description: "Code generation conventions and rules for es-plus-ui (button keys, formtypes, import requirements)",
        mimeType: "text/plain",
    }, async () => {
        return {
            contents: [
                {
                    uri: "esplus://conventions",
                    mimeType: "text/plain",
                    text: buildConventionsContent(),
                },
            ],
        };
    });
}
//# sourceMappingURL=conventions.js.map