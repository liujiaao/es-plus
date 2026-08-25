<template>
  <div class="example-form-custom">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
    />
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { ref, reactive, h } from 'vue'
import { message, Upload, Button, Slider, InputNumber, Rate, Transfer } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'

const formModel = reactive({
  avatar: '',
  score: 3,
  color: '#409EFF',
  age: 25,
  files: [],
  transfer: [],
  rate: 3
})

const transferData = [
  { key: 1, label: '选项一' },
  { key: 2, label: '选项二' },
  { key: 3, label: '选项三' },
  { key: 4, label: '选项四' },
  { key: 5, label: '选项五' }
]

const formItems = [
  {
    prop: 'avatar',
    label: '头像',
    span: 12,
    render: (h, model) => {
      return h(Upload, {
        class: 'avatar-uploader',
        'show-file-list': false,
        'auto-upload': false,
        'on-change': (file) => { model.avatar = URL.createObjectURL(file.raw) }
      }, () => {
        if (model.avatar) {
          return h('img', { src: model.avatar, class: 'avatar', style: 'width: 100px; height: 100px; border-radius: 50%; object-fit: cover;' })
        }
        return h(PlusOutlined, { style: { fontSize: '28px', color: '#8c939d' } })
      })
    }
  },
  {
    prop: 'color',
    label: '主题色',
    span: 12,
    formtype: 'ColorPicker'
  },
  {
    prop: 'score',
    label: '评分',
    span: 12,
    render: (h, model) => {
      return h(Rate, {
        value: model.score,
        'onUpdate:value': (val) => { model.score = val }
      })
    }
  },
  {
    prop: 'age',
    label: '年龄',
    span: 12,
    render: (h, model) => {
      return h(Slider, {
        value: model.age,
        'onUpdate:value': (val) => { model.age = val },
        min: 18,
        max: 60,
        included: true
      })
    }
  },
  {
    prop: 'transfer',
    label: '穿梭框',
    span: 24,
    render: (h, model) => {
      return h(Transfer, {
        targetKeys: model.transfer,
        'onUpdate:targetKeys': (val) => { model.transfer = val },
        dataSource: transferData,
        filterable: true,
        titles: ['待选', '已选']
      })
    }
  }
]

const configBtn = [
  {
    name: '提交',
    type: 'primary',
    click: (model) => {
      message.success('提交成功: ' + JSON.stringify(model))
    }
  },
  {
    name: '重置',
    click: (_, formRef) => {
      formRef?.resetFields()
    }
  }
]
</script>

<style scoped>
.example-form-custom {
  padding: 20px;
}
.avatar-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-uploader:hover {
  border-color: #1677ff;
}
</style>
