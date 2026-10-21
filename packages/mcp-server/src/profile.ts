/**
 * AN-26 —— MCP 工具面 profile（独立模块）。
 *
 * 放在这里而不是 `tools/index.ts`：**提示词与资源**也要按同一份 profile 适配
 * （`ESPLUS_MCP_PROFILE=front-door` 下 `generate_crud_from_config` /
 * `generate_crud_page` / `generate_crud_schema` 根本不注册，任何「去调它」的引导
 * 都会让宿主拿到 tool not found）。若 prompts/resources 从 `tools/index.ts` 引，
 * 就会为了一个字符串常量把 15 个工具的注册模块连同其依赖全部拉进资源层；独立成
 * 模块后两边只共享一个纯函数，依赖方向也保持单向。
 *
 * `tools/index.ts` 继续 re-export 这两个符号，既有 import 路径不变。
 */

export type ToolProfile = "full" | "front-door";

/**
 * 解析 profile；未知值按 `full` 处理并留给调用方决定是否告警（不静默改变工具面）。
 *
 * `full`（默认）：注册全部工具。默认值刻意是 full，与 ARCHITECTURE §9.4 的弃用
 * 流程一致（「先改描述 → 再加 profile 开关（默认关闭）→ 大版本移除」）。
 *
 * 选择读环境变量而不读 CLI flag：MCP 服务器由宿主 launcher 启动，环境变量是
 * 双方都能配置的唯一通道。
 */
export function resolveToolProfile(raw = process.env.ESPLUS_MCP_PROFILE): ToolProfile {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "front-door" ? "front-door" : "full";
}
