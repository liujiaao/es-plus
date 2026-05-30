import { type TargetFramework } from "./target.js";
export interface CrudSchemaResult {
    schema: Record<string, unknown>;
    wrapperCode: string;
    summary: string;
    /** 实际使用的目标框架（缺省时为 'vue3'） */
    target: TargetFramework;
}
/**
 * 从自然语言描述生成 CrudPageSchema + 包装 SFC
 *
 * @param description 中/英文页面描述
 * @param target      目标框架，'vue3' (Element Plus, 默认) | 'vue2' (Element UI)
 *
 * 注意：返回的 `schema` JSON 在两个 target 间完全一致 —— 这是 schema 模式的核心价值。
 * 仅 `wrapperCode` 会根据 target 输出不同语法（v-model:* vs :*.sync, script setup vs defineComponent...）。
 */
export declare function generateCrudSchema(description: string, target?: TargetFramework): CrudSchemaResult;
//# sourceMappingURL=schema-generator.d.ts.map