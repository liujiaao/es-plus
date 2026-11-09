<template>
  <div class="example-crud-export-fallback">
    <div class="host-bar">
      <span class="host-bar-label">宿主是否接管 @export</span>
      <button
        type="button"
        class="host-toggle"
        :class="{ 'is-on': hostTakesOver }"
        @click="hostTakesOver = !hostTakesOver"
      >
        {{ hostTakesOver ? '已接管' : '未接管' }}
      </button>
      <span class="host-bar-hint">
        未接管时点工具栏「导出」直接下载当前页 CSV；接管后由宿主自己处理，不会再触发内置导出。
      </span>
    </div>
    <es-crud-page ref="crudRef" :schema="schema" v-on="hostListeners" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { EsCrudPage } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const crudRef = ref(null)

// 开关只做一件事：决定宿主是否监听 @export —— 用来对比「内置兜底」与「宿主接管」两条路径
const hostTakesOver = ref(false)
const hostListeners = computed(() =>
  hostTakesOver.value
    ? {
        export: () => {
          message.success('宿主接管：真实项目里在这里调后端导出接口')
        }
      }
    : {}
)

const mockData = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  orderNo: `SO${String(20240001 + i)}`,
  customer: ['张三', '李四', '王五', '赵六'][i % 4],
  amount: (i + 1) * 128,
  status: ['待付款', '已付款', '已发货'][i % 3],
  createTime: `2024-05-${String((i % 28) + 1).padStart(2, '0')}`
}))

const schema = {
  formItems: [
    { prop: 'orderNo', label: '订单号', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [
        { label: '待付款', value: '待付款' },
        { label: '已付款', value: '已付款' },
        { label: '已发货', value: '已发货' }
      ] }
  ],
  columns: [
    { prop: 'orderNo', label: '订单号', width: 140 },
    { prop: 'customer', label: '客户', width: 100 },
    { prop: 'amount', label: '金额', width: 100 },
    { prop: 'status', label: '状态', width: 100 },
    { prop: 'createTime', label: '下单时间' }
  ],
  tableOptions: {
    border: true,
    // 内置导出读它的文件名；默认引擎导出当前页 CSV（vxe 引擎会走原生 exportData）
    exportConfig: { filename: '订单列表' },
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize, formParams }) => {
      let filtered = mockData
      if (formParams?.orderNo) filtered = filtered.filter((d) => d.orderNo.includes(formParams.orderNo))
      if (formParams?.status) filtered = filtered.filter((d) => d.status === formParams.status)
      const start = (pageIndex - 1) * pageSize
      return { data: filtered.slice(start, start + pageSize), total: filtered.length, pageSize, pageIndex }
    },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  // 只留一个工具栏导出键：不声明 actions 里的 add/edit 时操作面不会多出弹窗按钮
  actions: ['export']
}
</script>

<style scoped>
.example-crud-export-fallback { padding: 0; }

.host-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--es-space-2);
  padding: var(--es-space-2) var(--es-space-3);
  margin-bottom: var(--es-space-3);
  background: var(--es-fill-light);
  border-radius: var(--es-radius-sm);
}

.host-bar-label {
  font-size: var(--es-text-sm);
  font-weight: 600;
}

.host-bar-hint {
  font-size: var(--es-text-xs);
  color: var(--es-text-secondary);
}

.host-toggle {
  padding: var(--es-space-1) var(--es-space-3);
  font-size: var(--es-text-xs);
  color: var(--es-text-primary);
  cursor: pointer;
  background: var(--es-bg);
  border: 1px solid var(--es-border);
  border-radius: var(--es-radius-full);
}

.host-toggle.is-on {
  background: var(--es-brand-primary-light);
  border-color: var(--es-brand-primary);
}
</style>
