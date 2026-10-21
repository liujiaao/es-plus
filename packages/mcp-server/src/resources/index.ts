import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSchemaResources } from "./schemas.js";
import { registerTypesResource } from "./types.js";
import { registerExamplesResource } from "./examples.js";
import { registerNlToConfigExamplesResource } from "./nl-to-config-examples.js";
import { registerSurfacesExamplesResource } from "./surfaces-examples.js";
import { registerConventionsResource } from "./conventions.js";
import { registerCrudPageSchemaResource } from "./crud-page-schema.js";
import { registerDesignExtractionResource } from "./design-extraction.js";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

/**
 * AN-26 —— 资源文本按**同一份** profile 适配（与 `registerTools` 同源）。
 *
 * 需要适配的三处都是「引导宿主去调某个工具」的措辞：`conventions` 的
 * Structured-Config 一节、`examples` 的 engine 说明、`nl-to-config` 的使用说明。
 * 资源本身（形状、语法、few-shot）在任何 profile 下都仍然正确，所以只换引导句，
 * 不删内容 —— 删掉会让宿主失去理解前门产物的唯一参考。
 *
 * 其余资源（schemas/types/surfaces/crud-page-schema/design-extraction/source-locator）
 * 不含「去调隐藏工具」的指令，无需分支。
 */
export function registerResources(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  registerSchemaResources(server);
  registerTypesResource(server);
  registerExamplesResource(server, profile);
  registerNlToConfigExamplesResource(server, profile);
  registerSurfacesExamplesResource(server);
  registerConventionsResource(server, profile);
  registerCrudPageSchemaResource(server);
  registerDesignExtractionResource(server);
}
