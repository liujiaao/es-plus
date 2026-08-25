<template>
  <div class="example-dynamic-columns">
    <div class="column-toggle">
      <span class="toggle-label">显示列：</span>
      <a-checkbox-group v-model:value="visibleColumns" size="small">
        <a-checkbox v-for="c in toggleOptions" :key="c.value" :label="c.value">{{ c.label }}</a-checkbox>
      </a-checkbox-group>
    </div>
    <es-table
      :data-source="tableData"
      :columns="dynamicColumns"
      :options="tableOptions"
    />
  </div>
</template>