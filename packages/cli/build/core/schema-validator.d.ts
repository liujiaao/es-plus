interface ValidationResult {
    valid: boolean;
    errors: string[];
    suggestions: string[];
}
export declare function validateConfig(config: unknown, schemaType?: string): ValidationResult;
export declare function listAvailableSchemas(): string[];
export {};
//# sourceMappingURL=schema-validator.d.ts.map