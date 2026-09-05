export type Target = "vue3" | "vue2" | "antdv";
export declare const MCP_ROOT: string;
export declare const PACKAGES_ROOT: string;
/** Absolute path to a renderer's EsCrudPage type source in the monorepo. */
export declare function crudPageTypesPath(target: Target): string;
/** Absolute path to a renderer's top-level type source in the monorepo. */
export declare function rendererTypesPath(target: Target): string;
/** Absolute path to a file bundled inside the published mcp-server package. */
export declare function bundledPath(file: string): string;
/**
 * Return the contents of the first readable path, or `null` if none exist so
 * the caller can supply its own inline fallback.
 */
export declare function readFirst(paths: string[]): string | null;
//# sourceMappingURL=source-locator.d.ts.map