<template>
  <div class="fixture">
    <div class="fixture__bar">
      <button id="btn-export" type="button" class="fixture__btn" @click="handleExport">导出 CSV</button>
      <span id="export-result" class="fixture__result" data-testid="export-result">{{ exportResult }}</span>
    </div>

    <div id="main-table" class="fixture__table">
      <es-table
        ref="tableRef"
        :columns="columns"
        :options="options"
        :pagination="pagination"
        :data-source="rows"
        @change-table-sort="onSort"
      />
    </div>

    <div v-if="withVxe" id="vxe-table" class="fixture__table">
      <es-table
        ref="vxeRef"
        :columns="editableColumns"
        :options="vxeOptions"
        :data-source="vxeRows"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { makeColumns, makeEditableColumns, makeRows } from './data'

// 与 TableApp.vue 同构，只是底层库换成 Ant Design Vue（`?lib=antdv`）。
const params = new URLSearchParams(window.location.search)
const rowCount = Number(params.get('rows')) || 60
const withLocalPagination = params.get('local') !== '0'
const withVxe = params.get('vxe') === '1'

const rows = makeRows(rowCount)
const columns = makeColumns()
const options = {
  multiSelect: true,
  border: true,
  rowkey: 'id',
  ...(withLocalPagination ? { localPagination: true } : {}),
}
const pagination = { current: 1, pageSize: 20 }

const tableRef = ref<Record<string, any> | null>(null)
const exportResult = ref('')

const sortEvents: Array<{ prop: unknown; order: unknown }> = []
const onSort = (payload: Record<string, unknown>) => {
  sortEvents.push({ prop: payload?.prop, order: payload?.order })
}

const handleExport = () => {
  const ok = tableRef.value?.exportData?.({ filename: 'fixture-rows' })
  exportResult.value = String(ok)
}

const vxeRows = makeRows(5)
const editableColumns = makeEditableColumns()
const vxeOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  editConfig: { trigger: 'click', mode: 'cell' },
}
const vxeRef = ref<Record<string, any> | null>(null)

onMounted(async () => {
  await nextTick()
  ;(window as unknown as Record<string, unknown>).__fixture = {
    lib: 'antdv',
    sortEvents,
    selection: () => tableRef.value?.getSelectionRows?.() ?? [],
    updateRecords: () => vxeRef.value?.getUpdateRecords?.() ?? [],
  }
  ;(window as unknown as Record<string, unknown>).__fixtureReady = true
})
</script>
