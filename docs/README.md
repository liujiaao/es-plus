# docs/ 目录约定

这个目录此前是一个**混放**状态：对外文档（`why-es-plus.md`）与内部审计报告、设计方案、
投稿稿、以及被站点引用的数据源（`brand/` `cases/` `ai/` `tokens/` `theme/` `tri-render/`）
平铺在一起，只靠文件名区分。结果是「产品文档的单一真源在哪」没有答案 ——
对外文档要与内部报告一起被检索，而真正发布到站点的文档反而住在 `es-plus-docs/src/docs/`。

现在按**读者**分层：

| 位置 | 放什么 | 谁读 |
|---|---|---|
| `docs/*.md` | 对外文档的单一真源（`why-es-plus.md` / `.en.md`、`migrate-v1.4.md`） | 用户；由 `sync-docs.mjs` 镜像到文档站 |
| `docs/{brand,cases,ai,tokens,theme,tri-render}/` | 被站点消费的**单源数据**（文案、案例、设计 token、配对实测…） | 构建脚本 + 站点 |
| `docs/internal/` | 内部报告、审计、设计方案 | 维护者 |
| `docs/articles/` | 对外投稿稿（掘金等） | 维护者 → 外部平台 |
| `es-plus-docs/src/docs/` | 站点页面本体（含 `<demo name="…" />` 挂载点） | 文档站构建 |

## 为什么站点的 15 篇文档仍然住在 `es-plus-docs/src/docs/`

它们不是可移植的 Markdown：正文里的 `<demo name="…" />` 由该站的示例注册表
（`components/doc/example-registry.ts`）在渲染时挂载真实组件，离开这个站点就无法工作。
所以它们的「家」只能是该站点 —— 这与上面那张表的其余部分不矛盾：
**对外长文**（why-es-plus、migrate-v1.4）在根 `docs/` 单源并镜像，
**站点页面**在站点内维护。

## 约束（由 `check:docs-layout` 守住）

1. 根 `docs/` 下不允许出现清单外的 `.md`（新增对外文档请加进 `MIRRORED_DOCS` 并在此登记，
   内部材料请放 `docs/internal/`，投稿稿请放 `docs/articles/`）；
2. `docs/**/*.md` 里的仓库内相对链接必须指向真实存在的文件
   （此前有 3 处断链：`site-structure.md`、`tri-render/README.md` 各 1 处指到了仓库外，
   以及重命名 `migrate-v1.4.md` 后遗留的 2 处引用 —— 都是靠这道检查发现的）。
