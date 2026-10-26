<template>
  <es-dialog
    v-model:visible="visible"
    :title="title"
    width="560px"
    :config-btn="configBtn"
  >
    <es-form
      ref="formRef"
      :model="formData"
      :form-item-list="formItems"
      :layout-form-props="{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }"
    />
  </es-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { httpRequest } from '@es-plus/adapter-antdv'

interface DialogModel {
  customer: string
  amount: number | null
  status: string | number | ''
}

const DEFAULTS: DialogModel = { customer: '', amount: null, status: '' }
const formData = reactive<DialogModel>({ ...DEFAULTS })
const visible = ref(false)
const title = ref('')
const formRef = ref<{ validate: () => Promise<unknown> } | null>(null)
let onSuccess: ((data: DialogModel) => void) | undefined

const formItems = [
  {
    "prop": "customer",
    "label": "客户",
    "formtype": "Input",
    "span": 24,
    "attrs": {
      "clearable": true
    },
    "formItemOptions": {
      "rules": [
        {
          "required": true,
          "message": "请输入客户",
          "trigger": "blur"
        }
      ]
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
        "label": "待发货",
        "value": 0,
        "tagType": "warning"
      },
      {
        "label": "已发货",
        "value": 1,
        "tagType": "success"
      },
      {
        "label": "已签收",
        "value": 2,
        "tagType": "info"
      }
    ]
  }
]

function open(t: string = '新增订单', row: Partial<DialogModel> = {}, success?: (data: DialogModel) => void) {
  title.value = t
  Object.assign(formData, DEFAULTS, row)
  onSuccess = success
  visible.value = true
}

function close() {
  visible.value = false
}

async function handleConfirm() {
  try {
    await formRef.value?.validate()
  } catch {
    return // 校验未通过:静默中止,等用户修正
  }
  // TODO(es-plus): 宿主编排槽 —— 提交前后的额外业务逻辑写在这里
  const method = title.value === '新增' ? 'POST' : 'PUT'
  const url = title.value === '新增' ? '/api/demo/orders' : `/api/demo/orders/${formData.id}`
  await httpRequest({ url, method, data: formData })
  close()
  onSuccess?.(formData)
}

const isView = computed(() => title.value === '查看')
const configBtn = computed(() => isView.value
  ? [
    { name: '关闭', click: () => close() }
  ]
  : [
    { name: '取消', click: () => close() },
    { name: '确定', type: 'primary', click: () => handleConfirm() }
  ])

defineExpose({ open })
</script>
