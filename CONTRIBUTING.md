# Contributing to ES-Plus

感谢你对 ES-Plus 的关注！这份文档说明开发流程、PR 规范和社区约定。

## TL;DR

```bash
git clone https://github.com/liujiaao/es-plus.git
cd es-plus
npm install --legacy-peer-deps
npm run build:packages
npm test                                      # 跑全部包单测
npm run test:e2e                              # 跑 vue2/vue3 × schema/sfc e2e 矩阵
```

PR 提交前请保证 `npm test` + `npm run test:e2e` 全绿。

## 仓库结构

ES-Plus 是 **npm workspaces monorepo**。

```
es-plus/
├── packages/
│   ├── core/         # 框架无关纯逻辑（Vue 2/3 共享）
│   ├── shared/       # 工具链共享（codegen / schema validator）
│   ├── vue2/         # Vue 2 + Element UI 渲染层
│   ├── vue3/         # Vue 3 + Element Plus 渲染层
│   ├── cli/          # 命令行代码生成器
│   └── mcp-server/   # MCP Server（AI 编码工具集成）
├── es-plus-docs/     # 文档站（vite + vue3 + element-plus）
└── __tests__/e2e/    # 跨包 e2e 矩阵
```

依赖图：
- `core` → 被 `vue2`、`vue3` 直接依赖（vue3 内联打包，vue2 external 引用）
- `shared` → 被 `cli`、`mcp-server` 依赖

## 开发流程

### 1. fork + clone

```bash
git clone git@github.com:<your-username>/es-plus.git
cd es-plus
git remote add upstream https://github.com/liujiaao/es-plus.git
```

### 2. 装依赖

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` 是必需的：peer dep 解析在 element-ui / element-plus 的 vue 跨版本场景下会与 npm 7+ 的严格模式冲突。

### 3. 切分支

```bash
git checkout -b fix/short-description
# 或 feat/xxx / docs/xxx / refactor/xxx
```

### 4. 改代码

每个 package 自治：

```bash
cd packages/<package>
npm run dev          # watch 模式（如果支持）
npm test             # 单测
npm run typecheck    # 类型检查
npm run lint         # 代码风格（阶段 B 上线后启用）
```

### 5. 跑全套验证

回到根目录：

```bash
npm run build:packages       # 构建所有包
npm test --workspaces --if-present
npm run test:e2e             # vue2/vue3 × schema/sfc 矩阵
```

### 6. 提交 commit

我们用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

[body]

[footer]
```

**type**：`feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `release`

**scope**：限定为 monorepo 包名（`core`、`shared`、`vue2`、`vue3`、`cli`、`mcp-server`、`docs`、`e2e`、`ci`、`deps`）

**示例**：
```
fix(vue2): inline @vue/composition-api into dist to fix UNRESOLVED_IMPORT
feat(mcp-server): add --diagnose subcommand for self-check
docs(vue2): clarify auto polyfill management since 1.1.0
```

### 7. 推 + 提 PR

```bash
git push origin fix/short-description
```

PR 标题用 commit message 同样的格式。模板会自动填充——按里面 checklist 一项项过。

## PR 准入标准

✅ **必须**：
- 所有 CI 任务绿（unit-tests、typecheck、e2e、lint）
- 改动有对应单测（bug 修复 → 回归测试；新功能 → 行为测试）
- breaking change 显式在 PR 描述里标 `BREAKING CHANGE:` 并说明迁移路径
- 涉及发布的改动同步更新 CHANGELOG
- 对外 API 改动同步 `es-plus-docs` 文档

⚠️ **审核会重点关注**：
- 类型契约（`@es-plus/core/types` 改动会影响两个渲染层）
- 包体积（vue2/vue3 dist 增长 > 10% 需要解释）
- 跨包依赖一致性（peer dep 范围、版本范围）

## 版本管理

ES-Plus 用 **independent versioning**——每个包版本独立。

发布流程（仅 maintainer）：

```bash
cd packages/<pkg>
# 编辑 package.json + src 内 version 字面量（如 vue2/index.ts）
# 编辑 CHANGELOG.md
# 编辑 es-plus-docs/src/docs/changelog.md（用户面向）
git add -A
git commit -m "release(@es-plus/<pkg>): <version> — <summary>"
npm publish --workspace @es-plus/<pkg>
```

### Semver 边界

- `patch` (1.0.x)：bug 修复，无 API 变化
- `minor` (1.x.0)：新增 feature，向后兼容
- `major` (x.0.0)：breaking change

> **dist 体积增长 > 30%** 视同 `minor` bump（即使是 bug 修复），通过 CHANGELOG 显式说明。

## 报 bug / 提 feature

走 [GitHub Issues](https://github.com/liujiaao/es-plus/issues) + 选对应模板。**不要**在 Discussions 里报 bug——那里是给问答和点子用的。

### Bug 报告 SLA

- **首响应**：72 小时（工作日）
- **修复进度更新**：每周一次，直到 close 或归档
- **安全漏洞**：见 [SECURITY.md](./SECURITY.md)，24 小时首响应

## 设计哲学（写代码前请读）

ES-Plus 的核心抽象是**配置即代码**——同一份 JSON 配置驱动两个渲染层（Vue 2 + Element UI / Vue 3 + Element Plus）。

写新代码时遵循：

1. **新功能优先放 `core`**，让两个渲染层自动获得
2. **渲染层差异**用 adapter 模式处理（vue2 / vue3 各自实现统一接口）
3. **不要在配置 schema 里放仅 vue3 / 仅 vue2 的特定字段**——除非有明确 fallback
4. **breaking change 至少经过一个 minor 版本的 deprecation**

## 行为准则

参与项目即同意 [Code of Conduct](./CODE_OF_CONDUCT.md)。

## License

MIT。提交 PR 即代表你同意贡献内容以同样的 license 发布。
