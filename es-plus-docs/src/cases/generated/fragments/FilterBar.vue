<template>
  <es-form :model="model" :form-item-list="formItems" :config-btn="configBtn" />
</template>

<script setup lang="ts">
import { reactive } from 'vue'

interface FormModel {
  keyword: string
  status: string | number | ''
}

const model = reactive<FormModel>({ keyword: '', status: '' })
const formItems = [
  {
    "prop": "keyword",
    "label": "关键词",
    "formtype": "Input",
    "span": 8,
    "attrs": {
      "clearable": true
    }
  },
  {
    "prop": "status",
    "label": "状态",
    "formtype": "Select",
    "span": 8,
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

const configBtn = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]
</script>
