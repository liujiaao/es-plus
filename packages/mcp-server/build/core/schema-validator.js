import Ajv from "ajv";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, "../../schemas");
const ajv = new Ajv({ allErrors: true, verbose: true });
function loadSchema(schemaName) {
    const schemaPath = join(SCHEMAS_DIR, `${schemaName}.schema.json`);
    if (!existsSync(schemaPath))
        return null;
    return JSON.parse(readFileSync(schemaPath, "utf-8"));
}
export function validateConfig(config, schemaType) {
    const schemaName = schemaType || "form-item";
    const schema = loadSchema(schemaName);
    if (!schema) {
        return {
            valid: false,
            errors: [`Schema "${schemaName}" not found. Available: form-item, table-column, table-options, dialog-options`],
            suggestions: ["Check schema name spelling"],
        };
    }
    const validate = ajv.compile(schema);
    const valid = validate(config);
    if (valid) {
        return { valid: true, errors: [], suggestions: [] };
    }
    const errors = (validate.errors || []).map((err) => {
        const path = err.instancePath || "(root)";
        return `${path}: ${err.message}`;
    });
    const suggestions = generateSuggestions(validate.errors || [], schemaName);
    return { valid: false, errors, suggestions };
}
function generateSuggestions(errors, schemaName) {
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
export function listAvailableSchemas() {
    return ["form-item", "table-column", "table-options", "dialog-options"];
}
//# sourceMappingURL=schema-validator.js.map