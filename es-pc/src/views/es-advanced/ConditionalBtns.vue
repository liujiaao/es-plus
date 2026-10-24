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
      <Alert type="success" :closable="false" show-icon>
        <template #message>
          <b>btns + hidden + clickEvent</b> — 一行配置声明行操作按钮，替代 a-table 冗长的 v-if / template slot 写法。
          每行显示哪些按钮由 <code>hidden(row)</code> 谓词决定，状态机不在模板里、也不在点击回调里。
        </template>
      </Alert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { message, Tag, Modal, Alert } from 'ant-design-vue'
import { EsTable, EsForm,  useDialog } from '@es-plus/adapter-antdv'
import { tagColor } from '@/utils/antdv-colors'

const tableRef = ref(null)
const dialog = useDialog()
const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0, pageSizes: [10, 20] })

// Modal.confirm 返回 { destroy, update } 而非 Promise，必须用 onOk/onCancel 包一层才等得到结果
const confirmBox = (options) => new Promise((resolve) => {
  Modal.confirm({ ...options, onOk: () => resolve(true), onCancel: () => resolve(false) })
})

const statusMap = {
  draft: { text: '草稿', type: 'info' },
  pending: { text: '待审', type: 'warning' },
  approved: { text: '已审', type: 'success' },
  rejected: { text: '已驳', type: 'danger' },
  published: { text: '已发', type: '' }
}

const columns = [
  { prop: 'id', label: '编号', width: 70 },
  { prop: 'title', label: '标题', minWidth: 160 },
  { prop: 'author', label: '作者', width: 80 },
  {
    prop: 'status', label: '状态', width: 80,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return <Tag color={tagColor(s.type)}>{s.text}</Tag>
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
                message.success('保存成功')
                close()
              }}
            ]
          })
        }
      },
      {
        name: '提交审核', type: 'primary',
        // 状态机落在**声明层**：hidden 谓词决定这行到底有没有这个按钮，
        // clickEvent 里不再需要 if (状态不对) return
        hidden: (row) => row.status !== 'draft' && row.status !== 'rejected',
        clickEvent: (row) => {
          row.status = 'pending'
          message.success('已提交审核')
        }
      },
      {
        name: '撤回', type: 'default',
        hidden: (row) => row.status !== 'pending',
        clickEvent: (row) => {
          row.status = 'draft'
          message.info('已撤回')
        }
      },
      {
        name: '发布', type: 'primary',
        hidden: (row) => row.status !== 'approved',
        clickEvent: (row) => {
          row.status = 'published'
          message.success('已发布')
        }
      },
      {
        name: '删除', type: 'danger',
        hidden: (row) => row.status === 'published',
        clickEvent: async (row) => {
          const ok = await confirmBox({ title: '提示', content: `确定删除 "${row.title}"？`, okType: 'primary', okButtonProps: { danger: true } })
          if (!ok) return
          const idx = allArticles.findIndex((r) => r.id === row.id)
          if (idx > -1) allArticles.splice(idx, 1)
          message.success('删除成功')
          tableRef.value?.httpRequestInstance()
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
