# ES-Plus AI 工具链

> 本文件为三站 AI 工具链页的**文案单一真源**。es-plus-docs / es-pc / es-eui 的 AI 页均从此处取文案（MCP / CLI / 在线体验），保持跨渲染器一致。

ES-Plus 是「中后台 CRUD 的配置层」——因为配置是数据，AI 才能可靠地生成。配套 MCP Server 与 CLI，AI 生成的代码**真的能编译**。

## MCP Server

让 Claude Code、Cursor 等 AI 编码助手通过协议直接调用 CRUD 生成能力：

```bash
# Claude Code 一行配置
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

接入后，在 AI 对话中直接说：

```
> 生成一个用户管理页面，查询姓名、手机号、状态，表格显示姓名、邮箱、状态、创建时间，支持新增编辑删除
```

AI 的协作流程：`detect_project_target`（识别 Vue 2 / Vue 3 / AntDV）→ `generate_crud_schema`（语义推理生成配置）→ `validate_config`（校验）→ `generate_from_config`（确定性编译）。生成的代码三端通用，且 CI 保证能编译。

## CLI 工具

终端直接生成 CRUD 页面：

```bash
# 从结构化配置生成（生产级，零 TODO）
npx @es-plus/cli create --from-config ./config.json --target antdv

# 自然语言生成
npx @es-plus/cli create user-management --target antdv -d "用户管理，查询姓名、状态..."

# 校验 JSON 配置
npx @es-plus/cli validate ./config.json --schema form-item
```

## 在线体验

主文档站提供了 [AI CRUD 生成器](https://liujiaao.github.io/es-plus/#/ai-crud)，可视化 MCP 协议的完整调用流。完整的 AI 工具链文档见[主文档站](https://liujiaao.github.io/es-plus/)。
