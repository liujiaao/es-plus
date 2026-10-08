/**
 * 代码生成器的**转义层**（单源）。
 *
 * 为什么单独成模块：本包有 4 处生成代码（`structured-generator.ts` 的 SFC 模式、
 * `crud-engine.ts` 的旧 NL 路径、`target.ts` 的模板片段、`code-generator.ts` 的
 * 脚手架）。此前转义器只在 `structured-generator.ts` 里定义，其余三处要么裸拼、
 * 要么各写一份 —— 于是同一类 bug（数据字段变成可执行代码）在四处以四种形态复发：
 * `width: '20' + (1) + ''`、`row.${prop}`、`class="${name}-page"`、
 * `<template #column-x"@mouseover="alert(1)">`。
 *
 * 各函数的边界必须分清，混用会漏：
 *   - `q()`     JS **单引号字符串**字面量
 *   - `qBt()`   JS **反引号模板字面量**内容
 *   - `qKey()`  对象字面量键 / TS 接口成员名
 *   - `qPath()` JS **成员访问路径**（`row.xxx` 的后半段）
 *   - `qAttr()` HTML **属性值** / mustache 插值
 *   - `inlineJson()` 内联进 SFC `<script>` 的 JSON
 *
 * `formatter` / `render` 是**文档化的源码扩展点**（`structured-config.schema.ts`
 * 的 describe 明写 "Extension point"），刻意不经任何转义 —— 它们就是用来内联
 * 任意 JS 源码的。不要"顺手修"它们。
 */

/**
 * JS 单引号字符串字面量。
 *
 * 同时把 `</` 转义成 `<\/`：生成物既可能是独立 `.ts`，也可能被内联进 SFC 的
 * `<script>` 块 —— 后者里字符串字面量中的 `</script>` 会被 HTML 解析器当成
 * 结束标签提前闭合脚本块（实测 `label: 'A</script><script>alert(1)</script>'`
 * 就能逃逸）。`\/` 是 JS 与 JSON 都合法的转义，语义不变。
 */
export function q(value: unknown): string {
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n')
    .replace(/<\//g, '<\\/')}'`
}

/**
 * 反引号模板字面量的**内容**（不含反引号本身）。
 *
 * 数据字段在生成代码里常以 `...` 出现（如 ``url: `${apiUrl}/${row.id}` ``），
 * 含 `` ` `` 或 `${` 会破坏生成代码甚至注入任意 JS。`</` 同 `q()` 一并转义
 * （模板字面量里同样会被 HTML 解析器当成 script 结束标签）。
 */
export function qBt(value: unknown): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/<\//g, '<\\/')
}

/**
 * HTML 属性值 / mustache 插值上下文。
 *
 * 为什么必须与 `q()` 分开：`q()` 与 `qBt()` 都放行 `"`、`<`、`&` —— 而 `prop`
 * 会被写进 `<template #column-${prop}="{ row }">` 这样的**属性值**位置。
 * 实测 `prop: 'x"@mouseover="alert(1)'` 会生成
 * `<template #column-x"@mouseover="alert(1)="{ row }">`，凭空多出一个事件属性。
 */
export function qAttr(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 裸标识符：可直接写在「对象字面量键 / TS 接口成员名」位置的形态。 */
export const BARE_IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/**
 * 对象字面量键 / TS 接口成员名：**仅在不是裸标识符时才加引号**。
 *
 * 为什么必须加引号：`prop` 支持嵌套路径 —— core 的 `parsePathSegments` 按
 * `/\.|\[|\]/` 分段，`form-item.schema.json` 也明文写「Supports nested paths like
 * 'a.b' or 'a[0].b'」。裸写 `a.b: ''` 在对象字面量里是语法错、在 TS 接口里会被解析成
 * 「成员 b、类型 string」，而 `'a.b': ''` 两种位置都合法且语义等价。
 *
 * 为什么**不能**无条件加引号：`{ 'amount': null }` 与 `{ amount: null }` 运行时等价，
 * 但前者会让既有断言（`__tests__/structured-generator.spec.ts:194-195` 断言
 * `amount: null`）以及所有正常输出发生无意义变化。按需加 → 正常路径逐字节不变。
 */
export function qKey(prop: string): string {
  return BARE_IDENTIFIER.test(prop) ? prop : q(prop)
}

/** 点分路径形态：`a`、`a.b`、`a[0].b`（与 core `parsePathSegments` 的口径一致）。 */
const SAFE_PATH = /^[A-Za-z_$][\w$]*(?:\[(?:\d+|[A-Za-z_$][\w$]*)\]|\.[A-Za-z_$][\w$]*)*$/

/**
 * JS **成员访问后缀**，直接接在基表达式后面用：`row${qMember(prop)}`、
 * `formData${qMember(prop)}`……（含前导 `.` 或 `[...]`，所以调用处**不要再写点的**）。
 *
 * 为什么不能用 `qAttr` 或 `qBt`：这里是 JS **表达式**位置，不是在字符串里。
 * 光挡住引号不够 —— 实测 `prop: 'x??alert(1)'` 会生成
 * `row.x??alert(1) === 1 ? ...`，是**合法 JS 且真的会调用 alert**，且它不含任何引号。
 * 而 `qBt`（模板串转义）在此处更离谱：它只防 `` ` `` 和 `${`，对 `row` 之后
 * 的表达式注入毫无作用 —— 本文件此前有 6 处这样误用（`row.${qBt(rowkey)}`、
 * `formData.${qBt(rowkey)}`、`data.${qBt(rowkey)}`）。
 *
 * 策略：是安全路径就返回 `.${prop}`（正常路径逐字节不变），否则退化成方括号取值
 * `['x??alert(1)']` —— 键变成字符串字面量，注入的表达式再也无法求值；
 * 顺带把 `user-name` 这类今天会生成 `row.user-name`（减法！）的 prop 一并修好。
 */
export function qMember(prop: string): string {
  if (SAFE_PATH.test(prop)) return `.${prop}`
  return `[${qMustache(prop)}]`
}

/**
 * 必须落进 Vue **mustache 插值**（`{{ … }}`）的 JS 字符串字面量。
 *
 * 与 `q()` 的唯一差别：把它产出的字面量里每一个右花括号改写成 JS 的 Unicode
 * 转义序列（反斜杠 u 007d）—— 二者在 JS 字符串里语义**完全相同**，但模板文本里
 * 不会再出现两个连续的右花括号。
 *
 * 为什么必须这样：mustache 的结束定界符就是两个右花括号，而 Vue 是拿非贪婪正则找
 * **第一个**出现的那一对 —— 字符串字面量里的也不例外，于是插值会提前收尾、表达式被截断
 * 成语法错。实测 prop 写成 a 加两个右花括号再加 b 时，生成物里的插值表达式退化成
 * 半个下标访问（缺少结尾的引号与方括号），整个组件编译失败。
 *
 * qMember 的方括号分支也走这一支：它产出的字面量既可能进 JS 语句，也可能进 mustache
 * 或属性表达式，mustache 安全的写法对所有位置都成立。
 */
export function qMustache(value: unknown): string {
  return q(value).replace(/\}/g, '\\u007d')
}

/**
 * `number | string` 两种字面量的生成形态：number 原样、string 经 `q()` 转义。
 *
 * 抽成一处的原因：同一个 union（`tableOptions.tabHeight` 与 `.height` 都是
 * `z.union([z.number(), z.string()])`）此前被写了两遍 —— 其中 `height` 漏了分支，
 * 传 `'100vh'` 直接生成 `height: 100vh,` 导致产物**语法错误**；而 `tabHeight` 的
 * 字符串分支是 `'${x}'` 裸拼，未转义。两处共用本函数后不会再分叉。
 */
export function numOrStr(v: number | string): string {
  return typeof v === 'number' ? String(v) : q(v)
}

/** HTML 注释内容：不能含 `--`，且需单行；折叠空白并把连续短横替换为破折号，截断超长源码。 */
export function sanitizeForComment(src: string): string {
  return src.replace(/\s+/g, ' ').replace(/--+/g, '—').trim().slice(0, 200)
}

/**
 * 序列化成可以安全内联进 SFC `<script>` 块的 JSON。
 *
 * 为什么 `JSON.stringify` 还不够：JSON 是合法 JS 字面量语法，但 JSON 字符串里的
 * `</script>` 会被 HTML 解析器当成宿主 `<script>` 的结束标签 —— 配置里任意一个
 * `label` 写成 `</script><script>alert(1)</script>` 就能逃出 script 块。
 * 把 `</` 转义成 `<\/` 后 JSON 语义完全不变（JSON 允许 `\/`），
 * 而 HTML 解析器再也看不到结束标签。
 *
 * @param space 与 `JSON.stringify` 的第三参一致（保留缩进，产物字节对正常值不变）
 */
export function inlineJson(value: unknown, space?: string | number): string {
  return JSON.stringify(value, null, space).replace(/<\/(script)/gi, '<\\/$1')
}
