<template>
  <div>
    <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
      <span style="color: #606266;">当前角色：</span>
      <el-radio-group v-model="role" size="small">
        <el-radio-button label="admin">管理员</el-radio-button>
        <el-radio-button label="editor">编辑</el-radio-button>
        <el-radio-button label="viewer">访客</el-radio-button>
      </el-radio-group>
      <span style="color: #909399; font-size: 13px;">
        可用权限：{{ allowed.length ? allowed.join('、') : '（无）' }}
      </span>
    </div>

    <el-divider content-position="left">表单按钮（configBtn.permissionValue）</el-divider>
    <es-form
      :model="model"
      :form-item-list="formItems"
      :config-btn="formButtons"
      :layout-form-props="layout"
    />

    <el-divider content-position="left">表格操作按钮（operate btns.permissionValue）</el-divider>
    <es-table :data-source="data" :columns="columns" :options="{ border: true }" />
  </div>
</template>

<script lang="jsx">
/**
 * 权限按钮（组合）—— 按角色控制表单/表格按钮的显隐
 *
 * 关键点：
 *   1. EsForm 的 configBtn、EsTable operate 列 btns 均支持 permissionValue，
 *      渲染时用 checkPermission(permissionValue) 过滤（读取全局 $EsPlus.permission）
 *   2. 应用初始化时用 configureEsPlus({ permission }) 注入判定函数；这里在组件内
 *      改写共享的 $EsPlus.permission（闭包读取响应式 role），使切换角色即时联动，
 *      并在卸载时还原，避免污染其它页面
 *   3. permission 函数在按钮渲染期间读取 role（响应式），role 变化触发重渲染重新过滤
 */
import { defineComponent, reactive, ref, computed, inject, onUnmounted } from '@vue/composition-api'
import { Message } from 'element-ui'

const rolePerms = {
  admin: ['user:add', 'user:edit', 'user:delete', 'user:export'],
  editor: ['user:add', 'user:edit'],
  viewer: []
}

export default defineComponent({
  name: 'CombinationPermissionButtons',
  setup() {
    const role = ref('admin')
    const allowed = computed(() => rolePerms[role.value] || [])

    // 改写共享的 $EsPlus.permission（等价于应用初始化时 configureEsPlus({ permission })）
    const esPlus = inject('$EsPlus', null) || {}
    const originalPermission = esPlus.permission
    esPlus.permission = (v) => !v || allowed.value.includes(v)
    onUnmounted(() => { esPlus.permission = originalPermission })

    const model = reactive({ keyword: '' })
    const formItems = [
      { prop: 'keyword', label: '关键字', span: 12, formtype: 'Input', attrs: { placeholder: '搜索用户' } }
    ]
    const formButtons = [
      { name: '新增', key: 'add', type: 'primary', permissionValue: 'user:add', click: () => Message.success('新增') },
      { name: '批量导出', key: 'export', permissionValue: 'user:export', click: () => Message.success('导出') }
    ]

    const data = reactive([
      { id: 1, name: '张三', dept: '研发部' },
      { id: 2, name: '李四', dept: '市场部' }
    ])
    const columns = [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'name', label: '姓名', width: 140 },
      { prop: 'dept', label: '部门' },
      {
        prop: 'operate',
        label: '操作',
        width: 160,
        btns: [
          { name: '编辑', type: 'primary', permissionValue: 'user:edit', clickEvent: (row) => Message.success(`编辑 ${row.name}`) },
          { name: '删除', type: 'danger', permissionValue: 'user:delete', clickEvent: (row) => Message.success(`删除 ${row.name}`) }
        ]
      }
    ]

    const layout = { fromLayProps: { labelWidth: '80px', size: 'small', inline: true } }

    return { role, allowed, model, formItems, formButtons, data, columns, layout }
  }
})
</script>
