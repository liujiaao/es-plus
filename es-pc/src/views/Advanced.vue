<template>
  <div class="advanced-page">
    <h1>高级联动</h1>
    <p class="subtitle">
      EsForm、EsTable、useDialog 组合使用，覆盖零代码查询、跨页选择、弹窗嵌套、虚拟滚动等复杂业务场景。
    </p>

    <a-divider />

    <!-- 零代码查询 -->
    <section id="zero-code">
      <h2>零代码查询</h2>
      <p>通过 <code>triggerEvent</code> + <code>apiParams.model</code> 实现表单与表格自动联动，无需手写查询/重置事件。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/ZeroCodeQuery.vue']">
        <ZeroCodeQuery />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="form-table">
      <h2>查询表格完整版</h2>
      <p>EsForm + EsTable + <code>triggerEvent</code> 实现零事件代码查询。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/FormTable.vue']">
        <FormTable />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="cascade-form-table">
      <h2>级联表单联动表格</h2>
      <p>三级级联（<code>isHidden</code>）+ <code>httpRequest</code> 远程数据 + <code>triggerEvent</code> 自动查询。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/CascadeFormTable.vue']">
        <CascadeFormTable />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="dynamic-form-query">
      <h2>动态表单查询</h2>
      <p><code>isHidden</code> 函数式显隐 + 级联选项加载 + <code>apiParams.model</code> 自动同步，零模板代码。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/DynamicFormQuery.vue']">
        <DynamicFormQuery />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 跨页选择 -->
    <section id="cross-page">
      <h2>跨页选择持久化</h2>
      <p><code>rowkey</code> + <code>cachePageSelection</code> 让分页切换后仍能保持勾选状态。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/CrossPageSelect.vue']">
        <CrossPageSelect />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 完整页面 -->
    <section id="admin-page">
      <h2>完整后台管理页</h2>
      <p>搜索表单 + 分页表格 + CRUD 弹窗 + 删除确认 — 一个文件完整后台页面，覆盖 90% 中后台场景。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/AdminPage.vue']">
        <AdminPage />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="crud-page">
      <h2>EsCrudPage 一键 CRUD</h2>
      <p>一个 schema 对象即可渲染完整的查询 + 表格 + 弹窗 CRUD 页面。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/CrudPage.vue']">
        <CrudPage />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 弹窗嵌套 -->
    <section id="dialog-table-form">
      <h2>弹窗内表格嵌套表单</h2>
      <p>两级 useDialog 嵌套：弹窗表格 → 行操作触发二级编辑弹窗。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/DialogTableForm.vue']">
        <DialogTableForm />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="form-table-dialog">
      <h2>完整 CRUD 示例</h2>
      <p>EsForm + EsTable + useDialog 组合实现完整的增删改查。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/FormTableDialog.vue']">
        <FormTableDialog />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="one-line-crud">
      <h2>极简 CRUD 弹窗</h2>
      <p>useDialog + JSX EsForm — 一个函数完成增/编辑弹窗，<code>registerRef</code> 获取表单实例验证。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/OneLineCrud.vue']">
        <OneLineCrud />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 行操作 / 审批 -->
    <section id="row-approval">
      <h2>行操作审批流程</h2>
      <p><code>btns</code> 条件行操作 + 批量选择 + 弹窗（表格+表单）审批。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/RowApproval.vue']">
        <RowApproval />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="conditional-btns">
      <h2>条件行操作按钮</h2>
      <p><code>btns</code> 声明式行操作 — 替代冗长 v-if slot，按钮行为随行数据动态变化。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/ConditionalBtns.vue']">
        <ConditionalBtns />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 订单展开 -->
    <section id="order-expand-table">
      <h2>订单展开明细</h2>
      <p>展开行内嵌套表格，显示订单商品明细与汇总行。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/OrderExpandTable.vue']">
        <OrderExpandTable />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 适配后端 -->
    <section id="any-backend-api">
      <h2>适配任意后端接口</h2>
      <p><code>configTableOut</code> + <code>brcb/qrcb</code> — 切换 3 种后端格式仅需改配置，零适配代码。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/AnyBackendApi.vue']">
        <AnyBackendApi />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="auto-fit-height">
      <h2>自适应高度表格</h2>
      <p><code>heightType</code> + <code>tabHeight</code> + ResizeObserver 自动重算，表单展开/收起时表格高度自适应。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/AutoFitHeight.vue']">
        <AutoFitHeight />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 分步表单 -->
    <section id="step-form">
      <h2>分步表单</h2>
      <p>分步骤填写的复杂表单，每步独立校验。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/StepForm.vue']">
        <StepForm />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="step-import-wizard">
      <h2>分步导入向导</h2>
      <p>useDialog 多步骤：配置表单 → 预览表格 → 确认提交，<code>configBtn</code> 动态按钮。</p>
            <CodeDemo :source="rawSFCs['./es-advanced/StepImportWizard.vue']">
        <StepImportWizard />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 虚拟滚动基础 -->
    <section id="virtual-table">
      <h2>虚拟滚动基础</h2>
      <p><code>options.virtual: true</code> 开启虚拟滚动，大数据量流畅渲染。</p>
      <a-alert
        v-if="!showVirtual"
        type="info"
        show-icon
        message="该示例初始化时会生成 1 万条数据，渲染需短暂等待。"
        description="EsTable 对 dataSource 的深度监听在数据量较大时会有短暂卡顿，点击下方按钮按需加载。"
        style="margin-bottom: 16px"
      >
        <template #action>
          <a-button type="primary" size="small" @click="showVirtual = true">加载示例</a-button>
        </template>
      </a-alert>
      <VirtualTable v-if="showVirtual" />
    </section>

    <a-divider />

    <!-- 虚拟滚动进阶 -->
    <section id="virtual-advanced">
      <h2>虚拟滚动进阶</h2>
      <p>虚拟模式下排序、固定列、多选、自定义渲染、行样式与完整 CRUD。</p>
      <a-alert
        v-if="!showVirtualAdvanced"
        type="info"
        show-icon
        message="以下示例均使用 1 万条数据，渲染需短暂等待。"
        style="margin-bottom: 16px"
      >
        <template #action>
          <a-button type="primary" size="small" @click="showVirtualAdvanced = true">加载全部进阶示例</a-button>
        </template>
      </a-alert>
      <template v-if="showVirtualAdvanced">
        <h3 style="margin: 16px 0 8px">排序 + 固定列</h3>
              <CodeDemo :source="rawSFCs['./es-advanced/VirtualTableSort.vue']">
        <VirtualTableSort />
      </CodeDemo>
        <h3 style="margin: 16px 0 8px">多选 + 行操作</h3>
              <CodeDemo :source="rawSFCs['./es-advanced/VirtualTableSelect.vue']">
        <VirtualTableSelect />
      </CodeDemo>
        <h3 style="margin: 16px 0 8px">自定义渲染</h3>
              <CodeDemo :source="rawSFCs['./es-advanced/VirtualTableCustomRender.vue']">
        <VirtualTableCustomRender />
      </CodeDemo>
        <h3 style="margin: 16px 0 8px">行样式 + 事件</h3>
              <CodeDemo :source="rawSFCs['./es-advanced/VirtualTableRowStyle.vue']">
        <VirtualTableRowStyle />
      </CodeDemo>
        <h3 style="margin: 16px 0 8px">完整 CRUD</h3>
              <CodeDemo :source="rawSFCs['./es-advanced/VirtualTableCrud.vue']">
        <VirtualTableCrud />
      </CodeDemo>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent } from 'vue'
import CodeDemo from '@/components/CodeDemo.vue'
import ZeroCodeQuery from './es-advanced/ZeroCodeQuery.vue'
import FormTable from './es-advanced/FormTable.vue'
import CascadeFormTable from './es-advanced/CascadeFormTable.vue'
import DynamicFormQuery from './es-advanced/DynamicFormQuery.vue'
import CrossPageSelect from './es-advanced/CrossPageSelect.vue'
import AdminPage from './es-advanced/AdminPage.vue'
import CrudPage from './es-advanced/CrudPage.vue'
import DialogTableForm from './es-advanced/DialogTableForm.vue'
import FormTableDialog from './es-advanced/FormTableDialog.vue'
import OneLineCrud from './es-advanced/OneLineCrud.vue'
import RowApproval from './es-advanced/RowApproval.vue'
import ConditionalBtns from './es-advanced/ConditionalBtns.vue'
import OrderExpandTable from './es-advanced/OrderExpandTable.vue'
import AnyBackendApi from './es-advanced/AnyBackendApi.vue'
import AutoFitHeight from './es-advanced/AutoFitHeight.vue'
import StepForm from './es-advanced/StepForm.vue'
import StepImportWizard from './es-advanced/StepImportWizard.vue'

// 虚拟滚动示例初始化时会生成 1 万条数据，EsTable 对 dataSource 的深度监听会导致主线程短暂冻结，
// 故用 defineAsyncComponent 懒加载 + 按钮触发，避免首屏渲染时整个页面卡死。
const showVirtual = ref(false)
const showVirtualAdvanced = ref(false)
const VirtualTable = defineAsyncComponent(() => import('./es-advanced/VirtualTable.vue'))
const VirtualTableSort = defineAsyncComponent(() => import('./es-advanced/VirtualTableSort.vue'))
const VirtualTableSelect = defineAsyncComponent(() => import('./es-advanced/VirtualTableSelect.vue'))
const VirtualTableCustomRender = defineAsyncComponent(() => import('./es-advanced/VirtualTableCustomRender.vue'))
const VirtualTableRowStyle = defineAsyncComponent(() => import('./es-advanced/VirtualTableRowStyle.vue'))
const VirtualTableCrud = defineAsyncComponent(() => import('./es-advanced/VirtualTableCrud.vue'))
</script>

<style scoped>
h1 {
  font-size: 30px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 15px;
  line-height: 1.8;
}

h2 {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #1a1a2e;
}

section {
  scroll-margin-top: 100px;
}

section p {
  color: #555;
  line-height: 1.8;
  margin-bottom: 16px;
}

code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #d63384;
}
</style>
