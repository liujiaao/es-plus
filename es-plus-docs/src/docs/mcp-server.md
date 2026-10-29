# @es-plus/mcp-server

`@es-plus/mcp-server` 是 ES-Plus 官方的 MCP (Model Context Protocol) Server，让 AI 编码工具一行配置即可获得 @es-plus/vue3 的 CRUD 页面生成能力。

## 什么是 MCP？

MCP (Model Context Protocol) 是 Anthropic 提出的开放协议标准，用于连接 AI 助手与外部工具/数据源。通过 MCP，AI 编码工具可以：

- 调用 **Tools**（工具）—— 执行操作，如生成代码、校验配置
- 读取 **Resources**（资源）—— 获取上下文信息，如 Schema 定义、类型文档
- 使用 **Prompts**（提示模板）—— 获取结构化的系统提示

ES-Plus 的 MCP Server 将组件库的能力暴露给 AI 工具，让 AI 能够**精准**生成 @es-plus/vue3 的配置代码。

## 客户端兼容矩阵

| 客户端 | MCP 支持 | 推荐配置位置 |
|---|---|---|
| **Claude Code (CLI)** | ✅ 官方支持 | `~/.claude.json` 或项目根 `.mcp.json` |
| **Claude Desktop** | ✅ 官方支持 | `claude_desktop_config.json` |
| **Cursor** | ✅ 官方支持 | `.cursor/mcp.json` |
| **Windsurf** | ✅ 官方支持 | `~/.codeium/windsurf/mcp_config.json` |
| **VS Code (GitHub Copilot)** | ✅ Insiders 频道已支持 | `.vscode/mcp.json` |
| **Continue** | ✅ 0.9+ 支持 | `~/.continue/config.json` |
| **Cline / Roo Code** | ✅ 支持 | 客户端 GUI 内配置 |
| **Claude Web (claude.ai)** | ❌ 暂未提供 MCP 客户端 | — |
| **GitHub Copilot Chat (Stable)** | ❌ 仅 Insiders 频道 | — |
| **OpenAI Codex / Codex CLI** | ❌ **不支持 MCP 协议** | — |
| **Cody** | ⚠️ 早期版本不支持，新版本未验证 | — |

::: warning
**Codex / Claude Web / Copilot Stable 上"配置失败"不是本包的问题** —— 它们目前根本没有 MCP 客户端实现。请先查上表确认你的客户端在 ✅ 行。
:::

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

::: warning 关键提示
**首次运行 `npx -y` 会从 npm 下载本包及依赖，慢网络下耗时 30-90 秒**。多数 MCP 客户端的连接超时是 10-30 秒，因此你可能看到"连接失败"——这通常**不是配置错误，是 npx 还没下完**。等待完成后下次启动会快得多（命中本地 npx 缓存）。

中国大陆用户建议先 `npm config set registry https://registry.npmmirror.com/` 加速下载。
:::

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

## 各客户端具体配置示例

::: tip
下面所有示例都用**方式 A（全局安装后的直接命令）**。如果坚持用 npx，把 `"command": "mcp-server-es-plus"` 替换为 `"command": "npx"`、`"args": []` 替换为 `"args": ["-y", "@es-plus/mcp-server"]` 即可。
:::

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

`~/.continue/config.json` 的 `experimental.modelContextProtocolServers` 数组里加：

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

## 故障排查（Troubleshooting）

按出现频率排列，**90% 的"启动失败"是前两个**。

### 1. 配置后客户端报"连接失败 / connection timeout"

**原因**：用了方式 B (`npx -y`)，首次运行需要从 npm 下载包，慢网络 30-90 秒，超过客户端默认 10-30 秒超时。

**解决**：
- 切换到**方式 A**（全局安装）—— 进程启动 < 200ms，不再依赖 npx
- 如果坚持用 npx，先在终端手动跑一次 `npx -y @es-plus/mcp-server --version` 让本地 cache 命中，再启动客户端
- 中国大陆用户：`npm config set registry https://registry.npmmirror.com/`

### 2. Windows 下 npx 找不到 / spawn 错误

**原因**：
- npm 全局 bin 没在 PATH 里
- 用户路径含中文/空格（如 `C:\Users\张三`），npx cache 写入失败
- PowerShell vs CMD vs Git Bash 的 PATH 差异

**解决**：
- 优先用方式 A：装完后在终端跑 `mcp-server-es-plus --version`，能输出版本即说明 PATH OK
- 排查 PATH：`npm config get prefix` 输出的目录加进 `%PATH%`
- 路径含中文用户：用方式 C（本地路径）+ 写绝对路径绕开

### 3. 启动后立即断开 / "Unexpected token" / JSON parse error

**原因**：MCP 用 stdio 通信，**stdout 是协议管道**，任何 `console.log` 输出都会被当成 MCP 消息，客户端 JSON parse 失败 → 断连。

**解决**：本包源码已确保所有日志走 `process.stderr`。如果还看到这种错，多半是 Node 版本不够（见下条），或本机有 npm warning 写到 stdout。先排查 Node 版本。

### 4. "SyntaxError: Unexpected token '??=' / 私有字段"

**原因**：Node 版本 < 18。本包用了 Node 18+ 语法。

```bash
node --version    # 必须 >= 18.0.0
```

建议用 [nvm](https://github.com/nvm-sh/nvm) 切到 Node 20 LTS。

### 5. AI 调用工具返回的 schema 类型不对 / 协议版本错

**原因**：MCP SDK 协议版本与某些老客户端不匹配。本包用 `@modelcontextprotocol/sdk@^1.0.0`，要求客户端的 SDK 在 1.x。Continue 0.8.x、Cursor 0.40 之前的版本都有兼容性问题。

**解决**：升级 AI 客户端到最新版。

### 6. 多客户端同时连，进程频繁重启

**原因**：每个客户端开独立 stdio 子进程。这是 MCP 协议预期行为，不是 bug——但占资源。当前未提供 HTTP transport 选项，如有强需求请提 issue。

### 7. 工具 `detect_project_target` 返回错误

**原因**：客户端没有把 `package.json` 的内容传给工具。

**解决**：在描述里明确说"我的 package.json 内容如下：..."，或让 AI 先读项目文件再调工具。

### 自检命令

```bash
mcp-server-es-plus --version    # 输出版本号
mcp-server-es-plus --help        # 用法说明
```

> 若这两条命令**没有任何输出、直接挂住**，说明装的是 1.4.1 或更早的版本 —— 那些版本没有 CLI 参数处理，会把参数当普通启动参数忽略。请升级后再自检。

## MCP Tools（可调用工具）

配置完成后，AI 工具会自动发现并使用以下 **15 个工具**（默认 `full` profile；设 `ESPLUS_MCP_PROFILE=front-door` 时隐藏 1 个高级 + 2 个 legacy 工具，只留前门、单面片段与支撑工具）：

| 工具 | 定位 | front-door |
|------|------|:----------:|
| `generate_crud` | **唯一前门**：自然语言 → 三端可编译的 CRUD 页面 | ✅ |
| `generate_form` | 单面片段：独立 `<es-form>` SFC | ✅ |
| `generate_table` | 单面片段：独立 `<es-table>` SFC | ✅ |
| `generate_dialog` | 单面片段：独立 `useXxxDialog()` composable 或 `<es-dialog>` SFC | ✅ |
| `detect_project_target` | 读宿主 `package.json` 判定 `vue3` / `vue2` / `antdv` | ✅ |
| `validate_config` | 确定性校验配置（只判不改） | ✅ |
| `ingest_schema` | OpenAPI / JSON Schema / 示例 JSON / TS 接口 / SQL DDL → 草拟配置 | ✅ |
| `refine_config` | 对已 pin 的配置做一轮精修：校验 + 结构化 diff | ✅ |
| `list_form_types` | 列出全部 `formtype` 及其渲染器 | ✅ |
| `get_component_api` | 组件 API / 类型文档 | ✅ |
| `scaffold_page` | 最小页面脚手架 | ✅ |
| `doctor_page` | 静态检查宿主入口是否满足 preflight 清单 | ✅ |
| `generate_crud_from_config` | **ADVANCED**：已持有类型化配置时的直通生成 | ⛔ |
| `generate_crud_page` | **LEGACY FALLBACK**：正则/关键词解析（无 LLM 兜底） | ⛔ |
| `generate_crud_schema` | **LEGACY FALLBACK**：正则 → CrudPageSchema + 包装 SFC | ⛔ |

> profile 是**工具面**的开关，不是能力差异：被隐藏的三个工具与 `generate_crud` 共用同一套确定性生成器，隐藏它们只是为了让宿主在前门与 legacy 路径之间没有选择歧义。提示词、resources 与工具描述会按同一份 profile 同步调整。

### generate_crud（唯一前门 / FRONT DOOR）

**功能**：自然语言请求的统一入口。你只需填 `surfaces` 意图表 —— query / table / form / dialog 各放哪些字段、要哪些弹窗；之后的路由与三端编译由确定性代码完成：**有表格**的请求走 golden 覆盖的单一生成器（一次成码），**无表格**的子集（如单独查询表单、单独弹窗）产出自包含片段。显式旋钮（`tableOptions` / `formLayout` / `operationColumn` / `tableBtns` / `toolbarBtns` / `expandConfig` / `treeConfig` / `mergeConfig`）可一并传入，前门原样转交合成器。

### generate_form / generate_table / generate_dialog（单面片段）

**功能**：当用户明确只要**一个**表单 / 表格 / 弹窗（而不是整页 CRUD）时，产出**自包含**的 `.vue` 片段，可以放在原生或第三方组件旁边而不与宿主作用域冲突。字段词汇与 `generate_crud` 完全一致。

| 工具 | 产物 | 适用 |
|------|------|------|
| `generate_form` | 自带 reactive model + `formItemList` 的 `<es-form>` SFC | 搜索栏、设置表单、嵌在自定义布局里的表单 |
| `generate_table` | 自带 columns/options/数据源与分页 ref 的 `<es-table>` SFC | 独立列表；给 `apiUrl` 即经 `apiParams` 自动请求 |
| `generate_dialog` | `mode='composable'`（默认）→ 可复用的 `useXxxDialog()`；`mode='component'` → 自包含 `<es-dialog>` SFC | 独立新增/编辑弹窗，或与单独生成的表格配套 |

> **不要用片段工具手工拼整页 CRUD**：`generate_crud` 的弹窗是声明式配置，走前门一次成码且有 golden 覆盖。片段工具只适合「用户明确只要一个面」。`generate_dialog` 的 composable 形态需要宿主启用 JSX 插件（弹窗体是 JSX render），`mode='component'` 则不需要。

### detect_project_target

**功能**：读宿主项目的 `package.json` 内容（由宿主用文件读取工具读出后原样传入），判定该用哪个 target：`vue3`（`@es-plus/vue3`）、`vue2`（`@es-plus/vue2`）还是 `antdv`（`@es-plus/adapter-antdv`）。

**何时调用**：在任何 `generate_*` **之前**。否则只能默认 `vue3` —— 在 Vue 2 或 Ant Design Vue 项目里会生成语法正确、但依赖装不上的代码。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| packageJson | string | ✅ | 宿主 `package.json` 的**原始字符串**内容 |

### generate_crud_from_config（ADVANCED / 已持有类型化配置时用）

**功能**：从**结构化配置**生成**生产级** CRUD 页面代码（零 TODO、零占位符）

这是**高级路径**：当你已经持有一份类型化配置（持久化、做过于 diff、或刚经 `refine_config` 修订）时直接使用。**自然语言请求请走 `generate_crud`（前门）** —— 它把「填整份配置」压缩成「填 `surfaces`」，路由由确定性代码完成。

与 `generate_crud_page`（正则关键词兜底）不同，此工具的入参是一套**类型化字段**（不是一坨 JSON 字符串）——由你（AI 客户端）按字段**语义**逐项填空。字段的 `.describe()` 语义指引与枚举合法值都内嵌在工具的 JSON schema 里，直接约束你的输出。

> **推理在你这边**：读需求 → 填 `name`（PascalCase）/ `apiUrl`（真实地址）/ `fields[]`（`prop`/`label`/`formtype` + `inQuery`/`inTable`/`inForm`）/ `actions[]`。schema 无法表达的业务逻辑（自定义校验、跨字段计算、副作用）**不要静默丢弃**，而是落成带标记的扩展点（`formatter`/`render` 串），并在返回的 `warnings` 里显式列出。调用前先读 `esplus://conventions`、`esplus://examples/nl-to-config`、`esplus://types`，草拟后对照原始需求自审一遍再调用。

**输入参数**：结构化对象（工具 inputSchema 逐字段约束），主要字段：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 页面/组件名（PascalCase），如 `UserManage` |
| apiUrl | string | ✅ | 资源的真实 REST 基础地址，如 `/api/users` |
| fields | FieldConfig[] | ✅ | 字段定义，每个数据属性一项（含 `formtype`/`inQuery`/`inTable`/`inForm`） |
| actions | string[] | ✅ | 启用的 CRUD 动作：`add`/`edit`/`delete`/`view`/`export`/`import` |
| mode | `schema`\|`sfc` | | 输出模式，默认 `schema` |
| target | `vue3`\|`vue2`\|`antdv` | | 目标渲染器，默认 `vue3` |
| dialogs / tableBtns / operationColumn / permissions / i18n … | | | 见示例与类型资源 |

> 旧文档里 `config: string`（一坨 JSON 字符串）的入参已废弃——现在工具直接暴露完整结构化形状以开启约束解码。

**输出模式**：

- **schema 模式**（默认）：输出 CrudPageSchema JSON + 包装 SFC（约 30 行）
- **sfc 模式**：输出完整独立的 Vue 3 SFC（约 200 行）

**基础配置示例**：

```json
{
  "name": "UserManage",
  "apiUrl": "/api/system/users",
  "fields": [
    { "prop": "username", "label": "用户名", "formtype": "Input", "required": true },
    { "prop": "phone", "label": "手机号", "formtype": "Input" },
    { "prop": "status", "label": "状态", "formtype": "Select",
      "dataOptions": [{ "label": "启用", "value": 1 }, { "label": "禁用", "value": 0 }],
      "render": "(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.status === 1 ? '启用' : '禁用')" },
    { "prop": "createTime", "label": "创建时间", "formtype": "DatePicker",
      "attrs": { "type": "daterange", "valueFormat": "YYYY-MM-DD" }, "inForm": false, "querySpan": 8 }
  ],
  "actions": ["add", "edit", "delete"],
  "permissions": { "add": "system:user:add", "edit": "system:user:edit", "delete": "system:user:delete" }
}
```

**多弹窗配置示例**：

```json
{
  "name": "UserManage",
  "apiUrl": "/api/system/users",
  "fields": [
    { "prop": "username", "label": "用户名", "formtype": "Input", "required": true },
    { "prop": "status", "label": "状态", "formtype": "Select",
      "dataOptions": [{ "label": "启用", "value": 1 }, { "label": "禁用", "value": 0 }] }
  ],
  "toolbarBtns": [
    { "name": "新增", "type": "primary", "icon": "Plus", "dialogKey": "add" },
    { "name": "导入", "icon": "Upload", "dialogKey": "import" },
    { "name": "导出", "icon": "Download", "actionType": "export" }
  ],
  "operationColumn": {
    "label": "操作",
    "width": 240,
    "fixed": "right",
    "btns": [
      { "name": "编辑", "type": "primary", "dialogKey": "edit" },
      { "name": "审批", "type": "warning", "dialogKey": "approve" },
      { "name": "删除", "type": "danger", "key": "delete", "confirm": "确定删除该条数据吗？" }
    ]
  },
  "dialogs": {
    "add": {
      "title": "新增用户",
      "width": "600px",
      "formItems": [
        { "prop": "username", "label": "用户名", "formtype": "Input", "required": true },
        { "prop": "phone", "label": "手机号", "formtype": "Input" }
      ]
    },
    "edit": {
      "title": "编辑用户",
      "width": "600px",
      "formItems": [
        { "prop": "username", "label": "用户名", "formtype": "Input" },
        { "prop": "phone", "label": "手机号", "formtype": "Input" }
      ]
    },
    "approve": {
      "title": "审批",
      "width": "500px",
      "formItems": [
        { "prop": "result", "label": "审批结果", "formtype": "Radio" },
        { "prop": "remark", "label": "备注", "formtype": "Input" }
      ]
    },
    "import": {
      "title": "批量导入",
      "width": "500px",
      "hasCustomRender": true
    }
  }
}
```

**StructuredCrudConfig 完整字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | PascalCase 组件名 |
| `apiUrl` | string | ✅ | 真实 API 端点 |
| `fields` | FieldConfig[] | ✅ | 字段配置数组 |
| `actions` | string[] | 旧模式必填 | CRUD 操作：add/edit/delete/view/export/import |
| `toolbarBtns` | object[] | 否 | 工具栏按钮（多弹窗模式） |
| `operationColumn` | object \| false | 否 | 操作列配置（多弹窗模式） |
| `dialogs` | Record<string, object> | 否 | 弹窗配置（多弹窗模式） |
| `mode` | 'schema' \| 'sfc' | 否 | 输出模式，默认 schema |
| `typescript` | boolean | 否 | 是否生成 TypeScript，默认 true |
| `permissions` | Record<string, string> | 否 | 权限标识映射 |
| `tableOptions` | object | 否 | 表格选项 |
| `pagination` | object | 否 | 分页配置 |

**FieldConfig 字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `prop` | string | 后端字段名 |
| `label` | string | 显示标签 |
| `formtype` | string | 表单类型（14 种，见 `list_form_types`） |
| `inQuery` | boolean | 是否在查询表单中显示（默认 true） |
| `inTable` | boolean | 是否在表格中显示（默认 true） |
| `inForm` | boolean | 是否在弹窗表单中显示（默认 true） |
| `required` | boolean | 是否必填 |
| `rules` | object[] | 自定义验证规则 |
| `attrs` | object | 透传给 Element Plus 组件的属性 |
| `dataOptions` | object[] | 静态选项数据 |
| `apiParams` | object | 远程选项加载配置 |
| `querySpan` | number | 查询表单栅格宽度 |
| `render` | string | 表格列渲染表达式 |
| `width` | number \| string | 表格列宽 |

**示例对话**：

```
用户：帮我生成一个用户管理页面，要有新增、编辑、审批功能，每个操作独立弹窗

AI：[读取 esplus://conventions 获取规范]
    [构建 StructuredCrudConfig JSON]
    [调用 generate_crud_from_config]
    
    生成了 UserManage 页面：
    - schema.ts：CrudPageSchema 配置（含 3 个弹窗定义）
    - Page.vue：30 行包装组件（处理弹窗确认逻辑）
```

---

### generate_crud_page（LEGACY FALLBACK / no-LLM 兜底）

**功能**：从自然语言描述生成完整的 `.vue` CRUD 页面——**基于正则/关键词解析**，准确率受关键词覆盖度限制。

> **优先用 `generate_crud`（前门）；已持有配置时用 `generate_crud_from_config`（ADVANCED）**。此工具不借助你的语义推理，纯靠内置关键词表匹配字段类型，仅适合快速原型、离线/无 LLM 宿主，或你确实无法草拟结构化配置时的兜底。它同样支持 `mode`（schema/sfc）与 `target`（vue3/vue2/antdv）。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| description | string | ✅ | 页面需求的自然语言描述（支持中文/英文） |
| mode | `schema`\|`sfc` | 否 | `schema`（默认）= `CrudPageSchema` JSON + 包装 SFC；`sfc` = 完整 SFC |
| target | `vue3`\|`vue2`\|`antdv` | 否 | 默认 `vue3` |

**输出**（`mode=sfc`）：完整的 Vue SFC 代码，包含：
- `<template>` — EsTable + EsForm 组合
- `<script setup>` — 响应式状态、配置对象、useDialog 弹窗逻辑

**示例对话**：

```
用户：帮我生成一个用户管理页面，查询条件有姓名、手机号、状态，
     表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除

AI：[调用 generate_crud_page] 生成包含查询表单、数据表格、操作列和弹窗表单的完整代码
```

**支持的描述格式**：

```
# 格式一：明确区分查询和表格字段
"查询条件有 A、B，表格显示 A、B、C、D，支持新增编辑删除"

# 格式二：仅列出字段（自动同时用于查询和表格）
"用户管理：姓名、手机号、邮箱、状态"

# 格式三：指定具体操作
"订单列表，支持查看详情和导出"
```

### generate_crud_schema（LEGACY FALLBACK / 输出 CrudPageSchema）

**功能**：与 `generate_crud_page` 同属正则/关键词引擎，但产物是 **`CrudPageSchema` JSON + 最小包装 SFC**（`<es-crud-page>` 形态），直接可被 `EsCrudPage` 消费。

> **优先用 `generate_crud`（前门）**。两者共用同一套确定性生成器，前门多了 `surfaces` 路由与片段分派；此工具只为「快速原型 / 无 LLM 宿主 / 明确要 schema 形态」保留。支持 `target: vue3 | vue2 | antdv`（schema JSON 与 target 无关，只有包装 SFC 语法不同）。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| description | string | ✅ | 页面需求的自然语言描述 |
| target | `vue3`\|`vue2`\|`antdv` | 否 | 默认 `vue3` |

### validate_config

**功能**：校验 es-plus JSON 配置是否符合 Schema（三端共用同一份 schema），并给出修复建议。**只判不改**：它不会替你重写配置。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config | string | ✅ | JSON 格式的配置字符串 |
| type | string | 否 | 默认 `form-item`。可选：`form-item`、`table-column`、`table-options`、`dialog-options`、`btn-config`、`api-params`；`structured-crud-config`（前门在内部合成的整页配置；手工写好的也可以在这里校验）/ `generate_crud_from_config` 的入参；`es-table-config` / `es-form-config` / `es-dialog-config`（`generate_table` / `generate_form` / `generate_dialog` 的入参） |

**示例对话**：

```
用户：帮我检查这个配置对不对
     { "prop": "name", "formtype": "Inputx", "label": "姓名" }

AI：[调用 validate_config]
    ✗ formtype 值 "Inputx" 不在允许的枚举范围内
    → 有效值：Input, InputNumber, Select, DatePicker, TimePicker, Slider,
      ColorPicker, Transfer, Cascader, Radio, Checkbox, Switch, Rate, Upload
```

### list_form_types

**功能**：列出三端（vue3 / vue2 / antdv）共享的全部 14 种表单字段类型

**输入参数**：无

**输出**：每种 formtype 的名称、描述、示例；枚举与 `VALID_FORM_TYPES` 同源（PascalCase 为推荐写法，`datePicker` / `timePicker` 旧写法仍兼容）

**示例对话**：

```
用户：es-plus 有哪些表单类型可以用？

AI：[调用 list_form_types]
    1. Input — 输入框（文本/数字/密码）
    2. InputNumber — 数字输入框
    3. Select — 下拉选择器（单选/多选）
    4. DatePicker — 日期选择器
    ...共 14 种
```

### get_component_api

**功能**：获取组件的完整 API 文档，包括 TypeScript 接口定义、Props、Methods 和使用示例

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| component | string | ✅ | 组件名：`EsForm`、`EsTable` 或 `useDialog` |

**示例对话**：

```
用户：EsTable 的 options 怎么配置？httpRequest 回调的参数是什么格式？

AI：[调用 get_component_api { component: "EsTable" }]
    返回 TableOptions 完整接口定义，包含 httpRequest、configTableOut、
    listenToCallBack 等属性的类型和用法说明
```

### scaffold_page

**功能**：生成最小化的 @es-plus/vue3 页面脚手架模板

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 页面名称（kebab-case），如 `user-management` |
| features | string[] | 否 | 包含的功能模块，默认 `["query", "table"]`。可选：`query`、`table`、`dialog` |

**示例对话**：

```
用户：给我一个空的 es-plus 页面模板，需要查询表单、表格和弹窗

AI：[调用 scaffold_page { name: "order-list", features: ["query", "table", "dialog"] }]
    生成包含基本结构的 .vue 文件，所有配置项为空数组待填充
```

### ingest_schema

**功能**：从**既有 schema** 预填一份草拟 `StructuredCrudConfig`（确定性、不调模型）。支持五种输入：OpenAPI JSON、JSON Schema、示例 JSON 对象、TypeScript 接口/类型字面量、SQL `CREATE TABLE` DDL。映射规则按**数据类型**：`integer → InputNumber`、`boolean → Switch`、日期字符串 → `DatePicker`、`string + enum → Select`、`array + enum → Checkbox`、其余 `Input`；TS 的 JSDoc / SQL 的 `COMMENT` 成为 label，非可选成员 / `NOT NULL`、`PRIMARY KEY` 成为 `required`。

**定位**：这是**起点**不是终点 —— 拿回草稿后要人工修订（收窄查询字段、补 schema 表达不了的按钮/弹窗/权限），再交给 `generate_crud_from_config` 或前门。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | ✅ | schema 原文（格式由 `kind` 决定） |
| kind | `openapi`\|`jsonSchema`\|`sample-json`\|`ts-interface`\|`sql-ddl` | ✅ | 输入格式 |
| name | string | 否 | 覆盖页面名（PascalCase）；默认取 schema title |
| apiUrl | string | 否 | 覆盖 REST 基础地址；默认是必须替换的占位符 |

### refine_config

**功能**：对已 pin 的配置做**一轮**精修。pin 就是宿主手里那份 `StructuredCrudConfig` JSON —— **服务端没有会话**。宿主先把用户这句纠正应用成 `revised`，再传入 `previous`（上一版）与 `revised`，工具确定性地（1）按权威 schema 校验 `revised`，（2）返回本轮**结构化 diff**：字段增删、`formtype`/归属变化、`actions`，以及 `dialogs` / `formLayout` / `tableOptions` / 按钮 / `columns` / `permissions` / 生成选项等顶层块的变化。

**为什么不是「把话丢给模型」**：一轮只改一个弹窗或放宽表单，若只比 `fields` 会被误报成「无变化」。校验失败时返回的是 schema 错误而不是 diff —— 修完重试即可。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| previous | string | 否 | 上一版已 pin 配置的 JSON 字符串（首轮省略） |
| revised | string | ✅ | 本轮修订后的配置 JSON 字符串 |

### doctor_page

**功能**：对宿主**入口文件**做静态检查，对照 es-plus 的 preflight 清单：UI 库、`ESPlus` 插件注册、`httpRequest`、`permission`、`t`、JSX transform。可一并传入「页面由哪份配置生成」（只要求该页面真正用到的能力）与 `vite.config`（自动导入 / JSX 插件）。

**判据是字面扫描**，结果三态：`ok` / `missing` / **`unverified`**（可能由其他方式满足，需人工确认）。`unverified` 不等于通过 —— 它只是说「这里看不出来」。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| entry | string | ✅ | 入口源码，如 `src/main.ts`（vue2 为 `src/main.js`） |
| target | `vue3`\|`vue2`\|`antdv` | 否 | 默认 `vue3` |
| config | object | 否 | 该页面生成自的配置（按需收敛必查项） |
| viteConfig | string | 否 | `vite.config.*` 源码（UI 自动导入 / JSX 插件） |

## MCP Resources（可读取资源）

AI 工具可以主动读取以下资源来获取上下文信息（共 **8 类**）：

| URI | 内容说明 |
|-----|----------|
| `esplus://conventions` | 代码生成规范（formtype、按钮 key、多弹窗模式、`configureEsPlus` 等）。按 target 分版：`/vue3`、`/vue2`、`/antdv`，无后缀 = vue3 |
| `esplus://crud-page-schema` | `EsCrudPage` 的完整 schema 与用法示例，同样分 `/vue3`、`/vue2`、`/antdv` |
| `esplus://schemas/form-item` | FormItemOption 完整 JSON Schema 定义 |
| `esplus://schemas/table-column` | TableColumn 完整 JSON Schema 定义 |
| `esplus://schemas/table-options` | TableOptions 完整 JSON Schema 定义 |
| `esplus://schemas/dialog-options` | DialogOptions 完整 JSON Schema 定义 |
| `esplus://schemas/btn-config` | BtnConfig 按钮配置 JSON Schema |
| `esplus://schemas/api-params` | ApiParams 远程数据加载 JSON Schema |
| `esplus://types` | 完整 TypeScript 类型定义文件（所有接口）。分 `/vue3`、`/vue2`、`/antdv` |
| `esplus://examples` | 8 个预设 CRUD 页面示例（含完整代码）。分 `/vue3`、`/vue2`、`/antdv` |
| `esplus://examples/nl-to-config` | 自然语言 → `StructuredCrudConfig` 的 few-shot 对（前门入参的写法参照） |
| `esplus://examples/surfaces` | `surfaces` 意图表的 few-shot（query/table/form/dialog 各面怎么写） |
| `esplus://design-extraction` | 设计稿/截图转写规范（图片须由宿主先转成文字，服务端不收图） |

**作用**：当 AI 工具需要精确了解某个配置项的类型定义时，会自动读取对应的 Schema 资源，确保生成的代码类型正确。

> 资源文本与工具面**同源**：`front-door` profile 下，引导句会自动改写成「去调前门」，不会让宿主去找被隐藏的工具。

## MCP Prompts（提示模板）

提供结构化的系统提示模板，帮助 AI 更准确地生成代码（共 **3 个**）：

| Prompt 名 | 参数 | 用途 |
|-----------|------|------|
| `crud-page` | `description: string`、`target?: vue3\|vue2\|antdv`、`mode?: schema\|sfc` | 包含 es-plus 最佳实践的 CRUD 页面生成系统提示 |
| `form-config` | `description: string`、`target?: vue3\|vue2\|antdv` | 仅生成 `formItemList` JSON 配置的系统提示 |
| `spec-to-surfaces` | `spec: string`、`target?: vue3\|vue2\|antdv`、`mode?: schema\|sfc` | 把 PRD / 用户故事 / 线框转写变成 `generate_crud` 的 `surfaces` 意图表（「第一公里」） |

## 使用场景与示例

### 场景 1：从零创建 CRUD 页面

```
用户：创建一个商品管理页面，需要：
     - 查询：商品名称、分类、状态
     - 表格：名称、分类、价格、库存、状态
     - 操作：新增、编辑、删除
```

AI 调用 `generate_crud`（前门）：把需求填成 `surfaces` 意图表 → 确定性路由到 golden 覆盖的生成器，产出：
- 查询表单（3 个字段 + 查询/重置/新增按钮）
- 数据表格（5 列 + 操作列）
- 弹窗（新增/编辑表单；声明式配置，无需手写 useDialog 胶水）

### 场景 2：查询 API 用法

```
用户：EsForm 的 apiParams 怎么用？我想让下拉框的选项从接口加载

AI：[调用 get_component_api] 返回完整说明：
    apiParams: {
      url: '/api/options',    // 接口地址
      method: 'GET',          // 请求方法
      model: { type: 'dept' } // 额外参数
    }
    配合 isInitRun: true（默认）自动在组件挂载时加载
```

### 场景 3：校验现有配置

```
用户：这个表格配置有问题吗？
     { "columns": [{ "prop": "name", "lable": "姓名" }], "options": { "border": "yes" } }

AI：[调用 validate_config]
    1. columns[0].lable → 应为 "label"（拼写错误）
    2. options.border → 应为 boolean 类型，当前是 string "yes"
    建议修复为：{ "label": "姓名" } 和 { "border": true }
```

### 场景 4：渐进式开发

```
用户：先给我一个空的页面结构，我后面再填配置

AI：[调用 scaffold_page { name: "report-dashboard", features: ["query", "table"] }]
    生成骨架代码，formItems 和 columns 为空数组
```

```
用户：现在帮我添加查询字段：日期范围、报表类型

AI：[读取 esplus://schemas/form-item 了解字段结构]
    向 formItems 中添加：
    { prop: 'dateRange', label: '日期范围', formtype: 'DatePicker',
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' }, span: 8 }
    { prop: 'reportType', label: '报表类型', formtype: 'Select',
      dataOptions: [...], span: 6 }
```

## 工作原理

```
┌────────────────────────────────────────────────────┐
│            AI 编码工具 (Claude / Cursor)             │
│                                                    │
│  用户输入: "生成用户管理页面，查询姓名状态..."        │
└──────────────────────┬─────────────────────────────┘
                       │ MCP Protocol (JSON-RPC over stdio)
                       ▼
┌────────────────────────────────────────────────────┐
│              @es-plus/mcp-server                    │
│                                                    │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Tools (15)     │  │Resources (8 类)│  │Prompts(3)│  │
│  │ 前门 + 单面片段  │  │ JSON Schema  │  │ 系统提示 │  │
│  │ + 确定性支撑     │  │ TS 类型定义  │  │ 最佳实践 │  │
│  │                 │  │ 预设示例     │  │          │  │
│  └─────────────────┘  └──────────────┘  └──────────┘  │
│                                                    │
│  Core Engine:                                      │
│  ├── front-door router (surfaces → 生成器)          │
│  ├── structured-generator (Config → 三端 SFC)       │
│  └── schema-validator (JSON Schema 校验)           │
└────────────────────────────────────────────────────┘
                       │
                       ▼ 输出
┌────────────────────────────────────────────────────┐
│           完整 .vue SFC 文件                        │
│                                                    │
│  <es-table :columns="columns" :options="options">  │
│    <es-form :model="query" :form-item-list="..." />│
│  </es-table>                                       │
│                                                    │
│  + useDialog() 弹窗逻辑                            │
│  + 响应式状态管理                                   │
│  + 类型安全的配置对象                               │
└────────────────────────────────────────────────────┘
```

## 自然语言解析规则（仅限 generate_crud_page 兜底）

> 以下关键词表**只**用于 `generate_crud_page` 的正则启发式解析。`generate_crud`（前门）与 `generate_crud_from_config`（ADVANCED）都不走这些表——路由或字段语义由确定性代码/宿主推理决定，不受关键词覆盖度限制。

`generate_crud_page` 工具使用基于规则的 NLP 引擎，支持以下模式：

### 字段类型自动推断

| 关键词 | 推断 formtype | 示例 |
|--------|--------------|------|
| 状态、类型、分类、性别、级别 | Select | "状态" → Select + 启用/禁用选项 |
| 日期、时间、创建时间 | DatePicker | "日期范围" → DatePicker + daterange |
| 开关、是否、启用 | Switch | "是否启用" → Switch |
| 评分、星级 | Rate | "满意度评分" → Rate |
| 颜色 | ColorPicker | "标签颜色" → ColorPicker |
| 图片、头像、文件 | Upload | "头像" → Upload |
| 备注、描述、内容 | Input(textarea) | "备注" → Input + textarea |
| 其他 | Input | 默认为文本输入框 |

### 字段名自动映射

常见中文字段名会自动映射为英文 prop：

| 中文名 | prop 值 | 中文名 | prop 值 |
|--------|---------|--------|---------|
| 姓名 | name | 手机号 | phone |
| 邮箱 | email | 状态 | status |
| 创建时间 | createTime | 订单号 | orderNo |
| 金额 | amount | 分类 | category |
| 部门 | department | 职位 | position |

### 操作识别

| 关键词 | 识别的操作 |
|--------|-----------|
| 新增、添加、创建 | add（生成新增按钮 + 弹窗） |
| 编辑、修改、更新 | edit（生成编辑按钮 + 弹窗） |
| 删除、移除 | delete（生成删除按钮） |
| 查看、详情 | view（生成查看按钮） |
| 导出 | export（生成导出按钮） |

## 常见问题

### Q: MCP Server 需要网络连接吗？

不需要。`@es-plus/mcp-server` 完全在本地运行，所有代码生成基于内置的规则引擎，不依赖任何外部 API 或 LLM 服务。

### Q: 生成的代码能直接运行吗？

可以。生成的 `.vue` 文件可直接复制到你的项目中使用，前提是项目已安装并配置 `@es-plus/vue3`。你只需要：
1. 替换 `httpRequest` 中的注释为实际的 API 调用
2. 根据业务需求调整 `dataOptions` 的选项值

### Q: 支持英文输入吗？

支持。你可以用英文描述字段，如 "User management, query by name and status, table shows name, phone, email, status"。但中文描述的识别精度更高。

### Q: 如何自定义生成的代码风格？

MCP Server 生成的是标准 @es-plus/vue3 配置代码。如果需要调整风格（如使用 TypeScript、调整缩进），可以在 AI 工具中追加指令，如："请把上面的代码改为 TypeScript 版本，并添加类型注解"。

### Q: 与 AI CRUD 生成器（文档站）有什么区别？

两者使用相同的核心引擎（crud-engine），区别在于：
- **文档站 AI CRUD 生成器**：在浏览器中运行，通过 Web UI 交互
- **MCP Server**：在本地 Node.js 中运行，通过 AI 编码工具的对话界面交互，可直接将代码写入项目文件

## 版本说明

| 版本 | 变更 |
|------|------|
| 1.4.x | 工具面 15 个（`generate_crud` 前门 / 单面片段 / `detect_project_target` / `ingest_schema` / `refine_config` / `doctor_page` 等）、8 类 resources、3 个 prompts；新增 `front-door` profile |
| 1.1.0 | 新增 `generate_crud_from_config` 工具，支持多弹窗配置生成 |
| 1.0.0 | 初始发布：5 Tools + 8 Resources + 2 Prompts |

> 想看某一版**准确的**工具/资源清单，以运行时为准：`validate_config` 之类的工具名可直接在客户端工具面板查看，或用 `check:tool-surface` 的源码断言（`full` 15 / `front-door` 12）。
