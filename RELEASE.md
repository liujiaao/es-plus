# 发布指南

本项目使用 [changesets](https://github.com/changesets/changesets) 管理版本和发布。

## 包结构

| 包名 | 路径 | 说明 |
|------|------|------|
| `@es-plus/shared` | `packages/shared` | 共享核心逻辑（自动安装，用户无感） |
| `@es-plus/mcp-server` | `packages/mcp-server` | MCP Server（AI 编码工具集成） |
| `@es-plus/cli` | `packages/cli` | CLI 工具（命令行生成 CRUD 页面） |

三个包通过 `linked` 配置联动 — 任一包发版时，其他关联包自动同步版本号。

## 日常开发流程

### 1. 记录变更

完成功能开发或 bug 修复后，运行：

```bash
npx changeset
```

交互式选择：
- **哪些包受影响**（可多选）
- **变更级别**：`patch`（修复）/ `minor`（新功能）/ `major`（破坏性变更）
- **变更描述**（一行即可，会写入 CHANGELOG）

执行后会在 `.changeset/` 目录生成一个 markdown 文件，**需要提交到 git**。

> 一次 PR 可以包含多个 changeset 文件（对应多个独立变更）。

### 2. 升版本号

准备发版时运行：

```bash
npx changeset version
```

该命令会：
- 消费 `.changeset/` 中的所有变更文件
- 自动计算并更新各包的 `package.json` 版本号
- 自动更新内部依赖（如 shared 升版，mcp-server/cli 的依赖声明同步更新）
- 生成/追加各包的 `CHANGELOG.md`

检查生成的变更，确认无误后提交：

```bash
git add .
git commit -m "chore: version packages"
```

### 3. 发布到 npm

```bash
npx changeset publish
```

该命令按依赖顺序发布：`@es-plus/shared` → `@es-plus/mcp-server` + `@es-plus/cli`

发布后自动创建 git tag（如 `@es-plus/shared@1.0.1`）。

推送 tag 到远程：

```bash
git push --follow-tags
```

## 版本号规则

| 场景 | 级别 | 示例 |
|------|------|------|
| 修复 bug、文档更新 | `patch` | 1.0.0 → 1.0.1 |
| 新增功能、新增工具 | `minor` | 1.0.0 → 1.1.0 |
| 破坏性 API 变更 | `major` | 1.0.0 → 2.0.0 |

## 构建顺序

发布前需确保构建通过：

```bash
# 先构建 shared（其他包依赖它）
cd packages/shared && npm run build

# 再构建消费者（可并行）
cd packages/mcp-server && npm run build
cd packages/cli && npm run build
```

`mcp-server` 已配置 `prebuild` 脚本自动先构建 shared。

## 预发布（Prerelease）

如需发布 beta/rc 版本：

```bash
# 进入预发布模式
npx changeset pre enter beta

# 正常记录变更 + version + publish
npx changeset
npx changeset version    # 生成如 1.1.0-beta.0
npx changeset publish

# 退出预发布模式
npx changeset pre exit
```

## 首次发布检查清单

- [ ] 确认各包 `package.json` 中 `publishConfig.access` 为 `"public"`
- [ ] 确认已登录 npm：`npm whoami`
- [ ] 确认包名在 npm 上未被占用
- [ ] 确认 `packages/shared` 已构建：`ls packages/shared/build/index.js`
- [ ] 运行测试：`cd packages/shared && npm test`

## 常见问题

**Q: 改了 shared 但忘记记录 changeset？**
CI 可配置 [changeset-bot](https://github.com/apps/changeset-bot) 在 PR 中提醒。

**Q: 只改了 mcp-server，需要选 shared 吗？**
不需要。只选实际修改的包。changesets 会自动判断是否需要 bump 依赖方。

**Q: `linked` 和 `fixed` 的区别？**
- `linked`：版本号保持一致，但只有实际变更的包才发布
- `fixed`：版本号保持一致，且所有包一起发布（即使没变更）

本项目用 `linked`，避免不必要的发布。
