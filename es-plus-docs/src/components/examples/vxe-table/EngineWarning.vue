<template>
  <div class="engine-warning-demo">
    <el-alert
      title="engine:'vxe' 引擎路由 — editConfig 正确用法"
      type="warning"
      :closable="false"
      show-icon
      class="intro-alert"
    >
      <template #default>
        <code>editConfig</code>、<code>toolbarConfig</code>、<code>keyboardConfig</code> 等键
        仅在 <code>engine:'vxe'</code> 下生效。漏写 engine 时 es-table 会在浏览器控制台告警一次，并忽略这些配置。
      </template>
    </el-alert>

    <div class="compare-grid">
      <!-- 正确写法 -->
      <div class="demo-card correct">
        <div class="card-header">
          <el-tag type="success">✓ 正确</el-tag>
          <span>engine:'vxe' + editConfig + editRender 三件套</span>
        </div>
        <es-table
          :columns="columns"
          :options="correctOptions"
          :data-source="tableData"
          @cell-edit="onCellEdit"
        />
        <p class="hint">单击「价格」或「库存」列单元格可直接编辑</p>
      </div>

      <!-- 错误写法：真实的 es-table，配了 editConfig 却没写 engine —— 打开控制台可见运行时告警 -->
      <div class="demo-card wrong">
        <div class="card-header">
          <el-tag type="danger">✗ 常见错误</el-tag>
          <span>有 editConfig 但缺少 engine:'vxe'</span>
        </div>
        <es-table
          :columns="columns"
          :options="wrongOptions"
          :data-source="tableData"
        />
        <p class="hint">同一份列配置，点单元格不会进入编辑 —— editConfig 在默认引擎上被忽略。</p>
        <el-alert
          type="error"
          :closable="false"
          class="console-alert"
          title="浏览器控制台里的真实告警"
        >
          <template #default>
            <code>
              [es-plus/vue3] options.editConfig 只在 engine: 'vxe' 下生效 ——
              当前引擎为 'default'，这些配置会被忽略……请在 options 里加上 engine: 'vxe'（需安装 vxe-table）。
            </code>
          </template>
        </el-alert>
      </div>
    </div>

    <div v-if="lastEdit" class="edit-log">
      <strong>最近一次编辑：</strong>
      字段 <code>{{ lastEdit.prop }}</code>，
      旧值 <code>{{ lastEdit.oldValue }}</code> →
      新值 <code>{{ lastEdit.value }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { EsTable } from '@es-plus/vue3'
import type { TableColumn, TableOptions } from '@es-plus/vue3'

interface Product { id: number; name: string; price: number; stock: number }

const tableData = reactive<Product[]>([
  { id: 1, name: '无线鼠标', price: 89, stock: 120 },
  { id: 2, name: '机械键盘', price: 359, stock: 45 },
  { id: 3, name: 'USB 集线器', price: 59, stock: 200 },
  { id: 4, name: '显示器支架', price: 199, stock: 78 },
])

// ✓ 正确写法：三件套同时出现
const columns: TableColumn[] = [
  { prop: 'name', label: '商品名称', width: 140 },
  {
    prop: 'price',
    label: '价格（元）',
    width: 130,
    editRender: { name: '$input', props: { type: 'number', min: 0 } },
  },
  {
    prop: 'stock',
    label: '库存',
    width: 110,
    editRender: { name: '$input', props: { type: 'number', min: 0 } },
  },
]

const correctOptions: TableOptions = {
  engine: 'vxe',           // ① 引擎声明
  editConfig: {             // ② 表级开关
    trigger: 'click',
    mode: 'cell',
    showStatus: true,
  },
  // columns 上的 editRender ③ 见上方列定义
  border: true,
  height: 260,
}

// ✗ 常见错误：editConfig 写了，engine 漏了 —— 运行时告警，编辑不生效
const wrongOptions: TableOptions = {
  editConfig: { trigger: 'click', mode: 'cell' },
  border: true,
  height: 260,
}

const lastEdit = ref<{ prop: string; oldValue: unknown; value: unknown } | null>(null)

function onCellEdit(payload: { prop: string; value: unknown; oldValue: unknown }) {
  lastEdit.value = payload
}
</script>

<style scoped>
.engine-warning-demo {
  max-width: 900px;
}
.intro-alert {
  margin-bottom: var(--es-space-4);
}
.console-alert {
  margin-top: var(--es-space-2);
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--es-space-4);
}
@media (max-width: 700px) {
  .compare-grid { grid-template-columns: 1fr; }
}
.demo-card {
  border-radius: var(--es-radius-sm);
  border: 1.5px solid var(--el-border-color);
  padding: var(--es-space-3);
}
.demo-card.correct { border-color: var(--el-color-success-light-5); }
.demo-card.wrong   { border-color: var(--el-color-danger-light-5);  }
.card-header {
  display: flex;
  align-items: center;
  gap: var(--es-space-2);
  margin-bottom: var(--es-space-3);
  font-size: var(--es-text-sm);
  font-weight: 500;
}
.hint {
  margin: var(--es-space-2) 0 0;
  font-size: var(--es-text-xs);
  color: var(--el-text-color-secondary);
}
.edit-log {
  margin-top: var(--es-space-3);
  padding: var(--es-space-2) var(--es-space-3);
  background: var(--el-fill-color-light);
  border-radius: var(--es-radius-xs);
  font-size: var(--es-text-sm);
}
</style>
