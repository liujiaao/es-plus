<template>
  <div class="quickstart-page">
    <div class="qs-hero">
      <h1>⚡ 30 秒上手</h1>
      <p>
        三个案例看懂 es-plus 的「配置驱动」——<strong>一行配置一个字段、列配置 + 操作列、函数式弹窗</strong>。
        每个案例读完约 30 秒，完整实现见下方链接。
      </p>
    </div>

    <div class="case" v-for="c in cases" :key="c.id">
      <div class="case-header">
        <span class="case-time">⏱ 30 秒</span>
        <h2>{{ c.title }}</h2>
      </div>
      <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
      <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
      <div class="code-block">
        <pre><code>{{ c.code }}</code></pre>
      </div>
      <router-link :to="c.route" class="case-link">查看完整案例 →</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
const cases = [
  {
    id: 'form',
    title: '① 配置化表单',
    pain: '8 字段查询表单要写 70 行模板。',
    win: '一行配置一个字段，8 字段 = 8 行配置。',
    route: '/components/es-form',
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
    route: '/components/es-table',
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
    route: '/advanced/use-dialog',
    code: `// 函数式调用，告别 visible 变量
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()
dialog({
  title: '提示',
  render: () => h('div', '弹窗内容'),
})`,
  },
]
</script>

<style lang="scss" scoped>
.quickstart-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 8px clamp(16px, 4vw, 48px) 56px;
}

.qs-hero {
  text-align: center;
  padding: 32px 0 24px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-color-lighter);

  h1 {
    font-size: 34px;
    font-weight: 700;
    color: var(--text-color-primary);
    margin-bottom: 14px;
    letter-spacing: -0.5px;
  }

  p {
    max-width: 640px;
    margin: 0 auto;
    color: var(--text-color-regular);
    font-size: 15px;
    line-height: 1.8;
  }
}

.case {
  margin: 28px 0;
  padding: 24px 28px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;

  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
}

.case-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin: 0;
  }
}

.case-time {
  display: inline-flex;
  align-items: center;
  padding: 3px 12px;
  background: var(--primary-color-light, rgba(59, 130, 246, 0.1));
  color: var(--primary-color);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.case-pain,
.case-win {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin: 8px 0;
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.7;
  color: var(--text-color-regular);
  font-size: 14px;
}

.case-pain {
  background: rgba(245, 108, 108, 0.06);
}

.case-win {
  background: rgba(103, 194, 58, 0.08);
}

.case-pain strong {
  color: #f56c6c;
  flex-shrink: 0;
}

.case-win strong {
  color: #67c23a;
  flex-shrink: 0;
}

.code-block {
  position: relative;
  margin: 16px 0 20px;
  background: #1e1e1e;
  border-radius: 10px;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 14px;
    left: 16px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ff5f56;
    box-shadow: 20px 0 0 #ffbd2e, 40px 0 0 #27c93f;
    z-index: 1;
  }

  pre {
    margin: 0;
    padding: 40px 20px 18px;
    overflow-x: auto;
  }

  code {
    color: #abb2bf;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    line-height: 1.8;
    white-space: pre;
  }
}

.case-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--primary-color);
  font-weight: 500;
  text-decoration: none;
  transition: gap 0.2s ease;

  &:hover {
    gap: 8px;
    text-decoration: underline;
  }
}
</style>
