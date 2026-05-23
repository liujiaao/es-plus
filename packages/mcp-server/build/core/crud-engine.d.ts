export interface GeneratedConfig {
    formItems: any[];
    columns: any[];
    queryBtns: any[];
    tableOptions: any;
    actions: string[];
    dialogFormItems?: any[];
}
export declare function generateCrudConfig(input: string): GeneratedConfig;
export declare function generateCode(config: GeneratedConfig): string;
//# sourceMappingURL=crud-engine.d.ts.map