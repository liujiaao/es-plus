<template>
  <div class="example-crud-custom-render">
    <es-crud-page :schema="schema" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsCrudPage } from '@es-plus/adapter-antdv'
import { message, Upload, Button, Progress } from 'ant-design-vue'

// 本地数据源：上传成功后真的往这里加，统计面板读到的是修改后的真实数据
const mockData = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `文档${i + 1}.xlsx`,
  size: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
  uploader: ['张三', '李四', '王五'][i % 3],
  uploadTime: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`
}))

const STORAGE_QUOTA_MB = 200

// Upload 的 onChange 给回 fileList，确认上传时据此落数据
const pendingFiles = ref([])
const sizeToMb = (bytes) => `${((bytes || 0) / 1024 / 1024).toFixed(1)} MB`
const today = () => new Date().toISOString().slice(0, 10)
const nextId = () => Math.max(0, ...mockData.map((d) => d.id)) + 1

const schema = {
  formItems: [
    { prop: 'name', label: '文件名', formtype: 'Input' }
  ],
  columns: [
    { prop: 'name', label: '文件名', width: 160 },
    { prop: 'size', label: '大小', width: 100 },
    { prop: 'uploader', label: '上传人', width: 100 },
    { prop: 'uploadTime', label: '上传时间' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize }) => {
      const start = (pageIndex - 1) * pageSize
      return { data: mockData.slice(start, start + pageSize), total: mockData.length, pageSize, pageIndex }
    },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '上传文件', type: 'primary', icon: 'Upload', dialogKey: 'upload' },
    { name: '查看统计', dialogKey: 'stats' }
  ],
  operationColumn: false,
  dialogs: {
    upload: {
      title: '上传文件',
      width: '500px',
      // isHiddenFooter：不要默认的确定/取消，底部按钮完全由 render 自己画
      isHiddenFooter: true,
      render: (h, { close, refresh }) => {
        return h('div', { style: 'padding: 20px; text-align: center;' }, [
          h('p', { style: 'margin-bottom: 16px; color: #666;' }, '拖拽文件到此处或点击上传按钮'),
          h(Upload, {
            drag: true,
            action: '#',
            multiple: true,
            // ADV 无 autoUpload：beforeUpload 返回 false 阻止自动上传，避免 action:'#' 被真的请求
            beforeUpload: () => false,
            onChange: ({ fileList }) => { pendingFiles.value = fileList }
          }, {
            default: () => h('div', [
              h('p', { style: 'font-size: 40px; color: #c0c4cc;' }, '+'),
              h('p', { style: 'color: #999;' }, '支持 xlsx、csv、pdf 格式')
            ])
          }),
          h('div', { style: 'margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px;' }, [
            // 取消时清空暂存列表，否则下次打开弹窗会残留上一次选的文件
            h(Button, { onClick: () => { pendingFiles.value = []; close() } }, () => '取消'),
            h(Button, {
              type: 'primary',
              onClick: () => {
                if (!pendingFiles.value.length) return message.warning('请先选择文件')
                const baseId = nextId()
                const added = pendingFiles.value.map((f, i) => ({
                  id: baseId + i,
                  name: f.name,
                  size: sizeToMb(f.size),
                  uploader: '当前用户',
                  uploadTime: today()
                }))
                mockData.unshift(...added)
                pendingFiles.value = []
                close()
                refresh()
                message.success(`已上传 ${added.length} 个文件`)
              }
            }, () => '确认上传')
          ])
        ])
      }
    },
    stats: {
      title: '文件统计',
      width: '400px',
      isHiddenFooter: true,
      // render 打开时执行，读到的是当时的真实数据
      render: (h) => {
        const totalMb = mockData.reduce((sum, f) => sum + parseFloat(f.size), 0)
        const usedPercent = Math.min(100, Math.round((totalMb / STORAGE_QUOTA_MB) * 100))
        return h('div', { style: 'padding: 20px;' }, [
          h('div', { style: 'margin-bottom: 12px;' }, [h('span', '总文件数: '), h('strong', String(mockData.length))]),
          h('div', { style: 'margin-bottom: 12px;' }, [h('span', '总大小: '), h('strong', `${totalMb.toFixed(1)} MB`)]),
          h('div', { style: 'margin-bottom: 8px;' }, `存储空间使用率（配额 ${STORAGE_QUOTA_MB} MB）:`),
          h(Progress, { percent: usedPercent, status: usedPercent > 90 ? 'exception' : 'success' })
        ])
      }
    }
  }
}
</script>

<style scoped>
.example-crud-custom-render { padding: 0; }
</style>
