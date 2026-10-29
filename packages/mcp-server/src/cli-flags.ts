/**
 * 入口参数解析 —— 只认「自检」这一类，其余一律进 stdio 服务模式。
 *
 * 为什么需要它：docs/mcp-server.md 的故障排查把 `mcp-server-es-plus --version` /
 * `--help` 当成 PATH 自检（「能输出版本即说明 PATH OK」）。此前入口完全没有参数
 * 解析：`--version` 会被当成「无参数」，进程照常启动 stdio 服务并**等在 stdin 上**，
 * 终端里一行输出都没有 —— 自检步骤因此恒失败，而失败原因看起来像「PATH 坏了」。
 *
 * 单独的模块而不是写在 index.ts 里：index.ts 是入口（导入即连 transport），
 * 纯函数放这里才能被单测直接覆盖。
 */

export type CliCommand =
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "serve" };

/** 认得的版本号参数。`-v` 与 `--version` 等价。 */
const VERSION_FLAGS = new Set(["--version", "-v"]);
/** 认得的帮助参数。`-h` 与 `--help` 等价。 */
const HELP_FLAGS = new Set(["--help", "-h"]);

/**
 * @param argv 命令行参数（不含 `node` 与脚本路径，即 `process.argv.slice(2)`）
 */
export function resolveCliCommand(argv: readonly string[]): CliCommand {
  if (argv.some((a) => VERSION_FLAGS.has(a))) return { kind: "version" };
  if (argv.some((a) => HELP_FLAGS.has(a))) return { kind: "help" };
  return { kind: "serve" };
}

/**
 * `--help` 正文。刻意只写「怎么用 + 怎么自检」：工具清单会随 profile 变化，
 * 抄一份到帮助里必然过期，指向文档与 `tools/list` 即可。
 */
export const HELP_TEXT = `es-plus MCP server (stdio)

Usage:
  mcp-server-es-plus                 start the MCP server on stdio
  mcp-server-es-plus --version       print the version (PATH self-check)
  mcp-server-es-plus --help          print this message

Environment:
  ESPLUS_MCP_PROFILE=front-door      register the front-door tool surface only
                                     (default: full — all 15 tools)

Clients configure this binary as a stdio command, e.g.
  { "mcpServers": { "es-plus": { "command": "mcp-server-es-plus", "args": [] } } }

Docs: https://liujiaao.github.io/es-plus/#/guide/mcp-server
`;
