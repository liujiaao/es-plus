import { registerSchemaResources } from "./schemas.js";
import { registerTypesResource } from "./types.js";
import { registerExamplesResource } from "./examples.js";
export function registerResources(server) {
    registerSchemaResources(server);
    registerTypesResource(server);
    registerExamplesResource(server);
}
//# sourceMappingURL=index.js.map