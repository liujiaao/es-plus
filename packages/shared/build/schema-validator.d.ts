export interface ValidationResult {
    valid: boolean;
    errors: string[];
    suggestions: string[];
}
export declare function createSchemaValidator(schemasDir?: string): {
    validateConfig: (config: unknown, schemaType?: string) => ValidationResult;
    listAvailableSchemas: () => string[];
};
export declare const validateConfig: (config: unknown, schemaType?: string) => ValidationResult;
export declare const listAvailableSchemas: () => string[];
//# sourceMappingURL=schema-validator.d.ts.map