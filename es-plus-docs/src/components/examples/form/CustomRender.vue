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
import { ref, reactive, h } from 'vue'
import { ElMessage, ElUpload, ElButton, ElIcon, ElSlider, ElColorPicker, ElInputNumber, ElRate, ElTransfer } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import EsForm from 'es-plus/components/es-form'

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
      return h(ElUpload, {
        class: 'avatar-uploader',
        'show-file-list': false,
        'auto-upload': false,
        'on-change': (file) => { model.avatar = URL.createObjectURL(file.raw) }
      }, () => {
        if (model.avatar) {
          return h('img', { src: model.avatar, class: 'avatar', style: 'width: 100px; height: 100px; border-radius: 50%; object-fit: cover;' })
        }
        return h(ElIcon, { size: 28, color: '#8c939d' }, () => h(Plus))
      })
    }
  },
  {
    prop: 'color',
    label: '主题色',
    span: 12,
    render: (h, model) => {
      return h(ElColorPicker, {
        modelValue: model.color,
        'onUpdate:modelValue': (val) => { model.color = val }
      })
    }
  },
  {
    prop: 'score',
    label: '评分',
    span: 12,
    render: (h, model) => {
      return h(ElRate, {
        modelValue: model.score,
        'onUpdate:modelValue': (val) => { model.score = val },
        'show-score': true
      })
    }
  },
  {
    prop: 'age',
    label: '年龄',
    span: 12,
    render: (h, model) => {
      return h(ElSlider, {
        modelValue: model.age,
        'onUpdate:modelValue': (val) => { model.age = val },
        min: 18,
        max: 60,
        'show-stops': true
      })
    }
  },
  {
    prop: 'transfer',
    label: '穿梭框',
    span: 24,
    render: (h, model) => {
      return h(ElTransfer, {
        modelValue: model.transfer,
        'onUpdate:modelValue': (val) => { model.transfer = val },
        data: transferData,
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
      ElMessage.success('提交成功: ' + JSON.stringify(model))
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
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-uploader:hover {
  border-color: var(--el-color-primary);
}
</style>
