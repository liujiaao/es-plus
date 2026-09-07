<template>
  <div>
    <el-alert
      type="warning"
      :closable="false"
      style="margin-bottom: 10px;"
      description="三个易忽略的边界：① 服务端 422 字段错误回填到对应表单项；② 删除本页最后一条时自动回退一页；③ 删除可撤销（延迟提交，撤销窗口内可恢复）。"
    />

    <!-- ① 新增表单：演示 422 字段级错误回填 -->
    <div style="border:1px solid #ebeef5;border-radius:4px;padding:14px 16px;margin-bottom:12px;">
      <div style="font-size:13px;color:#606266;margin-bottom:10px;">
        新增员工（试试重复姓名「员工1」或把薪资填成负数，观察字段错误）
      </div>
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <el-input v-model="addForm.name" size="small" placeholder="姓名" style="width:150px;" />
          <div v-if="formErrors.name" style="color:#f56c6c;font-size:12px;margin-top:2px;">{{ formErrors.name }}</div>
        </div>
        <div>
          <el-select v-model="addForm.department" size="small" style="width:130px;">
            <el-option v-for="o in departmentOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </div>
        <div>
          <el-input v-model.number="addForm.salary" size="small" type="number" placeholder="薪资" style="width:130px;" />
          <div v-if="formErrors.salary" style="color:#f56c6c;font-size:12px;margin-top:2px;">{{ formErrors.salary }}</div>
        </div>
        <el-button size="small" type="primary" :loading="adding" @click="submitAdd">新增</el-button>
      </div>
    </div>

    <!-- ③ 删除撤销条 -->
    <el-alert
      v-if="undo"
      type="info"
      :closable="false"
      style="margin-bottom:10px;"
    >
      已删除「{{ undo.row.name }}」，{{ undo.seconds }} 秒后生效。
      <el-button type="text" style="margin-left:8px;" @click="undoDelete">撤销</el-button>
    </el-alert>

    <es-table
      :data-source="allRows"
      :columns="columns"
      :options="options"
      :pagination="pageSeed"
    />
  </div>
</template>

<script lang="jsx">
/**
 * CRUD 边界场景合集 —— 补齐健壮性「最后一公里」
 *
 * ① 422 字段错误：api.create 抛 ApiError.fields 时，把 { prop: msg } 回填到对应输入框下方，
 *    而非只弹一条笼统的 toast。
 * ② 分页边界：删除当前页最后一条后，若当前页已空且非首页，自动回退一页，避免停在空白页。
 *    —— 现由组件内建客户端分页（options.localPagination）自动处理，页面无需任何分页样板代码。
 * ③ 删除撤销：删除先本地移除并倒计时，窗口内可「撤销」恢复；超时才真正提交后端。
 *
 * 采用内建客户端分页：直接把全量 allRows 交给 es-table，翻页/切片/total/边界回退
 * 全部由组件内部消费；写操作仍经过假后端校验/落库。
 */
import { defineComponent, ref, reactive, onBeforeUnmount } from '@vue/composition-api'
import { Message } from 'element-ui'
import { createEmployeeService, DEPARTMENT_OPTIONS, STATUS_MAP } from '../_mock/crud-service'

const PAGE_SIZE = 5
const UNDO_SECONDS = 5

export default defineComponent({
  name: 'TableCrudEdgeCases',
  setup() {
    const api = createEmployeeService({ seedCount: 13, latency: 300 })
    const allRows = ref(api.snapshot())

    // 内建客户端分页：只需把全量数据交给 es-table，翻页/切片/total/边界回退由组件内部处理。
    // pageSeed 仅播种初始 pageSize（无需 total、无需事件、无需手动切片）。
    const pageSeed = { pageSize: PAGE_SIZE }

    // ── ① 新增 + 422 字段错误 ──
    const addForm = reactive({ name: '', department: '技术部', salary: 8000 })
    const formErrors = reactive({ name: '', salary: '' })
    const adding = ref(false)
    const clearErrors = () => { formErrors.name = ''; formErrors.salary = '' }

    const submitAdd = async () => {
      clearErrors()
      adding.value = true
      try {
        const created = await api.create({ ...addForm, status: 'active', email: `${addForm.name}@example.com` })
        // 仅更新数据源，total / 分页由组件内部随长度自动同步
        allRows.value = [created, ...allRows.value]
        addForm.name = ''
        Message.success('新增成功')
      } catch (e) {
        if (e.fields) {
          // 服务端字段错误 → 精确回填到对应输入框
          Object.entries(e.fields).forEach(([prop, msg]) => { formErrors[prop] = msg })
        } else {
          Message.error(e.message)
        }
      } finally {
        adding.value = false
      }
    }

    // ── ③ 删除撤销（② 分页边界回退已由组件内建分页自动处理） ──
    const undo = ref(null) // { row, index, seconds, timer, tick }

    const finalizeDelete = async (id) => {
      try {
        await api.remove(id)
      } catch (e) {
        Message.error(`删除未能保存：${e.message}`)
      }
    }

    const clearUndo = () => {
      if (!undo.value) return
      clearTimeout(undo.value.timer)
      clearInterval(undo.value.tick)
      undo.value = null
    }

    const deleteRow = (row) => {
      // 若已有待撤销项，先把它真正提交（同一时刻只保留一个撤销窗口）
      if (undo.value) {
        finalizeDelete(undo.value.row.id)
        clearUndo()
      }
      const index = allRows.value.findIndex((r) => r.id === row.id)
      // 仅从数据源移除；若删空了当前页，组件会自动回退到上一有效页
      allRows.value = allRows.value.filter((r) => r.id !== row.id)

      const state = { row, index, seconds: UNDO_SECONDS, timer: null, tick: null }
      state.tick = setInterval(() => {
        state.seconds -= 1
        if (undo.value) undo.value = { ...state }
      }, 1000)
      state.timer = setTimeout(() => {
        finalizeDelete(row.id)
        clearUndo()
      }, UNDO_SECONDS * 1000)
      undo.value = { ...state }
    }

    const undoDelete = () => {
      if (!undo.value) return
      const { row, index } = undo.value
      const next = [...allRows.value]
      next.splice(Math.min(index, next.length), 0, row) // 原位恢复
      allRows.value = next
      clearUndo()
      Message.success('已撤销删除')
    }

    onBeforeUnmount(clearUndo)

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 110 },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'salary', label: '薪资', width: 120, align: 'right',
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      },
      {
        prop: 'status', label: '状态', width: 90,
        render: (h, { row }) => {
          const [label, type] = STATUS_MAP[row.status] || [row.status, '']
          return <el-tag type={type} size="small">{label}</el-tag>
        }
      },
      {
        prop: 'operate', label: '操作', width: 90, fixed: 'right',
        btns: [{ name: '删除', type: 'danger', clickEvent: (row) => deleteRow(row) }]
      }
    ]

    const options = { border: true, rowkey: 'id', size: 'small', localPagination: true }

    return {
      departmentOptions: DEPARTMENT_OPTIONS,
      allRows, pageSeed,
      addForm, formErrors, adding, submitAdd,
      undo, undoDelete,
      columns, options
    }
  }
})
</script>
