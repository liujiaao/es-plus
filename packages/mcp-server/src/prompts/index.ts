import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCrudPagePrompt } from "./crud-page.js";
import { registerFormConfigPrompt } from "./form-config.js";
import { registerSpecToSurfacesPrompt } from "./spec-to-surfaces.js";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

/**
 * AN-26 —— 提示词也必须按**同一份** profile 适配。
 *
 * `front-door` 下 `generate_crud_from_config` / `generate_crud_page` /
 * `generate_crud_schema` 不注册；提示词里若仍写着「去调它们」，宿主会拿到
 * tool not found —— 提示词与工具面同源才算契约自洽（见 `crud-page.ts` 的
 * `preferredPath`）。
 */
export function registerPrompts(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  registerCrudPagePrompt(server, profile);
  registerFormConfigPrompt(server);
  registerSpecToSurfacesPrompt(server);
}
