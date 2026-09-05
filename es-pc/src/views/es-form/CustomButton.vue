<template>
  <div class="example-form-custom-btn">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :render-btn="renderBtn"
      :layout-form-props="layoutProps"
    />
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { reactive, ref, h } from 'vue'
import { message, Modal } from 'ant-design-vue'

const submitting = ref(false)

const formModel = reactive({
  title: '',
  category: '',
  content: ''
})

const formItems = [
  {
    prop: 'title',
    label: '标题',
    span: 12,
    formtype: 'Input',
    attrs: { placeholder: '请输入标题' }
  },
  {
    prop: 'category',
    label: '分类',
    span: 12,
    formtype: 'Select',
    dataOptions: [
      { label: '技术分享', value: 'tech' },
      { label: '产品动态', value: 'product' },
      { label: '团队日志', value: 'team' }
    ],
    attrs: { placeholder: '请选择分类' }
  },
  {
    prop: 'content',
    label: '内容',
    span: 24,
    formtype: 'Input',
    attrs: { type: 'textarea', rows: 4, placeholder: '请输入内容' }
  }
]

const renderBtn = () => {
  return h('div', {
    style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '8px 0' }
  }, [
    h('span', {
      style: { color: '#909399', cursor: 'pointer', lineHeight: '32px', fontSize: '14px' },
      onClick: () => {
        Modal.confirm({
          title: '提示',
          content: '确定放弃编辑？未保存的内容将丢失',
          okText: '确定',
          cancelText: '取消',
          okType: 'warning',
          onOk: () => {
            message.info('已取消编辑')
          }
        })
      }
    }, '取消'),
    h('span', {
      style: {
        color: '#1677ff', cursor: 'pointer', lineHeight: '32px', fontSize: '14px', marginRight: '8px'
      },
      onClick: () => {
        message.success('草稿已保存: ' + formModel.title)
        console.log('草稿:', formModel)
      }
    }, '保存草稿'),
    h('span', {
      class: 'ant-btn ant-btn-primary',
      style: { opacity: submitting.value ? 0.7 : 1, padding: '4px 15px', borderRadius: '6px', cursor: 'pointer' },
      onClick: async () => {
        if (!formModel.title) { message.warning('请输入标题'); return }
        submitting.value = true
        await new Promise(r => setTimeout(r, 1200))
        submitting.value = false
        message.success('发布成功！')
        console.log('发布:', formModel)
      }
    }, submitting.value ? '发布中...' : '立即发布')
  ])
}

const layoutProps = {
  fromLayProps: { labelWidth: '80px', size: 'small' },
  rowLayProps: { gutter: 16 }
}
</script>

<style scoped>
.example-form-custom-btn { padding: 20px; }
</style>
