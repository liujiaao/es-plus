<template>
  <div>
    <div style="margin-bottom: 12px;">
      <el-button type="primary" size="mini" icon="el-icon-check" @click="saveAll">保存全部</el-button>
      <el-button size="mini" icon="el-icon-refresh-left" @click="cancelAll">取消编辑</el-button>
      <span style="margin-left: 12px; color: #909399; font-size: 13px;">点击单元格进入编辑状态，或用行内「编辑」按钮切换</span>
    </div>
    <es-table
      :data-source="data"
      :columns="columns"
      :options="options"
      @cell-click="handleCellClick"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 行内编辑 —— 演示单元格点击进入编辑态
 *
 * 关键点：
 *   1. 每行携带 `editing` 标记，render 函数据此在「编辑器 / 纯文本」间切换
 *   2. Vue 2 JSX 双向绑定手动展开：value={row.x} + on-input/on-change
 *      （不能直接写 v-model，@vue/babel-preset-jsx 在 setup 下处理 v-model 有兼容问题）
 *   3. @cell-click 由 EsTable 透传 el-table 原生事件，(row, column) 判断非操作列后置为编辑态
 *   4. 取消编辑通过初始深拷贝快照 originalData 还原
 */
import { defineComponent, reactive } from '@vue/composition-api'

export default defineComponent({
  name: 'TableEditTable',
  setup() {
    const seed = [
      { id: 1, name: '张三', dept: '研发部', age: 28, editing: false },
      { id: 2, name: '李四', dept: '市场部', age: 35, editing: false },
      { id: 3, name: '王五', dept: '财务部', age: 24, editing: false }
    ]
    const data = reactive(seed.map((r) => ({ ...r })))
    // 深拷贝快照，用于「取消编辑」还原
    let originalData = JSON.parse(JSON.stringify(seed))

    const deptOptions = ['研发部', '市场部', '财务部', '人事部']

    const columns = [
      { prop: 'id', label: 'ID', width: 80 },
      {
        prop: 'name',
        label: '姓名',
        render: (h, { row }) =>
          row.editing ? (
            <el-input size="mini" value={row.name} on-input={(v) => { row.name = v }} />
          ) : (
            <span>{row.name}</span>
          )
      },
      {
        prop: 'dept',
        label: '部门',
        render: (h, { row }) =>
          row.editing ? (
            <el-select size="mini" value={row.dept} on-change={(v) => { row.dept = v }} style="width:100%">
              {deptOptions.map((d) => (
                <el-option key={d} label={d} value={d} />
              ))}
            </el-select>
          ) : (
            <span>{row.dept}</span>
          )
      },
      {
        prop: 'age',
        label: '年龄',
        render: (h, { row }) =>
          row.editing ? (
            <el-input size="mini" type="number" value={row.age} on-input={(v) => { row.age = Number(v) }} />
          ) : (
            <span>{row.age}</span>
          )
      },
      {
        prop: 'operate',
        label: '操作',
        width: 140,
        render: (h, { row }) =>
          row.editing ? (
            <el-button size="mini" type="text" on-click={() => { row.editing = false }}>完成</el-button>
          ) : (
            <el-button size="mini" type="text" on-click={() => { row.editing = true }}>编辑</el-button>
          )
      }
    ]

    const options = { border: true }

    const handleCellClick = (row, column) => {
      // 操作列不进入编辑态
      if (column && (column.property === 'operate' || column.label === '操作')) return
      row.editing = true
    }

    const saveAll = () => {
      data.forEach((r) => { r.editing = false })
      // 保存后更新快照；真实业务在此调用保存接口
      originalData = data.map((r) => {
        const copy = { ...r }
        delete copy.editing
        return copy
      })
    }

    const cancelAll = () => {
      originalData.forEach((snap, i) => {
        Object.assign(data[i], snap, { editing: false })
      })
    }

    return { data, columns, options, handleCellClick, saveAll, cancelAll }
  }
})
</script>
