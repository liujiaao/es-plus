/**
 * 自动生成：scripts/gen-composition-gallery.mjs —— **禁止手改**。
 *
 * `npm run check:composition-gallery` 会重算本文件并与仓库里的字节比对；
 * 三站副本由 `npm run cases:sync` 分发（`check:ai-cases` 断言逐字节一致）。
 */
export const COMPOSITION_GALLERY = {
  "version": 1,
  "generatedBy": "scripts/gen-composition-gallery.mjs",
  "note": "自动生成，禁止手改。单源：__tests__/golden/composition/*.json；组合事实由 compositionFacts 计算（与评测同一函数），产物由 composeCrudConfig → generateFromConfig / 前门 no-table 分支产出。",
  "source": "__tests__/golden/composition/*.json（18 例 = 6 逻辑案例 × 3 target）",
  "shapes": [
    "full",
    "table+form",
    "form+dialog"
  ],
  "targets": [
    "vue3",
    "vue2",
    "antdv"
  ],
  "cases": [
    {
      "id": "comp-form-dialog-01-antdv",
      "baseId": "comp-form-dialog-01",
      "shape": "form+dialog",
      "target": "antdv",
      "mode": "schema",
      "name": "CustomerSignup",
      "apiUrl": "/api/customers",
      "surfaces": {
        "form": [
          {
            "prop": "customerName",
            "label": "客户姓名",
            "formtype": "Input"
          },
          {
            "prop": "phone",
            "label": "手机号",
            "formtype": "Input"
          },
          {
            "prop": "level",
            "label": "客户等级",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "普通",
                "value": "normal"
              },
              {
                "label": "VIP",
                "value": "vip"
              }
            ]
          }
        ],
        "dialog": [
          "add",
          "edit"
        ]
      },
      "expect": {
        "dialogBlocks": [
          {
            "key": "add",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          },
          {
            "key": "edit",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          }
        ]
      },
      "facts": {
        "shape": "form+dialog",
        "dialogKeys": [
          "add",
          "edit"
        ],
        "dialogBlocks": [
          {
            "key": "add",
            "composable": "useAddDialog",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          },
          {
            "key": "edit",
            "composable": "useEditDialog",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          }
        ]
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "dialogKeys",
          "label": "弹窗块 key",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogFields",
          "label": "每个弹窗块的字段（= form 面）",
          "pass": true,
          "want": [
            "add: customerName, phone, level",
            "edit: customerName, phone, level"
          ],
          "got": [
            "add: customerName, phone, level",
            "edit: customerName, phone, level"
          ]
        },
        {
          "key": "composable",
          "label": "composable 命名（use<Key>Dialog）",
          "pass": true,
          "want": [
            "useAddDialog",
            "useEditDialog"
          ],
          "got": [
            "useAddDialog",
            "useEditDialog"
          ]
        }
      ],
      "warnings": [
        "target=antdv: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
      ],
      "product": {
        "kind": "fragments",
        "fragments": [
          {
            "name": "useAddDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/adapter-antdv'\n\nexport function useAddDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '新增', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ customerName: '', phone: '', level: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"customerName\",\n        \"label\": \"客户姓名\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"phone\",\n        \"label\": \"手机号\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"level\",\n        \"label\": \"客户等级\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"普通\",\n                \"value\": \"normal\"\n            },\n            {\n                \"label\": \"VIP\",\n                \"value\": \"vip\"\n            }\n        ]\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/customers' : `/api/customers/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          },
          {
            "name": "useEditDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/adapter-antdv'\n\nexport function useEditDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '编辑', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ customerName: '', phone: '', level: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"customerName\",\n        \"label\": \"客户姓名\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"phone\",\n        \"label\": \"手机号\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"level\",\n        \"label\": \"客户等级\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"普通\",\n                \"value\": \"normal\"\n            },\n            {\n                \"label\": \"VIP\",\n                \"value\": \"vip\"\n            }\n        ]\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/customers' : `/api/customers/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          }
        ],
        "hostEntry": {
          "lang": "ts",
          "code": "// src/main.ts — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport { createApp } from 'vue'\nimport axios from 'axios'\nimport Antd from 'ant-design-vue'\nimport 'ant-design-vue/dist/reset.css'\nimport ESPlus from '@es-plus/adapter-antdv'\nimport '@es-plus/adapter-antdv/dist/style.css'\n\nconst app = createApp(App)\n\napp.use(Antd)\napp.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n\napp.mount('#app')\n"
        }
      }
    },
    {
      "id": "comp-form-dialog-01-vue2",
      "baseId": "comp-form-dialog-01",
      "shape": "form+dialog",
      "target": "vue2",
      "mode": "schema",
      "name": "CustomerSignup",
      "apiUrl": "/api/customers",
      "surfaces": {
        "form": [
          {
            "prop": "customerName",
            "label": "客户姓名",
            "formtype": "Input"
          },
          {
            "prop": "phone",
            "label": "手机号",
            "formtype": "Input"
          },
          {
            "prop": "level",
            "label": "客户等级",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "普通",
                "value": "normal"
              },
              {
                "label": "VIP",
                "value": "vip"
              }
            ]
          }
        ],
        "dialog": [
          "add",
          "edit"
        ]
      },
      "expect": {
        "dialogBlocks": [
          {
            "key": "add",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          },
          {
            "key": "edit",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          }
        ]
      },
      "facts": {
        "shape": "form+dialog",
        "dialogKeys": [
          "add",
          "edit"
        ],
        "dialogBlocks": [
          {
            "key": "add",
            "composable": "useAddDialog",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          },
          {
            "key": "edit",
            "composable": "useEditDialog",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          }
        ]
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "dialogKeys",
          "label": "弹窗块 key",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogFields",
          "label": "每个弹窗块的字段（= form 面）",
          "pass": true,
          "want": [
            "add: customerName, phone, level",
            "edit: customerName, phone, level"
          ],
          "got": [
            "add: customerName, phone, level",
            "edit: customerName, phone, level"
          ]
        },
        {
          "key": "composable",
          "label": "composable 命名（use<Key>Dialog）",
          "pass": true,
          "want": [
            "useAddDialog",
            "useEditDialog"
          ],
          "got": [
            "useAddDialog",
            "useEditDialog"
          ]
        }
      ],
      "warnings": [
        "target=vue2: 弹窗用 JSX render —— 需项目启用 @vue/babel-preset-jsx(或 @vitejs/plugin-vue2-jsx)。"
      ],
      "product": {
        "kind": "fragments",
        "fragments": [
          {
            "name": "useAddDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue2'\n\nexport function useAddDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '新增', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ customerName: '', phone: '', level: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"customerName\",\n        \"label\": \"客户姓名\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"phone\",\n        \"label\": \"手机号\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"level\",\n        \"label\": \"客户等级\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"普通\",\n                \"value\": \"normal\"\n            },\n            {\n                \"label\": \"VIP\",\n                \"value\": \"vip\"\n            }\n        ]\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/customers' : `/api/customers/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          },
          {
            "name": "useEditDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue2'\n\nexport function useEditDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '编辑', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ customerName: '', phone: '', level: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"customerName\",\n        \"label\": \"客户姓名\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"phone\",\n        \"label\": \"手机号\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"level\",\n        \"label\": \"客户等级\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"普通\",\n                \"value\": \"normal\"\n            },\n            {\n                \"label\": \"VIP\",\n                \"value\": \"vip\"\n            }\n        ]\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/customers' : `/api/customers/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          }
        ],
        "hostEntry": {
          "lang": "ts",
          "code": "// src/main.js — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport Vue from 'vue'\nimport ElementUI from 'element-ui'\nimport 'element-ui/lib/theme-chalk/index.css'\nimport axios from 'axios'\nimport ESPlus from '@es-plus/vue2'\nimport '@es-plus/vue2/dist/style.css'\n\nVue.use(ElementUI)\nVue.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n"
        }
      }
    },
    {
      "id": "comp-form-dialog-01-vue3",
      "baseId": "comp-form-dialog-01",
      "shape": "form+dialog",
      "target": "vue3",
      "mode": "schema",
      "name": "CustomerSignup",
      "apiUrl": "/api/customers",
      "surfaces": {
        "form": [
          {
            "prop": "customerName",
            "label": "客户姓名",
            "formtype": "Input"
          },
          {
            "prop": "phone",
            "label": "手机号",
            "formtype": "Input"
          },
          {
            "prop": "level",
            "label": "客户等级",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "普通",
                "value": "normal"
              },
              {
                "label": "VIP",
                "value": "vip"
              }
            ]
          }
        ],
        "dialog": [
          "add",
          "edit"
        ]
      },
      "expect": {
        "dialogBlocks": [
          {
            "key": "add",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          },
          {
            "key": "edit",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          }
        ]
      },
      "facts": {
        "shape": "form+dialog",
        "dialogKeys": [
          "add",
          "edit"
        ],
        "dialogBlocks": [
          {
            "key": "add",
            "composable": "useAddDialog",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          },
          {
            "key": "edit",
            "composable": "useEditDialog",
            "fields": [
              "customerName",
              "phone",
              "level"
            ]
          }
        ]
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "dialogKeys",
          "label": "弹窗块 key",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogFields",
          "label": "每个弹窗块的字段（= form 面）",
          "pass": true,
          "want": [
            "add: customerName, phone, level",
            "edit: customerName, phone, level"
          ],
          "got": [
            "add: customerName, phone, level",
            "edit: customerName, phone, level"
          ]
        },
        {
          "key": "composable",
          "label": "composable 命名（use<Key>Dialog）",
          "pass": true,
          "want": [
            "useAddDialog",
            "useEditDialog"
          ],
          "got": [
            "useAddDialog",
            "useEditDialog"
          ]
        }
      ],
      "warnings": [
        "target=vue3: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
      ],
      "product": {
        "kind": "fragments",
        "fragments": [
          {
            "name": "useAddDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue3'\n\nexport function useAddDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '新增', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ customerName: '', phone: '', level: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"customerName\",\n        \"label\": \"客户姓名\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"phone\",\n        \"label\": \"手机号\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"level\",\n        \"label\": \"客户等级\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"普通\",\n                \"value\": \"normal\"\n            },\n            {\n                \"label\": \"VIP\",\n                \"value\": \"vip\"\n            }\n        ]\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/customers' : `/api/customers/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          },
          {
            "name": "useEditDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue3'\n\nexport function useEditDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '编辑', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ customerName: '', phone: '', level: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"customerName\",\n        \"label\": \"客户姓名\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"phone\",\n        \"label\": \"手机号\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"level\",\n        \"label\": \"客户等级\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"普通\",\n                \"value\": \"normal\"\n            },\n            {\n                \"label\": \"VIP\",\n                \"value\": \"vip\"\n            }\n        ]\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/customers' : `/api/customers/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          }
        ],
        "hostEntry": {
          "lang": "ts",
          "code": "// src/main.ts — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport { createApp } from 'vue'\nimport axios from 'axios'\nimport ElementPlus from 'element-plus'\nimport 'element-plus/dist/index.css'\nimport ESPlus from '@es-plus/vue3'\nimport '@es-plus/vue3/dist/style.css'\n\nconst app = createApp(App)\n\napp.use(ElementPlus)\napp.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n\napp.mount('#app')\n"
        }
      }
    },
    {
      "id": "comp-form-dialog-02-antdv",
      "baseId": "comp-form-dialog-02",
      "shape": "form+dialog",
      "target": "antdv",
      "mode": "schema",
      "name": "TicketSubmit",
      "apiUrl": "/api/tickets",
      "surfaces": {
        "form": [
          {
            "prop": "title",
            "label": "标题",
            "formtype": "Input"
          },
          {
            "prop": "type",
            "label": "类型",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "故障",
                "value": "bug"
              },
              {
                "label": "需求",
                "value": "feature"
              }
            ]
          },
          {
            "prop": "description",
            "label": "描述",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "view"
        ]
      },
      "expect": {
        "dialogBlocks": [
          {
            "key": "add",
            "fields": [
              "title",
              "type",
              "description"
            ]
          },
          {
            "key": "view",
            "fields": [
              "title",
              "type",
              "description"
            ]
          }
        ]
      },
      "facts": {
        "shape": "form+dialog",
        "dialogKeys": [
          "add",
          "view"
        ],
        "dialogBlocks": [
          {
            "key": "add",
            "composable": "useAddDialog",
            "fields": [
              "title",
              "type",
              "description"
            ]
          },
          {
            "key": "view",
            "composable": "useViewDialog",
            "fields": [
              "title",
              "type",
              "description"
            ]
          }
        ]
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "dialogKeys",
          "label": "弹窗块 key",
          "pass": true,
          "want": [
            "add",
            "view"
          ],
          "got": [
            "add",
            "view"
          ]
        },
        {
          "key": "dialogFields",
          "label": "每个弹窗块的字段（= form 面）",
          "pass": true,
          "want": [
            "add: title, type, description",
            "view: title, type, description"
          ],
          "got": [
            "add: title, type, description",
            "view: title, type, description"
          ]
        },
        {
          "key": "composable",
          "label": "composable 命名（use<Key>Dialog）",
          "pass": true,
          "want": [
            "useAddDialog",
            "useViewDialog"
          ],
          "got": [
            "useAddDialog",
            "useViewDialog"
          ]
        }
      ],
      "warnings": [
        "target=antdv: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
      ],
      "product": {
        "kind": "fragments",
        "fragments": [
          {
            "name": "useAddDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/adapter-antdv'\n\nexport function useAddDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '新增', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ title: '', type: '', description: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"title\",\n        \"label\": \"标题\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"type\",\n        \"label\": \"类型\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"故障\",\n                \"value\": \"bug\"\n            },\n            {\n                \"label\": \"需求\",\n                \"value\": \"feature\"\n            }\n        ]\n    },\n    {\n        \"prop\": \"description\",\n        \"label\": \"描述\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n        }\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/tickets' : `/api/tickets/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          },
          {
            "name": "useViewDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/adapter-antdv'\n\nexport function useViewDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '查看', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ title: '', type: '', description: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"title\",\n        \"label\": \"标题\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"type\",\n        \"label\": \"类型\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"故障\",\n                \"value\": \"bug\"\n            },\n            {\n                \"label\": \"需求\",\n                \"value\": \"feature\"\n            }\n        ]\n    },\n    {\n        \"prop\": \"description\",\n        \"label\": \"描述\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n        }\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/tickets' : `/api/tickets/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          }
        ],
        "hostEntry": {
          "lang": "ts",
          "code": "// src/main.ts — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport { createApp } from 'vue'\nimport axios from 'axios'\nimport Antd from 'ant-design-vue'\nimport 'ant-design-vue/dist/reset.css'\nimport ESPlus from '@es-plus/adapter-antdv'\nimport '@es-plus/adapter-antdv/dist/style.css'\n\nconst app = createApp(App)\n\napp.use(Antd)\napp.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n\napp.mount('#app')\n"
        }
      }
    },
    {
      "id": "comp-form-dialog-02-vue2",
      "baseId": "comp-form-dialog-02",
      "shape": "form+dialog",
      "target": "vue2",
      "mode": "schema",
      "name": "TicketSubmit",
      "apiUrl": "/api/tickets",
      "surfaces": {
        "form": [
          {
            "prop": "title",
            "label": "标题",
            "formtype": "Input"
          },
          {
            "prop": "type",
            "label": "类型",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "故障",
                "value": "bug"
              },
              {
                "label": "需求",
                "value": "feature"
              }
            ]
          },
          {
            "prop": "description",
            "label": "描述",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "view"
        ]
      },
      "expect": {
        "dialogBlocks": [
          {
            "key": "add",
            "fields": [
              "title",
              "type",
              "description"
            ]
          },
          {
            "key": "view",
            "fields": [
              "title",
              "type",
              "description"
            ]
          }
        ]
      },
      "facts": {
        "shape": "form+dialog",
        "dialogKeys": [
          "add",
          "view"
        ],
        "dialogBlocks": [
          {
            "key": "add",
            "composable": "useAddDialog",
            "fields": [
              "title",
              "type",
              "description"
            ]
          },
          {
            "key": "view",
            "composable": "useViewDialog",
            "fields": [
              "title",
              "type",
              "description"
            ]
          }
        ]
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "dialogKeys",
          "label": "弹窗块 key",
          "pass": true,
          "want": [
            "add",
            "view"
          ],
          "got": [
            "add",
            "view"
          ]
        },
        {
          "key": "dialogFields",
          "label": "每个弹窗块的字段（= form 面）",
          "pass": true,
          "want": [
            "add: title, type, description",
            "view: title, type, description"
          ],
          "got": [
            "add: title, type, description",
            "view: title, type, description"
          ]
        },
        {
          "key": "composable",
          "label": "composable 命名（use<Key>Dialog）",
          "pass": true,
          "want": [
            "useAddDialog",
            "useViewDialog"
          ],
          "got": [
            "useAddDialog",
            "useViewDialog"
          ]
        }
      ],
      "warnings": [
        "target=vue2: 弹窗用 JSX render —— 需项目启用 @vue/babel-preset-jsx(或 @vitejs/plugin-vue2-jsx)。"
      ],
      "product": {
        "kind": "fragments",
        "fragments": [
          {
            "name": "useAddDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue2'\n\nexport function useAddDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '新增', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ title: '', type: '', description: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"title\",\n        \"label\": \"标题\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"type\",\n        \"label\": \"类型\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"故障\",\n                \"value\": \"bug\"\n            },\n            {\n                \"label\": \"需求\",\n                \"value\": \"feature\"\n            }\n        ]\n    },\n    {\n        \"prop\": \"description\",\n        \"label\": \"描述\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n        }\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/tickets' : `/api/tickets/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          },
          {
            "name": "useViewDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue2'\n\nexport function useViewDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '查看', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ title: '', type: '', description: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"title\",\n        \"label\": \"标题\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"type\",\n        \"label\": \"类型\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"故障\",\n                \"value\": \"bug\"\n            },\n            {\n                \"label\": \"需求\",\n                \"value\": \"feature\"\n            }\n        ]\n    },\n    {\n        \"prop\": \"description\",\n        \"label\": \"描述\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n        }\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/tickets' : `/api/tickets/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          }
        ],
        "hostEntry": {
          "lang": "ts",
          "code": "// src/main.js — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport Vue from 'vue'\nimport ElementUI from 'element-ui'\nimport 'element-ui/lib/theme-chalk/index.css'\nimport axios from 'axios'\nimport ESPlus from '@es-plus/vue2'\nimport '@es-plus/vue2/dist/style.css'\n\nVue.use(ElementUI)\nVue.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n"
        }
      }
    },
    {
      "id": "comp-form-dialog-02-vue3",
      "baseId": "comp-form-dialog-02",
      "shape": "form+dialog",
      "target": "vue3",
      "mode": "schema",
      "name": "TicketSubmit",
      "apiUrl": "/api/tickets",
      "surfaces": {
        "form": [
          {
            "prop": "title",
            "label": "标题",
            "formtype": "Input"
          },
          {
            "prop": "type",
            "label": "类型",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "故障",
                "value": "bug"
              },
              {
                "label": "需求",
                "value": "feature"
              }
            ]
          },
          {
            "prop": "description",
            "label": "描述",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "view"
        ]
      },
      "expect": {
        "dialogBlocks": [
          {
            "key": "add",
            "fields": [
              "title",
              "type",
              "description"
            ]
          },
          {
            "key": "view",
            "fields": [
              "title",
              "type",
              "description"
            ]
          }
        ]
      },
      "facts": {
        "shape": "form+dialog",
        "dialogKeys": [
          "add",
          "view"
        ],
        "dialogBlocks": [
          {
            "key": "add",
            "composable": "useAddDialog",
            "fields": [
              "title",
              "type",
              "description"
            ]
          },
          {
            "key": "view",
            "composable": "useViewDialog",
            "fields": [
              "title",
              "type",
              "description"
            ]
          }
        ]
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "dialogKeys",
          "label": "弹窗块 key",
          "pass": true,
          "want": [
            "add",
            "view"
          ],
          "got": [
            "add",
            "view"
          ]
        },
        {
          "key": "dialogFields",
          "label": "每个弹窗块的字段（= form 面）",
          "pass": true,
          "want": [
            "add: title, type, description",
            "view: title, type, description"
          ],
          "got": [
            "add: title, type, description",
            "view: title, type, description"
          ]
        },
        {
          "key": "composable",
          "label": "composable 命名（use<Key>Dialog）",
          "pass": true,
          "want": [
            "useAddDialog",
            "useViewDialog"
          ],
          "got": [
            "useAddDialog",
            "useViewDialog"
          ]
        }
      ],
      "warnings": [
        "target=vue3: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
      ],
      "product": {
        "kind": "fragments",
        "fragments": [
          {
            "name": "useAddDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue3'\n\nexport function useAddDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '新增', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ title: '', type: '', description: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"title\",\n        \"label\": \"标题\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"type\",\n        \"label\": \"类型\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"故障\",\n                \"value\": \"bug\"\n            },\n            {\n                \"label\": \"需求\",\n                \"value\": \"feature\"\n            }\n        ]\n    },\n    {\n        \"prop\": \"description\",\n        \"label\": \"描述\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n        }\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/tickets' : `/api/tickets/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          },
          {
            "name": "useViewDialog",
            "lang": "tsx",
            "code": "import { reactive } from 'vue'\nimport { useDialog, EsForm, httpRequest } from '@es-plus/vue3'\n\nexport function useViewDialog() {\n  const dialog = useDialog()\n\n  function open(title: string = '查看', row: any = {}, onSuccess?: (data: any) => void) {\n    const formData = reactive({ title: '', type: '', description: '', ...row })\n    const isView = title === '查看'\n\n    const formItems = [\n    {\n        \"prop\": \"title\",\n        \"label\": \"标题\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        }\n    },\n    {\n        \"prop\": \"type\",\n        \"label\": \"类型\",\n        \"formtype\": \"Select\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true\n        },\n        \"dataOptions\": [\n            {\n                \"label\": \"故障\",\n                \"value\": \"bug\"\n            },\n            {\n                \"label\": \"需求\",\n                \"value\": \"feature\"\n            }\n        ]\n    },\n    {\n        \"prop\": \"description\",\n        \"label\": \"描述\",\n        \"formtype\": \"Input\",\n        \"span\": 24,\n        \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n        }\n    }\n]\n\n    dialog({\n      title,\n      width: '560px',\n      render: (h, { registerRef }) => (\n        <EsForm\n          ref={el => el && registerRef('form', el)}\n          model={formData}\n          formItemList={formItems}\n          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}\n        />\n      ),\n      configBtn: isView ? [\n        { name: '关闭', click: (_, { close }) => close() }\n      ] : [\n        { name: '取消', click: (_, { close }) => close() },\n        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {\n          try {\n            await getRefs('form')?.validate()\n          } catch {\n            return // 校验未通过:静默中止,等用户修正\n          }\n          const method = title === '新增' ? 'POST' : 'PUT'\n          const url = title === '新增' ? '/api/tickets' : `/api/tickets/${formData.id}`\n          await httpRequest({ url, method, data: formData })\n          close()\n          onSuccess?.(formData)\n        } }\n      ]\n    })\n  }\n\n  return { open }\n}\n"
          }
        ],
        "hostEntry": {
          "lang": "ts",
          "code": "// src/main.ts — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）\nimport { createApp } from 'vue'\nimport axios from 'axios'\nimport ElementPlus from 'element-plus'\nimport 'element-plus/dist/index.css'\nimport ESPlus from '@es-plus/vue3'\nimport '@es-plus/vue3/dist/style.css'\n\nconst app = createApp(App)\n\napp.use(ElementPlus)\napp.use(ESPlus, {\n  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提\n  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）\n  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提\n})\n\napp.mount('#app')\n"
        }
      }
    },
    {
      "id": "comp-full-01-antdv",
      "baseId": "comp-full-01",
      "shape": "full",
      "target": "antdv",
      "mode": "schema",
      "name": "UserManage",
      "apiUrl": "/api/users",
      "surfaces": {
        "query": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          }
        ],
        "table": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          },
          {
            "prop": "createdAt",
            "label": "创建时间",
            "formtype": "DatePicker"
          }
        ],
        "form": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "edit"
        ]
      },
      "expect": {
        "membership": {
          "name": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [
          "add",
          "edit"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "facts": {
        "shape": "full",
        "membership": {
          "name": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [
          "add",
          "edit"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "full",
          "got": "full"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "name": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "name": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": false,
          "got": false
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "formItems": [
            {
              "prop": "name",
              "label": "姓名",
              "formtype": "Input",
              "span": 6,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "status",
              "label": "状态",
              "formtype": "Select",
              "span": 6,
              "attrs": {
                "clearable": true
              },
              "dataOptions": [
                {
                  "label": "启用",
                  "value": 1
                },
                {
                  "label": "禁用",
                  "value": 0
                }
              ]
            }
          ],
          "columns": [
            {
              "prop": "name",
              "label": "姓名"
            },
            {
              "prop": "status",
              "label": "状态",
              "dataOptions": [
                {
                  "label": "启用",
                  "value": 1
                },
                {
                  "label": "禁用",
                  "value": 0
                }
              ]
            },
            {
              "prop": "createdAt",
              "label": "创建时间"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/users"
            },
            "rowkey": "id"
          },
          "dialogs": {
            "add": {
              "title": "新增",
              "formItems": [
                {
                  "prop": "name",
                  "label": "姓名",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "启用",
                      "value": 1
                    },
                    {
                      "label": "禁用",
                      "value": 0
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "edit": {
              "title": "编辑",
              "formItems": [
                {
                  "prop": "name",
                  "label": "姓名",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "启用",
                      "value": 1
                    },
                    {
                      "label": "禁用",
                      "value": 0
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            }
          },
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"name\",\n      \"label\": \"姓名\",\n      \"formtype\": \"Input\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"formtype\": \"Select\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      },\n      \"dataOptions\": [\n        {\n          \"label\": \"启用\",\n          \"value\": 1\n        },\n        {\n          \"label\": \"禁用\",\n          \"value\": 0\n        }\n      ]\n    }\n  ],\n  \"columns\": [\n    {\n      \"prop\": \"name\",\n      \"label\": \"姓名\"\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"dataOptions\": [\n        {\n          \"label\": \"启用\",\n          \"value\": 1\n        },\n        {\n          \"label\": \"禁用\",\n          \"value\": 0\n        }\n      ]\n    },\n    {\n      \"prop\": \"createdAt\",\n      \"label\": \"创建时间\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/users\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogs\": {\n    \"add\": {\n      \"title\": \"新增\",\n      \"formItems\": [\n        {\n          \"prop\": \"name\",\n          \"label\": \"姓名\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"启用\",\n              \"value\": 1\n            },\n            {\n              \"label\": \"禁用\",\n              \"value\": 0\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"edit\": {\n      \"title\": \"编辑\",\n      \"formItems\": [\n        {\n          \"prop\": \"name\",\n          \"label\": \"姓名\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"启用\",\n              \"value\": 1\n            },\n            {\n              \"label\": \"禁用\",\n              \"value\": 0\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    }\n  },\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-full-01-vue2",
      "baseId": "comp-full-01",
      "shape": "full",
      "target": "vue2",
      "mode": "schema",
      "name": "UserManage",
      "apiUrl": "/api/users",
      "surfaces": {
        "query": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          }
        ],
        "table": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          },
          {
            "prop": "createdAt",
            "label": "创建时间",
            "formtype": "DatePicker"
          }
        ],
        "form": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "edit"
        ]
      },
      "expect": {
        "membership": {
          "name": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [
          "add",
          "edit"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "facts": {
        "shape": "full",
        "membership": {
          "name": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [
          "add",
          "edit"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "full",
          "got": "full"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "name": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "name": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": false,
          "got": false
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "formItems": [
            {
              "prop": "name",
              "label": "姓名",
              "formtype": "Input",
              "span": 6,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "status",
              "label": "状态",
              "formtype": "Select",
              "span": 6,
              "attrs": {
                "clearable": true
              },
              "dataOptions": [
                {
                  "label": "启用",
                  "value": 1
                },
                {
                  "label": "禁用",
                  "value": 0
                }
              ]
            }
          ],
          "columns": [
            {
              "prop": "name",
              "label": "姓名"
            },
            {
              "prop": "status",
              "label": "状态",
              "dataOptions": [
                {
                  "label": "启用",
                  "value": 1
                },
                {
                  "label": "禁用",
                  "value": 0
                }
              ]
            },
            {
              "prop": "createdAt",
              "label": "创建时间"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/users"
            },
            "rowkey": "id"
          },
          "dialogs": {
            "add": {
              "title": "新增",
              "formItems": [
                {
                  "prop": "name",
                  "label": "姓名",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "启用",
                      "value": 1
                    },
                    {
                      "label": "禁用",
                      "value": 0
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "edit": {
              "title": "编辑",
              "formItems": [
                {
                  "prop": "name",
                  "label": "姓名",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "启用",
                      "value": 1
                    },
                    {
                      "label": "禁用",
                      "value": 0
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            }
          },
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"name\",\n      \"label\": \"姓名\",\n      \"formtype\": \"Input\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"formtype\": \"Select\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      },\n      \"dataOptions\": [\n        {\n          \"label\": \"启用\",\n          \"value\": 1\n        },\n        {\n          \"label\": \"禁用\",\n          \"value\": 0\n        }\n      ]\n    }\n  ],\n  \"columns\": [\n    {\n      \"prop\": \"name\",\n      \"label\": \"姓名\"\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"dataOptions\": [\n        {\n          \"label\": \"启用\",\n          \"value\": 1\n        },\n        {\n          \"label\": \"禁用\",\n          \"value\": 0\n        }\n      ]\n    },\n    {\n      \"prop\": \"createdAt\",\n      \"label\": \"创建时间\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/users\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogs\": {\n    \"add\": {\n      \"title\": \"新增\",\n      \"formItems\": [\n        {\n          \"prop\": \"name\",\n          \"label\": \"姓名\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"启用\",\n              \"value\": 1\n            },\n            {\n              \"label\": \"禁用\",\n              \"value\": 0\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"edit\": {\n      \"title\": \"编辑\",\n      \"formItems\": [\n        {\n          \"prop\": \"name\",\n          \"label\": \"姓名\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"启用\",\n              \"value\": 1\n            },\n            {\n              \"label\": \"禁用\",\n              \"value\": 0\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    }\n  },\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-full-01-vue3",
      "baseId": "comp-full-01",
      "shape": "full",
      "target": "vue3",
      "mode": "schema",
      "name": "UserManage",
      "apiUrl": "/api/users",
      "surfaces": {
        "query": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          }
        ],
        "table": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          },
          {
            "prop": "createdAt",
            "label": "创建时间",
            "formtype": "DatePicker"
          }
        ],
        "form": [
          {
            "prop": "name",
            "label": "姓名",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "启用",
                "value": 1
              },
              {
                "label": "禁用",
                "value": 0
              }
            ]
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "edit"
        ]
      },
      "expect": {
        "membership": {
          "name": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [
          "add",
          "edit"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "facts": {
        "shape": "full",
        "membership": {
          "name": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [
          "add",
          "edit"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "full",
          "got": "full"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "name": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "name": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": false,
          "got": false
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "formItems": [
            {
              "prop": "name",
              "label": "姓名",
              "formtype": "Input",
              "span": 6,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "status",
              "label": "状态",
              "formtype": "Select",
              "span": 6,
              "attrs": {
                "clearable": true
              },
              "dataOptions": [
                {
                  "label": "启用",
                  "value": 1
                },
                {
                  "label": "禁用",
                  "value": 0
                }
              ]
            }
          ],
          "columns": [
            {
              "prop": "name",
              "label": "姓名"
            },
            {
              "prop": "status",
              "label": "状态",
              "dataOptions": [
                {
                  "label": "启用",
                  "value": 1
                },
                {
                  "label": "禁用",
                  "value": 0
                }
              ]
            },
            {
              "prop": "createdAt",
              "label": "创建时间"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/users"
            },
            "rowkey": "id"
          },
          "dialogs": {
            "add": {
              "title": "新增",
              "formItems": [
                {
                  "prop": "name",
                  "label": "姓名",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "启用",
                      "value": 1
                    },
                    {
                      "label": "禁用",
                      "value": 0
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "edit": {
              "title": "编辑",
              "formItems": [
                {
                  "prop": "name",
                  "label": "姓名",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "启用",
                      "value": 1
                    },
                    {
                      "label": "禁用",
                      "value": 0
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            }
          },
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"name\",\n      \"label\": \"姓名\",\n      \"formtype\": \"Input\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"formtype\": \"Select\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      },\n      \"dataOptions\": [\n        {\n          \"label\": \"启用\",\n          \"value\": 1\n        },\n        {\n          \"label\": \"禁用\",\n          \"value\": 0\n        }\n      ]\n    }\n  ],\n  \"columns\": [\n    {\n      \"prop\": \"name\",\n      \"label\": \"姓名\"\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"dataOptions\": [\n        {\n          \"label\": \"启用\",\n          \"value\": 1\n        },\n        {\n          \"label\": \"禁用\",\n          \"value\": 0\n        }\n      ]\n    },\n    {\n      \"prop\": \"createdAt\",\n      \"label\": \"创建时间\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/users\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogs\": {\n    \"add\": {\n      \"title\": \"新增\",\n      \"formItems\": [\n        {\n          \"prop\": \"name\",\n          \"label\": \"姓名\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"启用\",\n              \"value\": 1\n            },\n            {\n              \"label\": \"禁用\",\n              \"value\": 0\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"edit\": {\n      \"title\": \"编辑\",\n      \"formItems\": [\n        {\n          \"prop\": \"name\",\n          \"label\": \"姓名\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"启用\",\n              \"value\": 1\n            },\n            {\n              \"label\": \"禁用\",\n              \"value\": 0\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    }\n  },\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-full-02-antdv",
      "baseId": "comp-full-02",
      "shape": "full",
      "target": "antdv",
      "mode": "schema",
      "name": "OrderManage",
      "apiUrl": "/api/orders",
      "surfaces": {
        "query": [
          {
            "prop": "orderNo",
            "label": "订单号",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          }
        ],
        "table": [
          {
            "prop": "orderNo",
            "label": "订单号",
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
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          },
          {
            "prop": "createdAt",
            "label": "下单时间",
            "formtype": "DatePicker"
          }
        ],
        "form": [
          {
            "prop": "orderNo",
            "label": "订单号",
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
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "edit",
          "view"
        ]
      },
      "expect": {
        "membership": {
          "orderNo": [
            "query",
            "table",
            "form"
          ],
          "amount": [
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit",
          "view"
        ],
        "dialogKeys": [
          "add",
          "edit",
          "view"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "facts": {
        "shape": "full",
        "membership": {
          "orderNo": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "amount": [
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit",
          "view"
        ],
        "dialogKeys": [
          "add",
          "edit",
          "view"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "full",
          "got": "full"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "orderNo": [
              "query",
              "table",
              "form"
            ],
            "amount": [
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "orderNo": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "amount": [
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit",
            "view"
          ],
          "got": [
            "add",
            "edit",
            "view"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [
            "add",
            "edit",
            "view"
          ],
          "got": [
            "add",
            "edit",
            "view"
          ]
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": false,
          "got": false
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "formItems": [
            {
              "prop": "orderNo",
              "label": "订单号",
              "formtype": "Input",
              "span": 6,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "status",
              "label": "状态",
              "formtype": "Select",
              "span": 6,
              "attrs": {
                "clearable": true
              },
              "dataOptions": [
                {
                  "label": "待付款",
                  "value": "pending"
                },
                {
                  "label": "已完成",
                  "value": "done"
                }
              ]
            }
          ],
          "columns": [
            {
              "prop": "orderNo",
              "label": "订单号"
            },
            {
              "prop": "status",
              "label": "状态",
              "dataOptions": [
                {
                  "label": "待付款",
                  "value": "pending"
                },
                {
                  "label": "已完成",
                  "value": "done"
                }
              ]
            },
            {
              "prop": "amount",
              "label": "金额"
            },
            {
              "prop": "createdAt",
              "label": "下单时间"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/orders"
            },
            "rowkey": "id"
          },
          "dialogs": {
            "add": {
              "title": "新增",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "edit": {
              "title": "编辑",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "view": {
              "title": "查看",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            }
          },
          "actions": [
            "add",
            "edit",
            "view"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"orderNo\",\n      \"label\": \"订单号\",\n      \"formtype\": \"Input\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"formtype\": \"Select\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      },\n      \"dataOptions\": [\n        {\n          \"label\": \"待付款\",\n          \"value\": \"pending\"\n        },\n        {\n          \"label\": \"已完成\",\n          \"value\": \"done\"\n        }\n      ]\n    }\n  ],\n  \"columns\": [\n    {\n      \"prop\": \"orderNo\",\n      \"label\": \"订单号\"\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"dataOptions\": [\n        {\n          \"label\": \"待付款\",\n          \"value\": \"pending\"\n        },\n        {\n          \"label\": \"已完成\",\n          \"value\": \"done\"\n        }\n      ]\n    },\n    {\n      \"prop\": \"amount\",\n      \"label\": \"金额\"\n    },\n    {\n      \"prop\": \"createdAt\",\n      \"label\": \"下单时间\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/orders\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogs\": {\n    \"add\": {\n      \"title\": \"新增\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"edit\": {\n      \"title\": \"编辑\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"view\": {\n      \"title\": \"查看\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    }\n  },\n  \"actions\": [\n    \"add\",\n    \"edit\",\n    \"view\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-full-02-vue2",
      "baseId": "comp-full-02",
      "shape": "full",
      "target": "vue2",
      "mode": "schema",
      "name": "OrderManage",
      "apiUrl": "/api/orders",
      "surfaces": {
        "query": [
          {
            "prop": "orderNo",
            "label": "订单号",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          }
        ],
        "table": [
          {
            "prop": "orderNo",
            "label": "订单号",
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
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          },
          {
            "prop": "createdAt",
            "label": "下单时间",
            "formtype": "DatePicker"
          }
        ],
        "form": [
          {
            "prop": "orderNo",
            "label": "订单号",
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
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "edit",
          "view"
        ]
      },
      "expect": {
        "membership": {
          "orderNo": [
            "query",
            "table",
            "form"
          ],
          "amount": [
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit",
          "view"
        ],
        "dialogKeys": [
          "add",
          "edit",
          "view"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "facts": {
        "shape": "full",
        "membership": {
          "orderNo": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "amount": [
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit",
          "view"
        ],
        "dialogKeys": [
          "add",
          "edit",
          "view"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "full",
          "got": "full"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "orderNo": [
              "query",
              "table",
              "form"
            ],
            "amount": [
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "orderNo": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "amount": [
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit",
            "view"
          ],
          "got": [
            "add",
            "edit",
            "view"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [
            "add",
            "edit",
            "view"
          ],
          "got": [
            "add",
            "edit",
            "view"
          ]
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": false,
          "got": false
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "formItems": [
            {
              "prop": "orderNo",
              "label": "订单号",
              "formtype": "Input",
              "span": 6,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "status",
              "label": "状态",
              "formtype": "Select",
              "span": 6,
              "attrs": {
                "clearable": true
              },
              "dataOptions": [
                {
                  "label": "待付款",
                  "value": "pending"
                },
                {
                  "label": "已完成",
                  "value": "done"
                }
              ]
            }
          ],
          "columns": [
            {
              "prop": "orderNo",
              "label": "订单号"
            },
            {
              "prop": "status",
              "label": "状态",
              "dataOptions": [
                {
                  "label": "待付款",
                  "value": "pending"
                },
                {
                  "label": "已完成",
                  "value": "done"
                }
              ]
            },
            {
              "prop": "amount",
              "label": "金额"
            },
            {
              "prop": "createdAt",
              "label": "下单时间"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/orders"
            },
            "rowkey": "id"
          },
          "dialogs": {
            "add": {
              "title": "新增",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "edit": {
              "title": "编辑",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "view": {
              "title": "查看",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            }
          },
          "actions": [
            "add",
            "edit",
            "view"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"orderNo\",\n      \"label\": \"订单号\",\n      \"formtype\": \"Input\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"formtype\": \"Select\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      },\n      \"dataOptions\": [\n        {\n          \"label\": \"待付款\",\n          \"value\": \"pending\"\n        },\n        {\n          \"label\": \"已完成\",\n          \"value\": \"done\"\n        }\n      ]\n    }\n  ],\n  \"columns\": [\n    {\n      \"prop\": \"orderNo\",\n      \"label\": \"订单号\"\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"dataOptions\": [\n        {\n          \"label\": \"待付款\",\n          \"value\": \"pending\"\n        },\n        {\n          \"label\": \"已完成\",\n          \"value\": \"done\"\n        }\n      ]\n    },\n    {\n      \"prop\": \"amount\",\n      \"label\": \"金额\"\n    },\n    {\n      \"prop\": \"createdAt\",\n      \"label\": \"下单时间\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/orders\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogs\": {\n    \"add\": {\n      \"title\": \"新增\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"edit\": {\n      \"title\": \"编辑\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"view\": {\n      \"title\": \"查看\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    }\n  },\n  \"actions\": [\n    \"add\",\n    \"edit\",\n    \"view\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-full-02-vue3",
      "baseId": "comp-full-02",
      "shape": "full",
      "target": "vue3",
      "mode": "schema",
      "name": "OrderManage",
      "apiUrl": "/api/orders",
      "surfaces": {
        "query": [
          {
            "prop": "orderNo",
            "label": "订单号",
            "formtype": "Input"
          },
          {
            "prop": "status",
            "label": "状态",
            "formtype": "Select",
            "dataOptions": [
              {
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          }
        ],
        "table": [
          {
            "prop": "orderNo",
            "label": "订单号",
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
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          },
          {
            "prop": "createdAt",
            "label": "下单时间",
            "formtype": "DatePicker"
          }
        ],
        "form": [
          {
            "prop": "orderNo",
            "label": "订单号",
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
                "label": "待付款",
                "value": "pending"
              },
              {
                "label": "已完成",
                "value": "done"
              }
            ]
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ],
        "dialog": [
          "add",
          "edit",
          "view"
        ]
      },
      "expect": {
        "membership": {
          "orderNo": [
            "query",
            "table",
            "form"
          ],
          "amount": [
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit",
          "view"
        ],
        "dialogKeys": [
          "add",
          "edit",
          "view"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "facts": {
        "shape": "full",
        "membership": {
          "orderNo": [
            "query",
            "table",
            "form"
          ],
          "status": [
            "query",
            "table",
            "form"
          ],
          "amount": [
            "table",
            "form"
          ],
          "createdAt": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit",
          "view"
        ],
        "dialogKeys": [
          "add",
          "edit",
          "view"
        ],
        "legacyDialogFormItems": false,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "full",
          "got": "full"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "orderNo": [
              "query",
              "table",
              "form"
            ],
            "amount": [
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "orderNo": [
              "query",
              "table",
              "form"
            ],
            "status": [
              "query",
              "table",
              "form"
            ],
            "amount": [
              "table",
              "form"
            ],
            "createdAt": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit",
            "view"
          ],
          "got": [
            "add",
            "edit",
            "view"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [
            "add",
            "edit",
            "view"
          ],
          "got": [
            "add",
            "edit",
            "view"
          ]
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": false,
          "got": false
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "formItems": [
            {
              "prop": "orderNo",
              "label": "订单号",
              "formtype": "Input",
              "span": 6,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "status",
              "label": "状态",
              "formtype": "Select",
              "span": 6,
              "attrs": {
                "clearable": true
              },
              "dataOptions": [
                {
                  "label": "待付款",
                  "value": "pending"
                },
                {
                  "label": "已完成",
                  "value": "done"
                }
              ]
            }
          ],
          "columns": [
            {
              "prop": "orderNo",
              "label": "订单号"
            },
            {
              "prop": "status",
              "label": "状态",
              "dataOptions": [
                {
                  "label": "待付款",
                  "value": "pending"
                },
                {
                  "label": "已完成",
                  "value": "done"
                }
              ]
            },
            {
              "prop": "amount",
              "label": "金额"
            },
            {
              "prop": "createdAt",
              "label": "下单时间"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/orders"
            },
            "rowkey": "id"
          },
          "dialogs": {
            "add": {
              "title": "新增",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "edit": {
              "title": "编辑",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            },
            "view": {
              "title": "查看",
              "formItems": [
                {
                  "prop": "orderNo",
                  "label": "订单号",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "amount",
                  "label": "金额",
                  "formtype": "InputNumber",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  }
                },
                {
                  "prop": "status",
                  "label": "状态",
                  "formtype": "Select",
                  "span": 24,
                  "attrs": {
                    "clearable": true
                  },
                  "dataOptions": [
                    {
                      "label": "待付款",
                      "value": "pending"
                    },
                    {
                      "label": "已完成",
                      "value": "done"
                    }
                  ]
                },
                {
                  "prop": "remark",
                  "label": "备注",
                  "formtype": "Input",
                  "span": 24,
                  "attrs": {
                    "clearable": true,
                    "type": "textarea"
                  }
                }
              ]
            }
          },
          "actions": [
            "add",
            "edit",
            "view"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"formItems\": [\n    {\n      \"prop\": \"orderNo\",\n      \"label\": \"订单号\",\n      \"formtype\": \"Input\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"formtype\": \"Select\",\n      \"span\": 6,\n      \"attrs\": {\n        \"clearable\": true\n      },\n      \"dataOptions\": [\n        {\n          \"label\": \"待付款\",\n          \"value\": \"pending\"\n        },\n        {\n          \"label\": \"已完成\",\n          \"value\": \"done\"\n        }\n      ]\n    }\n  ],\n  \"columns\": [\n    {\n      \"prop\": \"orderNo\",\n      \"label\": \"订单号\"\n    },\n    {\n      \"prop\": \"status\",\n      \"label\": \"状态\",\n      \"dataOptions\": [\n        {\n          \"label\": \"待付款\",\n          \"value\": \"pending\"\n        },\n        {\n          \"label\": \"已完成\",\n          \"value\": \"done\"\n        }\n      ]\n    },\n    {\n      \"prop\": \"amount\",\n      \"label\": \"金额\"\n    },\n    {\n      \"prop\": \"createdAt\",\n      \"label\": \"下单时间\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/orders\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogs\": {\n    \"add\": {\n      \"title\": \"新增\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"edit\": {\n      \"title\": \"编辑\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    },\n    \"view\": {\n      \"title\": \"查看\",\n      \"formItems\": [\n        {\n          \"prop\": \"orderNo\",\n          \"label\": \"订单号\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"amount\",\n          \"label\": \"金额\",\n          \"formtype\": \"InputNumber\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          }\n        },\n        {\n          \"prop\": \"status\",\n          \"label\": \"状态\",\n          \"formtype\": \"Select\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true\n          },\n          \"dataOptions\": [\n            {\n              \"label\": \"待付款\",\n              \"value\": \"pending\"\n            },\n            {\n              \"label\": \"已完成\",\n              \"value\": \"done\"\n            }\n          ]\n        },\n        {\n          \"prop\": \"remark\",\n          \"label\": \"备注\",\n          \"formtype\": \"Input\",\n          \"span\": 24,\n          \"attrs\": {\n            \"clearable\": true,\n            \"type\": \"textarea\"\n          }\n        }\n      ]\n    }\n  },\n  \"actions\": [\n    \"add\",\n    \"edit\",\n    \"view\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-table-form-01-antdv",
      "baseId": "comp-table-form-01",
      "shape": "table+form",
      "target": "antdv",
      "mode": "schema",
      "name": "DeptManage",
      "apiUrl": "/api/depts",
      "surfaces": {
        "table": [
          {
            "prop": "deptName",
            "label": "部门名称",
            "formtype": "Input"
          },
          {
            "prop": "leader",
            "label": "负责人",
            "formtype": "Input"
          },
          {
            "prop": "memberCount",
            "label": "人数",
            "formtype": "InputNumber"
          }
        ],
        "form": [
          {
            "prop": "deptName",
            "label": "部门名称",
            "formtype": "Input"
          },
          {
            "prop": "leader",
            "label": "负责人",
            "formtype": "Input"
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ]
      },
      "expect": {
        "membership": {
          "deptName": [
            "table",
            "form"
          ],
          "leader": [
            "table",
            "form"
          ],
          "memberCount": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "facts": {
        "shape": "table+form",
        "membership": {
          "deptName": [
            "table",
            "form"
          ],
          "leader": [
            "table",
            "form"
          ],
          "memberCount": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "table+form",
          "got": "table+form"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "deptName": [
              "table",
              "form"
            ],
            "leader": [
              "table",
              "form"
            ],
            "memberCount": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "deptName": [
              "table",
              "form"
            ],
            "leader": [
              "table",
              "form"
            ],
            "memberCount": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": true,
          "got": true
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "columns": [
            {
              "prop": "deptName",
              "label": "部门名称"
            },
            {
              "prop": "leader",
              "label": "负责人"
            },
            {
              "prop": "memberCount",
              "label": "人数"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/depts"
            },
            "rowkey": "id"
          },
          "dialogFormItems": [
            {
              "prop": "deptName",
              "label": "部门名称",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "leader",
              "label": "负责人",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "remark",
              "label": "备注",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true,
                "type": "textarea"
              }
            }
          ],
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"columns\": [\n    {\n      \"prop\": \"deptName\",\n      \"label\": \"部门名称\"\n    },\n    {\n      \"prop\": \"leader\",\n      \"label\": \"负责人\"\n    },\n    {\n      \"prop\": \"memberCount\",\n      \"label\": \"人数\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/depts\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogFormItems\": [\n    {\n      \"prop\": \"deptName\",\n      \"label\": \"部门名称\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"leader\",\n      \"label\": \"负责人\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"remark\",\n      \"label\": \"备注\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true,\n        \"type\": \"textarea\"\n      }\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-table-form-01-vue2",
      "baseId": "comp-table-form-01",
      "shape": "table+form",
      "target": "vue2",
      "mode": "schema",
      "name": "DeptManage",
      "apiUrl": "/api/depts",
      "surfaces": {
        "table": [
          {
            "prop": "deptName",
            "label": "部门名称",
            "formtype": "Input"
          },
          {
            "prop": "leader",
            "label": "负责人",
            "formtype": "Input"
          },
          {
            "prop": "memberCount",
            "label": "人数",
            "formtype": "InputNumber"
          }
        ],
        "form": [
          {
            "prop": "deptName",
            "label": "部门名称",
            "formtype": "Input"
          },
          {
            "prop": "leader",
            "label": "负责人",
            "formtype": "Input"
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ]
      },
      "expect": {
        "membership": {
          "deptName": [
            "table",
            "form"
          ],
          "leader": [
            "table",
            "form"
          ],
          "memberCount": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "facts": {
        "shape": "table+form",
        "membership": {
          "deptName": [
            "table",
            "form"
          ],
          "leader": [
            "table",
            "form"
          ],
          "memberCount": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "table+form",
          "got": "table+form"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "deptName": [
              "table",
              "form"
            ],
            "leader": [
              "table",
              "form"
            ],
            "memberCount": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "deptName": [
              "table",
              "form"
            ],
            "leader": [
              "table",
              "form"
            ],
            "memberCount": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": true,
          "got": true
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "columns": [
            {
              "prop": "deptName",
              "label": "部门名称"
            },
            {
              "prop": "leader",
              "label": "负责人"
            },
            {
              "prop": "memberCount",
              "label": "人数"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/depts"
            },
            "rowkey": "id"
          },
          "dialogFormItems": [
            {
              "prop": "deptName",
              "label": "部门名称",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "leader",
              "label": "负责人",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "remark",
              "label": "备注",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true,
                "type": "textarea"
              }
            }
          ],
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"columns\": [\n    {\n      \"prop\": \"deptName\",\n      \"label\": \"部门名称\"\n    },\n    {\n      \"prop\": \"leader\",\n      \"label\": \"负责人\"\n    },\n    {\n      \"prop\": \"memberCount\",\n      \"label\": \"人数\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/depts\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogFormItems\": [\n    {\n      \"prop\": \"deptName\",\n      \"label\": \"部门名称\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"leader\",\n      \"label\": \"负责人\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"remark\",\n      \"label\": \"备注\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true,\n        \"type\": \"textarea\"\n      }\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-table-form-01-vue3",
      "baseId": "comp-table-form-01",
      "shape": "table+form",
      "target": "vue3",
      "mode": "schema",
      "name": "DeptManage",
      "apiUrl": "/api/depts",
      "surfaces": {
        "table": [
          {
            "prop": "deptName",
            "label": "部门名称",
            "formtype": "Input"
          },
          {
            "prop": "leader",
            "label": "负责人",
            "formtype": "Input"
          },
          {
            "prop": "memberCount",
            "label": "人数",
            "formtype": "InputNumber"
          }
        ],
        "form": [
          {
            "prop": "deptName",
            "label": "部门名称",
            "formtype": "Input"
          },
          {
            "prop": "leader",
            "label": "负责人",
            "formtype": "Input"
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ]
      },
      "expect": {
        "membership": {
          "deptName": [
            "table",
            "form"
          ],
          "leader": [
            "table",
            "form"
          ],
          "memberCount": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "facts": {
        "shape": "table+form",
        "membership": {
          "deptName": [
            "table",
            "form"
          ],
          "leader": [
            "table",
            "form"
          ],
          "memberCount": [
            "table"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "table+form",
          "got": "table+form"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "deptName": [
              "table",
              "form"
            ],
            "leader": [
              "table",
              "form"
            ],
            "memberCount": [
              "table"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "deptName": [
              "table",
              "form"
            ],
            "leader": [
              "table",
              "form"
            ],
            "memberCount": [
              "table"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": true,
          "got": true
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "columns": [
            {
              "prop": "deptName",
              "label": "部门名称"
            },
            {
              "prop": "leader",
              "label": "负责人"
            },
            {
              "prop": "memberCount",
              "label": "人数"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/depts"
            },
            "rowkey": "id"
          },
          "dialogFormItems": [
            {
              "prop": "deptName",
              "label": "部门名称",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "leader",
              "label": "负责人",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "remark",
              "label": "备注",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true,
                "type": "textarea"
              }
            }
          ],
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"columns\": [\n    {\n      \"prop\": \"deptName\",\n      \"label\": \"部门名称\"\n    },\n    {\n      \"prop\": \"leader\",\n      \"label\": \"负责人\"\n    },\n    {\n      \"prop\": \"memberCount\",\n      \"label\": \"人数\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/depts\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogFormItems\": [\n    {\n      \"prop\": \"deptName\",\n      \"label\": \"部门名称\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"leader\",\n      \"label\": \"负责人\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"remark\",\n      \"label\": \"备注\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true,\n        \"type\": \"textarea\"\n      }\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-table-form-02-antdv",
      "baseId": "comp-table-form-02",
      "shape": "table+form",
      "target": "antdv",
      "mode": "schema",
      "name": "RoleManage",
      "apiUrl": "/api/roles",
      "surfaces": {
        "table": [
          {
            "prop": "roleName",
            "label": "角色名",
            "formtype": "Input"
          },
          {
            "prop": "code",
            "label": "编码",
            "formtype": "Input"
          },
          {
            "prop": "enabled",
            "label": "启用",
            "formtype": "Switch"
          }
        ],
        "form": [
          {
            "prop": "roleName",
            "label": "角色名",
            "formtype": "Input"
          },
          {
            "prop": "code",
            "label": "编码",
            "formtype": "Input"
          },
          {
            "prop": "enabled",
            "label": "启用",
            "formtype": "Switch"
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ]
      },
      "expect": {
        "membership": {
          "roleName": [
            "table",
            "form"
          ],
          "code": [
            "table",
            "form"
          ],
          "enabled": [
            "table",
            "form"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "facts": {
        "shape": "table+form",
        "membership": {
          "roleName": [
            "table",
            "form"
          ],
          "code": [
            "table",
            "form"
          ],
          "enabled": [
            "table",
            "form"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "table+form",
          "got": "table+form"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "roleName": [
              "table",
              "form"
            ],
            "code": [
              "table",
              "form"
            ],
            "enabled": [
              "table",
              "form"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "roleName": [
              "table",
              "form"
            ],
            "code": [
              "table",
              "form"
            ],
            "enabled": [
              "table",
              "form"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": true,
          "got": true
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "columns": [
            {
              "prop": "roleName",
              "label": "角色名"
            },
            {
              "prop": "code",
              "label": "编码"
            },
            {
              "prop": "enabled",
              "label": "启用"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/roles"
            },
            "rowkey": "id"
          },
          "dialogFormItems": [
            {
              "prop": "roleName",
              "label": "角色名",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "code",
              "label": "编码",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "enabled",
              "label": "启用",
              "formtype": "Switch",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "remark",
              "label": "备注",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true,
                "type": "textarea"
              }
            }
          ],
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"columns\": [\n    {\n      \"prop\": \"roleName\",\n      \"label\": \"角色名\"\n    },\n    {\n      \"prop\": \"code\",\n      \"label\": \"编码\"\n    },\n    {\n      \"prop\": \"enabled\",\n      \"label\": \"启用\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/roles\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogFormItems\": [\n    {\n      \"prop\": \"roleName\",\n      \"label\": \"角色名\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"code\",\n      \"label\": \"编码\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"enabled\",\n      \"label\": \"启用\",\n      \"formtype\": \"Switch\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"remark\",\n      \"label\": \"备注\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true,\n        \"type\": \"textarea\"\n      }\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-table-form-02-vue2",
      "baseId": "comp-table-form-02",
      "shape": "table+form",
      "target": "vue2",
      "mode": "schema",
      "name": "RoleManage",
      "apiUrl": "/api/roles",
      "surfaces": {
        "table": [
          {
            "prop": "roleName",
            "label": "角色名",
            "formtype": "Input"
          },
          {
            "prop": "code",
            "label": "编码",
            "formtype": "Input"
          },
          {
            "prop": "enabled",
            "label": "启用",
            "formtype": "Switch"
          }
        ],
        "form": [
          {
            "prop": "roleName",
            "label": "角色名",
            "formtype": "Input"
          },
          {
            "prop": "code",
            "label": "编码",
            "formtype": "Input"
          },
          {
            "prop": "enabled",
            "label": "启用",
            "formtype": "Switch"
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ]
      },
      "expect": {
        "membership": {
          "roleName": [
            "table",
            "form"
          ],
          "code": [
            "table",
            "form"
          ],
          "enabled": [
            "table",
            "form"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "facts": {
        "shape": "table+form",
        "membership": {
          "roleName": [
            "table",
            "form"
          ],
          "code": [
            "table",
            "form"
          ],
          "enabled": [
            "table",
            "form"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "table+form",
          "got": "table+form"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "roleName": [
              "table",
              "form"
            ],
            "code": [
              "table",
              "form"
            ],
            "enabled": [
              "table",
              "form"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "roleName": [
              "table",
              "form"
            ],
            "code": [
              "table",
              "form"
            ],
            "enabled": [
              "table",
              "form"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": true,
          "got": true
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "columns": [
            {
              "prop": "roleName",
              "label": "角色名"
            },
            {
              "prop": "code",
              "label": "编码"
            },
            {
              "prop": "enabled",
              "label": "启用"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/roles"
            },
            "rowkey": "id"
          },
          "dialogFormItems": [
            {
              "prop": "roleName",
              "label": "角色名",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "code",
              "label": "编码",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "enabled",
              "label": "启用",
              "formtype": "Switch",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "remark",
              "label": "备注",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true,
                "type": "textarea"
              }
            }
          ],
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"columns\": [\n    {\n      \"prop\": \"roleName\",\n      \"label\": \"角色名\"\n    },\n    {\n      \"prop\": \"code\",\n      \"label\": \"编码\"\n    },\n    {\n      \"prop\": \"enabled\",\n      \"label\": \"启用\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/roles\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogFormItems\": [\n    {\n      \"prop\": \"roleName\",\n      \"label\": \"角色名\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"code\",\n      \"label\": \"编码\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"enabled\",\n      \"label\": \"启用\",\n      \"formtype\": \"Switch\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"remark\",\n      \"label\": \"备注\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true,\n        \"type\": \"textarea\"\n      }\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    },
    {
      "id": "comp-table-form-02-vue3",
      "baseId": "comp-table-form-02",
      "shape": "table+form",
      "target": "vue3",
      "mode": "schema",
      "name": "RoleManage",
      "apiUrl": "/api/roles",
      "surfaces": {
        "table": [
          {
            "prop": "roleName",
            "label": "角色名",
            "formtype": "Input"
          },
          {
            "prop": "code",
            "label": "编码",
            "formtype": "Input"
          },
          {
            "prop": "enabled",
            "label": "启用",
            "formtype": "Switch"
          }
        ],
        "form": [
          {
            "prop": "roleName",
            "label": "角色名",
            "formtype": "Input"
          },
          {
            "prop": "code",
            "label": "编码",
            "formtype": "Input"
          },
          {
            "prop": "enabled",
            "label": "启用",
            "formtype": "Switch"
          },
          {
            "prop": "remark",
            "label": "备注",
            "formtype": "Input",
            "attrs": {
              "type": "textarea"
            }
          }
        ]
      },
      "expect": {
        "membership": {
          "roleName": [
            "table",
            "form"
          ],
          "code": [
            "table",
            "form"
          ],
          "enabled": [
            "table",
            "form"
          ],
          "remark": [
            "form"
          ]
        },
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "facts": {
        "shape": "table+form",
        "membership": {
          "roleName": [
            "table",
            "form"
          ],
          "code": [
            "table",
            "form"
          ],
          "enabled": [
            "table",
            "form"
          ],
          "remark": [
            "form"
          ]
        },
        "duplicates": [],
        "actions": [
          "add",
          "edit"
        ],
        "dialogKeys": [],
        "legacyDialogFormItems": true,
        "operationColumn": null
      },
      "factsMatchExpect": true,
      "checks": [
        {
          "key": "shape",
          "label": "形状",
          "pass": true,
          "want": "table+form",
          "got": "table+form"
        },
        {
          "key": "membership",
          "label": "成员关系（同名归并后）",
          "pass": true,
          "want": {
            "roleName": [
              "table",
              "form"
            ],
            "code": [
              "table",
              "form"
            ],
            "enabled": [
              "table",
              "form"
            ],
            "remark": [
              "form"
            ]
          },
          "got": {
            "roleName": [
              "table",
              "form"
            ],
            "code": [
              "table",
              "form"
            ],
            "enabled": [
              "table",
              "form"
            ],
            "remark": [
              "form"
            ]
          }
        },
        {
          "key": "duplicates",
          "label": "同名字段归并（无重复 prop）",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "actions",
          "label": "动作（由弹窗键派生）",
          "pass": true,
          "want": [
            "add",
            "edit"
          ],
          "got": [
            "add",
            "edit"
          ]
        },
        {
          "key": "dialogKeys",
          "label": "弹窗键",
          "pass": true,
          "want": [],
          "got": []
        },
        {
          "key": "legacy",
          "label": "legacy dialogFormItems 形态",
          "pass": true,
          "want": true,
          "got": true
        },
        {
          "key": "operationColumn",
          "label": "operationColumn",
          "pass": true,
          "want": null,
          "got": null
        }
      ],
      "warnings": [],
      "product": {
        "kind": "page",
        "pageSchema": {
          "columns": [
            {
              "prop": "roleName",
              "label": "角色名"
            },
            {
              "prop": "code",
              "label": "编码"
            },
            {
              "prop": "enabled",
              "label": "启用"
            }
          ],
          "tableOptions": {
            "border": true,
            "stripe": true,
            "highlightCurrentRow": true,
            "headerCellStyle": {
              "background": "#f5f7fa"
            },
            "apiParams": {
              "url": "/api/roles"
            },
            "rowkey": "id"
          },
          "dialogFormItems": [
            {
              "prop": "roleName",
              "label": "角色名",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "code",
              "label": "编码",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "enabled",
              "label": "启用",
              "formtype": "Switch",
              "span": 24,
              "attrs": {
                "clearable": true
              }
            },
            {
              "prop": "remark",
              "label": "备注",
              "formtype": "Input",
              "span": 24,
              "attrs": {
                "clearable": true,
                "type": "textarea"
              }
            }
          ],
          "actions": [
            "add",
            "edit"
          ],
          "pagination": {
            "pageSize": 10
          }
        },
        "code": "export const pageSchema = {\n  \"columns\": [\n    {\n      \"prop\": \"roleName\",\n      \"label\": \"角色名\"\n    },\n    {\n      \"prop\": \"code\",\n      \"label\": \"编码\"\n    },\n    {\n      \"prop\": \"enabled\",\n      \"label\": \"启用\"\n    }\n  ],\n  \"tableOptions\": {\n    \"border\": true,\n    \"stripe\": true,\n    \"highlightCurrentRow\": true,\n    \"headerCellStyle\": {\n      \"background\": \"#f5f7fa\"\n    },\n    \"apiParams\": {\n      \"url\": \"/api/roles\"\n    },\n    \"rowkey\": \"id\"\n  },\n  \"dialogFormItems\": [\n    {\n      \"prop\": \"roleName\",\n      \"label\": \"角色名\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"code\",\n      \"label\": \"编码\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"enabled\",\n      \"label\": \"启用\",\n      \"formtype\": \"Switch\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true\n      }\n    },\n    {\n      \"prop\": \"remark\",\n      \"label\": \"备注\",\n      \"formtype\": \"Input\",\n      \"span\": 24,\n      \"attrs\": {\n        \"clearable\": true,\n        \"type\": \"textarea\"\n      }\n    }\n  ],\n  \"actions\": [\n    \"add\",\n    \"edit\"\n  ],\n  \"pagination\": {\n    \"pageSize\": 10\n  }\n}\n"
      }
    }
  ],
  "bases": [
    {
      "baseId": "comp-form-dialog-01",
      "name": "CustomerSignup",
      "shape": "form+dialog",
      "apiUrl": "/api/customers",
      "kind": "fragments",
      "codeEqual": false,
      "generatedEqualIgnoringTargetImports": true,
      "hostEntryEqualIgnoringTargetImports": false,
      "factsEqual": true,
      "rendererByTarget": {
        "vue3": "@es-plus/vue3",
        "vue2": "@es-plus/vue2",
        "antdv": "@es-plus/adapter-antdv"
      },
      "codeBytesByTarget": {
        "vue3": 4273,
        "vue2": 4273,
        "antdv": 4291
      },
      "warningsByTarget": {
        "vue3": [
          "target=vue3: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
        ],
        "vue2": [
          "target=vue2: 弹窗用 JSX render —— 需项目启用 @vue/babel-preset-jsx(或 @vitejs/plugin-vue2-jsx)。"
        ],
        "antdv": [
          "target=antdv: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
        ]
      },
      "note": "组合产物（dialog composable）只差 import 的渲染端包名；宿主装配块按端不同（Element Plus / Ant Design / Element UI）—— 那是宿主预检，不是组合差异。"
    },
    {
      "baseId": "comp-form-dialog-02",
      "name": "TicketSubmit",
      "shape": "form+dialog",
      "apiUrl": "/api/tickets",
      "kind": "fragments",
      "codeEqual": false,
      "generatedEqualIgnoringTargetImports": true,
      "hostEntryEqualIgnoringTargetImports": false,
      "factsEqual": true,
      "rendererByTarget": {
        "vue3": "@es-plus/vue3",
        "vue2": "@es-plus/vue2",
        "antdv": "@es-plus/adapter-antdv"
      },
      "codeBytesByTarget": {
        "vue3": 4311,
        "vue2": 4311,
        "antdv": 4329
      },
      "warningsByTarget": {
        "vue3": [
          "target=vue3: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
        ],
        "vue2": [
          "target=vue2: 弹窗用 JSX render —— 需项目启用 @vue/babel-preset-jsx(或 @vitejs/plugin-vue2-jsx)。"
        ],
        "antdv": [
          "target=antdv: 弹窗用 JSX render —— 模块以 .tsx 产出,需安装并注册 @vitejs/plugin-vue-jsx。"
        ]
      },
      "note": "组合产物（dialog composable）只差 import 的渲染端包名；宿主装配块按端不同（Element Plus / Ant Design / Element UI）—— 那是宿主预检，不是组合差异。"
    },
    {
      "baseId": "comp-full-01",
      "name": "UserManage",
      "shape": "full",
      "apiUrl": "/api/users",
      "kind": "page",
      "codeEqual": true,
      "generatedEqualIgnoringTargetImports": true,
      "hostEntryEqualIgnoringTargetImports": true,
      "factsEqual": true,
      "rendererByTarget": {
        "vue3": null,
        "vue2": null,
        "antdv": null
      },
      "codeBytesByTarget": {
        "vue3": 2963,
        "vue2": 2963,
        "antdv": 2963
      },
      "warningsByTarget": {
        "vue3": [],
        "vue2": [],
        "antdv": []
      },
      "note": "schema 模式：同一份 surfaces 在三端产出逐字节相同的产物；target 只体现在宿主预检文案与告警。"
    },
    {
      "baseId": "comp-full-02",
      "name": "OrderManage",
      "shape": "full",
      "apiUrl": "/api/orders",
      "kind": "page",
      "codeEqual": true,
      "generatedEqualIgnoringTargetImports": true,
      "hostEntryEqualIgnoringTargetImports": true,
      "factsEqual": true,
      "rendererByTarget": {
        "vue3": null,
        "vue2": null,
        "antdv": null
      },
      "codeBytesByTarget": {
        "vue3": 4592,
        "vue2": 4592,
        "antdv": 4592
      },
      "warningsByTarget": {
        "vue3": [],
        "vue2": [],
        "antdv": []
      },
      "note": "schema 模式：同一份 surfaces 在三端产出逐字节相同的产物；target 只体现在宿主预检文案与告警。"
    },
    {
      "baseId": "comp-table-form-01",
      "name": "DeptManage",
      "shape": "table+form",
      "apiUrl": "/api/depts",
      "kind": "page",
      "codeEqual": true,
      "generatedEqualIgnoringTargetImports": true,
      "hostEntryEqualIgnoringTargetImports": true,
      "factsEqual": true,
      "rendererByTarget": {
        "vue3": null,
        "vue2": null,
        "antdv": null
      },
      "codeBytesByTarget": {
        "vue3": 1066,
        "vue2": 1066,
        "antdv": 1066
      },
      "warningsByTarget": {
        "vue3": [],
        "vue2": [],
        "antdv": []
      },
      "note": "schema 模式：同一份 surfaces 在三端产出逐字节相同的产物；target 只体现在宿主预检文案与告警。"
    },
    {
      "baseId": "comp-table-form-02",
      "name": "RoleManage",
      "shape": "table+form",
      "apiUrl": "/api/roles",
      "kind": "page",
      "codeEqual": true,
      "generatedEqualIgnoringTargetImports": true,
      "hostEntryEqualIgnoringTargetImports": true,
      "factsEqual": true,
      "rendererByTarget": {
        "vue3": null,
        "vue2": null,
        "antdv": null
      },
      "codeBytesByTarget": {
        "vue3": 1210,
        "vue2": 1210,
        "antdv": 1210
      },
      "warningsByTarget": {
        "vue3": [],
        "vue2": [],
        "antdv": []
      },
      "note": "schema 模式：同一份 surfaces 在三端产出逐字节相同的产物；target 只体现在宿主预检文案与告警。"
    }
  ]
}
