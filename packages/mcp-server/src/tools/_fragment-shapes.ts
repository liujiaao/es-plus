import { z } from "zod";
import {
  StructuredCrudConfigSchema,
  SurfaceFieldSchema,
  DialogBlockOptionsSchema,
  formatFragmentText,
} from "@es-plus/shared";
import { deriveSchema } from "./_derive.js";

/**
 * Zod shapes shared by the fragment tools (generate_form / generate_table /
 * generate_dialog) and the front door (generate_crud, the legacy adapter).
 *
 * ## W2：派生，不再手写镜像
 *
 * 这里曾是 **549 行的手写镜像**（字段词汇 + 四组容器选项），逐键对着 shared 的
 * `SurfaceField` / `TableBlockOptions` / `DialogBlockOptions` 维护，靠
 * `scripts/check-fragment-contract.mjs` 按源码正则对账。镜像漂移的症状是**静默 strip**：
 * 工具接受入参、生成器收不到、零告警。
 *
 * 现在所有形状都从 shared 的权威 Zod **派生**（`_derive.ts`），只剩三处**有意差异**：
 *
 *  1. **单面字段 / 弹窗选项 passthrough**（`extras:'passthrough'`）：MCP SDK 在调用
 *     handler 之前先按工具 schema `safeParse`，而 `z.object()` 默认 strip —— 嵌套层
 *     （`fields[0].formType`、`options.widht`）会在 args 到达 handler 前消失，
 *     `_arg-guard` 的 did-you-mean 闸门拿到的是一个没有该键的对象，于是恒空。
 *     让拼写错误活到 handler，由闸门判错并给建议。
 *  2. **容器选项保持 strip**（`extras:'inherit'`）：与 shared 一致；未知容器旋钮由
 *     `z.object` 丢弃（现状如此，`check-fragment-contract` 的发射枚举断言保证
 *     「接口有的键一定被发射」，故不存在「接受却永不注入」）。
 *  3. **`formtype` 重新设为必填**：shared 用 `.default('Input')` 表达缺省，派生会剥掉
 *     默认值并保留「可省略」；但单面字段的 `formtype` 决定控件渲染，是模型必须做的
 *     一次判断 —— 表字段（`tableFieldSchema`）例外，它零消费者，故放宽为 optional。
 */

const crudShape = StructuredCrudConfigSchema.shape;

// ── 容器级选项：shared 权威 schema 的同一份形状 ─────────────────────────────
//
// 这些容器此前各有 10–180 行手写副本。派生同样**剥掉 `.default()`**（`_derive.ts`
// 的核心职责）：SDK 在进 handler 前填默认值，生成器就无法区分「调用方显式给了 true」
// 与「没给」，冲突/告警类判据全部失真（`rowkey` 是典型：默认 `'id'` 会与 intent 顶层的
// rowkey 撞成假冲突）。缺省由生成器统一补。
//
// `tableBlockOptionsSchema`：generate_table 的 tableOptions —— shared
// `StructuredCrudConfigSchema.tableOptions`（键集 ≡ fragment-generator 的
// `TableBlockOptions` ≡ 发射枚举 `TABLE_BLOCK_ALWAYS ∪ TABLE_BLOCK_OPTION_ORDER`）。
export const tableBlockOptionsSchema = deriveSchema(crudShape.tableOptions, { extras: "inherit" });

/** generate_table 的分页种子 —— shared `pagination`（pageSize / pageSizes）。 */
export const tablePaginationSchema = deriveSchema(crudShape.pagination, { extras: "inherit" });

/** generate_form 的布局 —— shared `formLayout`（labelWidth / minFoldRows / layout）。 */
export const formLayoutSchema = deriveSchema(crudShape.formLayout, { extras: "inherit" });

/**
 * generate_dialog 的底座选项 —— shared `DialogBlockOptionsSchema`
 * （`DialogConfigSchema` 的 pick 子集，见 shared 侧注释）。passthrough 见文件头。
 */
export const dialogOptionsSchema = deriveSchema(DialogBlockOptionsSchema, { extras: "passthrough" });

// ── 单面字段：SurfaceFieldSchema（FieldConfigSchema − 三面成员标志）─────────
const derivedSurface = deriveSchema(SurfaceFieldSchema, {
  extras: "passthrough",
}) as unknown as z.ZodObject<any>;

/** 不含 `children` 的基座 —— 嵌套容器的子元素用它，「只许一层」由结构锁死。 */
const surfaceBase = derivedSurface.omit({ children: true }) as unknown as z.ZodObject<any>;

// `formtype` 在 shared 是 `.default('Input')`；派生剥掉默认值后变成 optional。单面字段
// 是「控件类型决定渲染」的必答项，故把内层 enum 取出来重新设为必填（描述在重建时挂在
// 外层 optional 上，`.unwrap()` 后需要手动搬回）。
const formtypeField = surfaceBase.shape.formtype;
const requiredFormtype = formtypeField.unwrap().describe(formtypeField.description ?? "");

/** 单面字段基座（formtype 必填、全层 passthrough）。 */
export const surfaceFieldBase = surfaceBase.extend({ formtype: requiredFormtype });

/**
 * 单面字段（含 P1-3 第二期嵌套对象容器）。子 schema 用不带 children 的基座 = 一层上限；
 * 容器自身不绑定数据，也不派生表格列。
 */
export const surfaceFieldSchema = surfaceFieldBase.extend({
  children: z
    .array(surfaceFieldBase)
    .min(1)
    .optional()
    .describe(derivedSurface.shape.children.description ?? ""),
});

/**
 * `generate_table` 的字段形状（AI-51）。
 *
 * 表格列**只消费** `buildTableColumn` / `buildTableColumnSFC` 的列属性
 * （prop/label/labelKey/width/minWidth/align/fixed/ellipsis/render/formatter/permissionValue）；
 * `formtype` 在独立 `<es-table>` 片段里零消费者（`buildFormItem`/`inferTsType` 都不在表格
 * 路径上）。共享 `surfaceFieldSchema` 把它设为必填是为了表单/弹窗（控件类型决定渲染），
 * 对表格却是一条**幻影要求**：模型必须填，产物却不读。故这里直接用基座（formtype optional）。
 */
export const tableFieldSchema = surfaceBase;

/** 格式 + 围栏：`result.fence` 优先（AI-28：dialog 有了第二种产物形态），否则用调用方的兜底。
 *
 * 文本格式本身在 shared `formatFragmentText`（P2）：`generate_scene` 也走同一个
 * 格式化器，字节等价才不依赖两份手写模板。这里只做 MCP `content` 适配。
 */
export function renderFragmentOutput(
  result: { code: string; summary: string; warnings: string[]; fence?: "vue" | "tsx" },
  fence: "vue" | "tsx",
): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: formatFragmentText(result, fence) }] };
}
