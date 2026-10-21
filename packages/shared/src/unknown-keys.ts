// 刻意不 import zod：本模块只读 `_def`，也不该在类型层绑定「是哪一个 zod 实例」
// （shared 是 v4，mcp-server 解析到根目录的 v3）。唯一调用的方法 `safeParse` 是两代
// 共有的**行为契约**（联合分支选择用，见 `acceptsValue`），不依赖构造器同一性。

/**
 * AN-08 —— **未知键**的确定性收集（让「Schema 校验」名副其实）。
 *
 * ## 为什么需要它
 *
 * Zod 的 `z.object()` 默认**剥掉**未知键（`.strip()`），且**零告警**：宿主 LLM 把
 * `rowkey` 写成 `rowKey`、把 `width` 写成 `widht`、把 `tableOptions` 的键写到顶层
 * （或反过来），`safeParse` 一律回 `success: true`。校验通过、产物里那个键消失，
 * 而 AI 只看到「✓ 配置有效」—— 这正是「静默丢弃」最隐蔽的一种：连 Zod 的 issue 列表
 * 里都没有痕迹。
 *
 * 本模块**只读**地沿 Zod 形状走一遍输入，报告「这个对象里有、形状里没有」的键。
 * 它**不改**配置（如何修复是 `normalize-config.ts` 的事），也不依赖 Zod 的
 * `.strict()`：权威 schema 是共用的，把整棵树改成 strict 会让任何既有配置直接失败，
 * 且嵌套对象（`attrs` 之类）本来就该放开。
 *
 * ## zod 4 / zod 3 双版本适配
 *
 * 本仓**同时装着两个大版本**（不是笔误）：
 *  - `packages/shared` 自己的依赖是 **zod 4.4.3**（`structured-config.schema.ts` 就是它建的，
 *    与计划原文一致）；
 *  - 根目录 hoist 的是 **zod 3.25.76**，`mcp-server` / `core` / `cli` 解析到它 ——
 *    `validate_config` 的片段形状（`tableShape` 等）是 zod3 对象，会被传进本模块。
 *
 * 因此解包不能假设单一内部词汇。zod3 用 `_def.typeName`（`ZodOptional`…），zod4 用
 * `_def.type`（`optional`…）；这里统一成小写短名（`optional`/`object`/`pipe`…）再分派。
 * 判定一律基于 `_def` 字段而不是 `instanceof`：守卫用 esbuild 从源码打包时，跨副本的
 * `instanceof` 会静默失配（两个版本各有一份 class）。
 *
 * 要解包的透明包装：
 * `optional/nullable/default/catch/readonly/prefault → innerType`、
 * `branded → type`、zod3 `effects → schema`、`pipe → in`、`lazy → getter()`。
 *
 * ## 停止下钻的位置
 *
 * - `z.record`：键是**动态**的（`permissions`、`attrs`、`headerCellStyle`），不能当未知键；
 *   但**值形状**仍会下钻（`dialogs` 就是 record<DialogConfigSchema>，里面写错的键必须报）。
 * - `z.any` / `z.unknown` / `z.never` / 标量：没有「键」的概念。
 * - `z.map` / `z.set`：JSON 不可承载，视为不透明。
 *
 * ## 联合类型：先选「接受该值」的候选，再在它们之间取交集
 *
 * `operationColumn: false | {...}`、`isHidden: 条件 | 表达式 | 数组` 都是联合。
 * 若逐分支报告，`field/op/value` 会在表达式分支里被误判成未知键；但若对所有对象分支
 * 一律取交集，记录型分支（`isHidden` 的算子节点 `z.record(...)`）结构上放行任何键，
 * 会把真实拼写错误（`opp`）整体否决掉。故先用各分支的 `safeParse` 收窄到**真正接受
 * 该值**的候选（见 `acceptsValue`），再只在它们之间取交集：一个键只有在所有**匹配的**
 * 候选对象形状里都不存在时才是未知键。
 */

/** 一条未知键报告。 */
export interface UnknownKeyFinding {
  /** 承载该键的**对象**路径（`[]` = 根对象），如 `['tableOptions']`、`['fields', 0]`。 */
  path: (string | number)[]
  /** 形状里不存在的键名。 */
  key: string
  /** 同层最接近的已知键（Levenshtein，大小写不敏感）；无近似候选时缺省。 */
  suggestion?: string
}

/** `x-*` 是**有意**的扩展键（JSON Schema 惯例）：未必被运行时消费，但不是拼写错误。 */
export function isExtensionKey(key: string): boolean {
  return /^x-/i.test(key)
}

/** 纯对象（排除数组 / null）。 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

/** 经典 Levenshtein（插入/删除/替换各计 1；转置计 2 —— 与常见拼写纠正一致）。 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  // 只需上一行 + 当前行，避免为长键分配 O(n*m) 矩阵。
  let prev = new Array<number>(b.length + 1)
  let cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]
}

/**
 * 给一个未知键找同层最接近的已知键。
 *
 * 阈值：短键（≤ 4 字符）只接受距离 1，其余接受 2。再宽就会把 `id` 说成 `size`
 * 这种噪音建议；「did you mean」宁可不说，也不能说错。大小写不敏感：`rowKey`
 * 对 `rowkey` 的距离按小写算 = 0 —— 这正是本项验收里点名的那条。
 */
export function suggestKey(key: string, candidates: Iterable<string>): string | undefined {
  const lower = key.toLowerCase()
  const limit = key.length <= 4 ? 1 : 2
  let best: string | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = levenshtein(lower, candidate.toLowerCase())
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best !== undefined && bestDistance <= limit ? best : undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// zod 4 / zod 3 解包
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 入参的形状类型：只要**是个对象**，不绑定 zod 的实例 / 版本。
 *
 * 这里曾经写成 `z.ZodTypeAny`，结果是类型层把「必须与 shared 的 zod 同实例」写了进去：
 * `mcp-server` 解析到根目录的 zod3，它的 `tableShape`（zod3 对象）传给本模块直接
 * `TS2345`，而运行时完全正常 —— 判定一律基于 `_def` 字段，从不碰 zod 的方法或
 * `instanceof`（见文件头「跨副本的 instanceof 会静默失配」）。类型层同理不该依赖同一性。
 */
type AnyZod = object

interface ZodDefLike {
  /** zod3 词汇。 */
  typeName?: string
  /** zod4 词汇（同时被 zod 的 brand 分支用作内层 schema，故按 unknown 收）。 */
  type?: unknown
  [key: string]: unknown
}

function defOf(schema: AnyZod): ZodDefLike | undefined {
  return (schema as unknown as { _def?: ZodDefLike })?._def
}

/**
 * 把两代词汇归一成小写短名：zod3 `ZodOptional` → `optional`，zod4 `optional` 原样。
 * 拿不到 def 时返回 undefined（调用方当作「无形状可判」）。
 */
function typeTag(schema: AnyZod): string | undefined {
  const def = defOf(schema)
  if (!def) return undefined
  const tag = def.typeName ?? def.type
  if (typeof tag !== 'string') return undefined
  if (tag.startsWith('Zod')) {
    const short = tag.slice(3)
    return short.charAt(0).toLowerCase() + short.slice(1)
  }
  return tag
}

const TRANSPARENT_INNER = new Set(['optional', 'nullable', 'default', 'catch', 'readonly', 'prefault', 'nonoptional'])

/** 解包全部「透明包装」，直到拿到真正的形状节点（对象/数组/联合/record/标量…）。 */
function unwrap(schema: AnyZod): AnyZod {
  let cur = schema
  // 上限只是防御：`z.lazy` 自指 + 透明包装理论上是无限链，实际 schema 不会。
  for (let i = 0; i < 32; i++) {
    const def = defOf(cur)
    const tag = typeTag(cur)
    if (!def || !tag) return cur
    if (TRANSPARENT_INNER.has(tag)) {
      cur = def.innerType as AnyZod
      continue
    }
    switch (tag) {
      case 'branded':
        cur = def.type as AnyZod
        continue
      case 'effects': // zod3 `.refine/.transform`
        cur = def.schema as AnyZod
        continue
      case 'pipeline': // zod3 `.pipe()`
      case 'pipe': // zod4 `.transform()/.pipe()`
        cur = def.in as AnyZod
        continue
      case 'lazy':
        cur = (def.getter as () => AnyZod)()
        continue
      default:
        return cur
    }
  }
  return cur
}

const OBJECT_CAPABLE = new Set([
  'object',
  'record',
  'union',
  'intersection',
  'array',
  'tuple',
  'map',
])

function isObjectCapable(schema: AnyZod): boolean {
  const tag = typeTag(unwrap(schema))
  return !!tag && OBJECT_CAPABLE.has(tag)
}

function findingsKey(f: UnknownKeyFinding): string {
  return `${f.path.join('/')}::${f.key}`
}

/**
 * 该分支是否**接受**这个值。
 *
 * 联合的语义是「候选形状之一」，而 `_def` 读不出「哪个候选真的匹配」：`isHidden` 的
 * 表达式分支是 `z.record(...)`，结构上对**任何**键都放行（真正的约束在 `.refine`
 * 的键集检查里），若让它参与键判定的交集，`{ field, opp, value }` 里拼错的 `opp`
 * 会被这条记录分支投成「合法」，错误键随即被 zod 静默剥掉、`op` 回落到默认 `eq` ——
 * 语义从「不等于」变成「等于」，且全程零告警。这里用候选分支自己的 `safeParse`
 * 选出「真的接受该值」的分支，只在这些分支之间取交集。
 *
 * 这**不**违反「不绑定 zod 实例/版本」的约束：只调 `safeParse` 这一两代共有的
 * 方法契约，不 import zod、不做 `instanceof`。拿不到该方法时视为接受（退回旧口径）。
 */
function acceptsValue(schema: AnyZod, value: unknown): boolean {
  const fn = (schema as unknown as { safeParse?: (v: unknown) => { success?: boolean } }).safeParse
  if (typeof fn !== 'function') return true
  try {
    return fn.call(schema, value)?.success === true
  } catch {
    return true // 分支自身抛错不应让「未知键」判定整体失效
  }
}

/** 联合：在**接受该值**的候选对象分支之间取 findings 交集（见文件头「联合类型」）。 */
function collectUnion(options: AnyZod[], value: unknown, path: (string | number)[], out: UnknownKeyFinding[]): void {
  const objectOptions = options.filter(isObjectCapable)
  if (objectOptions.length === 0) return
  const accepted = objectOptions.filter((option) => acceptsValue(option, value))
  // 没有任何分支接受 ⇒ 值本身非法（zod 会报 union 错），未知键不是主因：
  // 退回「全部对象分支取交集」，保持旧口径、不额外制造噪音。
  const candidates = accepted.length > 0 ? accepted : objectOptions
  const perOption: UnknownKeyFinding[][] = []
  for (const option of candidates) {
    const findings: UnknownKeyFinding[] = []
    collect(option, value, path, findings, 0)
    perOption.push(findings)
  }
  let intersection = perOption[0]
  for (let i = 1; i < perOption.length; i++) {
    const present = new Set(perOption[i].map(findingsKey))
    intersection = intersection.filter((f) => present.has(findingsKey(f)))
  }
  out.push(...intersection)
}

function collect(
  schema: AnyZod,
  value: unknown,
  path: (string | number)[],
  out: UnknownKeyFinding[],
  depth: number,
): void {
  if (depth > 64) return // 防御：值深度已限定递归，这里只是兜底
  const node = unwrap(schema)
  const def = defOf(node)
  const tag = typeTag(node)
  if (!def || !tag) return

  switch (tag) {
    case 'object': {
      if (!isPlainObject(value)) return
      const shape = (typeof def.shape === 'function' ? (def.shape as () => Record<string, AnyZod>)() : def.shape) as
        | Record<string, AnyZod>
        | undefined
      if (!shape) return
      const known = Object.keys(shape)
      // catchall（`.catchall(z.any())`）显式允许任意键；默认（zod3 的 ZodNever / zod4 无 catchall）不放行。
      const catchall = def.catchall as AnyZod | undefined
      const allowsUnknown = !!catchall && typeTag(unwrap(catchall)) !== 'never'

      for (const key of Object.keys(value)) {
        if (key in shape || isExtensionKey(key) || allowsUnknown) continue
        out.push({
          path: [...path],
          key,
          suggestion: suggestKey(key, known),
        })
      }
      for (const key of known) {
        const child = value[key]
        if (child === undefined) continue
        collect(shape[key], child, [...path, key], out, depth + 1)
      }
      return
    }
    case 'record': {
      if (!isPlainObject(value)) return
      // record 的**键**是动态的（tenant id、按钮 key…），不判未知；**值形状**照走。
      const valueType = def.valueType as AnyZod | undefined
      if (!valueType) return
      for (const key of Object.keys(value)) {
        collect(valueType, value[key], [...path, key], out, depth + 1)
      }
      return
    }
    case 'array': {
      if (!Array.isArray(value)) return
      // zod3 `_def.type` / zod4 `_def.element`
      const item = (def.element ?? def.type) as AnyZod | undefined
      if (!item) return
      value.forEach((entry, index) => collect(item, entry, [...path, index], out, depth + 1))
      return
    }
    case 'tuple': {
      if (!Array.isArray(value)) return
      const items = (def.items ?? []) as AnyZod[]
      for (let i = 0; i < Math.min(items.length, value.length); i++) {
        collect(items[i], value[i], [...path, i], out, depth + 1)
      }
      return
    }
    case 'union': {
      // zod4 的 DiscriminatedUnion 也是 `type: 'union'`（带 `discriminator`），同一分支即可。
      const rawOptions = def.options
      const options: AnyZod[] =
        rawOptions instanceof Map ? [...(rawOptions as Map<unknown, AnyZod>).values()] : ((rawOptions ?? []) as AnyZod[])
      collectUnion(options, value, path, out)
      return
    }
    case 'intersection': {
      // 交集中的键必须被**两边**都接受；只在一边未知不算未知。
      const left: UnknownKeyFinding[] = []
      const right: UnknownKeyFinding[] = []
      collect(def.left as AnyZod, value, path, left, depth + 1)
      collect(def.right as AnyZod, value, path, right, depth + 1)
      const rightKeys = new Set(right.map(findingsKey))
      out.push(...left.filter((f) => rightKeys.has(findingsKey(f))))
      return
    }
    default:
      // 标量 / any / unknown / never / map / set / promise / function：无键可判。
      return
  }
}

/**
 * 沿 Zod 形状报告 `value` 里的未知键。纯函数、确定性：同一 (schema, value) 恒返回
 * 同一序列（按路径/键排序，便于测试与稳定输出）。
 *
 * `value` 不是对象（例如 `null`）时返回空数组 —— 类型错误由 Zod 自己报，这里不重复。
 */
export function collectUnknownKeys(schema: AnyZod, value: unknown): UnknownKeyFinding[] {
  const out: UnknownKeyFinding[] = []
  collect(schema, value, [], out, 0)
  return out.sort((a, b) => {
    const pa = a.path.map(String).join('\u0000')
    const pb = b.path.map(String).join('\u0000')
    if (pa !== pb) return pa < pb ? -1 : 1
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
}

/** 把一条未知键渲染成 `/path/key: …` 错误串（与 `formatIssuePath` 同形态）。 */
export function formatUnknownKey(f: UnknownKeyFinding): string {
  const path = f.path.length ? '/' + f.path.map(String).join('/') + '/' + f.key : '/' + f.key
  return f.suggestion
    ? `${path}: 未知键 "${f.key}" —— did you mean "${f.suggestion}"?`
    : `${path}: 未知键 "${f.key}"（该层没有相近的已知键；拼写错误或放错了层级）`
}
