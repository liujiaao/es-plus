export interface GeneratedConfig {
    formItems: any[];
    columns: any[];
    queryBtns: any[];
    tableOptions: any;
    actions: string[];
    dialogFormItems?: any[];
    hasStatusRender?: boolean;
    /**
     * Special-feature hints surfaced from the natural-language prompt that the
     * generator cannot fully render in code (e.g. multi-tab detail dialog,
     * multi-step form, cross-page selection toolbar). The docs-site preview
     * shows these as a banner so users know "this needs manual code" — without
     * them the preview silently drops the feature and looks like a bug.
     */
    featureHints?: string[];
}
export declare function generateCrudConfig(input: string): GeneratedConfig;
export declare function generateCode(config: GeneratedConfig): string;
//# sourceMappingURL=crud-engine.d.ts.map