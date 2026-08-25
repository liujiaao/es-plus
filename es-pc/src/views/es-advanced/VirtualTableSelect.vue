<template>
  <div class="virtual-select-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 多选 + 跨页记忆 + 操作按钮</h4>
    <div style="margin-bottom: 12px;">
      <a-button type="primary" size="small" @click="getSelection">获取选中行</a-button>
      <a-button size="small" @click="clearSelection">清空选择</a-button>
      <a-tag v-if="selectedCount > 0" type="info" style="margin-left: 12px;">
        已选 {{ selectedCount }} 条
      </a-tag>
    </div>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
  </div>
</template>