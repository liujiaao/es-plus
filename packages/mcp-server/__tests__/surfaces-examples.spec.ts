import { describe, it, expect } from "vitest";
import {
  StructuredCrudConfigSchema,
  composeCrudConfig,
  generateFromConfig,
  generateFormBlock,
  generateDialogBlock,
  type SurfaceField,
} from "@es-plus/shared";
import {
  SURFACES_EXAMPLES,
  type SurfacesExample,
  type DialogKey,
} from "../src/resources/surfaces-examples.js";

// The surfaces few-shot examples are the primary steering signal for the
// front-door (generate_crud) intent decision. If one rots — a field the
// generator drops, a subset that no longer routes, a formtype that fails schema
// — we'd be teaching the host LLM a dead intent. So route EVERY example through
// the exact shared functions generate-crud.ts uses and assert it produces code
// that carries every prop the example declared.
//
// This mirror must stay in lockstep with the routing in
// packages/mcp-server/src/tools/generate-crud.ts.
const DIALOG_TITLES: Record<DialogKey, string> = { add: "新增", edit: "编辑", view: "查看" };

function allProps(ex: SurfacesExample): string[] {
  const s = ex.input.surfaces;
  const props = new Set<string>();
  for (const list of [s.query, s.table, s.form]) {
    for (const f of list ?? []) props.add(f.prop);
  }
  return [...props];
}

/** Faithful mirror of generate-crud.ts routing; returns the route + emitted code. */
function route(ex: SurfacesExample): { route: SurfacesExample["route"]; code: string } {
  const { name, apiUrl, target } = ex.input;
  const s = ex.input.surfaces;
  const query: SurfaceField[] = s.query ?? [];
  const table: SurfaceField[] = s.table ?? [];
  const form: SurfaceField[] = s.form ?? [];
  const dialogKeys: DialogKey[] = s.dialog ?? [];

  if (table.length > 0) {
    const dialogBody = form.length ? form : table;
    const dialogs = dialogKeys.length
      ? Object.fromEntries(dialogKeys.map((k) => [k, { title: DIALOG_TITLES[k], formItems: dialogBody }]))
      : undefined;
    const { config } = composeCrudConfig({
      name,
      apiUrl,
      target,
      query,
      table,
      form,
      dialogs: dialogs as never,
    });
    const parsed = StructuredCrudConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(`composed config invalid:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
    }
    const result = generateFromConfig(config);
    return { route: "compose→generateFromConfig", code: result.code + "\n" + (result.wrapperCode ?? "") };
  }

  const parts: string[] = [];
  if (query.length) parts.push(generateFormBlock({ fields: query, context: "query", buttons: "query", target }).code);
  if (dialogKeys.length) {
    parts.push(generateDialogBlock({ fields: form.length ? form : query, apiUrl, target }).code);
  } else if (form.length) {
    parts.push(generateFormBlock({ fields: form, context: "form", buttons: "submit", target }).code);
  }
  return { route: "fragment", code: parts.join("\n") };
}

/** A prop surfaces either as JSON (`"prop": "x"`) or JS literal (`prop: 'x'`). */
function propPresent(code: string, prop: string): boolean {
  return code.includes(`"prop": "${prop}"`) || new RegExp(`prop:\\s*['"]${prop}['"]`).test(code);
}

describe("surfaces few-shot examples", () => {
  it("has a non-trivial set of examples", () => {
    expect(SURFACES_EXAMPLES.length).toBeGreaterThanOrEqual(5);
  });

  it("covers both routes and all target renderers", () => {
    const routes = new Set(SURFACES_EXAMPLES.map((e) => e.route));
    expect(routes.has("compose→generateFromConfig")).toBe(true);
    expect(routes.has("fragment")).toBe(true);
    const targets = new Set(SURFACES_EXAMPLES.map((e) => e.input.target ?? "vue3"));
    expect(targets.has("vue3")).toBe(true);
    expect(targets.has("vue2")).toBe(true);
  });

  for (const ex of SURFACES_EXAMPLES) {
    it(`"${ex.label}" has an NL prompt and reasoning`, () => {
      expect(ex.nl.trim().length).toBeGreaterThan(0);
      expect(ex.reasoning.trim().length).toBeGreaterThan(0);
    });

    it(`"${ex.label}" routes as declared and emits non-empty code`, () => {
      const { route: actual, code } = route(ex);
      expect(actual).toBe(ex.route);
      expect(code.trim().length).toBeGreaterThan(0);
    });

    it(`"${ex.label}" carries every declared field prop into the output`, () => {
      const { code } = route(ex);
      const missing = allProps(ex).filter((p) => !propPresent(code, p));
      expect(missing, `props dropped from generated output: ${missing.join(", ")}`).toEqual([]);
    });
  }
});
