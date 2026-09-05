#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { program } from "commander";
import pc from "picocolors";
import { createCommand } from "./commands/create.js";
import { validateCommand } from "./commands/validate.js";
import { scaffoldCommand } from "./commands/scaffold.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

program
  .name("es-plus")
  .description("es-plus CLI — generate CRUD pages & validate configs (Vue 3 / Vue 2)")
  .version(pkg.version);

program.addCommand(createCommand);
program.addCommand(validateCommand);
program.addCommand(scaffoldCommand);

// 顶层错误兜底：命令 action 为 async，未捕获的 rejection（写盘 EACCES/ENOSPC、
// AI 调用抛错等）此前会以裸 Node 栈回溯冒泡，甚至因异步而以退出码 0 结束。
// 用 parseAsync + catch 统一转成简洁错误信息 + 非零退出码。
program.parseAsync().catch((err) => {
  console.error(pc.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
