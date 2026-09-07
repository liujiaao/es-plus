<template>
  <div>
    <el-alert
      type="warning"
      :closable="false"
      style="margin-bottom: 10px;"
      description="乐观更新 + 失败回滚：切换开关立即改 UI，同时发起异步请求；请求失败自动回滚到原值并提示。打开「模拟失败」开关可观察回滚。"
    />
    <div style="margin-bottom: 10px; display: flex; gap: 12px; align-items: center;">
      <span style="font-size: 13px; color: #606266;">模拟请求失败：</span>
      <el-switch v-model="failMode" active-text="失败" inactive-text="正常" />
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
 * 乐观更新 + 失败回滚 —— 专门补齐「请求健壮性」空白
 *
 * 关键点：
 *   1. 切换状态时先本地改值（乐观更新），UI 立即响应；同时发起 api.update。
 *   2. 请求期间 row._updating 置真，禁用开关避免并发点击。
 *   3. 失败（打开 failMode 注入）时把状态回滚为原值并提示；成功则保留。
 *   本地 rows 作为展示数据源，服务端仅负责「持久化 + 成功/失败信号」。
 */
import { defineComponent, ref } from '@vue/composition-api'
import { Message } from 'element-ui'
import { createEmployeeService, STATUS_MAP } from '../_mock/crud-service'

export default defineComponent({
  name: 'TableOptimisticToggle',
  setup() {
    const api = createEmployeeService({ seedCount: 6, latency: 600 })
    // 预置 _updating，保证其响应式（Vue2 无法侦测后加属性）
    const rows = ref(api.snapshot().slice(0, 6).map((r) => ({ ...r, _updating: false })))
    const failMode = ref(false)

    const toggleStatus = async (row) => {
      if (row._updating) return
      const prev = row.status
      const next = prev === 'active' ? 'leave' : 'active'
      row.status = next        // 乐观更新
      row._updating = true
      try {
        await api.update(row.id, { status: next }, { fail: failMode.value })
        Message.success(`${row.name} 状态已更新`)
      } catch (e) {
        row.status = prev      // 回滚
        Message.error(`${e.message}，已回滚为「${STATUS_MAP[prev][0]}」`)
      } finally {
        row._updating = false
      }
    }

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 110 },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'salary', label: '薪资', width: 130, align: 'right',
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      },
      {
        prop: 'status', label: '在职状态', width: 160,
        render: (h, { row }) => (
          <el-switch
            value={row.status === 'active'}
            disabled={row._updating}
            active-text="在职"
            inactive-text="离职"
            on-change={() => toggleStatus(row)}
          />
        )
      }
    ]

    const options = { border: true, rowkey: 'id', size: 'small' }

    return { rows, failMode, columns, options }
  }
})
</script>
