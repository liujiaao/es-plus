# @es-plus/mcp-server

[`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3) / [`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2) 官方 MCP Server —— 让 AI 编码工具自动生成 CRUD 页面。同一 Schema 可生成 Vue 3 或 Vue 2 版本代码。

**三端线上演示**（同一份配置，换的只有渲染器）：[Vue 3 + Element Plus](https://liujiaao.github.io/es-plus/) · [Vue 3 + Ant Design Vue](https://liujiaao.github.io/es-plus/es-pc/) · [Vue 2 + Element UI](https://liujiaao.github.io/es-plus/es-eui/) —— [在线文档](https://liujiaao.github.io/es-plus/) · [GitHub](https://github.com/liujiaao/es-plus)

> **维护基线（先读这两份）**
> - [AI-NATIVE-ARCHITECTURE.md](./AI-NATIVE-ARCHITECTURE.md) —— 主链路执行步骤、15 个工具的能力与边界（含 `ESPLUS_MCP_PROFILE` 两档工具面）、IR / 三端运行时契约、质量体系。**改动任何工具/schema/生成器前必读。**
> - [AI-NATIVE-REMEDIATION-PLAN.md](./AI-NATIVE-REMEDIATION-PLAN.md) —— 面向「真实编译 100% + 准确率 95%」的 `AN-01..AN-29` 可执行计划、阶段门禁与验收口径。

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

AI 会自动调用 MCP Server 的 `generate_crud`（前门）工具。你只填 `surfaces` 意图表（query / table / form / dialog 各放哪些字段、要哪些弹窗），路由与三端编译由确定性代码完成，产物包含：

- 查询表单（字段类型按语义映射到 Input / Select / DatePicker 等）
- 数据表格（含状态列渲染、操作按钮）
- 新增/编辑弹窗（声明式配置，含表单验证）
- 删除确认提示
- 分页与接口请求模板

**你只需替换 `httpRequest` 中的接口地址即可投入使用。**

---

## 工具 (Tools)

MCP Server 默认（`full` profile）暴露 **15 个工具**，AI 编码工具会根据你的描述自动选择调用。

> **生成路径优先级**：`generate_crud` 是**唯一前门**（自然语言请求走它 —— 你把需求填成 `surfaces`，路由由确定性代码完成）。`generate_crud_from_config` 是 **ADVANCED**（已持有类型化配置时直通，与前者共用同一生成器）。`generate_crud_page` / `generate_crud_schema` 是 **LEGACY FALLBACK**（无 LLM 的正则兜底，准确率受关键词表覆盖度限制）。
>
> 设 `ESPLUS_MCP_PROFILE=front-door` 时隐藏上述 1 个 ADVANCED + 2 个 LEGACY 工具，只留前门、单面片段与确定性支撑工具（共 12 个）。

### generate_crud（唯一前门 / FRONT DOOR）

自然语言请求的统一入口。入参是 `surfaces` 意图表：query / table / form / dialog 各放哪些字段、要哪些弹窗。**有表格**的请求走 golden 覆盖的单一生成器（一次成码）；**无表格**的子集（如单独查询表单、单独弹窗）产出自包含片段。显式旋钮（`tableOptions` / `formLayout` / `operationColumn` / `tableBtns` / `toolbarBtns` / `expandConfig` / `treeConfig` / `mergeConfig`）可一并传入，前门原样转交合成器。

### generate_form / generate_table / generate_dialog（单面片段）

用户明确只要**一个**表单 / 表格 / 弹窗时，产出**自包含**的 `.vue` 片段（或不需 JSX 的 `<es-dialog>` SFC），可放在原生/第三方组件旁边。**不要用它们手工拼整页 CRUD** —— 前门的弹窗是声明式的，走前门即可。

### detect_project_target

读宿主 `package.json` 判定 `vue3` / `vue2` / `antdv`。**在任何 `generate_*` 之前调用**，否则只能默认 `vue3`。

### generate_crud_from_config（ADVANCED / 已持有类型化配置时用）

从**结构化配置**（带类型的字段，而非 JSON 字符串）生成生产级 CRUD 页面。这是主生成路径：

- 由你（AI 客户端）阅读自然语言请求，直接**按类型逐字段填空**：`name`（PascalCase）、`apiUrl`（真实接口）、`fields[]`（`prop`/`label`/`formtype` + `inQuery`/`inTable`/`inForm`）、`actions[]`。工具的输入 schema 用 `.describe()` 指引你**按字段含义**推断 `formtype`，不靠关键词硬匹配。
- schema 无法表达的业务逻辑 → 落成**带标记的扩展点**（`formatter`/`render` 串 + `TODO(es-plus)` 桩 + `warnings`），显式暴露而非静默丢弃。
- 生成前先读 `esplus://conventions`、`esplus://examples/nl-to-config`、`esplus://types`；草拟后对照原始请求**自审**再调用。
- 返回 `warnings[]` —— 交付前逐条解决。
- 返回 **`preflight` 前置清单**：宿主入口必须配齐的 `httpRequest` / `permission` / `t` / JSX 插件 / UI 库。
  它按**本配置**逐项判定 required（没有 `permissionValue` 就不要求 `permission`），并附一份可直接复制的入口样板。
  清单来自 `packages/shared/src/preflight.ts`，与 `scaffold_page` 是**同一个** builder。

### generate_crud_page（兜底 / no-LLM fallback）

从自然语言生成 CRUD 页面（.vue SFC）。**它用正则/关键词解析，不做真正推理**——仅用于快速原型，或你无法草拟结构化配置时。日常请优先 `generate_crud`（前门）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `description` | string | 页面功能描述（中文或英文） |
| `mode` | `'schema' \| 'sfc'`（可选） | `schema`（默认）= CrudPageSchema + 包装 SFC；`sfc` = 完整 SFC |
| `target` | `'vue3' \| 'vue2' \| 'antdv'`（可选） | 渲染目标，未传则自动检测 |

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

**关键词兜底映射**（仅 `generate_crud_page` 的启发式；首选路径靠语义推断而非此表）：

| 字段关键词 | 自动映射为 |
|-----------|-----------|
| 状态、类型、分类、级别、来源 | Select 下拉选择 |
| 日期、创建时间、更新时间 | DatePicker 日期选择器 |
| 时间、时刻 | TimePicker 时间选择器 |
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

### generate_crud_schema（兜底 / 输出 CrudPageSchema）

与 `generate_crud_page` 同属正则/关键词引擎，但产物是 **`CrudPageSchema` JSON + 最小包装 SFC**（`<es-crud-page>` 形态），参数同为 `description` + 可选 `target`。日常请优先 `generate_crud`（前门）—— 两者共用同一套确定性生成器。

### validate_config

校验 JSON 配置是否符合 es-plus 组件规范，返回错误详情和修复建议（Vue 3 / Vue 2 共用同一份 Schema）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | string | JSON 配置字符串 |
| `type` | string? | Schema 类型，不传按 `form-item` 校验 |

支持的 Schema 类型：`form-item`、`table-column`、`table-options`、`dialog-options`、`btn-config`、`api-params`，
以及 `structured-crud-config`（前门在内部合成的整页配置；手工写好的也可以在这里校验 / `generate_crud_from_config` 的入参）
与 `es-table-config` / `es-form-config` / `es-dialog-config`（`generate_table` / `generate_form` / `generate_dialog` 的入参）。

**草拟完结构化配置后先自查一遍**，不要等生成报错：

```
validate_config({ config: JSON.stringify(yourConfig), type: "structured-crud-config" })
```

它按 `generate_crud_from_config` 的同一份 Zod schema（`packages/shared/src/structured-config.schema.ts`）
判定，错误路径与 `fields[0].formtype` 这类写法一一对应，因此 `generate → 校验 → 编译` 三步都跑得通。

### ingest_schema

从**既有 schema** 预填草拟配置（确定性、不调模型）。支持 `openapi` / `jsonSchema` / `sample-json` / `ts-interface` / `sql-ddl` 五种输入：按数据的**类型**映射 `formtype`（`integer → InputNumber`、`boolean → Switch`、日期字符串 → `DatePicker`、`string + enum → Select`、`array + enum → Checkbox`、其余 `Input`），TS 的 JSDoc / SQL 的 `COMMENT` 成为 label，非可选成员 / `NOT NULL`、`PRIMARY KEY` 成为 `required`。**这是起点不是终点**：拿回草稿后要人工修订，再交给前门或 `generate_crud_from_config`。

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | string | schema 原文 |
| `kind` | enum | `openapi` / `jsonSchema` / `sample-json` / `ts-interface` / `sql-ddl` |
| `name` | string? | 覆盖页面名（PascalCase）；默认取 schema title |
| `apiUrl` | string? | 覆盖 REST 基础地址；默认是必须替换的占位符 |

### refine_config

对已 pin 的配置做**一轮**精修（服务端无会话：pin 就是宿主手里那份 JSON）。宿主把用户的纠正应用成 `revised`，连同 `previous` 传入；工具确定性地校验 `revised` 并返回**结构化 diff**（字段增删、`formtype`/归属、`actions`，以及 `dialogs` / `formLayout` / `tableOptions` / 按钮 / `columns` / `permissions` 等顶层块的变化）。校验失败时返回 schema 错误而非 diff。

| 参数 | 类型 | 说明 |
|------|------|------|
| `previous` | string? | 上一版已 pin 配置的 JSON（首轮省略） |
| `revised` | string | 本轮修订后的配置 JSON |

### list_form_types

列出 es-plus 支持的全部 14 种表单控件类型及用法示例。无需参数。

### get_component_api

获取组件完整 API 文档，包含 TypeScript 接口定义、Props、方法、使用示例。

| 参数 | 类型 | 说明 |
|------|------|------|
| `component` | enum | `EsForm` / `EsTable` / `useDialog` |

### scaffold_page

生成最小化页面脚手架，适合需要手动填充配置的场景。返回值与生成物**共用同一份 `preflight` 清单**
（`buildScaffoldPreflight`），并附可直接复制的入口样板。

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | 页面名称（kebab-case） |
| `features` | string[]? | 功能列表，默认 `['query', 'table']` |
| `target` | enum? | `vue3`（默认）/ `vue2` / `antdv` |

可选 features：`query`（查询表单）、`table`（数据表格）、`dialog`（弹窗）

清单里 `httpRequest` 只在含 `table` 时 required（查询-only 脚手架不取远端数据）；
`dialog` 走 `useDialog()`，没有 JSX render，因此**不**要求 JSX 插件。

### doctor_page

检查宿主**已有**的入口装配是否满足前置清单。传入入口源码（可选 `viteConfig` 与生成该页面用的
`config`），按三态报告每一项：

- `ok` —— 找到了证据；
- `missing` —— 确定缺失（对应能力会静默失效，权限项甚至是**失败即放行**）；
- `unverified` —— 字面量扫描看不到（`app.use(ESPlus, options)`、`...spread`、未提供 `viteConfig`），
  **不是通过**，报告会明确写出需人工确认。

| 参数 | 类型 | 说明 |
|------|------|------|
| `entry` | string | 应用入口源码（`src/main.ts`；vue2 为 `src/main.js`） |
| `target` | enum? | `vue3`（默认）/ `vue2` / `antdv` |
| `config` | object? | 生成该页面所用的配置；给出后只要求它真正用到的能力 |
| `viteConfig` | string? | `vite.config.*` 源码，用于验证 UI 库自动导入与 JSX 插件 |

扫描前会**剥掉注释** —— 入口样板注释里就写着 `permission / t / httpRequest`，
不剥注释会把「只在注释里提过」误判为「已配置」。

---

## 资源 (Resources)

AI 工具可通过 MCP 资源协议读取 es-plus 的 Schema 定义和类型信息。

| 资源 URI | 内容 |
|----------|------|
| `esplus://conventions` | 生成规范（formtype、按钮 key、多弹窗、`configureEsPlus`）；`/vue3`、`/vue2`、`/antdv` |
| `esplus://crud-page-schema` | `EsCrudPage` 的 schema 与用法示例；`/vue3`、`/vue2`、`/antdv` |
| `esplus://schemas/form-item` | 表单项配置 JSON Schema |
| `esplus://schemas/table-column` | 表格列配置 JSON Schema |
| `esplus://schemas/table-options` | 表格选项 JSON Schema |
| `esplus://schemas/dialog-options` | 弹窗配置 JSON Schema |
| `esplus://schemas/btn-config` | 按钮配置 JSON Schema |
| `esplus://schemas/api-params` | 远程数据加载 JSON Schema |
| `esplus://types` | 完整 TypeScript 类型定义；`/vue3`、`/vue2`、`/antdv` |
| `esplus://examples` | 8 个预设 CRUD 示例（含生成代码）；`/vue3`、`/vue2`、`/antdv` |
| `esplus://examples/nl-to-config` | 自然语言 → `StructuredCrudConfig` 的 few-shot |
| `esplus://examples/surfaces` | `surfaces` 意图表的 few-shot |
| `esplus://design-extraction` | PRD / 线框 → surfaces 的提取契约（检查清单、正反例；图片由宿主视觉转写，server 不接收图片） |

---

## 提示模板 (Prompts)

| 模板名 | 参数 | 用途 |
|--------|------|------|
| `crud-page` | `description` | 生成完整 CRUD 页面的系统提示 |
| `form-config` | `description` | 仅生成表单配置 JSON 的系统提示 |
| `spec-to-surfaces` | `spec`, `target?`, `mode?` | 把文本 PRD / 线框转写稿转成 `generate_crud` 的 surfaces 意图表（第一英里） |

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
