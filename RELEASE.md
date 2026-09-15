# 发布指南

> 维护者文档以中文为工作语言；英文对外入口见 [README.en.md](./README.en.md)。

本项目使用 [changesets](https://github.com/changesets/changesets) 管理版本和发布。

## 包结构

| 包名 | 路径 | 说明 |
|------|------|------|
| `@es-plus/vue3` | `packages/vue3` | Vue 3 + Element Plus 渲染器 |
| `@es-plus/vue2` | `packages/vue2` | Vue 2 + Element UI 渲染器 |
| `@es-plus/core` | `packages/core` | 框架无关核心层（类型/工具/算法） |
| `@es-plus/shared` | `packages/shared` | 共享核心逻辑（自动安装，用户无感） |
| `@es-plus/mcp-server` | `packages/mcp-server` | MCP Server（AI 编码工具集成） |
| `@es-plus/cli` | `packages/cli` | CLI 工具（命令行生成 CRUD 页面） |
| `@es-plus/adapter-antdv` | `packages/adapter-antdv` | Ant Design Vue 4.x 适配器（**随 changesets 独立版本、不 linked**，见文末） |
| `es-plus-ui` | `packages/es-plus-legacy` | 兼容 stub（re-export `@es-plus/vue3`，deprecated） |

`@es-plus/shared`、`@es-plus/mcp-server`、`@es-plus/cli` 三者通过 `linked` 配置联动 — 任一包发版时，其他两个自动同步到相同版本号。其余包（vue3 / vue2 / core / adapter-antdv / es-plus-legacy）随 changesets **独立版本**：版本号互不影响、各自演进（实测 vue3@1.5.0 / vue2@1.2.0 / core@1.1.0 / adapter-antdv@1.1.0 各不相同）。

> `es-plus-ui`（`packages/es-plus-legacy`）已被 `.changeset/config.json` 的 `ignore` 冻结 —— 不再 version、不再发布。
> 其依赖范围 `@es-plus/vue3: ^1.5.0` 也随 changesets 一起冻结：若 vue3 升到 2.0，该 stub 的依赖将不可满足且无自动修复路径。

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

发布由 GitHub Actions 工作流 [`.github/workflows/publish.yml`](./.github/workflows/publish.yml)
通过 npm **Trusted Publishing (OIDC)** 完成 —— **不要在本地直接 `changeset publish`**：

本地 token 的写操作被 registry 限制（任何 PUT 返回 403），本地发布必然失败；CI 走 OIDC 交换身份，不需要 token。

```bash
# 1) 本地消费 changeset，生成版本号变更并提交
npx changeset version
git add -A && git commit -m "chore: version packages"

# 2) 推送提交后，到 GitHub → Actions → Publish → Run workflow
```

工作流会依次：构建全部包 → `changeset publish`（按依赖拓扑排序，先 `shared`，再 `cli` / `mcp-server` 与各渲染器）
→ 把 changesets 生成的 per-package tag 推回仓库。

> **注意**：工作流前置守卫要求 `.changeset/` 下没有未消费的 changeset。若忘记第 1 步，
> `changeset publish` 会以「No unpublished projects to publish」**退出码 0** 结束 ——
> 绿灯但什么都没发布。守卫会直接失败以避免这种误判。

`changesets` 生成的是 **per-package tag**（如 `@es-plus/shared@1.0.1`），不是 `v1.0.1`。
`changeset publish` 只在本地 `git tag`、**从不自动推送**；推送由工作流里的 `git push origin --tags` 完成。

## 版本号规则

| 场景 | 级别 | 示例 |
|------|------|------|
| 修复 bug、文档更新 | `patch` | 1.0.0 → 1.0.1 |
| 新增功能、新增工具 | `minor` | 1.0.0 → 1.1.0 |
| 破坏性 API 变更 | `major` | 1.0.0 → 2.0.0 |

## 构建顺序

发布前需确保构建通过。根目录一条命令构建全部可发布包：

```bash
npm run build:packages
```

内部按依赖顺序编排：`schemas:sync → core → shared → vue3 → vue2 → adapter-antdv → cli → mcp-server`。

- `@es-plus/core` **在脚本内且最先构建**（`core → shared → ...`）：vue3/vue2/adapter-antdv 都依赖它，先于三者产出。
- `@es-plus/adapter-antdv` 的 `prebuild` 会先 `sync-schemas`，`prepublishOnly` 会自动 `typecheck + build`。

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

## @es-plus/adapter-antdv 的版本与发布

`@es-plus/adapter-antdv`（Ant Design Vue 4.x 适配器）**在 changesets 体系内，但不在 `linked` 组**：给它提 changeset（`npx changeset` 时勾选 `@es-plus/adapter-antdv`）即走标准 `version` + `publish` 流程，版本号与 vue3 / vue2 互不联动。

由于它与 `@es-plus/vue3` 共享同一份配置 Schema，**破坏性 Schema 变更应与 vue3 同步升 major**（在 changeset 里选 major 即可）。

> 紧急补丁也可绕开 changesets 手动发布（下方步骤）；但日常发版请走 changeset，避免版本与 CHANGELOG 漂移。

### 发布步骤

```bash
cd packages/adapter-antdv

npm run build                                   # 重新构建，确认 dist/resolver.* 已生成
npm pack --dry-run                              # 检查打包清单（应仅含 dist/、schemas/、README.md）
npm publish --registry=https://registry.npmjs.org/
npm view @es-plus/adapter-antdv version         # 验证，应返回已发布版本号
```

### 注意事项

- `prepublishOnly` 脚本会自动执行 `npm run typecheck && npm run build`，发布前再次校验。
- 本机默认 registry 可能是 `npmmirror`（淘宝镜像），**必须显式 `--registry=https://registry.npmjs.org/`**；`package.json` 的 `publishConfig.registry` 已锁定官方源作为兜底。
- 详细的架构、构建产物与开发说明见 [`packages/adapter-antdv/DEVELOP.md`](./packages/adapter-antdv/DEVELOP.md)。
