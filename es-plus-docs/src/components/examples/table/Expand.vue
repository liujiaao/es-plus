<template>
  <div class="example-expand-table">
    <div class="mode-switch">
      <el-radio-group v-model="showMode" size="small">
        <el-radio-button label="expand">展开行</el-radio-button>
        <el-radio-button label="tree">树形数据</el-radio-button>
      </el-radio-group>
    </div>
    <es-table
      v-if="showMode === 'expand'"
      :data-source="tableData"
      :columns="expandColumns"
      :options="{ expand: true }"
    >
      <template #expand="{ row }">
        <div class="expand-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="详细地址">{{ row.detailAddress }}</el-descriptions-item>
            <el-descriptions-item label="入职日期">{{ row.joinDate }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ row.department }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ row.remark }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </template>
    </es-table>
    <es-table
      v-else
      :data-source="treeData"
      :columns="treeColumns"
      :options="{ border: true, rowKey: 'id' }"
    />
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
import { ref } from 'vue'
import { ElDescriptions, ElDescriptionsItem, ElRadioGroup, ElRadioButton } from 'element-plus'

const showMode = ref('expand')

const tableData = [
  {
    name: '张三',
    age: 28,
    detailAddress: '北京市朝阳区xxx街道xxx号',
    joinDate: '2020-03-15',
    department: '技术部',
    remark: '前端开发工程师，负责公司核心产品的前端开发工作'
  },
  {
    name: '李四',
    age: 32,
    detailAddress: '上海市浦东新区xxx路xxx号',
    joinDate: '2019-06-20',
    department: '产品部',
    remark: '高级产品经理，负责产品规划和需求分析'
  },
  {
    name: '王五',
    age: 24,
    detailAddress: '广州市天河区xxx大道xxx号',
    joinDate: '2021-09-01',
    department: '设计部',
    remark: 'UI设计师，负责产品界面设计'
  }
]

// 展开行列配置：type: 'expand' + scopedSlots 转发展开内容
const expandColumns = [
  { type: 'expand', width: 50, scopedSlots: { customRender: 'expand' } },
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'age', label: '年龄', width: 80 },
  { prop: 'department', label: '部门' }
]

const treeData = ref([
  {
    id: 1,
    name: '公司总部',
    type: 'department',
    leader: '张总',
    children: [
      {
        id: 11,
        name: '技术部',
        type: 'department',
        leader: '李工',
        children: [
          { id: 111, name: '前端组', type: 'team', leader: '王师' },
          { id: 112, name: '后端组', type: 'team', leader: '赵工' }
        ]
      },
      {
        id: 12,
        name: '销售部',
        type: 'department',
        leader: '孙经理',
        children: [
          { id: 121, name: '华东区', type: 'team', leader: '周总' },
          { id: 122, name: '华北区', type: 'team', leader: '吴总' }
        ]
      }
    ]
  },
  {
    id: 2,
    name: '分公司A',
    type: 'branch',
    leader: '陈总',
    children: [
      { id: 21, name: '运营部', type: 'department', leader: '刘总' },
      { id: 22, name: '财务部', type: 'department', leader: '黄总' }
    ]
  }
])

const treeColumns = [
  { prop: 'name', label: '组织名称', width: 200, align: 'left' },
  { prop: 'type', label: '类型', width: 100, formatter: (row) => ({ department: '部门', team: '团队', branch: '分公司' }[row.type] || row.type) },
  { prop: 'leader', label: '负责人'}
]
</script>

<style scoped>
.example-expand-table {
  padding: 0;
}
.mode-switch {
  margin-bottom: 16px;
}
.expand-content {
  padding: 20px;
  background-color: #f5f7fa;
}
</style>
