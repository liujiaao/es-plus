/**
 * 覆盖保护：写入前检查目标文件是否已存在。
 * - 无同名文件，或显式 --force → 直接放行。
 * - 存在同名文件且未 --force：
 *     · 交互式终端 → 提示用户确认覆盖；拒绝则返回 false（调用方按取消处理，退出码 0）。
 *     · 非交互环境（无 TTY，如 CI/脚本）→ 拒绝覆盖并置 exitCode=1，避免静默破坏用户已编辑的文件。
 * 对齐「覆盖前先查看目标」的安全约束，防止 create/scaffold 无声 clobber 现有 schema.ts / *.vue。
 */
export declare function confirmOverwrite(targets: string[], force: boolean): Promise<boolean>;
export interface GeneratedFile {
    path: string;
    content: string;
}
/**
 * 事务式写入一组生成文件：
 * - 先校验每个文件内容非空（B4：空 wrapperCode 会写出 0 字节 .vue 却仍报成功，属误导性成功），
 *   任一为空则在落盘前整体抛错。
 * - 逐个写入；若中途失败，回滚删除本次调用【新建】的文件（B3：避免留下半生成的目录，
 *   如只有 schema.ts 没有 wrapper.vue）。已存在（被覆盖）的文件不回滚——其原内容已被 confirmOverwrite 确认可覆盖。
 * 调用方应在 confirmOverwrite 通过后再调用本函数。
 */
export declare function writeGeneratedFiles(files: GeneratedFile[], dir: string): void;
//# sourceMappingURL=fs.d.ts.map