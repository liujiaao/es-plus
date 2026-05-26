import type { StructuredCrudConfig } from './structured-config.schema.js';
export type { StructuredCrudConfig };
export interface StructuredGenerateResult {
    code: string;
    wrapperCode?: string;
    summary: string;
    warnings: string[];
}
export declare function generateFromConfig(config: StructuredCrudConfig): StructuredGenerateResult;
//# sourceMappingURL=structured-generator.d.ts.map