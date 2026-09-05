/**
 * CLI 纯字符串/参数工具（可单测，复用于多个命令）
 *
 * 抽取动机：toPascalCase 原先在 scaffold.ts 与 create.ts 各复制一份；target 归一化
 * 三段三元表达式散落在 create/scaffold 命令里。收敛到此处消除重复，并让单测直接覆盖
 * 发货实现（而非命令闭包内的副本）。
 */
export type CliTarget = 'vue3' | 'vue2' | 'antdv';
/** 受支持的三端目标（顺序即 --help / 报错提示里的展示顺序）。 */
export declare const CLI_TARGETS: readonly CliTarget[];
/**
 * 校验 --target 是否为受支持值。undefined（未传）视为合法（命令层会默认 vue3）。
 * 命令应在 normalizeTarget 之前调用它，对显式的未知 target 报错退出，而不是
 * 让 normalizeTarget 静默回落 vue3（B5：把用户明确的不支持请求无声降级为 vue3）。
 */
export declare function isValidTarget(input: string | undefined): boolean;
/** kebab/snake → PascalCase（如 user-management → UserManagement）。 */
export declare function toPascalCase(str: string): string;
/** camel/Pascal → kebab-case（如 UserManagement → user-management）。 */
export declare function toKebabCase(str: string): string;
/**
 * 归一化 --target 输入到受支持的三端之一，默认 vue3。
 * 仅 'vue2' / 'antdv' 精确匹配；其余（含 undefined / 拼写错误）一律回落 vue3。
 */
export declare function normalizeTarget(input: string | undefined): CliTarget;
/** 三端目标框架 → 对应 npm 包名（生成的 import 语句用）。 */
export declare function esPlusPkgFor(target: CliTarget): string;
//# sourceMappingURL=strings.d.ts.map