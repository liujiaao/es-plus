<template>
  <div class="example-crud-hidden-column">
    <es-crud-page
      ref="crudRef"
      :schema="schema"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsCrudPage } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const crudRef = ref(null)

const mockData = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  event: ['用户登录', '数据导出', '权限变更', '配置修改', '系统重启'][i % 5],
  operator: ['admin', 'zhangsan', 'lisi', 'wangwu'][i % 4],
  ip: `192.168.1.${100 + i}`,
  time: `2024-03-${String((i % 28) + 1).padStart(2, '0')} ${String(8 + (i % 12)).padStart(2, '0')}:${String(i * 3 % 60).padStart(2, '0')}:00`,
  level: ['info', 'warn', 'error'][i % 3]
}))

const schema = {
  formItems: [
    { prop: 'event', label: '事件', formtype: 'Input' },
    { prop: 'operator', label: '操作人', formtype: 'Input' },
    { prop: 'level', label: '级别', formtype: 'Select',
      dataOptions: [
        { label: 'Info', value: 'info' },
        { label: 'Warn', value: 'warn' },
        { label: 'Error', value: 'error' }
      ] }
  ],
  columns: [
    { prop: 'event', label: '事件', minWidth: 120 },
    { prop: 'operator', label: '操作人', width: 100 },
    { prop: 'ip', label: 'IP 地址', width: 140 },
    { prop: 'time', label: '时间', width: 180 },
    { prop: 'level', label: '级别', width: 80 }
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
    { name: '导出日志', icon: 'DownloadOutlined', actionType: 'export' },
    { name: '清空日志', type: 'danger', confirm: '确定清空所有日志记录吗？此操作不可恢复。', actionType: 'clear' }
  ],
  operationColumn: false
}

// 导出为 CSV（带 BOM，Excel 打开不乱码）；真实项目换成后端导出接口
const exportLogs = () => {
  if (!mockData.length) return message.warning('没有可导出的日志')
  const header = ['事件', '操作人', 'IP 地址', '时间', '级别']
  const rows = mockData.map((r) => [r.event, r.operator, r.ip, r.time, r.level])
  const csv = '\uFEFF' + [header, ...rows].map((cols) => cols.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = '操作日志.csv'
  a.click()
  URL.revokeObjectURL(url)
  message.success(`已导出 ${mockData.length} 条日志`)
}

const handleBtnClick = (key) => {
  if (key === 'export') exportLogs()
  if (key === 'clear') {
    mockData.splice(0, mockData.length)
    crudRef.value?.refresh?.()
    message.warning('日志已清空')
  }
}
</script>

<style scoped>
.example-crud-hidden-column { padding: 0; }
</style>
