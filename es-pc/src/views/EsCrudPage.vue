<template>
  <div class="es-crud-page">
    <h1>EsCrudPage CRUD 编排</h1>
    <p class="subtitle">
      EsCrudPage 是 EsForm + EsTable + EsDialog 的集合编排组件，用一份 JSON Schema
      即可完成整个 CRUD 页面的配置。支持多弹窗、权限控制、行级操作、编程式打开弹窗等。
      使用 <code>@es-plus/adapter-antdv</code> 适配 Ant Design Vue 4.x。
    </p>

    <a-divider />

    <!-- 基础 CRUD -->
    <section id="basic">
      <h2>基础 CRUD</h2>
      <p>配置查询表单 + 数据表格 + 增删改弹窗，一份 Schema 搞定。</p>
            <CodeDemo :source="rawSFCs['./es-crud/Basic.vue']">
        <EsCrudBasic />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 多弹窗 -->
    <section id="multi-dialog">
      <h2>多弹窗</h2>
      <p>通过 <code>dialogs</code> 配置多个不同弹窗（新增、编辑、详情等）。</p>
            <CodeDemo :source="rawSFCs['./es-crud/MultiDialog.vue']">
        <EsCrudMultiDialog />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 权限控制 -->
    <section id="permission">
      <h2>权限控制</h2>
      <p>通过 <code>permissionValue</code> 控制按钮显隐，结合全局 <code>permission</code> 校验。</p>
            <CodeDemo :source="rawSFCs['./es-crud/Permission.vue']">
        <EsCrudPermission />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 编程式打开弹窗 -->
    <section id="program-open">
      <h2>编程式打开弹窗</h2>
      <p>通过 <code>ref</code> 调用 <code>openDialog(key, data?)</code> 编程式打开弹窗。</p>
            <CodeDemo :source="rawSFCs['./es-crud/ProgramOpen.vue']">
        <EsCrudProgramOpen />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 自定义弹窗内容 -->
    <section id="custom-render">
      <h2>自定义弹窗内容</h2>
      <p><code>dialogs</code> 使用 <code>render</code> 函数渲染自定义组件。</p>
            <CodeDemo :source="rawSFCs['./es-crud/CustomRender.vue']">
        <EsCrudCustomRender />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 动态标题 -->
    <section id="dynamic-title">
      <h2>动态标题与回填</h2>
      <p>edit 弹窗 title 为函数 + 表单自动回填行数据。</p>
            <CodeDemo :source="rawSFCs['./es-crud/DynamicTitle.vue']">
        <EsCrudDynamicTitle />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 行确认 -->
    <section id="row-confirm">
      <h2>行确认与删除</h2>
      <p>操作列 <code>confirm</code> 确认提示 + <code>btn-click</code> 事件处理删除/发布。</p>
            <CodeDemo :source="rawSFCs['./es-crud/RowConfirm.vue']">
        <EsCrudRowConfirm />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 完整业务 -->
    <section id="full-business">
      <h2>完整业务场景</h2>
      <p>用户管理全功能：多弹窗 + 动态标题 + render 详情 + 导出。</p>
            <CodeDemo :source="rawSFCs['./es-crud/FullBusiness.vue']">
        <EsCrudFullBusiness />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 自定义弹窗底部 -->
    <section id="custom-footer">
      <h2>自定义弹窗底部</h2>
      <p><code>configBtn</code> 自定义三按钮（取消/拒绝/通过）实现审批场景。</p>
            <CodeDemo :source="rawSFCs['./es-crud/CustomFooter.vue']">
        <EsCrudCustomFooter />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 隐藏操作列 -->
    <section id="hidden-column">
      <h2>隐藏操作列</h2>
      <p><code>operationColumn: false</code> + 纯工具栏操作，只读列表场景。</p>
            <CodeDemo :source="rawSFCs['./es-crud/HiddenColumn.vue']">
        <EsCrudHiddenColumn />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>API / 属性</h2>
    <a-table
      :dataSource="crudProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
import EsCrudBasic from './es-crud/Basic.vue'
import EsCrudMultiDialog from './es-crud/MultiDialog.vue'
import EsCrudPermission from './es-crud/Permission.vue'
import EsCrudProgramOpen from './es-crud/ProgramOpen.vue'
import EsCrudCustomRender from './es-crud/CustomRender.vue'
import EsCrudDynamicTitle from './es-crud/DynamicTitle.vue'
import EsCrudRowConfirm from './es-crud/RowConfirm.vue'
import EsCrudFullBusiness from './es-crud/FullBusiness.vue'
import EsCrudCustomFooter from './es-crud/CustomFooter.vue'
import EsCrudHiddenColumn from './es-crud/HiddenColumn.vue'

const rawSFCs = import.meta.glob('./es-crud/*.vue', { query: '?raw', import: 'default', eager: true })

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const crudProps = [
  { key: '1', prop: 'schema', type: 'CrudPageSchema', default: '{}', desc: 'CRUD 页面完整配置' },
  { key: '2', prop: 'schema.formItems', type: 'FormItemOption[]', default: '[]', desc: '查询表单字段' },
  { key: '3', prop: 'schema.columns', type: 'TableColumn[]', default: '[]', desc: '表格列配置' },
  { key: '4', prop: 'schema.tableOptions', type: 'TableOptions', default: '{}', desc: '表格选项' },
  { key: '5', prop: 'schema.toolbarBtns', type: 'BtnConfig[]', default: '[]', desc: '工具栏按钮' },
  { key: '6', prop: 'schema.operationColumn', type: 'object', default: '{}', desc: '操作列配置' },
  { key: '7', prop: 'schema.dialogs', type: 'Record<string, DialogOptions>', default: '{}', desc: '弹窗配置集合' },
]
</script>

<style scoped>
h1 { font-size: 30px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
