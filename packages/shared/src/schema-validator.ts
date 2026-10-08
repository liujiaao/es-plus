import Ajv from "ajv"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SCHEMAS_DIR = join(__dirname, "../schemas")

export interface ValidationResult {
  valid: boolean
  errors: string[]
  suggestions: string[]
}

export function createSchemaValidator(schemasDir?: string) {
  const dir = schemasDir || DEFAULT_SCHEMAS_DIR
  const ajv = new Ajv({ allErrors: true, verbose: true })

  let schemasLoaded = false
  /**
   * 目录里实际存在的 schema 名（不含 index）。
   *
   * 与 `readdirSync` 同源，因此**不可能**与文件集漂移 —— 这也是它必须被复用为
   * `loadSchema` 白名单的原因（见下）。
   */
  let availableNames: string[] = []

  function ensureSchemasLoaded(): void {
    if (schemasLoaded) return
    schemasLoaded = true
    if (!existsSync(dir)) return
    const files = readdirSync(dir).filter((f) => f.endsWith(".schema.json"))
    availableNames = files
      .filter((f) => f !== "index.schema.json")
      .map((f) => f.replace(".schema.json", ""))
    for (const file of files) {
      try {
        const schema = JSON.parse(readFileSync(join(dir, file), "utf-8"))
        if (schema.$id) {
          try { ajv.addSchema(schema) } catch { /* already added */ }
        }
      } catch {
        // 单个 schema 文件损坏不应拖垮整个校验器
      }
    }
  }

  /**
   * 读取 schema 文件 —— **必须走白名单**。
   *
   * `schemaName` 是外部输入（CLI 的 `--schema`、MCP 工具 `validate_config` 的 `type`），
   * 直接 `join(dir, name + '.schema.json')` 会让 `../../secrets/x` 这类名字读到目录之外的
   * 文件：取不到不报错、反而把它当成 schema 用（读得到就解析，读不到才报 not found）。
   * 命中 `availableNames`（与目录实际内容同源，见上）才读，其余一律按「未找到」处理，
   * 于是路径穿越与拼写错误走同一条路径，错误信息也一致（都列出可用名）。
   *
   * 注意 `availableNames` 刻意不含 `index.schema.json`：它只是 `$ref` 汇总的
   * definitions 容器，不是可施加于配置的 schema —— 与 `listAvailableSchemas()` 的口径一致。
   */
  function loadSchema(schemaName: string): object | null {
    ensureSchemasLoaded()
    if (!availableNames.includes(schemaName)) return null
    const schemaPath = join(dir, `${schemaName}.schema.json`)
    try {
      return JSON.parse(readFileSync(schemaPath, "utf-8"))
    } catch {
      return null
    }
  }

  function validateConfig(config: unknown, schemaType?: string): ValidationResult {
    const schemaName = schemaType || "form-item"
    const schema = loadSchema(schemaName)

    if (!schema) {
      return {
        valid: false,
        errors: [`Schema "${schemaName}" not found. Available: ${listAvailableSchemas().join(", ")}`],
        suggestions: ["Check schema name spelling"],
      }
    }

    const schemaObj = schema as Record<string, unknown>
    /**
     * 编译与应用 schema 都包在 try 里。
     *
     * 两处都会抛，且都**不是**调用方的输入问题：
     *  - `ajv.compile` / `getSchema` 在 schema 自身有病时抛（未解析的 `$ref`、非法关键字）；
     *  - `validate(config)` 在数据嵌套过深撞上递归上限时抛 `RangeError: Maximum call
     *    stack size exceeded` —— 本目录的 form-item（`dataOptions.children.$ref`）与
     *    table-column（`groups.items.$ref`）都是**递归 schema**，一份深到几千层的
     *    配置就能触发（`createSchemaValidator` 也向调用方开放了自定义目录）。
     *
     * `validateConfig` 被 CLI `validate` 与 MCP `validate_config` 直接调用，抛异常会
     * 变成工具崩溃而不是一条校验结果；统一降级成 `valid:false` + 可读原因。
     */
    let validate
    let rawErrors: any[] = []
    try {
      const cached = schemaObj.$id ? ajv.getSchema(schemaObj.$id as string) : undefined
      validate = cached || ajv.compile(schema)

      if (validate(config)) {
        return { valid: true, errors: [], suggestions: [] }
      }
      rawErrors = validate.errors || []
    } catch (err) {
      return {
        valid: false,
        errors: [`Schema "${schemaName}" could not be applied: ${(err as Error).message}`],
        suggestions: ['Check the schema for unresolvable $ref or invalid constructs'],
      }
    }

    const errors = rawErrors.map((err) => {
      const path = err.instancePath || "(root)"
      return `${path}: ${err.message}`
    })

    const suggestions = generateSuggestions(rawErrors)
    return { valid: false, errors, suggestions }
  }

  function listAvailableSchemas(): string[] {
    ensureSchemasLoaded()
    return availableNames
  }

  return { validateConfig, listAvailableSchemas }
}

function generateSuggestions(errors: any[]): string[] {
  const suggestions: string[] = []

  for (const err of errors) {
    if (err.keyword === "required") {
      suggestions.push(`Add missing property "${err.params.missingProperty}"`)
    }
    if (err.keyword === "enum") {
      suggestions.push(
        `Valid values for ${err.instancePath}: ${err.params.allowedValues?.join(", ")}`
      )
    }
    if (err.keyword === "type") {
      suggestions.push(`${err.instancePath} should be type "${err.params.type}"`)
    }
    if (err.keyword === "additionalProperties") {
      suggestions.push(`Remove unknown property "${err.params.additionalProperty}"`)
    }
    // `anyOf` 的默认措辞是 "must match a schema in anyOf" —— 对使用者等于什么都没说。
    // Ajv 开了 `verbose: true`，错误里会带上失败的 branch（`err.schema` 就是 anyOf 数组），
    // 于是可以把「至少要满足哪些形态」直接列出来（如 table-column 的
    // "(root) must satisfy at least one of: prop | key | type | groups"）。
    //
    // 只在**每个 branch 都恰好是 `{ required: [...] }`** 时做这种归纳：branch 里若还夹着
    // 别的约束，列成 "prop | key" 会让人以为只要写上键名就行，比不归纳更误导。
    if (err.keyword === "anyOf" || err.keyword === "oneOf") {
      const branches = Array.isArray(err.schema) ? err.schema : []
      const pureRequired =
        branches.length > 0 &&
        branches.every(
          (b: any) =>
            b && typeof b === "object" && Array.isArray(b.required) && Object.keys(b).length === 1
        )
      if (pureRequired) {
        const forms = branches.map((b: any) => b.required.join(" + "))
        suggestions.push(
          `${err.instancePath || "(root)"} must satisfy at least one of: ${forms.join(" | ")}`
        )
      } else {
        suggestions.push(`${err.instancePath || "(root)"} does not match any allowed shape`)
      }
    }
  }

  return suggestions
}

const defaultValidator = createSchemaValidator()
export const validateConfig = defaultValidator.validateConfig
export const listAvailableSchemas = defaultValidator.listAvailableSchemas
