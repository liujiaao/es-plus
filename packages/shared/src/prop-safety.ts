/**
 * 字段路径安全判据 —— 单一真源。
 *
 * `prop` / `field` / `var` 会被用作：数据模型的键（core `parsePathSegments` 按
 * `/\.|\[|\]/` 分段）、生成代码里的成员访问路径、以及 SFC 插槽名的一部分。这里只拒绝
 * **确定会坏事**的形态：
 *
 *  - 路径分隔符 `/`、`\`：与页面 `name` 同理（不得被当作文件/目录路径使用）；
 *  - 空段 / `.` / `..`：`parsePathSegments` 会把它们滤掉或指向父级，语义不可预期；
 *  - `__proto__` / `constructor` / `prototype`：core 的 `getNestedValue`/`setNestedValue`
 *    已经拒绝这三个键（原型污染），在入口一并挡掉，避免「校验通过、运行时静默不生效」。
 *
 * **刻意不**拒绝 kebab-case（`user-name`）等非标识符 prop：它们在 `mode=schema` 下
 * 今天确实可用（prop 只作为数据键透传，`model['user-name']` 正常）。生成侧已按需
 * 引号化/方括号化，产物可编译。收紧到「必须是标识符」会把既有可用配置判红，
 * 属于误判 —— 生成器只在 SFC 模式下对该形态发警告（见 structured-generator.ts 的
 * `warnNonIdentifierProps`）。
 *
 * ## 为什么单独成文件
 *
 * 权威 Zod schema（`structured-config.schema.ts`，会拉进 zod 运行时）与场景侧的
 * 生成前校验（`scene/intent-validation.ts`）都要用同一条判据，而
 * `@es-plus/shared/scene` 子路径的纪律是**只放只读元数据 + 纯函数**、不得被迫加载
 * schema 运行时。把判据抽出来，两边各自 import 即可，既不重复也不互相拖累。
 */
const UNSAFE_PROP_SEGMENT = /^(?:__proto__|constructor|prototype)$/

export function isSafeProp(v: string): boolean {
  if (v === '.' || v === '..' || /[\\/]/.test(v)) return false
  const segments = v.split(/\.|\[|\]/).filter((s) => s !== '')
  if (segments.length === 0) return false
  return !segments.some((s) => UNSAFE_PROP_SEGMENT.test(s))
}
