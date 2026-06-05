# @es-plus/mcp-server

[`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3) / [`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2) 官方 MCP Server —— 让 AI 编码工具自动生成 CRUD 页面。同一 Schema 可生成 Vue 3 或 Vue 2 版本代码。

## 客户端兼容矩阵

| 客户端 | MCP 支持 | 推荐配置文件 |
|---|---|---|
| **Claude Code (CLI)** | ✅ 官方支持 | `~/.claude.json` 或项目根 `.mcp.json` |
| **Claude Desktop** | ✅ 官方支持 | `claude_desktop_config.json` |
| **Cursor** | ✅ 官方支持 | `.cursor/mcp.json` |
| **Windsurf** | ✅ 官方支持 | `~/.codeium/windsurf/mcp_config.json` |
| **VS Code (GitHub Copilot)** | ✅ Insiders 已支持 | `.vscode/mcp.json` |
| **Continue** | ✅ 0.9+ 支持 | `~/.continue/config.json` |
| **Cline / Roo Code** | ✅ 支持 | 客户端内 GUI 配置 |
| **Claude Web** | ❌ 暂未提供 MCP 客户端 | — |
| **GitHub Copilot Chat (Stable)** | ❌ 仅 Insiders 频道 | — |
| **OpenAI Codex / Codex CLI** | ❌ **不支持 MCP 协议** | — |
| **Cody** | ⚠️ 早期版本不支持，新版本待验证 | — |

> 如果你在不支持 MCP 的客户端（如 Codex / Claude Web）里"配置失败"，并不是本包的问题——它们根本没有 MCP 客户端。

---

## 配置（按稳定性从高到低）

### 方式 A — 全局安装 + 直接命令（**强烈推荐**，最稳）

```bash
npm i -g @es-plus/mcp-server
```

然后在客户端配置文件里指向已安装的可执行文件：

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "mcp-server-es-plus",
      "args": []
    }
  }
}
```

**为什么推荐**：进程启动 < 200ms，不再走 `npx` 的网络/缓存解析流程，**避免大多数 MCP 客户端的 10-30 秒连接超时**。

升级：`npm update -g @es-plus/mcp-server` 即可。

### 方式 B — npx 启动（无需预装，但首次冷启动慢）

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  }
}
```

> ⚠️ **首次运行 `npx -y` 会从 npm 下载本包及依赖，慢网络下耗时 30-90 秒**。多数 MCP 客户端的连接超时是 10-30 秒，因此你可能看到"连接失败"——这通常**不是配置错误，是 npx 还没下完**。等待完成后下次启动会快得多（命中本地 npx 缓存）。
>
> 中国大陆用户建议先 `npm config set registry https://registry.npmmirror.com/` 加速下载。

### 方式 C — 本地路径（贡献者 / 自托管）

```bash
git clone https://github.com/liujiaao/es-plus.git
cd es-plus/packages/mcp-server
npm install
npm run build
```

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "node",
      "args": ["/abs/path/to/es-plus/packages/mcp-server/build/index.js"]
    }
  }
}
```

---

## 各客户端具体配置示例

> 下面所有示例都用**方式 A（全局安装后的直接命令）**。如果坚持用 npx，把 `"command": "mcp-server-es-plus"` 替换为 `"command": "npx"`、`"args": []` 替换为 `"args": ["-y", "@es-plus/mcp-server"]` 即可。

### Claude Code (CLI)

```bash
claude mcp add es-plus -- mcp-server-es-plus
```

或在项目根 `.mcp.json`：

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### Cursor

`.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`：

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### VS Code (GitHub Copilot Insiders)

`.vscode/mcp.json`：

```json
{
  "servers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### Continue

`~/.continue/config.json` 加入 `experimental.modelContextProtocolServers`：

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      { "transport": { "type": "stdio", "command": "mcp-server-es-plus", "args": [] } }
    ]
  }
}
```

### Claude Desktop

`claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

> **前提**：Node.js >= 18；项目已安装 `@es-plus/vue3` + `element-plus`（Vue 3）或 `@es-plus/vue2` + `element-ui`（Vue 2）。

---

## 故障排查（Troubleshooting）

按出现频率排列，**90% 的"启动失败"是前两个**。

### 1. 配置后客户端报"连接失败 / connection timeout"

**原因**：用了方式 B (`npx -y`)，首次运行需要从 npm 下载包，慢网络 30-90 秒，超过客户端默认 10-30 秒超时。

**解决**：
- 切换到**方式 A**（全局安装）—— 进程启动 < 200ms，不再依赖 npx
- 如果坚持用 npx，先在终端手动跑一次 `npx -y @es-plus/mcp-server --version` 让本地 cache 命中，然后再启动客户端
- 中国大陆用户：`npm config set registry https://registry.npmmirror.com/`

### 2. Windows 下 npx 找不到 / spawn 错误

**原因**：
- npm 全局 bin 没在 PATH 里
- 用户路径含中文/空格（如 `C:\Users\张三`），npx cache 写入失败
- PowerShell vs CMD vs Git Bash 的 PATH 差异

**解决**：
- 用方式 A 全局安装：装完后 `mcp-server-es-plus --version` 在终端能跑通即说明 PATH OK
- 排查 PATH：`npm config get prefix` 输出的目录加进 `%PATH%`
- 路径含中文用户：用方式 C（本地路径）+ 写绝对路径绕开

### 3. 启动后立即断开 / "Unexpected token" / JSON parse error

**原因**：MCP 用 stdio 通信，**stdout 是协议管道**，任何 `console.log` 输出都会被当成 MCP 消息，客户端 JSON parse 失败 → 断连。

**解决**：本包源码内已确保所有日志走 `process.stderr`。如果还是看到这种错，多半是 Node 版本不够（见下条），或者本机有 npm warning 写到 stdout。先排查 Node 版本。

### 4. "SyntaxError: Unexpected token '??=' / 私有字段"

**原因**：Node 版本 < 18。本包用了 Node 18+ 语法。

**解决**：
```bash
node --version    # 必须 >= 18.0.0
```
建议用 [nvm](https://github.com/nvm-sh/nvm) 切到 Node 20 LTS。

### 5. AI 调用工具返回的 schema 类型不对 / 协议版本错

**原因**：MCP SDK 协议版本与某些老客户端不匹配。本包用 `@modelcontextprotocol/sdk@^1.0.0`，要求客户端的 SDK 也在 1.x 范围。

**解决**：升级 AI 客户端到最新版。Continue 0.8.x、Cursor 0.40 之前的版本都有兼容性问题。

### 6. 多客户端同时连，进程频繁重启

**原因**：每个客户端开独立 stdio 子进程。这是 MCP 协议的预期行为，不是 bug——但占资源。

**解决**：暂无 HTTP transport 选项；如果你有强需求请提 issue。

### 7. 工具 `detect_project_target` 返回错误

**原因**：客户端没有把 `package.json` 的内容传给工具。

**解决**：在描述里明确说"我的 package.json 内容如下：..."，或让 AI 先读项目文件再调工具。

### 自检命令（v1.2.2+）

```bash
mcp-server-es-plus --version    # 输出版本号
mcp-server-es-plus --help        # 用法说明
```

---

## 使用方式

配置完成后，直接在 AI 编码工具中用自然语言描述需求：

```
帮我生成一个用户管理页面，查询条件有姓名、手机号、状态，
表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除
```

AI 会自动调用 MCP Server 的 `generate_crud_page` 工具，返回完整可运行的 `.vue` 文件，包含：

- 查询表单（自动推断 Input / Select / DatePicker 等控件类型）
- 数据表格（含状态列渲染、操作按钮）
- 新增/编辑弹窗（含表单验证）
- 删除确认提示
- 分页与接口请求模板

**你只需替换 `httpRequest` 中的接口地址即可投入使用。**

---

## 工具 (Tools)

MCP Server 提供 5 个工具，AI 编码工具会根据你的描述自动选择调用。

### generate_crud_page

从自然语言生成完整的 Vue 3 / Vue 2 CRUD 页面（.vue SFC）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `description` | string | 页面功能描述（中文或英文） |
| `target` | `'vue3' \| 'vue2'`（可选） | 渲染目标，未传则自动检测 |

**描述技巧**：

```
# ✅ 好的描述 — 分段说明查询、表格、操作
"用户管理页面，
 查询条件有姓名、手机号、状态，
 表格显示姓名、手机号、邮箱、状态、创建时间，
 支持新增编辑删除"

# ✅ 精简描述 — 自动推断全部字段
"员工管理：姓名、部门、职位、手机号、状态、创建时间"

# ✅ 只读列表
"操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看不编辑"
```

**关键词智能识别**：

| 字段关键词 | 自动映射为 |
|-----------|-----------|
| 状态、类型、分类、级别、来源 | Select 下拉选择 |
| 日期、创建时间、更新时间 | datePicker 日期选择器 |
| 时间、时刻 | timePicker 时间选择器 |
| 开关、启用、是否 | Switch 开关 |
| 评分、星级 | Rate 评分 |
| 头像、图片、文件、附件 | Upload 上传 |
| 备注、描述、内容、简介 | Input(textarea) 多行文本 |
| 性别、单选 | Radio 单选框 |
| 多选、标签、兴趣 | Checkbox 多选框 |
| 省市、城市、地区、层级 | Cascader 级联选择 |
| 进度、区间、范围 | Slider 滑块 |
| 穿梭、分配 | Transfer 穿梭框 |
| 其他 | Input 输入框 |

### validate_config

校验 JSON 配置是否符合 es-plus 组件规范，返回错误详情和修复建议（Vue 3 / Vue 2 共用同一份 Schema）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | string | JSON 配置字符串 |
| `type` | string? | Schema 类型，不传则自动检测 |

支持的 Schema 类型：`form-item`、`table-column`、`table-options`、`dialog-options`

### list_form_types

列出 es-plus 支持的全部 13 种表单控件类型及用法示例。无需参数。

### get_component_api

获取组件完整 API 文档，包含 TypeScript 接口定义、Props、方法、使用示例。

| 参数 | 类型 | 说明 |
|------|------|------|
| `component` | enum | `EsForm` / `EsTable` / `useDialog` |

### scaffold_page

生成最小化页面脚手架，适合需要手动填充配置的场景。

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | 页面名称（kebab-case） |
| `features` | string[]? | 功能列表，默认 `['query', 'table']` |

可选 features：`query`（查询表单）、`table`（数据表格）、`dialog`（弹窗）

---

## 资源 (Resources)

AI 工具可通过 MCP 资源协议读取 es-plus 的 Schema 定义和类型信息。

| 资源 URI | 内容 |
|----------|------|
| `esplus://schemas/form-item` | 表单项配置 JSON Schema |
| `esplus://schemas/table-column` | 表格列配置 JSON Schema |
| `esplus://schemas/table-options` | 表格选项 JSON Schema |
| `esplus://schemas/dialog-options` | 弹窗配置 JSON Schema |
| `esplus://schemas/btn-config` | 按钮配置 JSON Schema |
| `esplus://schemas/api-params` | 远程数据加载 JSON Schema |
| `esplus://types` | 完整 TypeScript 类型定义 |
| `esplus://examples` | 8 个预设 CRUD 示例（含生成代码） |

---

## 提示模板 (Prompts)

| 模板名 | 参数 | 用途 |
|--------|------|------|
| `crud-page` | `description` | 生成完整 CRUD 页面的系统提示 |
| `form-config` | `description` | 仅生成表单配置 JSON 的系统提示 |

---

## 内置预设示例

以下 8 个业务场景可直接使用或作为描述参考：

| 预设 | 查询字段 | 表格列 | 操作 |
|------|---------|--------|------|
| 用户管理 | 姓名、手机号、状态 | 姓名、手机号、邮箱、状态、创建时间 | 新增、编辑、删除 |
| 订单列表 | 订单号、客户名称、日期范围、状态 | 订单号、客户、金额、状态、创建时间 | 查看、删除 |
| 商品管理 | 商品名称、分类、状态 | 名称、分类、价格、库存、状态 | 新增、编辑、删除 |
| 日志查询 | 关键词、级别、日期范围 | 时间、级别、操作人、内容 | 只读 |
| 角色权限 | 角色名称、状态 | 角色名称、描述、状态、创建时间 | 新增、编辑、删除 |
| 员工花名册 | 姓名、部门、职位 | 姓名、性别、年龄、部门、职位、手机号、状态 | 新增、编辑 |
| 文章管理 | 标题、分类、状态 | 标题、分类、创建人、创建时间、状态 | 新增、编辑、删除 |
| 系统配置 | 名称、类型 | 名称、编号、类型、描述、状态 | 新增、编辑、删除、导出 |

---

## 与 @es-plus/cli 的区别

| 特性 | @es-plus/mcp-server | @es-plus/cli |
|------|---------------------|--------------|
| 使用方式 | AI 编码工具自动调用 | 终端手动运行 |
| 适用场景 | AI 对话式开发 | 批量生成、CI/CD |
| 输出 | 返回代码给 AI 工具 | 直接写入 .vue 文件 |

**推荐组合：** 项目初始化用 CLI 批量生成，日常开发用 MCP Server 让 AI 辅助迭代。

---

## 本地开发

```bash
git clone https://github.com/liujiaao/es-plus.git
cd es-plus/packages/mcp-server
npm install
npm run build
npm start
```

## 环境要求

- Node.js >= 18
- npm >= 8

## License

[MIT](./LICENSE)
