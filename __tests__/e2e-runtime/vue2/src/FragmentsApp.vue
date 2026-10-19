<template>
  <div class="fragments-app">
    <section data-test="frag-table-01">
      <h3>独立表格（frag-table-01：行操作按钮）</h3>
      <table-01 />
    </section>

    <section data-test="frag-table-02">
      <h3>独立表格（frag-table-02：容器级词汇）</h3>
      <table-02 />
    </section>

    <section data-test="frag-form-01">
      <h3>独立表单（frag-form-01：submit 分支）</h3>
      <form-01 />
    </section>

    <section data-test="frag-form-02">
      <h3>独立表单（frag-form-02：query + formLayout）</h3>
      <form-02 />
    </section>

    <section data-test="frag-dialogs">
      <h3>独立弹窗</h3>
      <button data-test="open-component-dialog" @click="openComponentDialog">打开组件弹窗</button>
      <button data-test="open-composable-dialog" @click="openComposableDialog">打开 Composable 弹窗</button>
      <!-- component 形态的 <es-dialog> SFC：open() 由 setup 返回暴露 -->
      <dialog-component ref="componentDialog" />
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

export default {
  name: 'FragmentsApp',
  components: {
    Table01,
    Table02,
    Form01,
    Form02,
    DialogComponent,
  },
  methods: {
    openComponentDialog() {
      // 预填一行：证明 open(title, row) 真的写进 reactive model。
      this.$refs.componentDialog.open('编辑', { id: 1, name: '张三', status: 1 })
    },
    openComposableDialog() {
      // composable 形态：每次 open 都会经 useDialog() 创建一个弹窗实例。
      useUserDialog().open('新增')
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
