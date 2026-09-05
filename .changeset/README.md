# Changesets

本项目用 [changesets](https://github.com/changesets/changesets) 管理版本与发布。完整发布流程见 [RELEASE.md](../RELEASE.md)；这里只讲「改代码时怎么记一笔」。

## 何时需要 changeset

改动属于**用户可见**（bug 修复 / 新功能 / 破坏性变更）时，提交 PR 前跑一次：

```bash
npx changeset
```

交互式选择：

1. **受影响包**（可多选）——只勾实际改动的包。
2. **变更级别**——`patch`（修复）/ `minor`（新功能）/ `major`（破坏性变更）。
3. **变更描述**——一行即可，会写入该包的 CHANGELOG。

执行后会在本目录生成一个 markdown 文件，**必须随 PR 一起提交**。纯文档 / 测试 / CI 改动通常不需要 changeset。

## 本仓库的版本分组

- **linked**：`@es-plus/shared`、`@es-plus/mcp-server`、`@es-plus/cli` —— 任一包发版，三个自动同步到相同版本号。
- **独立版本**：`@es-plus/vue3`、`@es-plus/vue2`、`@es-plus/core`、`@es-plus/adapter-antdv`、`es-plus-ui` —— 各自独立、互不联动。
- `@es-plus/adapter-antdv` 在 changesets 内但**不 linked**；因与 `@es-plus/vue3` 共享配置 Schema，破坏性 Schema 变更需同步升 major。

## 版本号规则

| 场景 | 级别 |
|------|------|
| 修复 bug | `patch` |
| 新增功能 | `minor` |
| 破坏性 API 变更 | `major` |

## 常见问题

**只改了 mcp-server，要勾 shared 吗？** 不需要，只勾实际改动的包。

**改了 core 要勾哪些？** 勾 `@es-plus/core` 即可；`vue2` / `vue3` / `adapter-antdv` 是否升版本，取决于它们是否发布了「依赖 core 新行为」的变更（changesets 会自动处理内部依赖联动）。

**某包没有 CHANGELOG.md 怎么办？** 首次 `npx changeset version` 会为该包自动生成；无需手写。
