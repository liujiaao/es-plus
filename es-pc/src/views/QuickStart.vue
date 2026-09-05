<template>
  <div class="quickstart-page">
    <div class="qs-hero">
      <h1>⚡ 30 秒上手</h1>
      <p>
        三个案例看懂 es-plus 的「配置驱动」——<strong>一行配置一个字段、列配置 + 操作列、函数式弹窗</strong>。
        每个案例读完约 30 秒，完整实现见下方链接。
      </p>
    </div>

    <a-divider />

    <div class="case" v-for="c in cases" :key="c.id">
      <div class="case-header">
        <span class="case-time">⏱ 30 秒</span>
        <h2>{{ c.title }}</h2>
      </div>
      <div class="case-pain">
        <strong>痛点：</strong>{{ c.pain }}
      </div>
      <div class="case-win">
        <strong>优势：</strong>{{ c.win }}
      </div>
      <a-card class="code-block">
        <pre><code>{{ c.code }}</code></pre>
      </a-card>
      <a-button type="link" @click="$router.push(c.route)">查看完整案例 →</a-button>
    </div>
  </div>
</template>

<script setup>
const cases = [
  {
    id: 'form',
    title: '① 配置化表单',
    pain: '8 字段查询表单要写 70 行模板。',
    win: '一行配置一个字段，8 字段 = 8 行配置。',
    route: '/es-form',
    code: `// 一行配置一个字段
const items = [
  { prop: 'name', label: '用户名', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions },
  { prop: 'phone', label: '手机号', formtype: 'Input', span: 6 },
  { prop: 'dept', label: '部门', formtype: 'Select', span: 6, dataOptions: deptOptions },
  // ... 共 8 行，替代 70 行模板
]`,
  },
  {
    id: 'table',
    title: '② 配置化表格',
    pain: '列 + 操作列 + 分页要写 60 行。',
    win: '列配置 + btns 操作列，分页内置自动处理。',
    route: '/es-table',
    code: `// 列配置 + btns 操作列，分页内置
const columns = [
  { prop: 'name', label: '用户名' },
  { prop: 'email', label: '邮箱' },
  { prop: 'status', label: '状态' },
]
const btns = [
  { name: '新增', key: 'add' },
  { name: '编辑', key: 'edit' },
  { name: '删除', key: 'del' },
]
const options = { apiParams: { url: '/api/users' } }`,
  },
  {
    id: 'dialog',
    title: '③ 编程式弹窗',
    pain: '模板声明弹窗要 45 行（visible 变量 + 模板 + 事件）。',
    win: 'useDialog() 函数调用，一行打开弹窗。',
    route: '/es-dialog',
    code: `// 函数式调用，告别 visible 变量
import { useDialog } from '@es-plus/adapter-antdv'

const dialog = useDialog()
dialog({
  title: '提示',
  render: () => h('div', '弹窗内容'),
})`,
  },
]
</script>

<style scoped>
.quickstart-page {
  max-width: 860px;
}

.qs-hero {
  text-align: center;
  padding: 24px 0 8px;
}

.qs-hero h1 {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 12px;
}

.qs-hero p {
  color: #666;
  line-height: 1.8;
}

.case {
  margin-bottom: 40px;
}

.case-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.case-time {
  display: inline-block;
  padding: 2px 10px;
  background: var(--es-brand-primary-light);
  color: var(--es-brand-primary);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.case-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.case-pain,
.case-win {
  color: #666;
  line-height: 1.7;
  margin: 4px 0;
}

.case-pain strong {
  color: #f56c6c;
}

.case-win strong {
  color: #52c41a;
}

.code-block {
  margin: 12px 0;
  background: #1e1e2e;
  border-radius: 8px;
  border: none;
}

.code-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.code-block code {
  color: #e0e0e0;
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre;
}
</style>
