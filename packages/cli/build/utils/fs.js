import prompts from "prompts";
import pc from "picocolors";
import { writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
/**
 * 覆盖保护：写入前检查目标文件是否已存在。
 * - 无同名文件，或显式 --force → 直接放行。
 * - 存在同名文件且未 --force：
 *     · 交互式终端 → 提示用户确认覆盖；拒绝则返回 false（调用方按取消处理，退出码 0）。
 *     · 非交互环境（无 TTY，如 CI/脚本）→ 拒绝覆盖并置 exitCode=1，避免静默破坏用户已编辑的文件。
 * 对齐「覆盖前先查看目标」的安全约束，防止 create/scaffold 无声 clobber 现有 schema.ts / *.vue。
 */
export async function confirmOverwrite(targets, force) {
    const existing = targets.filter((f) => existsSync(f));
    if (existing.length === 0 || force)
        return true;
    console.log(pc.yellow("\n⚠️ 以下文件已存在，将被覆盖："));
    for (const f of existing)
        console.log(pc.yellow(`   ${f}`));
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
/**
 * 事务式写入一组生成文件：
 * - 先校验每个文件内容非空（B4：空 wrapperCode 会写出 0 字节 .vue 却仍报成功，属误导性成功），
 *   任一为空则在落盘前整体抛错。
 * - 逐个写入；若中途失败，回滚删除本次调用【新建】的文件（B3：避免留下半生成的目录，
 *   如只有 schema.ts 没有 wrapper.vue）。已存在（被覆盖）的文件不回滚——其原内容已被 confirmOverwrite 确认可覆盖。
 * 调用方应在 confirmOverwrite 通过后再调用本函数。
 */
export function writeGeneratedFiles(files, dir) {
    for (const f of files) {
        if (!f.content || f.content.trim() === "") {
            throw new Error(`拒绝写入空文件：${f.path}（生成器未产出内容，可能是模式/配置不匹配）`);
        }
    }
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const created = [];
    try {
        for (const f of files) {
            const preexisting = existsSync(f.path);
            writeFileSync(f.path, f.content, "utf-8");
            if (!preexisting)
                created.push(f.path);
        }
    }
    catch (err) {
        // 回滚本次新建的文件，避免半生成产物
        for (const p of created) {
            try {
                rmSync(p, { force: true });
            }
            catch {
                /* 尽力回滚，忽略清理失败 */
            }
        }
        throw err;
    }
}
//# sourceMappingURL=fs.js.map