<template>
  <div class="example-crud-custom-render">
    <es-crud-page
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { h, ref } from 'vue'
import { ElMessage, ElUpload, ElButton, ElIcon, ElProgress } from 'element-plus'

const mockData = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `文档${i + 1}.xlsx`,
  size: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
  uploader: ['张三', '李四', '王五'][i % 3],
  uploadTime: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`
}))

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
      isHiddenFooter: true,
      render: (h, { close, refresh }) => {
        return h('div', { style: 'padding: 20px; text-align: center;' }, [
          h('p', { style: 'margin-bottom: 16px; color: #666;' }, '拖拽文件到此处或点击上传按钮'),
          h(ElUpload, {
            drag: true,
            action: '#',
            multiple: true,
            autoUpload: false,
            onChange: () => {}
          }, {
            default: () => h('div', [
              h('p', { style: 'font-size: 40px; color: #c0c4cc;' }, '+'),
              h('p', { style: 'color: #999;' }, '支持 xlsx、csv、pdf 格式')
            ])
          }),
          h('div', { style: 'margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px;' }, [
            h(ElButton, { onClick: close }, () => '取消'),
            h(ElButton, { type: 'primary', onClick: () => { close(); refresh() } }, () => '确认上传')
          ])
        ])
      }
    },
    stats: {
      title: '文件统计',
      width: '400px',
      isHiddenFooter: true,
      render: (h, { row }) => {
        return h('div', { style: 'padding: 20px;' }, [
          h('div', { style: 'margin-bottom: 12px;' }, [
            h('span', '总文件数: '),
            h('strong', '12')
          ]),
          h('div', { style: 'margin-bottom: 12px;' }, [
            h('span', '总大小: '),
            h('strong', '67.2 MB')
          ]),
          h('div', { style: 'margin-bottom: 8px;' }, '存储空间使用率:'),
          h(ElProgress, { percentage: 34, status: 'success' })
        ])
      }
    }
  }
}

const handleDialogConfirm = (key, data) => {
  ElMessage.success(`${key} 操作完成`)
}
</script>

<style scoped>
.example-crud-custom-render { padding: 0; }
</style>
