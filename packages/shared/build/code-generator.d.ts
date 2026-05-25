import { type GeneratedConfig } from "./crud-engine.js";
export interface GenerateResult {
    code: string;
    config: GeneratedConfig;
    summary: string;
}
export declare function generateCrudPage(description: string): GenerateResult;
export declare function generateScaffold(name: string, features?: string[]): string;
//# sourceMappingURL=code-generator.d.ts.map