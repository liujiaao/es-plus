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

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

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
    formtype: 'Input' as const,
    attrs: { placeholder: '请输入标题' }
  },
  {
    prop: 'category',
    label: '分类',
    span: 12,
    formtype: 'Select' as const,
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
    formtype: 'Input' as const,
    attrs: { type: 'textarea', rows: 4, placeholder: '请输入内容' }
  }
]

// renderBtn: (row, formModel, formItemList, h) => VNode
const renderBtn = (row: any, model: Record<string, unknown>, _list: unknown, h: any) => {
  return h('div', {
    style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '8px 0' }
  }, [
    h('span', {
      style: { color: '#909399', cursor: 'pointer', lineHeight: '32px', fontSize: '14px' },
      onClick: () => {
        ElMessageBox.confirm('确定放弃编辑？未保存的内容将丢失', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          ElMessage.info('已取消编辑')
        }).catch(() => {})
      }
    }, '取消'),
    h('span', {
      style: {
        color: '#409eff', cursor: 'pointer', lineHeight: '32px', fontSize: '14px', marginRight: '8px'
      },
      onClick: () => {
        ElMessage.success('草稿已保存: ' + model.title)
        console.log('草稿:', model)
      }
    }, '保存草稿'),
    h('span', {
      class: 'el-button el-button--primary',
      style: { opacity: submitting.value ? 0.7 : 1 },
      onClick: async () => {
        if (!model.title) { ElMessage.warning('请输入标题'); return }
        submitting.value = true
        await new Promise(r => setTimeout(r, 1200))
        submitting.value = false
        ElMessage.success('发布成功！')
        console.log('发布:', model)
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
