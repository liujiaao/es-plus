<!--
感谢你提 PR！请填写下面所有字段。
PR 标题用 Conventional Commits 格式：feat(scope): xxx / fix(scope): xxx
-->

## 改动摘要

<!-- 一句话说明这个 PR 在做什么。 -->

## 改动类型

- [ ] 🐛 bug 修复（无破坏性 / 不引入新 API）
- [ ] ✨ 新功能（向后兼容 / 不破坏现有 API）
- [ ] 💥 破坏性变更（API 变化 / 行为变化）
- [ ] ♻️ 重构（不改变外部行为）
- [ ] 📝 文档（仅文档 / 注释）
- [ ] 🎨 代码风格（不改变运行时行为）
- [ ] ✅ 测试（仅测试代码 / fixture）
- [ ] 🔧 构建 / CI / 发布
- [ ] ⬆️ 依赖升级

## 涉及的包

- [ ] `@es-plus/vue3`
- [ ] `@es-plus/vue2`
- [ ] `@es-plus/core` ⚠️ 改 core 会同时影响 vue2 和 vue3，需要双侧测试
- [ ] `@es-plus/shared`
- [ ] `@es-plus/cli`
- [ ] `@es-plus/mcp-server`
- [ ] `es-plus-docs`
- [ ] 仓库根（CI / workspace 配置 / 文档）

## 关联 issue

<!-- Closes #xxx / Refs #yyy -->

## 改动详情

<!--
按改动重要性顺序解释：
1. 为什么这么改（背景 / 触发原因）
2. 怎么改的（关键设计点）
3. 替代方案 + 为什么没选
-->

## 测试

- [ ] 已加单测（spec 路径：__tests__/xxx.spec.ts）
- [ ] 单测覆盖 happy path + 至少 1 个失败/边界 case
- [ ] e2e 矩阵在本地通过：`npm run test:e2e`
- [ ] typecheck 通过：`npm run typecheck --workspaces`
- [ ] lint 通过（阶段 B 上线后）：`npm run lint --workspaces`

## 兼容性 / 破坏性变更

<!-- 如果勾了"💥 破坏性变更"，必须填这一段 -->

- 影响哪些用户：
- 迁移路径：
- 是否需要 major bump：

## 文档

- [ ] `es-plus-docs/src/docs/` 对应文档已更新
- [ ] 包内 README.md 已更新（如果 API 有变化）
- [ ] 包 CHANGELOG.md 已加条目（如果是发布相关 PR）
- [ ] 文档站 changelog.md 已加条目（同上）

## 包体积影响（仅 vue2 / vue3 / core dist 改动）

<!--
跑一次 build 后填：
| dist 文件 | 改动前 (gzip) | 改动后 (gzip) | 增量 |
不需要的可以删除这个段
-->

## Checklist

- [ ] PR 标题遵循 Conventional Commits
- [ ] commit 历史已 rebase 干净（无 "fix typo" 这种 noise commit）
- [ ] 已自测改动的核心路径在本地跑通
- [ ] 我已阅读 [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] 我同意以 [MIT License](../LICENSE) 发布本 PR 的内容
