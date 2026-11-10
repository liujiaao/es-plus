import { StructuredCrudConfigSchema } from "@es-plus/shared";
import { deriveSchema } from "./_derive.js";

/**
 * 前门（`generate_scene` scene='crud'，兼容入口 `generate_crud`）的「旋钮」形状 —— AN-21。
 *
 * ## W2：派生，不再手写镜像
 *
 * 这些形状此前是 **241 行的手写副本**（`TableOptions`、`formLayout`、`operationColumn`、
 * 三类扩展配置），与 shared 的 `StructuredCrudConfigSchema` 逐键对账（`check-tool-shapes`）
 * 才能不漂。漂移不是假设：2026-11-10 的对账实测出两处**静默失败**——
 *
 *   · 副本里 `keyboardConfig` / `mouseConfig` / `validConfig` / `seqConfig` 四个嵌套对象
 *     **漏了 `.strict()`**，拼错的键会在 args 到达 handler 前被 strip，`_arg-guard` 的
 *     did-you-mean 闸门因此对这几个键恒空；
 *   · 副本里 `operationColumn.btns`、`expandConfig.fields`、`mergeConfig.rowsBy` 漏了
 *     shared 的 `.min(1)`，空数组会被当作合法配置一路传到生成器。
 *
 * 现在从 shared 的权威 schema **派生**，键、类型、枚举、`.min()` 与文案只有一个源。
 * 派生规则见 `_derive.ts`：**剥掉 `.default()`**（否则 `withRowkey` 会把默认的 `id`
 * 误判成用户显式配置）、**递归 `.strict()`**（未知旋钮必须在工具层报错）、
 * **保留 `.describe()`**（宿主 LLM 唯一的教学面）。
 *
 * 与 shared 的**唯一有意差异**因此只剩「无默认值 + 全层 strict」，两者都由
 * `check-tool-shapes` 与 `__tests__/_derive.spec.ts` 钉住。
 */

const crudShape = StructuredCrudConfigSchema.shape;

/** 表格选项（shared `StructuredCrudConfigSchema.shape.tableOptions`，剥默认值 + 递归 strict）。 */
export const tableOptionsSchema = deriveSchema(crudShape.tableOptions, { extras: "strict" });

/** 查询表单布局 —— labelWidth / minFoldRows，外加分组容器（P1-3）；列数由字段级 span 决定。 */
export const formLayoutSchema = deriveSchema(crudShape.formLayout, { extras: "strict" });

/** 操作列（`false` = 隐藏）。 */
export const operationColumnSchema = deriveSchema(crudShape.operationColumn, { extras: "strict" });

/** 声明式行展开内容（只读字段表；与 tableOptions.expandConfig 不同层）。 */
export const expandConfigSchema = deriveSchema(crudShape.expandConfig, { extras: "strict" });

/** 跨端树表窄子集（嵌套 children 数组）—— 注意与 `tableOptions.treeConfig` 不同层。 */
export const treeConfigSchema = deriveSchema(crudShape.treeConfig, { extras: "strict" });

/** 跨端行合并窄子集。 */
export const mergeConfigSchema = deriveSchema(crudShape.mergeConfig, { extras: "strict" });
