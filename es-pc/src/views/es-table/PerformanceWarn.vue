<template>
  <div class="performance-warn-demo">
    <a-alert type="warning" show-icon class="intro-alert">
      <template #message>a-table 没有虚拟滚动：一次渲染超过 1000 行会明显卡顿</template>
      <template #description>
        es-table 会按<strong>实际渲染的行数</strong>判断，超过阈值时在浏览器控制台告警一次。
        分页（服务端或 <code>localPagination</code>）只渲染当前页，不会触发；
        确实要一次展示大量数据，请用 <code>engine: 'vxe'</code>（vxe-grid 内置虚拟滚动）。
      </template>
    </a-alert>

    <div class="control-bar">
      <a-radio-group v-model:value="rowCount" size="small">
        <a-radio-button :value="200">200 行</a-radio-button>
        <a-radio-button :value="800">800 行</a-radio-button>
        <a-radio-button :value="1200">1200 行</a-radio-button>
      </a-radio-group>
      <a-switch v-model:checked="paged" checked-children="本地分页" un-checked-children="一次全渲染" />
      <a-tag :color="willWarn ? 'orange' : 'green'" class="warn-tag">
        {{ willWarn ? '会触发告警（打开控制台查看）' : '不会触发告警' }}
      </a-tag>
    </div>

    <es-table
      :key="tableKey"
      :options="tableOptions"
      :data-source="rows"
      :pagination="{ pageSize: 20 }"
      :columns="columns"
    />

    <a-divider orientation="left">同一 fixture 的实测首渲染（bench-table-2026-11-08，未打包 dev 环境）</a-divider>
    <a-table :data-source="benchData" :columns="benchColumns" :pagination="false" size="small" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'firstRowMs'">
          <span :style="{ color: levelColor[record.level], fontWeight: 600 }">
            {{ record.firstRowMs.toLocaleString() }}
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'level'">
          <a-tag :color="levelColor[record.level]">{{ levelText[record.level] }}</a-tag>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const rowCount = ref(200)
const paged = ref(true)

// 一次全渲染 1200 行才会告警；本地分页只渲染当前页 20 行
const willWarn = computed(() => !paged.value && rowCount.value > 1000)

// 告警每个表格实例只发一次：切换参数时换 key 重建实例，方便反复演示
const tableKey = computed(() => `${rowCount.value}-${paged.value}`)

const rows = computed(() =>
  Array.from({ length: rowCount.value }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['研发部', '产品部', '设计部', '运营部'][i % 4],
    status: i % 3 === 0 ? 0 : 1,
  }))
)

const tableOptions = computed(() => ({
  localPagination: paged.value,
  height: 360,
}))

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名' },
  { prop: 'department', label: '部门' },
  {
    prop: 'status',
    label: '状态',
    dataOptions: [
      { label: '正常', value: 1, tagType: 'success' },
      { label: '停用', value: 0, tagType: 'danger' },
    ],
  },
]

const levelColor = { ok: '#52c41a', slow: '#fa8c16', bad: '#f5222d' }
const levelText = { ok: '默认引擎可用', slow: '建议分页或 vxe', bad: '必须分页或 vxe' }

const benchData = [
  { id: 1, lib: 'antdv', rows: 1000, firstRowMs: 1322, level: 'ok' },
  { id: 2, lib: 'antdv', rows: 5000, firstRowMs: 12369, level: 'slow' },
  { id: 3, lib: 'antdv', rows: 20000, firstRowMs: 510295, level: 'bad' },
  { id: 4, lib: 'vue3', rows: 1000, firstRowMs: 1140, level: 'ok' },
  { id: 5, lib: 'vue3', rows: 5000, firstRowMs: 5408, level: 'slow' },
  { id: 6, lib: 'vue3', rows: 20000, firstRowMs: 44028, level: 'bad' },
]

const benchColumns = [
  { title: '渲染端', dataIndex: 'lib', width: 100 },
  { title: '一次渲染行数', dataIndex: 'rows', width: 130 },
  { title: '首行出现（ms）', dataIndex: 'firstRowMs', width: 150 },
  { title: '建议', dataIndex: 'level' },
]
</script>

<style scoped>
.performance-warn-demo {
  max-width: 900px;
}
.intro-alert {
  margin-bottom: var(--es-space-3);
}
.control-bar {
  display: flex;
  gap: var(--es-space-2);
  margin-bottom: var(--es-space-3);
  align-items: center;
  flex-wrap: wrap;
}
.warn-tag {
  margin: 0;
}
</style>
