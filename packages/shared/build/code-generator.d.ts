import { type GeneratedConfig } from "./crud-engine.js";
import { type TargetFramework } from "./target.js";
export interface GenerateResult {
    code: string;
    config: GeneratedConfig;
    summary: string;
    target: TargetFramework;
}
/**
 * 从自然语言描述生成完整 SFC（直接基于 EsTable + EsForm，不使用 EsCrudPage）
 *
 * Vue 3 vs Vue 2 差异：
 *  - 模板中的 v-model:* 修饰符（仅在 generateCode 输出的代码包含时）
 *  - import 包名：es-plus-ui ↔ @es-plus/vue2
 *  - script setup 与 defineComponent 之间的差异（见 generateScaffold 处理；
 *    crud-engine.generateCode 当前固定输出 vue3 风格，vue2 模式下会做后置改写）
 */
export declare function generateCrudPage(description: string, target?: TargetFramework): GenerateResult;
/**
 * 生成最小化空白脚手架（query/table/dialog 任意组合）
 *
 * @param name      kebab-case 页面名称
 * @param features  启用功能数组，可选 'query' | 'table' | 'dialog'
 * @param target    目标框架，'vue3' (默认) | 'vue2'
 */
export declare function generateScaffold(name: string, features?: string[], target?: TargetFramework): string;
//# sourceMappingURL=code-generator.d.ts.map