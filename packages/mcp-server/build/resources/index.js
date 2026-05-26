import { registerSchemaResources } from "./schemas.js";
import { registerTypesResource } from "./types.js";
import { registerExamplesResource } from "./examples.js";
import { registerConventionsResource } from "./conventions.js";
import { registerCrudPageSchemaResource } from "./crud-page-schema.js";
export function registerResources(server) {
    registerSchemaResources(server);
    registerTypesResource(server);
    registerExamplesResource(server);
    registerConventionsResource(server);
    registerCrudPageSchemaResource(server);
}
//# sourceMappingURL=index.js.map