import { registerCrudPagePrompt } from "./crud-page.js";
import { registerFormConfigPrompt } from "./form-config.js";
export function registerPrompts(server) {
    registerCrudPagePrompt(server);
    registerFormConfigPrompt(server);
}
//# sourceMappingURL=index.js.map