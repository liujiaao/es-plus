<template>
  <div class="example-dialog-nested">
    <el-button type="primary" @click="openNested">嵌套弹窗</el-button>
  </div>
</template>

<script setup lang="jsx">
import { reactive } from 'vue'
import { ElInput } from 'element-plus'
import { useDialog } from 'es-plus'

const dialog = useDialog()
const nestedDialog = useDialog()

const openNested = () => {
  const formData = reactive({ name: '', description: '' })

  dialog({
    title: '主弹窗',
    width: '600px',
    render: () => (
      <div style="padding: 20px">
        <p>这是主弹窗的内容</p>
        <div style="margin: 20px 0">
          <label style="display: block; margin-bottom: 8px">名称:</label>
          <ElInput v-model={formData.name} placeholder="请输入名称" />
        </div>
        <div style="margin: 20px 0">
          <label style="display: block; margin-bottom: 8px">描述:</label>
          <ElInput v-model={formData.description} type="textarea" rows={3} placeholder="请输入描述" />
        </div>
      </div>
    ),
    configBtn: [
      { name: '取消', size: 'small', click: (_, { close }) => close() },
      {
        name: '提交', size: 'small', click: (_, { close }) => {
          nestedDialog({
            title: '确认提交',
            width: '400px',
            isDraggable: true,
            render: () => (
              <div style="padding: 20px">
                <p>确定要提交以下信息吗?</p>
                <ul style="margin: 20px 0; padding-left: 20px">
                  <li>名称: {formData.name}</li>
                  <li>描述: {formData.description}</li>
                </ul>
              </div>
            ),
            configBtn: [
              { name: '确认', size: 'small', click: (_, { close }) => close() }
            ]
          })
        }
      }
    ]
  })
}
</script>

<style scoped>
.example-dialog-nested {
  padding: 20px;
}
</style>
