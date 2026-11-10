import { z } from "zod";

/**
 * W2 —— 把 shared 的权威 Zod schema **派生**成 MCP 工具入参形状（单源）。
 *
 * ## 为什么需要派生而不是直接 `schema.shape`
 *
 * shared 的 schema 是「配置的判据」，工具入参是「受约束解码的契约」，两者有三处
 * **有意的语义差**（`check-tool-shapes` 逐键对账证明键集一致，差异只在语义层）：
 *
 *   1. **默认值**：shared 用 `.default()` 表达缺省语义（`formtype:'Input'`、
 *      `inQuery/inTable/inForm:true`、`tableOptions.rowkey:'id'`…）。工具层若直接复用，
 *      Zod 会在 args 到达 handler **之前**把默认值注入 —— `withRowkey` 会把「默认的 id」
 *      误判成用户显式配置，也会让经 MCP 的真实调用与直接驱动 handler 的 eval 看到
 *      不同的入参。故工具形状必须**剥掉** `.default()`，保留 `.optional()`。
 *   2. **未知键**：shared 默认 strip（为兼容历史配置静默忽略多余键）；工具入口是
 *      受约束解码，拼错键必须**报错**而不是消失（否则 `_arg-guard` 的 did-you-mean
 *      闸门恒空）。故工具形状递归 `.strict()` / `.passthrough()`。
 *   3. **描述**：这是宿主 LLM 唯一的教学面。片段形状曾主张「镜像了键、没镜像文案
 *      等于教得比 CRUD 前门少」—— 派生从根上消除这条分叉。
 *
 * ## 实现约束
 *
 * · 只重建**容器**（object / array / union / record / optional / nullable / lazy），
 *   叶子（string / number / boolean / enum / literal）原样返回 —— `.min()`、`.regex()`、
 *   `.refine()` 等检查因此完整保留，不需要逐个复刻。
 * · `.describe()` 在 zod 4 里挂在实例 registry 上，**重建会丢**；故每个重建结果都
 *   显式重新 `describe()`。
 * · `.default()` 一律解包丢弃（连 `ZodDefault` 外层的 optional 一起）；这是本文件的
 *   存在理由，不是可选优化。
 * · `lazy` 用 WeakMap 记忆，避免自指 schema（`columns[].groups`）无限递归。
 */
export type ExtrasPolicy = "strict" | "passthrough" | "inherit";

export interface DeriveOptions {
  /**
   * 未知键策略：
   * · `strict`（默认）= 每一层 object 都 `.strict()`（片段工具与前门旋钮的口径）；
   * · `passthrough` = 每一层都 `.passthrough()`（需让拼写错误活到 handler 再做
   *   did-you-mean 的场景）；
   * · `inherit` = 保持 shared 原样（strip）。
   */
  extras?: ExtrasPolicy;
  /** 只对顶部对象设规则，嵌套层保持 shared 原样（`validate_config` 的形状）。 */
  extrasTopOnly?: boolean;
}

/** zod 4 的内部判别字段；用 `def.type` 而不是 `instanceof`，跨副本也成立。 */
function nodeType(schema: z.ZodType): string {
  return (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def?.type ?? "";
}

function copyDescription<T extends z.ZodType>(source: z.ZodType, out: T): T {
  const desc = source.description;
  return desc ? (out.describe(desc) as T) : out;
}

/**
 * 把原容器节点上的检查（`.min(1)` / `.refine()` / `.superRefine()` …）搬回重建结果。
 *
 * 重建对象/数组/联合时，**容器自身**的检查不在形状里，直接 `z.array(...)` 会静默丢掉
 * `.min(1)` —— 那会让「空数组」从非法变合法，且没有任何类型错误。zod 4 的 `clone(def)`
 * 是整体替换（不是合并），故必须带上重建结果自己的 def，再覆盖 `checks`。
 */
function withChecks<T extends z.ZodType>(source: z.ZodType, out: T): T {
  const checks = (source as unknown as { _zod?: { def?: { checks?: unknown[] } } })._zod?.def?.checks;
  if (!checks?.length) return out;
  const outDef = (out as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;
  return out.clone({ ...outDef, checks } as never) as T;
}

function applyExtras(schema: z.ZodObject<z.ZodRawShape>, policy: ExtrasPolicy) {
  if (policy === "strict") return schema.strict();
  if (policy === "passthrough") return schema.passthrough();
  return schema;
}

/**
 * 递归重建 schema：剥默认值、按策略收紧未知键、保留描述与叶子检查。
 *
 * 返回值类型是 `z.ZodType<z.infer<S>>` —— 派生**不改变**可接受的取值集合
 * （除了去掉默认值注入），所以类型参数可以安全透传。
 */
export function deriveSchema<S extends z.ZodType>(
  schema: S,
  options: DeriveOptions = {},
  depth = 0,
  memo: WeakMap<z.ZodType, z.ZodType> = new WeakMap(),
): z.ZodType<z.infer<S>> {
  const cached = memo.get(schema);
  if (cached) return cached as z.ZodType<z.infer<S>>;

  // 先登记占位，供 lazy 自指解析；同一实例的重入直接拿到占位。
  const policy = options.extras ?? "strict";
  const depthPolicy = options.extrasTopOnly && depth > 0 ? "inherit" : policy;

  const def = (schema as unknown as { _zod: { def: any } })._zod.def;
  const type = nodeType(schema);
  const recurse = (child: z.ZodType, nextDepth = depth + 1) =>
    deriveSchema(child, options, nextDepth, memo);

  // 默认值：解包丢弃默认值，但**保留「输入可省略」**这一半语义 —— `.default(x)`
  // 在 zod 里意味着字段可缺省，只剥成必填会把合法配置判红。故外层补 `.optional()`。
  if (type === "default") {
    const inner = recurse(def.innerType);
    const out = inner.isOptional() ? inner : inner.optional();
    memo.set(schema, out);
    return copyDescription(schema, out) as z.ZodType<z.infer<S>>;
  }

  if (type === "optional") {
    const inner = recurse(def.innerType);
    const out = inner.isOptional() ? inner : inner.optional();
    memo.set(schema, out);
    return copyDescription(schema, out) as z.ZodType<z.infer<S>>;
  }

  if (type === "nullable") {
    const out = recurse(def.innerType).nullable();
    memo.set(schema, out);
    return copyDescription(schema, out) as z.ZodType<z.infer<S>>;
  }

  if (type === "object") {
    const shape: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(def.shape as Record<string, z.ZodType>)) {
      shape[key] = recurse(value);
    }
    const out = withChecks(schema, applyExtras(z.object(shape), depthPolicy));
    memo.set(schema, out);
    return copyDescription(schema, out) as unknown as z.ZodType<z.infer<S>>;
  }

  if (type === "array") {
    const out = withChecks(schema, z.array(recurse(def.element)));
    memo.set(schema, out);
    return copyDescription(schema, out) as unknown as z.ZodType<z.infer<S>>;
  }

  if (type === "union") {
    const out = withChecks(
      schema,
      z.union((def.options as z.ZodType[]).map((o) => recurse(o)) as [z.ZodType, ...z.ZodType[]]),
    );
    memo.set(schema, out);
    return copyDescription(schema, out) as unknown as z.ZodType<z.infer<S>>;
  }

  if (type === "record") {
    // zod 4 的 record 键类型是 string | number | symbol 的窄联合；递归结果在类型上
    // 被抹平成 ZodType<unknown>，运行时仍是同一个键 schema。
    const key = recurse(def.keyType) as never;
    const out = withChecks(schema, z.record(key, recurse(def.valueType)));
    memo.set(schema, out);
    return copyDescription(schema, out) as unknown as z.ZodType<z.infer<S>>;
  }

  if (type === "lazy") {
    // 自指：**不能**先塞 `z.never()` 占位再同步解析 —— 解析过程中再次遇到本 lazy 时
    // 会拿到那个占位，于是 `children: z.array(z.never())` 把合法子节点全拒掉。
    // 正确做法是重建一个 lazy：占位本身就是「稍后再解析」，自指因此天然成立。
    let resolved: z.ZodType | undefined;
    const out: z.ZodType = z.lazy(() => (resolved ??= recurse(def.getter())));
    memo.set(schema, out);
    return copyDescription(schema, out) as z.ZodType<z.infer<S>>;
  }

  // 叶子（string/number/boolean/enum/literal/never/unknown/pipe/…）：原样返回，
  // 检查（min/regex/refine）与 transform 都不会被重建弄丢。
  memo.set(schema, schema);
  return schema as z.ZodType<z.infer<S>>;
}

/** 派生后取出顶层 shape —— MCP SDK 的 `server.tool()` / `registerTool()` 只吃形状。 */
export function deriveShape<S extends z.ZodObject<z.ZodRawShape>>(
  schema: S,
  options: DeriveOptions = {},
): S["shape"] {
  return (deriveSchema(schema, options) as unknown as S).shape;
}

/**
 * 断言派生结果**不含任何默认值**。
 *
 * 这是本文件最容易悄悄失效的契约：shared 新增一颗 `.default()` 时，派生会自动剥掉，
 * 但若有人改了派生逻辑（或直接绕开它），默认值会重新注入 —— 而那不会有任何运行时
 * 错误，只会在 `withRowkey` 之类的地方产出假冲突。守卫脚本与单测都调用它。
 */
export function hasDefaults(schema: z.ZodType, seen: Set<z.ZodType> = new Set()): boolean {
  if (seen.has(schema)) return false;
  seen.add(schema);
  const def = (schema as unknown as { _zod?: { def?: any } })._zod?.def;
  if (!def) return false;
  if (def.type === "default") return true;
  const children: z.ZodType[] = [];
  if (def.innerType) children.push(def.innerType);
  if (def.element) children.push(def.element);
  if (def.shape) children.push(...Object.values(def.shape as Record<string, z.ZodType>));
  if (def.options) children.push(...(def.options as z.ZodType[]));
  if (def.valueType) children.push(def.valueType);
  if (def.keyType) children.push(def.keyType);
  return children.some((c) => hasDefaults(c, seen));
}
