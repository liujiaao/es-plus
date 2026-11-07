---
"@es-plus/shared": patch
"@es-plus/mcp-server": patch
---

统一到单份 zod 4，并修好随之暴露的「passthrough 形状闸门全空转」

`mcp-server` 声明 `zod: ^3.22.0`、`shared` 声明 `^4.4.3` → npm 在
`packages/shared/node_modules/zod` 又装了一份 4.x，同一个进程里两个 zod 实现：
体积翻倍只是表象，真正的代价是两边建出的 schema 对象**不能跨副本混用**，而
`mcp-server` 因此一直维护着一份 shared `StructuredCrudConfigSchema` 的手写副本。

改动：

- `mcp-server` 的 `zod` 升到 `^4.4.3`（官方 MCP SDK 1.29 的 peer 本来就是
  `^3.25 || ^4.0`，`zod-to-json-schema` 的 peer 也是 `^3.25.28 || ^4`）→
  `package-lock.json` 里只剩一份 zod。手写副本暂时保留（工具文案独立维护、且有
  守卫逐键对账），升级它不必在同一次改动里做。
- **`collectUnknownKeys` 在 zod 4 下曾把 `.passthrough()` 当成「所有键都已知」**：
  zod 4 把 `.passthrough()` / `.loose()` 编译成 `catchall: z.unknown()`，与显式
  `.catchall(z.any())` 在 `_def` 上同形，而收集器原来据此放行整层未知键。本仓每一处
  `.passthrough()` 的用途恰恰相反 —— 让未知键活过 `safeParse`，再由这里点名。去掉该
  放行后，`_arg-guard` / `generate_scene` / 覆盖报告 / `validate_config` 的未知键判据
  全部恢复生效（`check:unknown-keys` 新增 A13 直接钉住这一条）。
- `scripts/eval/fragment-prompt.mjs` 的形状自省改为 zod 3 / 4 双词汇（`typeName` ↔
  `type`、`_def.description` ↔ 公开 `description` getter）。此前在 zod 4 下它读不到
  任何 `.describe()`，片段 prompt 会**静默退化成只有键名、没有教学文案**。
- 新增 `check:deps`：断言每个成员包解析到同一份 zod，且声明范围的下界主版本与
  实际安装一致（两条判据分别证「没有第二份」与「不会因为下次 install 长出第二份」）。

发版后 `@es-plus/mcp-server` 的依赖树少一份 zod；三端渲染包不依赖 zod，行为不变。
