# 结构债拍板记录（2026-11-05）

2026-11-05 源码审计收尾时列出五条结构债，方向性由项目负责人拍板。**本文件是这些议题的
唯一决策记录**：旧审计报告里的「仍待决策 / 尚未处理」以本文件为准，保留原文作为历史。

每条都写明：事实依据（源码位置）→ 决定 → 重新评估的条件。重开条件不是免责声明，是
「什么时候该回来改主意」的判据。

---

## D1 · 契约单一真源：维持双份 + 对账守卫

**事实**
- `packages/core/src/constants.ts`（152 行）与 `packages/shared/src/contract.ts`（67 行）
  是手写两份；core 必须保持零依赖，因此不能直接 import shared。
- 漂移已被机检：`scripts/check-schema-contract.mjs`（esbuild 转译后做深比较，而非文本/名字比对）、
  `scripts/check-tool-shapes.mjs`（前门 zod 3 ↔ 权威 zod 4 的键树对账）。

**决定**：不抽 `@es-plus/contract` 包，也不改成「由 core 反向生成 shared/contract」。
维持双份，把成本放在守卫上。

**理由**：新增包会改变 core/shared 的构建与发布顺序，并要全量改 import；而目前的漂移
风险已经被两条非恒真守卫覆盖。用发布链路的结构性改动换一个已被机检的问题，不划算。

**重开条件**
- 对账守卫被证明恒真/可绕过（例如只比键名、被注释或别名绕过）；
- 出现第三份手写副本；
- core 的零依赖约束被放开。

---

## D2 · `render` / `formatter`：信任边界 + 文档明示

**事实**
- 生成器只做语法闸：`assertEmittableExpr` 用 esbuild `transformSync` 判断源码能否作为
  表达式解析（`packages/shared/src/codegen-escape.ts:273`）。
- 通过后源码**原样**进入产物（`packages/shared/src/structured-generator.ts:2242`），
  由宿主应用执行 —— 没有任何 AST 白名单或运行时沙箱。

**决定**：不引入 AST 白名单，也不在 AI 工具路径拒收。把「配置里的函数字符串就是代码」
写进 AI 面向的文档：`esplus://conventions`（四个 URI 都渲染）与 NL few-shot 的硬规则，
并用测试钉住措辞。

**理由**：白名单会误杀合法写法且维护成本高；AI 路径拒收会直接收窄已发布的能力。
这个字段的语义本来就是「宿主愿意执行的源码」，把它当数据处理才是真风险 —— 所以修的是
**认知**（文档明示），不是语法。

**重开条件**
- MCP 前门开始接受/分发来自不可信第三方的配置（多租户、公开生成服务）；
- 出现真实的注入滥用案例。

---

## D3 · tri-render 渲染证据：维持 `pairs.json` 逐行实测

**事实**：三端截图 PNG 数量为 0；渲染证据由 `tri-render:pairs:check` 的同名示例逐行
断言承担 —— 比截图更强的结构证据，且不需要浏览器基建。

**决定**：不引入 PNG 快照基线。

**理由**：截图基线的主要价值是视觉回归（布局/像素），而当前问题是「三端产出是否同构」，
`pairs.json` 已经直接断言了它；引入截图会带来 flaky 与基线维护成本。

**重开条件**：需要视觉层的回归保证（CSS/布局），而非结构等价。

---

## D4 · A4 `--verify-compile` 沙箱：继续推迟

**事实**：全仓没有 `--verify-compile` 实现；编译面由 CI `golden-compile`（golden:e2e）
与 eval 的 compile leg 覆盖（SFC 过 `compileScript` + `compileTemplate`，模块过 esbuild）。

**决定**：不实现本地「生成后跑真实 vite build 并驱动模型修复」的沙箱闭环。

**理由**：每次生成都要起一次真实构建，时延与成本高，且修复回环需要宿主侧的模型循环
（与「工具确定性、模型推理在宿主」的分界冲突，参见 C2·A3 的拍板）。

**重开条件**：需要「生成即验证」的本地闭环，且能接受逐次构建的时延。

---

## D5 · antdv ColorPicker：保持登记的 deviation

**事实**
- Ant Design Vue 4 没有 ColorPicker；渲染器降级为原生 `<input type="color">`
  （`packages/adapter-antdv/src/composables/use-form-inputs.ts:406`）。
- 丢失 alpha / predefine / history，且不触发 `a-form-item` 的 fieldChange（校验失效）。
- 已在 `scripts/renderer-contract.mjs:23` 显式登记为跨端 deviation，并有测试覆盖降级行为。

**决定**：不自研控件、不引第三方依赖。

**理由**：自研或引入依赖都会扩大三端同构面与维护成本；当前降级有登记、有测试、有文档，
不会静默骗人。

**重开条件**：业务对颜色选择提出 alpha/predefine 需求，或表单校验必须覆盖该控件。

---

## 关联

- 2026-11-05 的另两条限制（非结构债）：eval 重跑被中继阻断；`formatter/render` 的语法闸
  与信任边界说明见 D2。
- 旧的待决策清单：`docs/internal/source-audit-report.md` §7、`docs/internal/deep-analysis-report.md` §「尚未处理」。
