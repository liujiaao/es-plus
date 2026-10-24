<template>
  <div class="example-conditional-btns">
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
    <div class="hint">
      <ElAlert type="success" :closable="false" show-icon>
        <template #title>
          <b>btns + clickEvent</b> — 一行配置声明行操作按钮，替代 el-table 冗长的 v-if / template slot 写法。
          按钮行为随行数据动态变化，无需手动判断。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { ElMessage, ElTag, ElMessageBox, ElAlert } from 'element-plus'
import { EsTable, EsForm,  useDialog } from '@es-plus/vue3'

const tableRef = ref(null)
const dialog = useDialog()
const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0, pageSizes: [10, 20] })

const statusMap = {
  draft: { text: '草稿', type: 'info' },
  pending: { text: '待审', type: 'warning' },
  approved: { text: '已审', type: 'success' },
  rejected: { text: '已驳', type: 'danger' },
  published: { text: '已发', type: 'primary' }
}

const columns = [
  { prop: 'id', label: '编号', width: 70 },
  { prop: 'title', label: '标题', minWidth: 160 },
  { prop: 'author', label: '作者', width: 80 },
  {
    prop: 'status', label: '状态', width: 80,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return <ElTag type={s.type} size="small">{s.text}</ElTag>
    }
  },
  { prop: 'date', label: '日期', width: 110 },
  {
    prop: 'operate', label: '操作', width: 240,
    // btns 配置化声明行操作 — 替代 <template #default="{ row }"> + v-if 链
    btns: [
      {
        name: '编辑', type: 'primary',
        clickEvent: (row) => {
          const formModel = ref({ ...row })
          dialog({
            title: `编辑: ${row.title}`,
            width: '500px',
            render: (h, { registerRef }) => (
              <EsForm
                ref={(el) => { if (el) registerRef('editForm', el) }}
                model={formModel.value}
                formItemList={[
                  { prop: 'title', label: '标题', formtype: 'Input', span: 24, attrs: { placeholder: '标题' } },
                  { prop: 'author', label: '作者', formtype: 'Input', span: 12, attrs: { placeholder: '作者' } },
                  { prop: 'content', label: '内容', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3, placeholder: '内容' } }
                ]}
              />
            ),
            configBtn: [
              { name: '取消', click: (_, { close }) => close() },
              { name: '保存', type: 'primary', click: (_, { close }) => {
                Object.assign(row, formModel.value)
                ElMessage.success('保存成功')
                close()
              }}
            ]
          })
        }
      },
      {
        name: '提交审核', type: 'warning',
        clickEvent: (row) => {
          if (row.status !== 'draft' && row.status !== 'rejected') {
            ElMessage.warning('仅草稿/已驳回状态可提交')
            return
          }
          row.status = 'pending'
          ElMessage.success('已提交审核')
        }
      },
      {
        name: '撤回', type: 'info',
        clickEvent: (row) => {
          if (row.status !== 'pending') {
            ElMessage.warning('仅待审状态可撤回')
            return
          }
          row.status = 'draft'
          ElMessage.info('已撤回')
        }
      },
      {
        name: '发布', type: 'success',
        clickEvent: (row) => {
          if (row.status !== 'approved') {
            ElMessage.warning('仅已审状态可发布')
            return
          }
          row.status = 'published'
          ElMessage.success('已发布')
        }
      },
      {
        name: '删除', type: 'danger',
        clickEvent: async (row) => {
          if (row.status === 'published') {
            ElMessage.warning('已发布文章不可删除，请先下线')
            return
          }
          try {
            await ElMessageBox.confirm(`确定删除 "${row.title}"？`, '提示', { type: 'warning' })
            const idx = allArticles.findIndex((r) => r.id === row.id)
            if (idx > -1) allArticles.splice(idx, 1)
            ElMessage.success('删除成功')
            tableRef.value?.httpRequestInstance()
          } catch {}
        }
      }
    ]
  }
]

// 模块级数据源：行内按钮改状态 / 编辑 / 删除都落在它上面，
// 刷新表格后改动仍然可见（若每次请求现造数组，任何刷新都会把改动冲掉）。
const allArticles = Array.from({ length: 18 }, (_, i) => ({
  id: 2001 + i,
  title: ['Vue3 实战指南', 'React 设计模式', 'TypeScript 进阶', 'Node.js 微服务', 'CSS 布局技巧', '算法与数据结构'][i % 6],
  author: ['张三', '李四', '王五'][i % 3],
  status: ['draft', 'pending', 'approved', 'rejected', 'published'][i % 5],
  date: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`
}))

const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 10 } = params || {}
  const all = allArticles
  const total = all.length
  const start = (pageIndex - 1) * pageSize
  return { data: all.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/articles', method: 'GET' },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 400
}
</script>

<style scoped>
.example-conditional-btns {
  padding: 0;
}
.hint {
  margin-top: 12px;
}
</style>
