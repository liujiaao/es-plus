import Ajv from "ajv";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMAS_DIR = join(__dirname, "../schemas");
export function createSchemaValidator(schemasDir) {
    const dir = schemasDir || DEFAULT_SCHEMAS_DIR;
    const ajv = new Ajv({ allErrors: true, verbose: true });
    let schemasLoaded = false;
    function ensureSchemasLoaded() {
        if (schemasLoaded)
            return;
        schemasLoaded = true;
        if (!existsSync(dir))
            return;
        const files = readdirSync(dir).filter((f) => f.endsWith(".schema.json"));
        for (const file of files) {
            const schema = JSON.parse(readFileSync(join(dir, file), "utf-8"));
            if (schema.$id) {
                try {
                    ajv.addSchema(schema);
                }
                catch { /* already added */ }
            }
        }
    }
    function loadSchema(schemaName) {
        ensureSchemasLoaded();
        const schemaPath = join(dir, `${schemaName}.schema.json`);
        if (!existsSync(schemaPath))
            return null;
        return JSON.parse(readFileSync(schemaPath, "utf-8"));
    }
    function validateConfig(config, schemaType) {
        const schemaName = schemaType || "form-item";
        const schema = loadSchema(schemaName);
        if (!schema) {
            return {
                valid: false,
                errors: [`Schema "${schemaName}" not found. Available: ${listAvailableSchemas().join(", ")}`],
                suggestions: ["Check schema name spelling"],
            };
        }
        const schemaObj = schema;
        let validate;
        if (schemaObj.$id && ajv.getSchema(schemaObj.$id)) {
            validate = ajv.getSchema(schemaObj.$id);
        }
        else {
            validate = ajv.compile(schema);
        }
        const valid = validate(config);
        if (valid) {
            return { valid: true, errors: [], suggestions: [] };
        }
        const errors = (validate.errors || []).map((err) => {
            const path = err.instancePath || "(root)";
            return `${path}: ${err.message}`;
        });
        const suggestions = generateSuggestions(validate.errors || []);
        return { valid: false, errors, suggestions };
    }
    function listAvailableSchemas() {
        if (!existsSync(dir))
            return [];
        return readdirSync(dir)
            .filter((f) => f.endsWith(".schema.json") && f !== "index.schema.json")
            .map((f) => f.replace(".schema.json", ""));
    }
    return { validateConfig, listAvailableSchemas };
}
function generateSuggestions(errors) {
    const suggestions = [];
    for (const err of errors) {
        if (err.keyword === "required") {
            suggestions.push(`Add missing property "${err.params.missingProperty}"`);
        }
        if (err.keyword === "enum") {
            suggestions.push(`Valid values for ${err.instancePath}: ${err.params.allowedValues?.join(", ")}`);
        }
        if (err.keyword === "type") {
            suggestions.push(`${err.instancePath} should be type "${err.params.type}"`);
        }
        if (err.keyword === "additionalProperties") {
            suggestions.push(`Remove unknown property "${err.params.additionalProperty}"`);
        }
    }
    return suggestions;
}
const defaultValidator = createSchemaValidator();
export const validateConfig = defaultValidator.validateConfig;
export const listAvailableSchemas = defaultValidator.listAvailableSchemas;
//# sourceMappingURL=schema-validator.js.map