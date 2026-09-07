<template>
  <div class="quickstart-page">
    <div class="container">
      <div class="qs-hero">
        <h1 class="content-title">⚡ 30 秒上手</h1>
        <p class="qs-subtitle">
          三个案例看懂 es-plus 的「配置驱动」——<strong>一行配置一个字段、列配置 + 操作列、函数式弹窗</strong>。
          每个案例读完约 30 秒，完整实现见下方链接。
        </p>
      </div>

      <div
        v-for="c in cases"
        :key="c.id"
        class="case"
      >
        <div class="case-header">
          <span class="case-time">⏱ 30 秒</span>
          <h2 class="content-subtitle">{{ c.title }}</h2>
        </div>
        <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
        <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
        <div class="code-block">
          <pre><code>{{ c.code }}</code></pre>
        </div>
        <router-link
          :to="c.route"
          class="case-link"
        >
          查看完整案例 →
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuickStart',
  data() {
    return {
      cases: [
        {
          id: 'form',
          title: '① 配置化表单',
          pain: '8 字段查询表单要写 70 行模板。',
          win: '一行配置一个字段，8 字段 = 8 行配置。',
          route: '/component/esform',
          code: `// 一行配置一个字段
const items = [
  { prop: 'name', label: '用户名', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions },
  { prop: 'phone', label: '手机号', formtype: 'Input', span: 6 },
  { prop: 'dept', label: '部门', formtype: 'Select', span: 6, dataOptions: deptOptions },
  // ... 共 8 行，替代 70 行模板
]`
        },
        {
          id: 'table',
          title: '② 配置化表格',
          pain: '列 + 操作列 + 分页要写 60 行。',
          win: '列配置 + btns 操作列，分页内置自动处理。',
          route: '/component/estable',
          code: `// 列配置 + btns 操作列，分页内置
const columns = [
  { prop: 'name', label: '用户名' },
  { prop: 'email', label: '邮箱' },
  { prop: 'status', label: '状态' }
]
const btns = [
  { name: '新增', key: 'add' },
  { name: '编辑', key: 'edit' },
  { name: '删除', key: 'del' }
]
const options = { apiParams: { url: '/api/users' } }`
        },
        {
          id: 'dialog',
          title: '③ 编程式弹窗',
          pain: '模板声明弹窗要 45 行（visible 变量 + 模板 + 事件）。',
          win: 'useDialog() 函数调用，一行打开弹窗。',
          route: '/component/esdialog',
          code: `// 函数式调用，告别 visible 变量
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog()
dialog({
  title: '提示',
  render: (h) => h('div', '弹窗内容')
})`
        }
      ]
    }
  }
}
</script>

<style scoped>
.quickstart-page {
  padding: 40px 20px;
}

.container {
  max-width: 860px;
  margin: 0 auto;
}

.qs-hero {
  text-align: center;
  margin-bottom: 32px;
}

.qs-subtitle {
  color: #606266;
  line-height: 1.8;
}

.case {
  margin: 32px 0 40px;
}

.case-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.case-header .content-subtitle {
  margin: 0;
}

.case-time {
  display: inline-block;
  padding: 2px 10px;
  background: #dbeafe;
  color: #3b82f6;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.case-pain,
.case-win {
  color: #606266;
  line-height: 1.7;
  margin: 4px 0;
}

.case-pain strong {
  color: #f56c6c;
}

.case-win strong {
  color: #67c23a;
}

.code-block {
  margin: 12px 0;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.code-block pre {
  margin: 0;
  padding: 16px 20px;
  overflow-x: auto;
}

.code-block code {
  color: #d4d4d4;
  font-family: 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre;
}

.case-link {
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
  text-decoration: none;
}

.case-link:hover {
  text-decoration: underline;
}
</style>
