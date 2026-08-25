<template>
  <div class="ai-tools-page">
    <h1>AI 工具链</h1>
    <p class="subtitle">
      ES-Plus 是「中后台 CRUD 的配置层」——因为配置是数据，AI 才能可靠地生成。配套 MCP Server 与 CLI，AI 生成的代码<strong>真的能编译</strong>。
    </p>

    <a-divider />

    <section id="mcp">
      <h2>🔌 MCP Server</h2>
      <p>让 Claude Code、Cursor 等 AI 编码助手通过协议直接调用 CRUD 生成能力：</p>
      <a-card class="code-block">
        <pre v-pre><code># Claude Code 一行配置
claude mcp add es-plus -- npx -y @es-plus/mcp-server</code></pre>
      </a-card>
      <p>接入后，在 AI 对话中直接说：</p>
      <a-card class="code-block">
        <pre v-pre><code>&gt; 生成一个用户管理页面，查询姓名、手机号、状态，表格显示姓名、邮箱、状态、创建时间，支持新增编辑删除</code></pre>
      </a-card>
      <p>
        AI 的协作流程：<code>detect_project_target</code>（识别 Vue 2 / Vue 3 / AntDV）→
        <code>generate_crud_schema</code>（语义推理生成配置）→ <code>validate_config</code>（校验）→
        <code>generate_from_config</code>（确定性编译）。生成的代码三端通用，且 CI 保证能编译。
      </p>
    </section>

    <a-divider />

    <section id="cli">
      <h2>🖥 CLI 工具</h2>
      <p>终端直接生成 CRUD 页面：</p>
      <a-card class="code-block">
        <pre v-pre><code># 从结构化配置生成（生产级，零 TODO）
npx @es-plus/cli create --from-config ./config.json --target antdv

# 自然语言生成
npx @es-plus/cli create user-management --target antdv -d "用户管理，查询姓名、状态..."

# 校验 JSON 配置
npx @es-plus/cli validate ./config.json --schema form-item</code></pre>
      </a-card>
    </section>

    <a-divider />

    <section id="demo">
      <h2>🎮 在线体验</h2>
      <p>
        主文档站提供了 <a href="https://liujiaao.github.io/es-plus/#/ai-crud" target="_blank">AI CRUD 生成器</a>，
        可视化 MCP 协议的完整调用流。完整的 AI 工具链文档见
        <a href="https://liujiaao.github.io/es-plus/" target="_blank">主文档站</a>。
      </p>
    </section>
  </div>
</template>

<script setup>
// AI 工具链是跨渲染器的：MCP/CLI 能生成 vue2 / vue3 / antdv 三种 target。
// 本页为 es-pc（AntDV 渲染器）的 AI 入口，完整文档见主站。
</script>

<style scoped>
.ai-tools-page {
  max-width: 860px;
}

.subtitle {
  font-size: 16px;
  color: #666;
}

.code-block {
  margin: 16px 0;
  background: #f6f8fa;
}

.code-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-block code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
}
</style>
