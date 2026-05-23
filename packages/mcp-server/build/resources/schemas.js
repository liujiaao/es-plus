import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, "../../schemas");
const SCHEMA_FILES = [
    { name: "form-item", description: "FormItemOption configuration schema" },
    { name: "table-column", description: "TableColumn configuration schema" },
    { name: "table-options", description: "TableOptions configuration schema" },
    { name: "dialog-options", description: "DialogOptions configuration schema" },
    { name: "btn-config", description: "BtnConfig button configuration schema" },
    { name: "api-params", description: "ApiParams remote data loading schema" },
];
export function registerSchemaResources(server) {
    for (const schema of SCHEMA_FILES) {
        const uri = `esplus://schemas/${schema.name}`;
        server.resource(schema.name, uri, {
            description: schema.description,
            mimeType: "application/json",
        }, async () => {
            const filePath = join(SCHEMAS_DIR, `${schema.name}.schema.json`);
            if (!existsSync(filePath)) {
                return {
                    contents: [
                        {
                            uri,
                            mimeType: "text/plain",
                            text: `Schema file not found: ${schema.name}.schema.json`,
                        },
                    ],
                };
            }
            const content = readFileSync(filePath, "utf-8");
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: content,
                    },
                ],
            };
        });
    }
}
//# sourceMappingURL=schemas.js.map