/**
 * 由 `scripts/gen-ai-workflows.mjs` 生成，勿手改。
 * 单源：三条工作流的 9 次真 handler 调用（入参冻结、出参逐字节）。
 * 守卫：`npm run check:ai-workflows`（新鲜度 / 确定性 / 覆盖 / 预期失败 / 接线）。
 */
export const AI_WORKFLOWS = {
  "tools": [
    "detect_project_target",
    "generate_crud",
    "validate_config",
    "refine_config",
    "scaffold_page",
    "doctor_page",
    "ingest_schema",
    "list_form_types",
    "get_component_api"
  ],
  "zeroCaseTools": [
    "detect_project_target",
    "validate_config",
    "refine_config",
    "scaffold_page",
    "doctor_page",
    "ingest_schema",
    "list_form_types",
    "get_component_api"
  ],
  "note": "S3 工具工作流：三条链、9 次真 handler 调用。入参冻结在生成器里，出参是逐字节的真实返回；`refine_config` 的 revised 是冻结输入（该工具不调模型）。check:ai-workflows 重算并逐字节比对。",
  "workflows": [
    {
      "id": "w1",
      "title": "一句话 → 页面 → 纠偏",
      "oneLiner": "先探目标，再用一张意图表（surfaces）出页；校验抓住两处写错，精修给出这一轮改了什么。",
      "tools": [
        "detect_project_target",
        "generate_crud",
        "validate_config",
        "refine_config"
      ],
      "steps": [
        {
          "tool": "detect_project_target",
          "note": "探目标读的是宿主传入的 package.json 文本 —— 依赖里已有 @es-plus/vue3，判 vue3/high。",
          "expect": "ok",
          "ok": true,
          "args": {
            "packageJson": "{\"dependencies\":{\"vue\":\"^3.4.0\",\"element-plus\":\"^2.4.0\",\"@es-plus/vue3\":\"^1.0.0\"}}"
          },
          "result": "Detected target: vue3 (confidence: high)\nReasoning: Project already depends on @es-plus/vue3.\nSignals found in dependencies:\n  - @es-plus/vue3: ^1.0.0\n  - vue: ^3.4.0\n  - element-plus: ^2.4.0\nNext step: pass target='vue3' to generate_crud / generate_form / generate_table / generate_dialog / get_component_api / etc.",
          "truncated": false,
          "bytes": 316
        },
        {
          "tool": "generate_crud",
          "note": "同一张意图表 → 查询/表格/表单三面 + add/edit 两个弹窗；产物是纯 JSON schema + 包装 SFC。",
          "expect": "ok",
          "ok": true,
          "args": {
            "name": "OrderWorkbench",
            "apiUrl": "/api/orders",
            "surfaces": {
              "query": [
                {
                  "prop": "keyword",
                  "label": "关键词",
                  "formtype": "Input",
                  "querySpan": 8
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "querySpan": 8,
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "table": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "width": 150
                },
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "minWidth": 140
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "align": "right"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "form": [
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "required": true
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "dialog": [
                "add",
                "edit"
              ]
            },
            "target": "vue3",
            "mode": "schema"
          },
          "result": "Generated CrudPageSchema (structured mode, target=vue3):\n- 2 query fields, 4 table columns\n- 2 dialog(s) configured\n- Actions: add, edit\n- API: /api/orders\n- Mode: schema + wrapper SFC\n- Multi-dialog mode\n- TypeScript enabled\n- Target: Vue 3 + Element Plus (@es-plus/vue3)\n\n## Preflight — host prerequisites (not generated code)\n\nThese live in the host app entry / build config. A missing item does **not** break compilation;\nthe matching capability silently turns inert (permission even fails *open*). Check every line marked required.\n\n- **[required]** **UI library — Element Plus (element-plus)**\n  - Why: es-plus renders `el-*` / `a-*` elements; without the UI library installed and registered they resolve to unknown elements — tables and forms render blank, with no compile error.\n  - Do: npm i element-plus; import ElementPlus from 'element-plus' + import 'element-plus/dist/index.css'; app.use(ElementPlus) (entry below).\n- **[required]** **es-plus plugin registration**\n  - Why: Registers <es-table> / <es-form> / <es-crud-page> and writes the global config singleton (httpRequest / permission / t). Without app.use(ESPlus, { … }) the generated template's components are unresolved.\n  - Do: app.use(ESPlus, { … }) — import ESPlus from '@es-plus/vue3' (entry below).\n- **[required]** **Global httpRequest**\n  - Why: The wrapper SFC calls the free function httpRequest() on mount and after delete/add/edit; this config's table fetches \"apiUrl\" through it. Unconfigured, it throws an explicit \"全局 httpRequest 未配置\" error — the page stays empty.\n  - Do: httpRequest: (params) => axios(params) — inside the plugin options (entry below).\n- [not needed] **Global permission()**\n  - Why: No permissionValue / permissions in this config — the runtime default (allow-all) is exactly the intended semantics.\n- [not needed] **Global t() (i18n)**\n  - Why: No labelKey / i18n in this config — labels come from `label`; t() is only consulted for labelKey.\n- [not needed] **JSX transform (dialog render)**\n  - Why: mode=schema wraps a JSON schema in a template-only SFC and dialogs are rendered at runtime by <es-crud-page> — no JSX syntax is emitted.\n\n### App entry — src/main.ts (copy once)\n\n```ts\n// src/main.ts — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport { createApp } from 'vue'\nimport axios from 'axios'\nimport ElementPlus from 'element-plus'\nimport 'element-plus/dist/index.css'\nimport ESPlus from '@es-plus/vue3'\nimport '@es-plus/vue3/dist/style.css'\n\nconst app = createApp(App)\n\napp.use(ElementPlus)\napp.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n\napp.mount('#app')\n```\n\n---\n\n## Schema (schema.ts)\n\n```typescript\nimport type { CrudPageSchema } from '@es-plus/vue3'\n\nexport const pageSchema: CrudPageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"keyword\",",
          "truncated": true,
          "bytes": 8265
        },
        {
          "tool": "validate_config",
          "note": "宿主照抄时写错了两处（InputNumbr、把 fields 复制成 formFields）—— 校验器只判不改，逐条点名并给建议。",
          "expect": "error",
          "ok": false,
          "args": {
            "config": {
              "name": "OrderWorkbench",
              "apiUrl": "/api/orders",
              "actions": [
                "add",
                "edit",
                "view"
              ],
              "fields": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": false,
                  "querySpan": 8
                },
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "querySpan": 8,
                  "required": true
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumbr",
                  "inQuery": false,
                  "inTable": true,
                  "inForm": true,
                  "align": "right"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "dialogs": {
                "view": {
                  "title": "订单详情",
                  "formItems": [
                    {
                      "prop": "orderNo",
                      "label": "订单号",
                      "formtype": "Input"
                    },
                    {
                      "prop": "customer",
                      "label": "客户",
                      "formtype": "Input"
                    },
                    {
                      "prop": "amount",
                      "label": "金额",
                      "formtype": "InputNumber"
                    },
                    {
                      "prop": "status",
                      "label": "状态",
                      "formtype": "Select",
                      "dataOptions": [
                        {
                          "label": "待发货",
                          "value": 0,
                          "tagType": "warning"
                        },
                        {
                          "label": "已发货",
                          "value": 1,
                          "tagType": "success"
                        }
                      ]
                    }
                  ]
                }
              },
              "tableOptions": {
                "border": true,
                "rowkey": "id"
              },
              "pagination": {
                "pageSize": 10
              },
              "formFields": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": false,
                  "querySpan": 8
                },
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "querySpan": 8,
                  "required": true
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumbr",
                  "inQuery": false,
                  "inTable": true,
                  "inForm": true,
                  "align": "right"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ]
            },
            "type": "structured-crud-config"
          },
          "jsonArgs": [
            "config"
          ],
          "result": "✗ Configuration has errors:\n\n  - /fields/2/formtype: Invalid option: expected one of \"Input\"|\"InputNumber\"|\"Select\"|\"DatePicker\"|\"TimePicker\"|\"Slider\"|\"ColorPicker\"|\"Transfer\"|\"Cascader\"|\"Radio\"|\"Checkbox\"|\"Switch\"|\"Rate\"|\"Upload\"|\"datePicker\"|\"timePicker\"\n  - /formFields: 未知键 \"formFields\"（该层没有相近的已知键；拼写错误或放错了层级）\nSuggestions:\n  → Valid values for /fields/2/formtype: Input, InputNumber, Select, DatePicker, TimePicker, Slider, ColorPicker, Transfer, Cascader, Radio, Checkbox, Switch, …",
          "truncated": false,
          "bytes": 545
        },
        {
          "tool": "refine_config",
          "note": "改好的这一版相对 pin 的改动：新增 edit 弹窗与操作列 —— diff 逐块回显，不靠人眼比对两份 JSON。",
          "expect": "ok",
          "ok": true,
          "args": {
            "previous": {
              "name": "OrderWorkbench",
              "apiUrl": "/api/orders",
              "actions": [
                "add",
                "edit",
                "view"
              ],
              "fields": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": false,
                  "querySpan": 8
                },
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "querySpan": 8,
                  "required": true
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "inQuery": false,
                  "inTable": true,
                  "inForm": true,
                  "align": "right"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "dialogs": {
                "view": {
                  "title": "订单详情",
                  "formItems": [
                    {
                      "prop": "orderNo",
                      "label": "订单号",
                      "formtype": "Input"
                    },
                    {
                      "prop": "customer",
                      "label": "客户",
                      "formtype": "Input"
                    },
                    {
                      "prop": "amount",
                      "label": "金额",
                      "formtype": "InputNumber"
                    },
                    {
                      "prop": "status",
                      "label": "状态",
                      "formtype": "Select",
                      "dataOptions": [
                        {
                          "label": "待发货",
                          "value": 0,
                          "tagType": "warning"
                        },
                        {
                          "label": "已发货",
                          "value": 1,
                          "tagType": "success"
                        }
                      ]
                    }
                  ]
                }
              },
              "tableOptions": {
                "border": true,
                "rowkey": "id"
              },
              "pagination": {
                "pageSize": 10
              }
            },
            "revised": {
              "name": "OrderWorkbench",
              "apiUrl": "/api/orders",
              "actions": [
                "add",
                "edit",
                "view"
              ],
              "fields": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": false,
                  "querySpan": 8
                },
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "querySpan": 8,
                  "required": true
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "inQuery": false,
                  "inTable": true,
                  "inForm": true,
                  "align": "right"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "dialogs": {
                "view": {
                  "title": "订单详情",
                  "formItems": [
                    {
                      "prop": "orderNo",
                      "label": "订单号",
                      "formtype": "Input"
                    },
                    {
                      "prop": "customer",
                      "label": "客户",
                      "formtype": "Input"
                    },
                    {
                      "prop": "amount",
                      "label": "金额",
                      "formtype": "InputNumber"
                    },
                    {
                      "prop": "status",
                      "label": "状态",
                      "formtype": "Select",
                      "dataOptions": [
                        {
                          "label": "待发货",
                          "value": 0,
                          "tagType": "warning"
                        },
                        {
                          "label": "已发货",
                          "value": 1,
                          "tagType": "success"
                        }
                      ]
                    }
                  ]
                },
                "edit": {
                  "title": "编辑订单",
                  "formItems": [
                    {
                      "prop": "customer",
                      "label": "客户",
                      "formtype": "Input",
                      "required": true
                    },
                    {
                      "prop": "amount",
                      "label": "金额",
                      "formtype": "InputNumber"
                    },
                    {
                      "prop": "status",
                      "label": "状态",
                      "formtype": "Select",
                      "dataOptions": [
                        {
                          "label": "待发货",
                          "value": 0,
                          "tagType": "warning"
                        },
                        {
                          "label": "已发货",
                          "value": 1,
                          "tagType": "success"
                        }
                      ]
                    }
                  ]
                }
              },
              "tableOptions": {
                "border": true,
                "rowkey": "id"
              },
              "pagination": {
                "pageSize": 10
              },
              "operationColumn": {
                "label": "操作",
                "btns": [
                  {
                    "name": "查看",
                    "dialogKey": "view"
                  },
                  {
                    "name": "编辑",
                    "dialogKey": "edit"
                  }
                ]
              }
            }
          },
          "jsonArgs": [
            "previous",
            "revised"
          ],
          "result": "✓ 修订后的配置合法。本轮改动:\n  ~ dialogs: {\"view\":{\"title\":\"订单详情\",\"formItems\":[{\"prop\":\"orderNo\",\"label\":\"订单号\",\"formtype\":\"Input\"},{\"prop\":\"customer\",\"label\":\"… → {\"view\":{\"title\":\"订单详情\",\"formItems\":[{\"prop\":\"orderNo\",\"label\":\"订单号\",\"formtype\":\"Input\"},{\"prop\":\"customer\",\"label\":\"…\n  ~ operationColumn: ∅ → {\"label\":\"操作\",\"btns\":[{\"name\":\"查看\",\"dialogKey\":\"view\"},{\"name\":\"编辑\",\"dialogKey\":\"edit\"}]}",
          "truncated": false,
          "bytes": 462
        }
      ]
    },
    {
      "id": "w2",
      "title": "脚手架 → 诊断 → 修",
      "oneLiner": "先给一份能跑的最小页面骨架与前置清单，再静态体检宿主入口，缺什么、怎么补都写在报告里。",
      "tools": [
        "scaffold_page",
        "doctor_page"
      ],
      "steps": [
        {
          "tool": "scaffold_page",
          "note": "与生成器共用同一份 preflight 清单（AN-15②）—— 脚手架说的前置项和生成页要求的是同一套。",
          "expect": "ok",
          "ok": true,
          "args": {
            "name": "workflow-demo",
            "features": [
              "query",
              "table",
              "dialog"
            ],
            "target": "vue3"
          },
          "result": "Generated scaffold for \"workflow-demo\" (target=vue3) with features: query, table, dialog\n\n<template>\n  <div class=\"workflow-demo-page\">\n    <es-table\n      ref=\"tableRef\"\n      :columns=\"columns\"\n      :options=\"options\"\n      v-model:data-source=\"tableData\"\n      v-model:pagination=\"pagination\"\n    >\n      <es-form :model=\"queryForm\" :form-item-list=\"formItems\" :config-btn=\"queryBtns\" />\n    </es-table>\n  </div>\n</template>\n\n<script setup>\nimport { reactive, ref } from 'vue'\nimport { useDialog } from '@es-plus/vue3'\n\nconst queryForm = reactive({})\nconst formItems = []\nconst queryBtns = [\n  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },\n  { name: '重置', key: 'rest', triggerEvent: true },\n]\n\nconst tableRef = ref(null)\nconst tableData = ref([])\nconst pagination = ref({ current: 1, pageSize: 10, total: 0 })\nconst columns = []\n// httpRequest 和 configTableOut 由全局配置注入，无需在此声明\n// 全局配置: app.use(ESPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })\nconst options = {\n  border: true,\n  stripe: true,\n  highlightCurrentRow: true,\n  headerCellStyle: { background: '#f5f7fa' },\n  apiParams: { url: '/api/xxx' },  // TODO: 替换为实际接口地址\n  rowkey: 'id'\n}\n\nconst dialog = useDialog()\n\n// ── 全局装配（permissionValue / i18n labelKey / 远端 apiParams 的前提）──\n// 入口 main.ts 须一次性 app.use(ESPlus, { permission, t, httpRequest })，否则对应能力静默失效\n// （scaffold_page 输出会随附可直接复制的 main.ts 样板）\n</script>\n\n## Preflight — host prerequisites (not generated code)\n\nThese live in the host app entry / build config. A missing item does **not** break compilation;\nthe matching capability silently turns inert (permission even fails *open*). Check every line marked required.\n\n- **[required]** **UI library — Element Plus (element-plus)**\n  - Why: es-plus renders `el-*` / `a-*` elements; without the UI library installed and registered they resolve to unknown elements — tables and forms render blank, with no compile error.\n  - Do: npm i element-plus; import ElementPlus from 'element-plus' + import 'element-plus/dist/index.css'; app.use(ElementPlus) (entry below).\n- **[required]** **es-plus plugin registration**\n  - Why: Registers <es-table> / <es-form> / <es-crud-page> and writes the global config singleton (httpRequest / permission / t). Without app.use(ESPlus, { … }) the generated template's components are unresolved.\n  - Do: app.use(ESPlus, { … }) — import ESPlus from '@es-plus/vue3' (entry below).\n- **[required]** **Global httpRequest**\n  - Why: The table's apiParams.url is fetched through the global httpRequest; unconfigured, the table throws an explicit \"全局 httpRequest 未配置\" error on mount.\n  - Do: httpRequest: (params) => axios(params) — inside the plugin options (entry below).\n- [not needed] **Global permission()**\n  - Why: No permissionValue / permissions in this config — the runtime default (allow-all) is exactly the intended semantics.\n- [not needed] **Global t() (i18n)**\n  - Why: No labelKey / i18n in this config — labels come from `label`; t() is only consulted f",
          "truncated": true,
          "bytes": 4119
        },
        {
          "tool": "doctor_page",
          "note": "同一份入口做静态体检：UI 库/插件注册在，httpRequest 缺 —— 报告给出「Do:」修法；只做字面扫描，看不到的记 unverified。",
          "expect": "ok",
          "ok": true,
          "args": {
            "entry": "import { createApp } from 'vue'\nimport ElementPlus from 'element-plus'\nimport ESPlus from '@es-plus/vue3'\nimport App from './App.vue'\n\nconst app = createApp(App)\napp.use(ElementPlus)\napp.use(ESPlus)\napp.mount('#app')\n",
            "target": "vue3",
            "config": {
              "name": "OrderWorkbench",
              "apiUrl": "/api/orders",
              "actions": [
                "add",
                "edit",
                "view"
              ],
              "fields": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": false,
                  "querySpan": 8
                },
                {
                  "prop": "customer",
                  "label": "客户",
                  "formtype": "Input",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "querySpan": 8,
                  "required": true
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "inQuery": false,
                  "inTable": true,
                  "inForm": true,
                  "align": "right"
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "inQuery": true,
                  "inTable": true,
                  "inForm": true,
                  "dataOptions": [
                    {
                      "label": "待发货",
                      "value": 0,
                      "tagType": "warning"
                    },
                    {
                      "label": "已发货",
                      "value": 1,
                      "tagType": "success"
                    }
                  ]
                }
              ],
              "dialogs": {
                "view": {
                  "title": "订单详情",
                  "formItems": [
                    {
                      "prop": "orderNo",
                      "label": "订单号",
                      "formtype": "Input"
                    },
                    {
                      "prop": "customer",
                      "label": "客户",
                      "formtype": "Input"
                    },
                    {
                      "prop": "amount",
                      "label": "金额",
                      "formtype": "InputNumber"
                    },
                    {
                      "prop": "status",
                      "label": "状态",
                      "formtype": "Select",
                      "dataOptions": [
                        {
                          "label": "待发货",
                          "value": 0,
                          "tagType": "warning"
                        },
                        {
                          "label": "已发货",
                          "value": 1,
                          "tagType": "success"
                        }
                      ]
                    }
                  ]
                }
              },
              "tableOptions": {
                "border": true,
                "rowkey": "id"
              },
              "pagination": {
                "pageSize": 10
              }
            }
          },
          "result": "## Doctor — host entry check (static scan)\n\nLiteral scan only: it cannot follow variables or imported modules. `unverified` means \"not visible here\",\nnot \"fine\" — confirm those by hand.\n\n- ✅ **UI library — Element Plus (element-plus)** — ok\n  - Found the UI library import/resolver and its registration (npm i element-plus; import ElementPlus from 'element-plus' + import 'element-plus/dist/index.css'; app.use(ElementPlus)).\n- ✅ **es-plus plugin registration** — ok\n  - Found the ESPlus install call.\n- ❌ **Global httpRequest** — missing\n  - `httpRequest` is absent from the plugin options literal.\n  - Do: httpRequest: (params) => axios(params) — inside the plugin options (entry below).\n- ✅ **Global permission()** — ok\n  - No permissionValue / permissions in this config — the runtime default (allow-all) is exactly the intended semantics.\n- ✅ **Global t() (i18n)** — ok\n  - No labelKey / i18n in this config — labels come from `label`; t() is only consulted for labelKey.\n- ✅ **JSX transform (dialog render)** — ok\n  - mode=schema wraps a JSON schema in a template-only SFC and dialogs are rendered at runtime by <es-crud-page> — no JSX syntax is emitted.\n\nAt least one required prerequisite is MISSING — the matching capability will be silently inert.",
          "truncated": false,
          "bytes": 1297
        }
      ]
    },
    {
      "id": "w3",
      "title": "接管既有表单",
      "oneLiner": "把一份既有的 TS interface 摄成草拟配置，再让宿主按需查控件清单与组件 API —— 三条确定性查询。",
      "tools": [
        "ingest_schema",
        "list_form_types",
        "get_component_api"
      ],
      "steps": [
        {
          "tool": "ingest_schema",
          "note": "类型→formtype 由摄取器定（number→InputNumber、boolean→Switch），查询面留空由宿主收窄。",
          "expect": "ok",
          "ok": true,
          "args": {
            "kind": "ts-interface",
            "text": "interface Product {\n  /** 商品编码 */\n  sku: string\n  /** 商品名称 */\n  name: string\n  /** 单价 */\n  price: number\n  /** 上架 */\n  active: boolean\n}",
            "name": "ProductManage",
            "apiUrl": "/api/products"
          },
          "result": "已从 ts-interface 摄取 4 个字段,草拟如下配置(请审阅并修订,然后 use the draft as the reference when filling `generate_crud`'s `surfaces` (map each field into query / table / form), and pass it to `validate_config` with type 'structured-crud-config' to check your edits):\n\n```json\n{\n  \"name\": \"ProductManage\",\n  \"apiUrl\": \"/api/products\",\n  \"fields\": [\n    {\n      \"prop\": \"sku\",\n      \"label\": \"商品编码\",\n      \"formtype\": \"Input\",\n      \"required\": true,\n      \"inQuery\": false,\n      \"inTable\": true,\n      \"inForm\": true\n    },\n    {\n      \"prop\": \"name\",\n      \"label\": \"商品名称\",\n      \"formtype\": \"Input\",\n      \"required\": true,\n      \"inQuery\": false,\n      \"inTable\": true,\n      \"inForm\": true\n    },\n    {\n      \"prop\": \"price\",\n      \"label\": \"单价\",\n      \"formtype\": \"InputNumber\",\n      \"required\": true,\n      \"inQuery\": false,\n      \"inTable\": true,\n      \"inForm\": true\n    },\n    {\n      \"prop\": \"active\",\n      \"label\": \"上架\",\n      \"formtype\": \"Switch\",\n      \"required\": true,\n      \"inQuery\": false,\n      \"inTable\": true,\n      \"inForm\": true\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ]\n}\n```",
          "truncated": false,
          "bytes": 1159
        },
        {
          "tool": "list_form_types",
          "note": "三端共用同一份 formtype 枚举 —— 宿主补字段时查这一份，不是各端各猜。",
          "expect": "ok",
          "ok": true,
          "args": {},
          "result": "# es-plus Form Types (formtype)\n\nAvailable types for the `formtype` property in `FormItemOption`.\n\nThe enum is shared by @es-plus/vue3, @es-plus/vue2 and @es-plus/adapter-antdv;\nonly the underlying UI component differs per target.\n\n1. **Input** — 输入框 — 文本/数字/密码输入\n   Example: 姓名、手机号、邮箱\n2. **InputNumber** — 数字输入框 — 数值/金额输入\n   Example: 年龄、价格、库存数量\n3. **Select** — 下拉选择器 — 单选/多选\n   Example: 状态、类型、分类\n4. **DatePicker** — 日期选择器 — 日期/日期范围\n   Example: 创建时间、日期范围\n5. **TimePicker** — 时间选择器 — 时间/时间范围\n   Example: 开始时间、结束时间\n6. **Slider** — 滑块 — 数值区间选择\n   Example: 价格区间、进度\n7. **ColorPicker** — 颜色选择器\n   Example: 主题色、标签颜色\n8. **Transfer** — 穿梭框 — 左右列表选择\n   Example: 权限分配、人员分配\n9. **Cascader** — 级联选择器 — 多级联动\n   Example: 省市区、部门层级\n10. **Radio** — 单选框组\n   Example: 性别、是否启用\n11. **Checkbox** — 多选框组\n   Example: 兴趣爱好、功能模块\n12. **Switch** — 开关 — 布尔切换\n   Example: 启用/禁用、显示/隐藏\n13. **Rate** — 评分 — 星级评分\n   Example: 满意度、评分\n14. **Upload** — 上传 — 文件/图片上传\n   Example: 头像、附件、证件照\n\n---\nUsage in config:\n```json\n{ \"prop\": \"status\", \"label\": \"状态\", \"formtype\": \"Select\", \"dataOptions\": [...] }\n```",
          "truncated": false,
          "bytes": 1573
        },
        {
          "tool": "get_component_api",
          "note": "组件 API 按 target 渲染（这里是 vue3）：同一份模板拼出三端差异，只换包名与 SFC 写法。",
          "expect": "ok",
          "ok": true,
          "args": {
            "component": "EsCrudPage",
            "target": "vue3"
          },
          "result": "# EsCrudPage API (@es-plus/vue3)\n\nOne `schema` object → a full CRUD page (query form + table + dialogs). The renderer wires EsForm + EsTable + dialogs together, so you describe the page, not the wiring.\n\n## Props\n```typescript\ninterface CrudPageProps {\n  schema: CrudPageSchema                                // required\n  httpRequest?: (params) => Promise<unknown>            // data fetching fn\n  autoLoad?: boolean                                    // fetch on mount — default true\n}\n```\n\n## CrudPageSchema (the `schema` prop)\n```typescript\ninterface CrudPageSchema {\n  formItems?: FormItemOption[]          // query form fields\n  formLayout?: { labelWidth?, minFoldRows? }\n  toolbarBtns?: CrudBtnConfig[]         // rendered in the EsForm button area\n  tableBtns?: TableBtnConfig[]          // above the table, position: 'left' | 'right'\n  columns: TableColumn[]                // required — table columns\n  tableOptions?: Partial<TableOptions>\n  pagination?: PaginationConfig\n  operationColumn?: OperationColumnConfig | false   // false = no action column\n  dialogs?: Record<string, CrudDialogConfig>        // keyed popups; buttons bind via dialogKey\n}\n```\nA `CrudDialogConfig` is either `formItems` (auto-built form) or a custom `render`, plus `onConfirm`/`onClose`; a row button with `dialogKey` opens it with the row data.\n\n## Emits\n`query`, `add`, `edit`, `delete`, `view`, `export`, `row-click`, `btn-click`, `dialog-confirm`, `dialog-cancel`, `dialog-open`. Payloads: `edit/view/delete` → `(row)`; `query/export` → `(model)`; `btn-click` → `(key, payload?)`; `dialog-confirm` → `(dialogKey, data)`; `dialog-open` → `(dialogKey, row?)`.\n\n## Exposed instance methods (via ref) — same on all three renderers\n- `refresh()` — reload the table\n- `getSelectedRows()` — selected rows\n- `tableRef` / `formRef` — the inner EsTable / EsForm instances\n- `queryModel` — the reactive query model\n- `openDialog(key, row?)` / `closeDialog(key)` — drive the keyed dialogs imperatively\n\n## Import\n```typescript\nimport { EsCrudPage } from '@es-plus/vue3'\n```\n\n## Key Features\n- Whole page — search + table + add/edit/view dialogs — from one schema\n- `dialogs` + `dialogKey` replace hand-wired per-row dialog state\n- `operationColumn` / `tableBtns` drive row & toolbar actions\n",
          "truncated": false,
          "bytes": 2302
        }
      ]
    }
  ]
}
