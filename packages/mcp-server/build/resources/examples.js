import { PRESET_EXAMPLES, generateCrudPage } from "@es-plus/shared";
export function registerExamplesResource(server) {
    server.resource("examples", "esplus://examples", {
        description: "Pre-built CRUD page examples with prompts and generated code",
        mimeType: "text/plain",
    }, async () => {
        const sections = PRESET_EXAMPLES.map((ex) => {
            const result = generateCrudPage(ex.prompt);
            return [
                `## ${ex.label}`,
                `**Prompt:** ${ex.prompt}`,
                "",
                "```vue",
                result.code,
                "```",
                "",
            ].join("\n");
        });
        const content = [
            "# es-plus-ui CRUD Page Examples\n",
            "These examples are generated from natural language descriptions using the es-plus CRUD engine.\n",
            ...sections,
        ].join("\n");
        return {
            contents: [
                {
                    uri: "esplus://examples",
                    mimeType: "text/plain",
                    text: content,
                },
            ],
        };
    });
}
//# sourceMappingURL=examples.js.map