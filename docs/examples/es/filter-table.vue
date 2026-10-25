<template>
  <!-- 同一件事：查询 / 列表 / 码值标签 / 分页 / 操作列全在 schema 里，宿主只提供数据与动作 -->
  <es-crud-page :schema="schema" :http-request="request" @btn-click="handleBtnClick" />
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { EsCrudPage } from '@es-plus/vue3'

// 演示数据（真实项目里换成接口返回；两端示例用同一份）
const DB = [
  { orderNo: 'SO-2026-001', customer: '张伟', amount: 1280, status: 'pending' },
  { orderNo: 'SO-2026-002', customer: '李娜', amount: 899, status: 'shipped' },
  { orderNo: 'SO-2026-003', customer: '王强', amount: 4500, status: 'pending' },
  { orderNo: 'SO-2026-004', customer: '刘洋', amount: 320, status: 'canceled' },
  { orderNo: 'SO-2026-005', customer: '陈静', amount: 2380, status: 'shipped' },
  { orderNo: 'SO-2026-006', customer: '赵磊', amount: 760, status: 'pending' },
  { orderNo: 'SO-2026-007', customer: '孙悦', amount: 1520, status: 'canceled' },
  { orderNo: 'SO-2026-008', customer: '周涛', amount: 980, status: 'shipped' },
  { orderNo: 'SO-2026-009', customer: '吴敏', amount: 16800, status: 'pending' },
  { orderNo: 'SO-2026-010', customer: '郑爽', amount: 240, status: 'shipped' },
  { orderNo: 'SO-2026-011', customer: '冯磊', amount: 3350, status: 'canceled' },
  { orderNo: 'SO-2026-012', customer: '许晴', amount: 610, status: 'pending' },
]

// 页面定义：纯 JSON（可存库、可下发、三端通用）。查询项、列、码值标签、
// 操作列、分页都在这里；没有事件绑定，也没有 v-if。
const schema = {
  formItems: [
    {
      prop: 'orderNo',
      label: '订单号',
      formtype: 'Input',
      span: 6,
      attrs: { clearable: true, placeholder: '请输入订单号' },
    },
    {
      prop: 'status',
      label: '状态',
      formtype: 'Select',
      span: 6,
      attrs: { clearable: true, placeholder: '请选择' },
      dataOptions: [
        { label: '待发货', value: 'pending' },
        { label: '已发货', value: 'shipped' },
        { label: '已取消', value: 'canceled' },
      ],
    },
  ],
  columns: [
    { prop: 'orderNo', label: '订单号' },
    { prop: 'customer', label: '客户' },
    { prop: 'amount', label: '金额' },
    {
      prop: 'status',
      label: '状态',
      // 码值 → 中文彩色标签：一份声明，零 render（native 版是三条 v-if 分支）
      dataOptions: [
        { label: '待发货', value: 'pending', tagType: 'warning' },
        { label: '已发货', value: 'shipped', tagType: 'success' },
        { label: '已取消', value: 'canceled', tagType: 'danger' },
      ],
    },
  ],
  operationColumn: { label: '操作', btns: [{ name: '查看' }] },
  pagination: { pageSize: 5 },
}

/** 取数：真实项目里换成接口调用；这里按 es-plus 的默认响应契约作答 */
async function request({ pageNo = 1, pageSize = 10, formParams = {} } = {}) {
  const list = DB.filter((row) => (formParams.orderNo ? row.orderNo.includes(formParams.orderNo) : true)).filter(
    (row) => (formParams.status ? row.status === formParams.status : true),
  )
  const start = (pageNo - 1) * pageSize
  return { rows: list.slice(start, start + pageSize), records: list.length, pageNo, pageSize }
}

/** 唯一的动作：生成的按钮没有 key 时，事件标识就是按钮名 */
function handleBtnClick(key, row) {
  if (key === '查看') ElMessage.info(`查看 ${row.orderNo}`)
}
</script>
