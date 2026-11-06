<template>
  <div class="fragments-app">
    <section data-test="frag-table-01">
      <h3>独立表格（frag-table-01：行操作按钮）</h3>
      <!-- P4：行按钮 clickEvent → 片段 emit('row-action')；宿主在这里接住。 -->
      <table-01 ref="table01" @row-action="onRowAction" />
      <p data-test="row-action-count">{{ rowActions.length }}</p>
      <p data-test="row-action-last">{{ rowActionLast }}</p>
      <!-- P4：表格产物 expose 的命令式刷新面。 -->
      <button data-test="refresh-table-01" @click="refreshTable01">refresh()</button>
    </section>

    <section data-test="frag-table-02">
      <h3>独立表格（frag-table-02：容器级词汇）</h3>
      <table-02 />
    </section>

    <section data-test="frag-form-01">
      <h3>独立表单（frag-form-01：submit 分支）</h3>
      <!-- P4：保存 → 片段内部 validate 通过后 emit('submit', snapshot)；重置 → emit('reset')。 -->
      <form-01 ref="form01" @submit="onFormSubmit" @reset="onFormReset" />
      <p data-test="form-submit-count">{{ formSubmits.length }}</p>
      <p data-test="form-submit-last">{{ lastSubmitName }}</p>
      <!-- P4：表单产物 expose 的 validate/resetFields。 -->
      <button data-test="validate-form-01" @click="validateForm01">validate()</button>
      <p data-test="form-validate-state">{{ validateState }}</p>
      <button data-test="reset-form-01" @click="resetForm01">resetFields()</button>
    </section>

    <section data-test="frag-form-02">
      <h3>独立表单（frag-form-02：query + formLayout）</h3>
      <!-- P4：查询 → emit('query', snapshot)，宿主据此刷新自己的表格。 -->
      <form-02 ref="form02" @query="onFormQuery" />
      <p data-test="form-query-count">{{ formQueries.length }}</p>
      <p data-test="form-query-last">{{ lastQueryKeyword }}</p>
    </section>

    <section data-test="frag-dialogs">
      <h3>独立弹窗</h3>
      <button data-test="open-component-dialog" @click="openComponentDialog">打开组件弹窗</button>
      <button data-test="open-component-new-dialog" @click="openComponentNewDialog">打开组件弹窗（新增）</button>
      <button data-test="open-readonly-dialog" @click="openReadonlyDialog">打开组件弹窗（查看）</button>
      <button data-test="open-composable-dialog" @click="openComposableDialog">打开 Composable 弹窗</button>
      <!-- component 形态的 <es-dialog> SFC：open() 由 setup 返回暴露 -->
      <dialog-component ref="componentDialog" />
      <!-- P4：open(title, row, onSuccess) 的第三参回调。 -->
      <p data-test="dialog-success-count">{{ dialogSuccesses }}</p>
    </section>

    <section data-test="frag-composition-dialogs">
      <h3>组合 form+dialog（AN-17：一份表单面 → 多个 dialog composable）</h3>
      <button data-test="open-composition-add" @click="openCompositionAdd">打开组合弹窗（新增）</button>
      <button data-test="open-composition-edit" @click="openCompositionEdit">打开组合弹窗（编辑）</button>
    </section>
  </div>
</template>

<script>
// 六个片段全部来自 golden 语料（scripts/gen-fragments.mjs 在 dev server 启动前落盘）。
// 这里**静态 import**：任一片段缺失/编译失败都会让页面直接崩，而不是静默少渲染一块。
import Table01 from './fragments/table-01.vue'
import Table02 from './fragments/table-02.vue'
import Form01 from './fragments/form-01.vue'
import Form02 from './fragments/form-02.vue'
import DialogComponent from './fragments/dialog-component.vue'
import { useUserDialog } from './fragments/dialog-composable'
// AN-17：组合 form+dialog 的两段产物 —— 同一份 form 面，按 dialog key 各成一个 composable。
import { useCustomerAddDialog } from './fragments/composition-dialog-add'
import { useCustomerEditDialog } from './fragments/composition-dialog-edit'

export default {
  name: 'FragmentsApp',
  components: {
    Table01,
    Table02,
    Form01,
    Form02,
    DialogComponent,
  },
  data() {
    return {
      rowActions: [],
      formSubmits: [],
      formQueries: [],
      formResets: 0,
      validateState: 'idle',
      dialogSuccesses: 0,
    }
  },
  computed: {
    rowActionLast() {
      const last = this.rowActions[this.rowActions.length - 1]
      return last ? `${last.key}:${last.name}` : ''
    },
    lastSubmitName() {
      const last = this.formSubmits[this.formSubmits.length - 1]
      return last ? String(last.name) : ''
    },
    lastQueryKeyword() {
      const last = this.formQueries[this.formQueries.length - 1]
      return last ? String(last.keyword) : ''
    },
  },
  methods: {
    // P4：四个组合接线的「宿主侧」都写在这里，产物只负责派发 / 暴露。
    onRowAction({ key, row }) {
      this.rowActions.push({ key, name: row && row.name })
    },
    refreshTable01() {
      this.$refs.table01.refresh()
    },
    onFormSubmit(model) {
      this.formSubmits.push({ ...model })
    },
    onFormReset() {
      this.formResets++
    },
    onFormQuery(model) {
      this.formQueries.push({ ...model })
    },
    async validateForm01() {
      try {
        await this.$refs.form01.validate()
        this.validateState = 'ok'
      } catch {
        this.validateState = 'invalid'
      }
    },
    resetForm01() {
      this.$refs.form01.resetFields()
    },
    openComponentDialog() {
      // 预填一行：证明 open(title, row) 真的写进 reactive model。
      // P4：第三参 onSuccess 在提交成功（PUT 之后）触发。
      this.$refs.componentDialog.open('编辑', { id: 1, name: '张三', status: 1 }, () => {
        this.dialogSuccesses++
      })
    },
    openComponentNewDialog() {
      // AN-16：「新增」走 POST（方法由运行时 title 派生，不是配置字段）。
      this.$refs.componentDialog.open('新增', { name: '王五' })
    },
    openReadonlyDialog() {
      // AN-16：「查看」是只读形态 —— 只有「关闭」，没有「确定/取消」，也不发请求。
      this.$refs.componentDialog.open('查看', { id: 1, name: '张三' })
    },
    openComposableDialog() {
      // composable 形态：每次 open 都会经 useDialog() 创建一个弹窗实例。
      useUserDialog().open('新增')
    },
    openCompositionAdd() {
      // AN-17 组合：add 弹窗没有预填（新增语义），弹窗体 = form 面。
      useCustomerAddDialog().open('新增')
    },
    openCompositionEdit() {
      // AN-17 组合：edit 弹窗预填一行，标题由语料 key 派生。
      useCustomerEditDialog().open('编辑', { customerName: '赵六', phone: '13800000000', level: 'vip' })
    },
  },
}
</script>

<style scoped>
.fragments-app {
  padding: 16px;
}
.fragments-app section {
  margin-bottom: 24px;
}
.fragments-app h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #606266;
}
</style>
