<template>
  <div class="engine-vxe-demo">
    <div class="intro-wrap">
      <el-alert
        title="vxe 引擎行内编辑 — 三件套缺一不可"
        type="warning"
        :closable="false"
        show-icon
      >
        行内编辑需要同时声明：① <strong>engine: 'vxe'</strong>（引擎）、
        ② <strong>editConfig</strong>（表级开关）、
        ③ 列上 <strong>editRender</strong>（单元格渲染器）。
        漏写 engine 时，es-table 会在控制台告警并忽略这些配置；漏写 editRender 时单元格不可编辑（用 AI 生成器生成时会提示）。
      </el-alert>
    </div>

    <es-table
      :columns="columns"
      :options="tableOptions"
      :data-source="tableData"
      @cell-edit="onCellEdit"
    />

    <div v-if="lastEdit" class="edit-log">
      <strong>最近编辑：</strong>
      字段 <code>{{ lastEdit.prop }}</code> ·
      旧值 <code>{{ lastEdit.oldValue }}</code> →
      新值 <code>{{ lastEdit.value }}</code>
    </div>
  </div>
</template>

<script>
import { defineComponent, reactive, ref } from '@vue/composition-api'

export default defineComponent({
  name: 'EngineVxe',
  setup() {
    const tableData = reactive([
      { id: 1, name: '无线鼠标', price: 89, stock: 120, category: 'peripheral' },
      { id: 2, name: '机械键盘', price: 359, stock: 45, category: 'peripheral' },
      { id: 3, name: 'USB 集线器', price: 59, stock: 200, category: 'accessory' },
    ])

    // ① 引擎 ② 表级 editConfig ③ 列上 editRender — 三件套
    const columns = [
      { prop: 'name', label: '商品名称', width: 160 },
      {
        prop: 'price',
        label: '价格（元）',
        width: 140,
        editRender: { name: '$input', props: { type: 'number', min: 0 } },
      },
      {
        prop: 'stock',
        label: '库存',
        width: 110,
        editRender: { name: '$input', props: { type: 'number', min: 0 } },
      },
      {
        prop: 'category',
        label: '分类',
        width: 140,
        dataOptions: [
          { label: '外设', value: 'peripheral' },
          { label: '配件', value: 'accessory' },
        ],
        editRender: {
          name: '$select',
          options: [
            { label: '外设', value: 'peripheral' },
            { label: '配件', value: 'accessory' },
          ],
        },
      },
    ]

    const tableOptions = {
      engine: 'vxe',           // ① 必须声明引擎
      editConfig: {             // ② 表级开关
        trigger: 'click',
        mode: 'cell',
        showStatus: true,
      },
      border: true,
      height: 280,
    }

    const lastEdit = ref(null)
    function onCellEdit(payload) {
      lastEdit.value = payload
    }

    return { columns, tableOptions, tableData, lastEdit, onCellEdit }
  },
})
</script>

<style scoped>
.engine-vxe-demo {
  max-width: 860px;
}
.intro-wrap {
  margin-bottom: var(--es-space-3);
}
.edit-log {
  margin-top: var(--es-space-2);
  padding: var(--es-space-2) var(--es-space-3);
  background: var(--es-fill-light);
  border-radius: var(--es-radius-xs);
  font-size: var(--es-text-sm);
}
</style>
