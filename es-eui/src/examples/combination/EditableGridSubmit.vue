<template>
  <div>
    <el-alert
      type="warning"
      :closable="false"
      style="margin-bottom: 10px;"
      description="可编辑表格 + 批量提交：行内直接编辑/新增/删除，前端跟踪「新增/修改/删除」三类脏数据，一次性提交到假后端，成功后重新拉取。"
    />
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="mini" type="primary" icon="el-icon-plus" @click="addRow">新增一行</el-button>
      <el-button size="mini" type="success" :loading="submitting" @click="submit">提交变更</el-button>
      <el-button size="mini" @click="reload">重置</el-button>
      <span style="font-size: 13px; color: #909399;">
        新增 <strong style="color:#67c23a">{{ diff.created }}</strong> ·
        修改 <strong style="color:#e6a23c">{{ diff.updated }}</strong> ·
        删除 <strong style="color:#f56c6c">{{ diff.deleted }}</strong>
      </span>
    </div>
    <es-table
      :data-source="rows"
      :columns="columns"
      :options="options"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 可编辑表格 + 批量提交 —— 补齐「批量写 + 脏数据跟踪」场景（el-table 引擎）
 *
 * 关键点：
 *   1. 本地 rows 直接行内编辑；originalMap 保存初始快照用于 diff。
 *   2. 新增行用负数临时 id 标记 _isNew；删除行收集到 deletedIds（不立即落库）。
 *   3. 提交时按三类分别调用 create/update/remove，全部完成后从服务端重新拉取，
 *      清空临时状态。任一失败提示并保留现场。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'
import { Message } from 'element-ui'
import { createEmployeeService, DEPARTMENT_OPTIONS } from '../_mock/crud-service'

export default defineComponent({
  name: 'CombinationEditableGridSubmit',
  setup() {
    const api = createEmployeeService({ seedCount: 6, latency: 500 })
    const rows = ref([])
    let originalMap = new Map()
    let tempSeq = 0
    const deletedIds = ref([])
    const submitting = ref(false)

    const seed = () => {
      const snap = api.snapshot().slice(0, 6)
      rows.value = snap.map((r) => ({ ...r }))
      originalMap = new Map(snap.map((r) => [r.id, JSON.stringify(r)]))
      deletedIds.value = []
      tempSeq = 0
    }
    seed()

    const isDirty = (row) => {
      const orig = originalMap.get(row.id)
      return orig && JSON.stringify(row) !== orig
    }

    const diff = computed(() => ({
      created: rows.value.filter((r) => r._isNew).length,
      updated: rows.value.filter((r) => !r._isNew && isDirty(r)).length,
      deleted: deletedIds.value.length
    }))

    const addRow = () => {
      rows.value = [
        { id: --tempSeq, _isNew: true, name: '', department: '技术部', position: '工程师', salary: 8000, status: 'active', email: '' },
        ...rows.value
      ]
    }

    const removeRow = (row) => {
      if (!row._isNew) deletedIds.value = [...deletedIds.value, row.id]
      rows.value = rows.value.filter((r) => r.id !== row.id)
    }

    const submit = async () => {
      const created = rows.value.filter((r) => r._isNew)
      const updated = rows.value.filter((r) => !r._isNew && isDirty(r))
      if (!created.length && !updated.length && !deletedIds.value.length) {
        Message.info('没有需要提交的变更')
        return
      }
      submitting.value = true
      try {
        await Promise.all([
          ...created.map((r) => {
            const { id, _isNew, ...payload } = r // eslint-disable-line no-unused-vars
            return api.create(payload)
          }),
          ...updated.map((r) => api.update(r.id, { ...r })),
          ...deletedIds.value.map((id) => api.remove(id))
        ])
        Message.success(`提交成功：新增 ${created.length}、修改 ${updated.length}、删除 ${deletedIds.value.length}`)
        seed() // 重新拉取（这里直接用最新快照重置）
      } catch (e) {
        Message.error(e.fields ? Object.values(e.fields)[0] : e.message)
      } finally {
        submitting.value = false
      }
    }

    const reload = () => seed()

    const columns = [
      {
        prop: 'name', label: '姓名', minWidth: 140,
        render: (h, { row }) => (
          <el-input
            value={row.name}
            size="small"
            placeholder="请输入姓名"
            on-input={(v) => { row.name = v }}
          />
        )
      },
      {
        prop: 'department', label: '部门', width: 150,
        render: (h, { row }) => (
          <el-select value={row.department} size="small" on-input={(v) => { row.department = v }}>
            {DEPARTMENT_OPTIONS.map((o) => <el-option key={o.value} label={o.label} value={o.value} />)}
          </el-select>
        )
      },
      {
        prop: 'salary', label: '薪资', width: 150, align: 'right',
        render: (h, { row }) => (
          <el-input
            value={String(row.salary)}
            size="small"
            type="number"
            on-input={(v) => { row.salary = Number(v) }}
          />
        )
      },
      {
        prop: '_flag', label: '状态', width: 90,
        render: (h, { row }) => {
          if (row._isNew) return <el-tag type="success" size="small">新增</el-tag>
          if (isDirty(row)) return <el-tag type="warning" size="small">已改</el-tag>
          return <el-tag type="info" size="small" effect="plain">未变</el-tag>
        }
      },
      {
        prop: 'operate', label: '操作', width: 90, fixed: 'right',
        btns: [{ name: '删除', type: 'danger', clickEvent: (row) => removeRow(row) }]
      }
    ]

    const options = { border: true, rowkey: 'id', size: 'small' }

    return { rows, columns, options, diff, submitting, addRow, submit, reload }
  }
})
</script>
