import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// ── Monorepo anchoring (single source of truth) ─────────────────────────────
// The MCP resources want to serve the *live* renderer types when the monorepo
// is checked out (dev), falling back to bundled .d.ts / inline text otherwise.
// Previously each resource hard-coded `join(__dirname, "../../../../<pkg>/…")`
// in several places. That prefix was off by one level — this module lives at:
//     build: packages/mcp-server/build/resources/source-locator.js
//     src  : packages/mcp-server/src/resources/source-locator.ts   (vitest)
// both of which are exactly 3 levels below `packages/` (resources → build|src
// → mcp-server → packages), so `../../../../` (4-up) escaped past the repo root
// and every live-source read silently fell through to the fallback. Anchoring
// once here — and pinning the paths with source-locator.spec.ts — turns any
// future layout drift into a failing test instead of stale content nobody sees.
const HERE = dirname(fileURLToPath(import.meta.url)); // …/resources
export const MCP_ROOT = join(HERE, "../.."); // packages/mcp-server
export const PACKAGES_ROOT = join(HERE, "../../.."); // packages
const PKG_DIR = {
    vue3: "vue3",
    vue2: "vue2",
    antdv: "adapter-antdv",
};
// Per-target live-source locations, relative to each renderer's package root.
// vue2 keeps its EsCrudPage types one level shallower than vue3/antdv.
const CRUD_PAGE_TYPES_REL = {
    vue3: "src/components/es-crud-page/src/types.ts",
    vue2: "src/components/es-crud-page/types.ts",
    antdv: "src/components/es-crud-page/src/types.ts",
};
const RENDERER_TYPES_REL = {
    vue3: "src/types/index.ts",
    vue2: "src/types/index.ts",
    antdv: "src/types/index.ts",
};
/** Absolute path to a renderer's EsCrudPage type source in the monorepo. */
export function crudPageTypesPath(target) {
    return join(PACKAGES_ROOT, PKG_DIR[target], CRUD_PAGE_TYPES_REL[target]);
}
/** Absolute path to a renderer's top-level type source in the monorepo. */
export function rendererTypesPath(target) {
    return join(PACKAGES_ROOT, PKG_DIR[target], RENDERER_TYPES_REL[target]);
}
/** Absolute path to a file bundled inside the published mcp-server package. */
export function bundledPath(file) {
    return join(MCP_ROOT, "bundled", file);
}
/**
 * Return the contents of the first readable path, or `null` if none exist so
 * the caller can supply its own inline fallback.
 */
export function readFirst(paths) {
    for (const p of paths) {
        try {
            return readFileSync(p, "utf-8");
        }
        catch {
            // try next candidate
        }
    }
    return null;
}
//# sourceMappingURL=source-locator.js.map