import prompts from "prompts";
import pc from "picocolors";
import { writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename } from "node:path";

/**
 * 覆盖保护：写入前检查目标文件是否已存在。
 * - 无同名文件，或显式 --force → 直接放行。
 * - 存在同名文件且未 --force：
 *     · 交互式终端 → 提示用户确认覆盖；拒绝则返回 false（调用方按取消处理，退出码 0）。
 *     · 非交互环境（无 TTY，如 CI/脚本）→ 拒绝覆盖并置 exitCode=1，避免静默破坏用户已编辑的文件。
 * 对齐「覆盖前先查看目标」的安全约束，防止 create/scaffold 无声 clobber 现有 schema.ts / *.vue。
 */
export async function confirmOverwrite(targets: string[], force: boolean): Promise<boolean> {
  const existing = targets.filter((f) => existsSync(f));
  if (existing.length === 0 || force) return true;

  console.log(pc.yellow("\n⚠️ 以下文件已存在，将被覆盖："));
  for (const f of existing) console.log(pc.yellow(`   ${f}`));

  if (!process.stdout.isTTY) {
    console.log(pc.red("检测到非交互环境，已中止以避免覆盖。请使用 --force 显式覆盖，或更换 --output 路径。"));
    process.exitCode = 1;
    return false;
  }

  const { ok } = await prompts({
    type: "confirm",
    name: "ok",
    message: "覆盖以上已存在文件？",
    initial: false,
  });
  if (!ok) {
    console.log(pc.yellow("已取消"));
    return false;
  }
  return true;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

/** Windows 保留设备名（`-o NUL` 这类路径写入不会产生任何文件，却"成功"返回）。 */
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * 写入前的落盘可行性闸门：Windows 上设备名（NUL/CON/COM1…，带扩展名同样命中）
 * 不由文件系统承载 —— `-o NUL` 会「成功」但目录里什么都没有，属误导性成功。
 * 非 Windows 下这些名字是合法文件名，故只在 win32 判红，避免跨平台行为漂移。
 */
function assertWritableTarget(path: string): void {
  if (process.platform !== "win32") return;
  if (WINDOWS_DEVICE_NAME.test(basename(path))) {
    throw new Error(`拒绝写入 Windows 保留设备名：${path}（该路径不会产生文件，写入会静默丢失）`);
  }
}

/**
 * 事务式写入一组生成文件：
 * - 先校验每个文件内容非空（B4：空 wrapperCode 会写出 0 字节 .vue 却仍报成功，属误导性成功），
 *   任一为空则在落盘前整体抛错。
 * - 逐个写入；若中途失败，回滚删除本次调用【新建】的文件（B3：避免留下半生成的目录，
 *   如只有 schema.ts 没有 wrapper.vue）。已存在（被覆盖）的文件不回滚——其原内容已被 confirmOverwrite 确认可覆盖。
 * 调用方应在 confirmOverwrite 通过后再调用本函数。
 */
export function writeGeneratedFiles(files: GeneratedFile[], dir: string): void {
  for (const f of files) {
    if (!f.content || f.content.trim() === "") {
      throw new Error(`拒绝写入空文件：${f.path}（生成器未产出内容，可能是模式/配置不匹配）`);
    }
    assertWritableTarget(f.path);
  }
  assertWritableTarget(dir);

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const created: string[] = [];
  try {
    for (const f of files) {
      const preexisting = existsSync(f.path);
      // 先登记再写：writeFileSync 可能在**创建之后**才抛错（如磁盘写满），
      // 此时该文件同样是「本次新建」，必须一起回滚，否则留下半截产物。
      if (!preexisting) created.push(f.path);
      writeFileSync(f.path, f.content, "utf-8");
    }
  } catch (err) {
    // 回滚本次新建的文件，避免半生成产物
    for (const p of created) {
      try {
        rmSync(p, { force: true });
      } catch {
        /* 尽力回滚，忽略清理失败 */
      }
    }
    throw err;
  }
}
