import { Command } from "commander";
export declare const validateCommand: Command;
/**
 * 依据配置对象的独有字段推断 schema 类型（--schema 未显式指定时）。
 * 导出以便单测覆盖分支判定（table-column / table-options / dialog-options / form-item）。
 */
export declare function detectSchemaType(config: unknown): string;
//# sourceMappingURL=validate.d.ts.map