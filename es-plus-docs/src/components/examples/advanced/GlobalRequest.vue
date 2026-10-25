<template>
  <div class="global-request-demo">
    <el-alert type="success" :closable="false" show-icon>
      <template #title>
        本组件 0 行请求代码 —— httpRequest 在站点入口配了一次，页面只声明了 apiParams
      </template>
    </el-alert>

    <es-crud-page :schema="pageSchema" />

    <!-- 请求检查器：数据来自 utils/demo-http.ts 里被全局函数调用的那一次请求 -->
    <div class="request-log">
      <span class="log-label">请求检查器</span>
      <el-tag size="small" type="success">全局函数已接管 · 第 {{ log.count }} 次</el-tag>
      <span v-if="log.last" class="log-detail">
        <code>{{ log.last.method }} {{ log.last.url }}</code>
        <span>{{ log.last.query }}</span>
        <span>返回 {{ log.last.rows }} 行 / 共 {{ log.last.total }} 行</span>
      </span>
      <span v-else class="log-detail">等待首次请求…</span>
    </div>
  </div>
</template>

<script setup>
/**
 * 全局请求：整页零请求代码
 *
 * 对比 advanced/ZeroCodeQuery：那边把 httpRequest 写在 tableOptions 里（每个页面一份），
 * 这边一个都不写 —— 请求函数在入口 app.use(ESPlus, { httpRequest }) 配了一次。
 *
 * 关键点：
 *   1. 整份 pageSchema 可 JSON 序列化：没有函数、没有组件引用 —— 存库、服务端下发、
 *      AI 生成都成立（有函数值的配置过不了 JSON.stringify 这一关）；
 *   2. 组件级 httpRequest 仍然优先：个别页面要特殊处理（签名、重试）就在那一页覆盖，
 *      其余页面继续吃全局配置；
 *   3. 查询 / 分页 / 重置全部落在这一个函数上，页面不需要知道它们的存在。
 */
import { EsCrudPage } from '@es-plus/vue3'
import { demoRequestLog as log } from '@/utils/demo-http'

// 码值 → 中文 + 语义色：同一份 dataOptions 既给筛选下拉、也给状态列（列上带 tagType
// 就渲染成本端原生标签，不需要 render 函数）
const STATUS_OPTIONS = [
  { label: '待发货', value: 0, tagType: 'warning' },
  { label: '已发货', value: 1, tagType: 'success' },
  { label: '已取消', value: 2, tagType: 'info' },
]

const pageSchema = {
  formItems: [
    {
      prop: 'keyword',
      label: '关键字',
      formtype: 'Input',
      span: 8,
      attrs: { placeholder: '订单号 / 客户', clearable: true },
    },
    {
      prop: 'status',
      label: '状态',
      formtype: 'Select',
      span: 6,
      dataOptions: STATUS_OPTIONS,
      attrs: { placeholder: '全部', clearable: true },
    },
  ],
  columns: [
    { prop: 'orderNo', label: '订单号', width: 150 },
    { prop: 'customer', label: '客户', minWidth: 140 },
    { prop: 'channel', label: '渠道', width: 90 },
    { prop: 'amount', label: '金额（元）', width: 110, align: 'right' },
    // 码值 → 中文与颜色也走配置，同样不需要 render 函数
    { prop: 'status', label: '状态', width: 100, dataOptions: STATUS_OPTIONS },
    { prop: 'createTime', label: '创建时间', width: 170 },
  ],
  tableOptions: {
    border: true,
    stripe: true,
    rowkey: 'id',
    // 只声明接口；请求函数由入口提供
    apiParams: { url: '/api/demo/orders', method: 'GET' },
    // 响应信封也是配置：后端返回 { data, total }，不需要在页面里拆包
    configTableOut: { tableData: 'data', total: 'total', pageSize: 'pageSize', current: 'pageIndex' },
  },
  pagination: { pageSize: 8 },
}
</script>

<style scoped>
.global-request-demo > .el-alert {
  margin-bottom: 16px;
}
.request-log {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px dashed var(--el-color-success-light-5, #b3e19d);
  border-radius: 8px;
  background: var(--el-color-success-light-9, #f0f9eb);
  font-size: 13px;
  color: #606266;
}
.log-label {
  font-weight: 600;
  color: #303133;
}
.log-detail {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #606266;
}
.log-detail code {
  font-family: 'Fira Code', monospace;
  color: #d63384;
}
</style>
