/**
 * 生成结果里的「非产物事实」：识别到了但没进 schema 的能力（featureHints），
 * 以及生成时被降级/剥离的诉求（warnings）。
 *
 * 为什么要有这个模块：这两组信息以前只存在于返回值里，站点读了、MCP 工具丢了。
 * 结果是**同一份生成器，两个消费者看到的事实不一样** —— 站点会提示「多 tab 弹窗
 * 需自行实现」，IDE 里的宿主 LLM 却只拿到 schema + code，于是它会把一个
 * 「已识别但未实现」的需求当作已完成。
 *
 * 版式与 `_fragment-shapes.ts` 的 warnings 段一致：先 hints（需要宿主补实现），
 * 后 warnings（本次生成被降级/剥离），都放在产物代码块**之前** —— 读者先知道
 * 边界，再读代码。
 */
export function generationNotes(result: {
  featureHints?: string[];
  warnings?: string[];
}): string[] {
  const lines: string[] = [];
  const hints = result.featureHints ?? [];
  const warnings = result.warnings ?? [];

  if (hints.length > 0) {
    lines.push(
      "",
      "## Notes (recognized, but NOT rendered by schema mode — implement in the wrapper SFC or the host page)",
    );
    for (const h of hints) lines.push(`  - ${h}`);
  }

  if (warnings.length > 0) {
    lines.push(
      "",
      "⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):",
    );
    for (const w of warnings) lines.push(`  - ${w}`);
  }

  return lines;
}
