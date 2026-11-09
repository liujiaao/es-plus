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

<script>
/**
 * 导出按钮兜底（P2-2）。
 *
 * 内置 export 键只 `emit('export', queryModel)`；宿主没监听时原本是空壳。
 * 现在：`@export` 与 `@btn-click` 都没监听 → 调表格内置 `exportData()` 兜底；
 * 只要监听其一，就认为导出交给宿主，避免双份下载。
 *
 * 页面上的开关只切「是否监听 @export」，用来对比两条路径。
 */
const MOCK_DATA = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  orderNo: `SO${String(20240001 + i)}`,
  customer: ['张三', '李四', '王五', '赵六'][i % 4],
  amount: (i + 1) * 128,
  status: ['待付款', '已付款', '已发货'][i % 3],
  createTime: `2024-05-${String((i % 28) + 1).padStart(2, '0')}`
}))

export default {
  name: 'CrudExportFallback',
  data() {
    return {
      hostTakesOver: false,
      schema: {
        formItems: [
          { prop: 'orderNo', label: '订单号', formtype: 'Input' },
          {
            prop: 'status',
            label: '状态',
            formtype: 'Select',
            dataOptions: [
              { label: '待付款', value: '待付款' },
              { label: '已付款', value: '已付款' },
              { label: '已发货', value: '已发货' }
            ]
          }
        ],
        columns: [
          { prop: 'orderNo', label: '订单号', width: 140 },
          { prop: 'customer', label: '客户', width: 100 },
          { prop: 'amount', label: '金额', width: 100 },
          { prop: 'status', label: '状态', width: 100 },
          { prop: 'createTime', label: '下单时间', minWidth: 140 }
        ],
        tableOptions: {
          border: true,
          // 内置导出读它的文件名；默认引擎导出当前页 CSV（vxe 引擎会走原生 exportData）
          exportConfig: { filename: '订单列表' },
          apiParams: { url: '/api/mock' },
          httpRequest: async ({ pageIndex, pageSize, formParams }) => {
            let filtered = MOCK_DATA
            if (formParams && formParams.orderNo) {
              filtered = filtered.filter((d) => d.orderNo.includes(formParams.orderNo))
            }
            if (formParams && formParams.status) {
              filtered = filtered.filter((d) => d.status === formParams.status)
            }
            const start = (pageIndex - 1) * pageSize
            return { data: filtered.slice(start, start + pageSize), total: filtered.length, pageSize, pageIndex }
          },
          configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
        },
        // 只留一个工具栏导出键：不声明 add/edit 时操作面不会多出弹窗按钮
        actions: ['export']
      }
    }
  },
  computed: {
    // 未接管 → 空对象（没有任何监听，触发内置兜底）；接管 → 只有 export 一个监听
    hostListeners() {
      if (!this.hostTakesOver) return {}
      return {
        export: () => {
          this.$message.success('宿主接管：真实项目里在这里调后端导出接口')
        }
      }
    }
  }
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
