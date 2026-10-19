/**
 * 入口可达性共享库（AI-24 → AI-25 抽出）
 *
 * 背景：es-plus 的 AI 生成有三个入口，**表达力不等** ——
 *   - `generate_crud_from_config`：完整 typed config（能到 schema 的一切）；
 *   - `generate_crud`（前门）：只填一张 surfaces 意图表 + 若干标量键；
 *   - fragments（generate_form/table/dialog）：精简 surfaceFieldSchema，SFC-only。
 *
 * 本文件抽出两处守卫（`check-entry-contract.mjs` / `check-feature-coverage.mjs`）共享的
 * **源码解析原语**（`stripComments`/`sliceBlock`/`topLevelKeys`）、**三个注册表**
 * （`FRONT_DOOR_ONLY` / `FRONT_DOOR_UNREACHABLE` / `SURFACE_FIELD_UNREACHABLE`）与
 * **实时键集抽取**（`readReachability`）。单一真源，避免两处守卫对「前门够不到什么」
 * 各自维护一份而漂移 —— AI-25 守卫断言⑤正建立在这份单一注册表之上。
 *
 * 用法：`import { readReachability, FRONT_DOOR_UNREACHABLE } from './lib/entry-keys.mjs'`
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

/**
 * 读仓库根为基准的 UTF-8 文本，并把 CRLF 归一化为 LF。
 *
 * 为什么必须归一化：Windows 工作区里这些源码是 CRLF，而 AI-26/AI-32 的切片用
 * `'  dialogs: z\n    .record('` 这类**跨行字面量**当起点标记（单行 closeLine 恰好
 * 免疫 —— `\r\n})` 里含 `\n})`）。不归一化则跨行标记在 CRLF 下必然定位失败，
 * 守卫会报「选择器失效」，与源码内容无关，纯属假红。
 */
export const read = (p) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n?/g, '\n')

export const FRONT_DOOR_SRC = 'packages/mcp-server/src/tools/generate-crud.ts'
export const FROM_CONFIG_SRC = 'packages/mcp-server/src/tools/generate-from-config.ts'
export const SCHEMA_SRC = 'packages/shared/src/structured-config.schema.ts'
export const COMPOSE_SRC = 'packages/shared/src/compose-crud-config.ts'
export const GENERATOR_SRC = 'packages/shared/src/structured-generator.ts'
export const CORE_TYPES_SRC = 'packages/core/src/types.ts'
export const FRAGMENT_SHAPES_SRC = 'packages/mcp-server/src/tools/_fragment-shapes.ts'

/**
 * 三个独立场景工具（Wave 4）的 Zod 入参形状 —— `readReachability` 的泛化对象。
 *
 * 为什么必须逐个登记：`generate_table` / `generate_form` / `generate_dialog` 是
 * **独立工具形状**，与 `crudShape` 完全不同。只切 `crudShape` 的守卫看不见它们；
 * 于是给片段工具加一个 schema 不认识的键 = **新开一条无守卫入口**（LLM 以为填了、
 * 生成器收不到）。本表把「所有生成工具形状」变成可遍历集合。
 */
export const FRAGMENT_TOOL_SRC = {
  table: {
    file: 'packages/mcp-server/src/tools/generate-table.ts',
    start: 'export const tableShape = {',
    label: 'generate-table.ts tableShape',
  },
  form: {
    file: 'packages/mcp-server/src/tools/generate-form.ts',
    start: 'export const formShape = {',
    label: 'generate-form.ts formShape',
  },
  dialog: {
    file: 'packages/mcp-server/src/tools/generate-dialog.ts',
    start: 'export const dialogShape = {',
    label: 'generate-dialog.ts dialogShape',
  },
}

/**
 * 片段工具顶层键里**不是**权威 schema 顶层键的合法例外（片段独有语义）——
 * 每键必须写明原因，空原因会红。与 `FRONT_DOOR_ONLY` 同纪律：**只减不增**，
 * 工具不再接收某键时删行（删漏 → 守卫的陈旧检查红）。
 */
export const FRAGMENT_TOOL_ONLY = {
  rowButtons:
    '独立表格的操作列按钮（事件上抛）。权威 schema 的按钮面是 actions/operationColumn（派生式），片段刻意只发 triggerEvent 事件，无对应顶层入参',
  context: "独立表单的 span 口径（query/form）；CRUD 页由字段落在哪个面派生，无同名顶层键",
  buttons: '独立表单的底部按钮罐头（none/query/submit）；CRUD 页对应 toolbarBtns，形态不同',
  rowkey: '独立弹窗 PUT 的主键参数（拼 `${apiUrl}/${formData[rowkey]}`）；schema 侧主键走 tableOptions.rowkey',
  composableName: '独立弹窗的导出函数名（片段独有，schema 侧整页生成无此概念）',
  defaultTitle: "open() 的缺省标题（AI-36）。schema 侧弹窗标题走 dialogs[k].title（声明式），语义不同",
  options:
    '独立弹窗的底座选项（DialogBlockOptions = core DialogOptions 的声明式子集）；schema 侧逐键平铺在 dialogs[k] 上，不叫 options',
}
/** MCP resource `esplus://schemas/dialog-options` 实际服务的那一份（`resources/schemas.ts` 的 SCHEMAS_DIR）。 */
export const DIALOG_OPTIONS_JSON_SRC = 'packages/mcp-server/schemas/dialog-options.schema.json'
/**
 * 三端 crud-page 的运行时契约 `CrudDialogConfig`。三份是**手写副本**，形态一致但可漂移
 * （AI-26 差集①正建立在此之上：运行时 13 键 vs AI 面 9 键，经 AI 入口传入的多余键被 Zod 静默剥掉）。
 */
export const CRUD_DIALOG_TYPES_SRC = {
  vue3: 'packages/vue3/src/components/es-crud-page/src/types.ts',
  vue2: 'packages/vue2/src/components/es-crud-page/types.ts',
  antdv: 'packages/adapter-antdv/src/components/es-crud-page/src/types.ts',
}

export const fail = (msg) => {
  console.error(`❌ ${msg}`)
  return false
}

/**
 * 前门 `crudShape` 顶层键里**不**是 schema 顶层键的合法例外（前门独有语义）——
 * 每键必须写明原因，空原因会红。
 */
export const FRONT_DOOR_ONLY = {
  surfaces: '前门的意图表本身（query/table/form 字段列表 + dialog 罐头键），schema 侧不叫这个名字',
  rowkey: '前门仅用于无表片段（useDialog 的 rowkey 参数），schema 侧主键走 tableOptions.rowkey',
}

/**
 * schema 顶层键里**前门够不到**的键，必须显式登记（每键写明原因）。
 * AI-21/22/23 每让前门多到一个键，就删掉对应一行 —— 这张表是「缺口清单」，应只减不增。
 *
 * AI-25 耦合：`feature-coverage.data.mjs` 的 B 档令牌以 `via:'FRONT_DOOR_UNREACHABLE:<k>'`
 * 指到本表。若本表某键消失（前门扩宽到它），对应 B 档令牌**立刻变红**、强制重新分类。
 */
export const FRONT_DOOR_UNREACHABLE = {
  fields: '由 surfaces 的字段列表经 composeCrudConfig 派生，schema 侧是派生结果、无对应入参',
  dialogs: '由 surfaces.dialog 合成（罐头键 "add|edit|view" 或全参对象 {key,title,width,fullscreen,formItems} —— AI-21④ 已放宽）；schema 侧无同名顶层入参',
  columns: '**刻意不可达**（用户拍板）：Tier-3 逃生数组，留 generate_crud_from_config，前门不收',
}

/**
 * 权威 `FieldConfig` 里**入口词汇够不到**的字段级键，每键写明原因。
 * AI-22 给 FieldConfig 加 `labelKey` 却没提进 `SurfaceField` 时，此表**不存在**、无人可见；
 * AI-21③ 已经把它提进词汇并落地本表 —— 此后 FieldConfig 每加一个字段级键，要么提进
 * SurfaceField，要么登记在此，二者皆无 → 红。
 */
export const SURFACE_FIELD_UNREACHABLE = {
  inQuery: '面成员标志：由 surfaces 的字段落在哪张列表经 composeCrudConfig 派生，不做逐字段入参',
  inTable: '面成员标志：同上（字段进 surfaces.table 即 inTable）',
  inForm: '面成员标志：同上（字段进 surfaces.form 即 inForm）',
}

/**
 * 剥掉行注释与块注释（与 check-schema-contract.mjs 同一实现）。
 *
 * 必须**单趟从左到右**：先跑块注释正则再跑行注释正则会吞掉 `// … @es-plus/* BtnConfig …`
 * 这类行注释里含块注释起始符的文本。`//` 的判定排除前置冒号，避免吃掉 `https://…`。
 */
export function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      if (end === -1) break
      i = end + 2
      continue
    }
    if (two === '//' && src[i - 1] !== ':') {
      const end = src.indexOf('\n', i)
      if (end === -1) break
      out += '\n'
      i = end + 1
      continue
    }
    out += src[i]
    i++
  }
  return out
}

/** 从 `startMarker` 到首个列 0 的 `closeLine` 之间的块（含起始换行）。找不到返回 null。 */
export function sliceBlock(src, startMarker, closeLine, label) {
  const i = src.indexOf(startMarker)
  if (i === -1) {
    fail(`未能在 ${label} 定位 ${JSON.stringify(startMarker)}`)
    return null
  }
  const rest = src.slice(i + startMarker.length)
  const needle = '\n' + closeLine
  const end = rest.indexOf(needle)
  if (end === -1) {
    fail(`未能在 ${label} 定位块结束符 ${JSON.stringify(closeLine)}（选择器失效，请检查脚本）`)
    return null
  }
  return rest.slice(0, end)
}

/**
 * 收集缩进 `indent` 空格的顶层键（zod 对象属性 `key:` / 接口属性 `key?:`）。
 * 默认 2 空格（schema 顶层 / crudShape / SurfaceField / FieldConfig）；
 * 嵌套块（如 `tableOptions`）传 4。
 */
export function topLevelKeys(block, indent = 2) {
  const keys = []
  const re = new RegExp(`^ {${indent}}([A-Za-z_$][\\w$]*)\\??\\s*:`, 'gm')
  for (const m of block.matchAll(re)) keys.push(m[1])
  return keys
}

/**
 * `sliceBlock` + `topLevelKeys` 的组合：切出块并取该缩进层的键。
 * 定位失败 → 打印 ❌ 并返回 `null`（调用方须 `process.exit(1)`，不静默放行）。
 */
export function keysInBlock(src, startMarker, closeLine, indent, label) {
  const block = sliceBlock(src, startMarker, closeLine, label)
  return block === null ? null : topLevelKeys(block, indent)
}

/** mcp 内联 AI Zod 的 `dialogs` 记录块起点（`z.record(z.string(), z.object({ … }))`，成员缩进 8）。 */
const MCP_DIALOGS_MARKER = '  dialogs: z\n    .record(\n      z.string(),\n      z.object({'

/**
 * `DIALOG_KEY_UNREACHABLE` —— 运行时 `CrudDialogConfig` 消费、但 AI 面（两处 AI Zod 的
 * `DialogConfigSchema`）够不到的键，**逐行**写明原因与档位。
 *
 * 与 `FRONT_DOOR_UNREACHABLE` / `SURFACE_FIELD_UNREACHABLE` 同一范式：这张表是**缺口清单**，
 * 应**只减不增**。AI-27 每把一个键收进 AI 契约，就删掉对应一行；删漏 → 断言③ 红
 * （反向陈旧检查：登记行若已出现在 AI 键集里即为陈旧）。
 *
 * 档位沿用 AI 可达性台账的 4 档（A 前门声明式 / B from_config / C 逃生舱·函数值 / D 非 AI 目标）：
 *   - `render`（C）：函数源码串，**AI-27 源码复核后不收**（两模式都没有注入点，详见行内 reason）；
 *   - `onOpen`/`onConfirm`/`onClose`（C）：函数值，承载业务编排（宿主编排，D-档精神），
 *     AI-27 **明确不收**（`onConfirm` 的正确路径是 `dialogKey` + `actionType` 事件外抛）。
 *
 * AI-27 已收编 `configBtn`（声明式子集 name/type/action/permissionValue）与 8 个底座数据键
 * （`showClose`/`destroyOnClose`/`modal`/`closeOnClickModal`/`closeOnPressEscape`/`hiddenFullBtn`/
 * `appendTo`/`cacheKey`）—— 按「只减不增」纪律，`configBtn` 那行**已删除**。
 */
export const DIALOG_KEY_UNREACHABLE = {
  render: {
    tier: 'C',
    reason:
      '自定义弹窗主体 = 函数源码串（Tier-3 永久逃生舱）。**AI-27 源码复核后的裁决：本轮不收**（与计划字面不同）。' +
      '计划原设想「像字段级那样：sfc 模式真内联源码串、schema 模式留占位槽」，但实测该前提不成立 ——' +
      '（a）SFC 模式的生成器**整体不消费** `config.dialogs`（`ignoredInSfc` 里逐字告警，见 SFC_DEGRADATIONS.dialogs），' +
      '故 sfc 模式没有逐弹窗的注入点；（b）schema 模式的产物是纯数据，载不动函数，' +
      '且 `es-crud-page` 模板**没有 per-dialog 插槽机制**（字段级还有 `scopedSlots.customRender` 这个占位槽，dialog 连它都没有）。' +
      '两条路都不通 ⟹ 收进 AI Zod 只会造出一个「声明了、但生成器两模式都不发射、运行时也拿不到」的幽灵键，' +
      '与本轮（AI-34 三向扫描）要消灭的形状一模一样。真正的自定义主体走已有的 `hasCustomRender: true` 声明 + 宿主在 wrapper SFC 里手写。' +
      '（计划自己也把「新增把函数 merge 回 pageSchema.dialogs[key].render 的真注入机制」列为另议。）',
  },
  onOpen: { tier: 'C', reason: '打开回调 = 函数值（宿主侧副作用），属宿主编排，AI 契约不收' },
  onConfirm: { tier: 'C', reason: '确认回调 = 函数值（业务编排）；正确路径是 dialogKey + actionType 事件外抛，非塞进 AI 配置' },
  onClose: { tier: 'C', reason: '关闭回调 = 函数值（宿主侧副作用），属宿主编排，AI 契约不收' },
}

/** 三端 crud-page 运行时源码 —— AI-27 的 `openDialog` 白名单所在（AI-35 也用它钉工具栏门）。 */
export const CRUD_DIALOG_PASSTHROUGH_SRC = {
  vue3: 'packages/vue3/src/components/es-crud-page/src/es-crud-page.vue',
  vue2: 'packages/vue2/src/components/es-crud-page/es-crud-page.vue',
  antdv: 'packages/adapter-antdv/src/components/es-crud-page/src/es-crud-page.vue',
}

/**
 * 读取三端 `openDialog` 的弹窗底座键**显式白名单**（AI-27）。
 *
 * 为什么必须由守卫读它：`openDialog` 是 AI 配置到弹窗组件的**最后一道闸门** ——
 * AI Zod 放行了某个键、生成器也发射了它，若白名单里没有，运行时照样静默丢弃
 * （AI-27 前的实况：硬编码 9 键转发、不 spread）。三端各有一份手写数组，
 * 守卫断言「三份互相等价」且「等于 AI 契约里逐键转发的子集」。
 *
 * 任一端定位失败 → `❌` + `null`（调用方 `exit 1`，不静默放行）。
 */
export function readDialogPassthrough() {
  const perEnd = {}
  for (const [end, file] of Object.entries(CRUD_DIALOG_PASSTHROUGH_SRC)) {
    const src = stripComments(read(file))
    const m = src.match(/const DIALOG_PASSTHROUGH_KEYS = \[([\s\S]*?)\]/)
    if (!m) {
      fail(`未能在 ${end} 端的 crud-page 里定位 const DIALOG_PASSTHROUGH_KEYS = [ … ]（选择器失效，请检查脚本）`)
      return null
    }
    perEnd[end] = [...m[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)].map((x) => x[1])
  }
  return { perEnd, keys: perEnd.vue3 }
}

/**
 * `DIALOG_OPTIONS_JSON_ONLY` —— `dialog-options.schema.json`（MCP resource
 * `esplus://schemas/dialog-options` 与 CLI `validate.ts` 消费的 legacy JSON 单源）声明、
 * 但 core `DialogOptions` **未命名**的键。AI-26 差集②。
 *
 * 背景：core `DialogOptions` 带 `[key: string]: unknown` 索引签名，是**刻意开键**的类型；
 * 故本表不是「错误清单」而是**裁决清单**——每个键必须给出的不是「为什么存在」，而是
 * 「它该留在 JSON、提进 core、还是删掉」。`verdict` 四值：
 *   - `promote-core`：三端运行时真消费，却被 core 漏命名 → 提为 core 命名键；
 *   - `legacy-alias`：旧写法，语义已被某个 core 命名键取代 → 归一化后降级为别名或删除；
 *   - `end-specific`：单端真实 prop（其余端无对应物）→ 按 `check-type-exports.mjs` 的
 *     既有「有意偏差」范式登记，不去硬凑另一端；
 *   - `dead`：全仓零消费者 → 删。
 * 与 `DIALOG_KEY_UNREACHABLE` 同纪律：**只减不增**，裁决落地后删行（判据见守卫）。
 */
export const DIALOG_OPTIONS_JSON_ONLY = {
  height: {
    verdict: 'legacy-alias',
    reason: '三端 es-dialog 的 height 是**自算样式**（viewH）而非 prop，JSON 的 height 零消费者；语义被 core `maxHeight` 覆盖 → 陈旧键，AI-28 裁决删除或改名',
  },
  key: {
    verdict: 'legacy-alias',
    reason: '旧写法，意图指向 core `cacheKey`（useDialog 实例缓存键）；es-dialog 里的 key 命中均为 `:key` 循环/局部变量 → 归一化后降级为别名',
  },
  center: {
    verdict: 'legacy-alias',
    reason: '旧写法，意图指向 core `alignCenter`（antdv es-dialog 的真实 prop/default）；三端 es-dialog 均不读 center → 待 AI-27/28 归一化',
  },
  customClass: {
    verdict: 'end-specific',
    reason: '仅 vue2 出现，且是以「透传白名单外会被静默丢弃」的反面教材被提及（vue2/.../use-dialog.ts）；三端无等价物 → 按有意偏差范式登记，不硬凑',
  },
  appendToBody: {
    verdict: 'end-specific',
    reason: 'vue2 es-dialog 真实 prop（Element UI `append-to-body`，component.vue:129）；vue3/antdv 由 core `appendTo` 承载 → 端特化',
  },
  lockScroll: {
    verdict: 'dead',
    reason: '全仓（packages/*/src + scripts）零消费者 → 死键，AI-28 裁决删除',
  },
  onlyInstance: {
    verdict: 'promote-core',
    reason: '三端 use-dialog 真实选项（实例复用开关），非 es-dialog prop；core 类型漏命名 → 提为 core 命名键',
  },
  showDefaultButtons: {
    verdict: 'dead',
    reason: '全仓零消费者 → 死键，AI-28 裁决删除',
  },
  onOpen: {
    verdict: 'legacy-alias',
    reason: '属 CrudDialogConfig（crud-page 弹窗打开回调），被误收进 dialog-options（es-dialog 无此 prop）→ AI-27 只保留在 crud 面，本处删除',
  },
}

/**
 * 抽取「入口可达性」的实时键集（供多条守卫复用）：
 *   - `frontKeys`：前门 `crudShape` 顶层键；
 *   - `schemaKeys`：`StructuredCrudConfigSchema` 顶层键；
 *   - `sfKeys`：`SurfaceField` 字段词汇；
 *   - `fcKeys`：`FieldConfig` 权威字段词汇；
 *   - `tableOptionsKeys`：AI Zod 的 `tableOptions` 嵌套键（缩进 4）；
 *   - `formLayoutKeys` / `paginationKeys`：权威 schema 的同名嵌套块；
 *   - `fragmentShapes`：三个独立工具的顶层键（table/form/dialog，Wave 4 泛化）；
 *   - `fragmentTableOptionsKeys` / `fragmentFormLayoutKeys` / `fragmentPaginationKeys`：
 *     片段工具镜像的容器级键（zod3，`_fragment-shapes.ts`）。
 *
 * 任一定位失败（选择器失效）→ 打印 ❌ 并返回 `null`，调用方须 `process.exit(1)` 拒绝静默放行。
 */
export function readReachability() {
  const schemaSrc = stripComments(read(SCHEMA_SRC))
  const frontSrc = stripComments(read(FRONT_DOOR_SRC))
  const composeSrc = stripComments(read(COMPOSE_SRC))
  const fromCfgSrc = stripComments(read(FROM_CONFIG_SRC))
  const fragmentShapesSrc = stripComments(read(FRAGMENT_SHAPES_SRC))

  const crudBlock = sliceBlock(frontSrc, 'const crudShape = {', '} as const', 'generate-crud.ts crudShape')
  const schemaBlock = sliceBlock(
    schemaSrc,
    'export const StructuredCrudConfigSchema = z.object({',
    '})',
    'structured-config.schema.ts StructuredCrudConfigSchema'
  )
  const sfBlock = sliceBlock(composeSrc, 'export interface SurfaceField {', '}', 'compose-crud-config.ts SurfaceField')
  const fcBlock = sliceBlock(schemaSrc, 'const FieldConfigSchema = z.object({', '})', 'structured-config.schema.ts FieldConfigSchema')
  const tableBlock = sliceBlock(
    schemaSrc,
    '  tableOptions: z.object({',
    '  }).optional(),',
    'structured-config.schema.ts tableOptions'
  )
  // 顶层 `formLayout` 与 `DialogConfigSchema` 里的同名块**缩进相同**（都是 2），
  // indexOf 会先命中 dialog 那个；顶层块在文件中更靠后，故用 lastIndexOf 定位。
  const flIdx = schemaSrc.lastIndexOf('  formLayout: z.object({')
  const formLayoutBlock =
    flIdx === -1
      ? null
      : sliceBlock(
          schemaSrc.slice(flIdx),
          '  formLayout: z.object({',
          "  }).optional().describe('Query form layout config'),",
          'structured-config.schema.ts formLayout'
        )
  const paginationBlock = sliceBlock(
    schemaSrc,
    '  pagination: z.object({',
    '  }).optional(),',
    'structured-config.schema.ts pagination'
  )
  // AI-32①：mcp 内联副本的顶层键（`configShape`，直接作为 `server.tool` 的 zod3 raw shape）。
  const configShapeBlock = sliceBlock(
    fromCfgSrc,
    'const configShape = {',
    '} as const;',
    'generate-from-config.ts configShape'
  )
  // AI-32②：下潜 `dialogs` —— 与 AI-26 的 `aiDialogKeys` 共用同一 reader，避免两处各切一份。
  const dialogBlock = sliceBlock(
    schemaSrc,
    'const DialogConfigSchema = z.object({',
    '})',
    'structured-config.schema.ts DialogConfigSchema'
  )

  // Wave 4：三个独立工具的顶层形状（泛化 —— 不再只切 crudShape）+ 容器级 zod3 镜像。
  const fragmentShapes = {}
  for (const [name, def] of Object.entries(FRAGMENT_TOOL_SRC)) {
    const src = stripComments(read(def.file))
    const block = sliceBlock(src, def.start, '} as const', def.label)
    if (block === null) return null
    fragmentShapes[name] = topLevelKeys(block)
  }
  const fragmentTableOptionsBlock = sliceBlock(
    fragmentShapesSrc,
    'export const tableBlockOptionsSchema = z.object({',
    '});',
    '_fragment-shapes.ts tableBlockOptionsSchema'
  )
  const fragmentFormLayoutBlock = sliceBlock(
    fragmentShapesSrc,
    'export const formLayoutSchema = z.object({',
    '});',
    '_fragment-shapes.ts formLayoutSchema'
  )
  const fragmentPaginationBlock = sliceBlock(
    fragmentShapesSrc,
    'export const tablePaginationSchema = z.object({',
    '});',
    '_fragment-shapes.ts tablePaginationSchema'
  )

  if (
    crudBlock === null ||
    schemaBlock === null ||
    sfBlock === null ||
    fcBlock === null ||
    tableBlock === null ||
    formLayoutBlock === null ||
    paginationBlock === null ||
    configShapeBlock === null ||
    dialogBlock === null ||
    fragmentTableOptionsBlock === null ||
    fragmentFormLayoutBlock === null ||
    fragmentPaginationBlock === null
  ) {
    return null
  }

  return {
    frontKeys: topLevelKeys(crudBlock),
    schemaKeys: topLevelKeys(schemaBlock),
    sfKeys: topLevelKeys(sfBlock),
    fcKeys: topLevelKeys(fcBlock),
    tableOptionsKeys: topLevelKeys(tableBlock, 4),
    formLayoutKeys: topLevelKeys(formLayoutBlock, 4),
    paginationKeys: topLevelKeys(paginationBlock, 4),
    configShapeKeys: topLevelKeys(configShapeBlock),
    dialogKeys: topLevelKeys(dialogBlock),
    fragmentShapes,
    fragmentTableOptionsKeys: topLevelKeys(fragmentTableOptionsBlock),
    fragmentFormLayoutKeys: topLevelKeys(fragmentFormLayoutBlock),
    fragmentPaginationKeys: topLevelKeys(fragmentPaginationBlock),
  }
}

/**
 * dialog 契约的三份/多份词汇抽取（AI-26）。
 *
 * 差集①：三端运行时 `CrudDialogConfig`（**手写三副本**，取**交集**为权威运行时契约）
 *        vs 两处 AI Zod 的 `DialogConfigSchema`（shared zod4 + mcp 内联 zod3，**手写双副本**）
 *        vs 生成器 `structured-generator.ts` **实际发射**的 dialog 键。
 * 差集②：core `DialogOptions` / MCP resource `dialog-options.schema.json` / AI Zod 三套词汇漂移。
 *
 * 单一真源：本函数是 AI-26 守卫与 AI-32② 的**唯一** dialog 词汇抽取点。
 * 任一定位失败 → `❌` + `null`（调用方 `exit 1`）。
 */
export function readDialogContract() {
  const schemaSrc = stripComments(read(SCHEMA_SRC))
  const fromCfgSrc = stripComments(read(FROM_CONFIG_SRC))
  const genSrc = stripComments(read(GENERATOR_SRC))

  // (a) 运行时：三端逐端取键，交集为权威；端独有键单独留存（供守卫报告端间漂移）。
  const perEnd = {}
  for (const [end, file] of Object.entries(CRUD_DIALOG_TYPES_SRC)) {
    const keys = keysInBlock(
      stripComments(read(file)),
      'export interface CrudDialogConfig {',
      '}',
      2,
      `CrudDialogConfig (${end})`
    )
    if (keys === null) return null
    perEnd[end] = keys
  }
  const ends = Object.keys(perEnd)
  const runtimeDialogKeys = perEnd[ends[0]].filter((k) => ends.every((e) => perEnd[e].includes(k)))
  const runtimeDialogEndOnly = {}
  for (const e of ends) {
    runtimeDialogEndOnly[e] = perEnd[e].filter((k) => !runtimeDialogKeys.includes(k))
  }

  // (b) AI 面：两处手写副本各自取键（守卫断言两副本逐键一致 —— 漂移即静默剥离）。
  const sharedDialogKeys = keysInBlock(
    schemaSrc,
    'const DialogConfigSchema = z.object({',
    '})',
    2,
    'shared DialogConfigSchema'
  )
  const mcpDialogKeys = keysInBlock(fromCfgSrc, MCP_DIALOGS_MARKER, '      })', 8, 'mcp 内联 dialogs')
  if (sharedDialogKeys === null || mcpDialogKeys === null) return null

  // (c) 生成器发射：schema 分支逐键 `dialogSchema.KEY = …`（SFC 分支只发注释、不发键）。
  //     用「赋值的键」而非「对象字面量的键」是因为该块是命令式赋值（`const dialogSchema: Record<…> = {}`）。
  const generatorDialogKeys = [
    ...new Set([...genSrc.matchAll(/\bdialogSchema\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])),
  ]

  return {
    perEnd,
    runtimeDialogEndOnly,
    runtimeDialogKeys,
    sharedDialogKeys,
    mcpDialogKeys,
    generatorDialogKeys,
  }
}

/**
 * 生成器**发射**的 schema 顶层键（AI-29 B 档「第二腿」：声称 from_config 可达 → 必须
 * 同时证明 Zod 声明了它、且生成器真发射它）。
 *
 * 生成器是命令式构造：`const schema: Record<string, unknown> = {}` 之后逐键 `schema.KEY = …`。
 * 故取「赋值的顶层键」。注意 `name`/`fields`/`target`/`mode`/`typescript`/`permissions`/`i18n`
 * 等是**生成控制键**（驱动生成，不进产物 schema），不在本集合内 —— AI-34 的三向扫描需要
 * 单独为它们立「控制键白名单」，勿在此处混入。
 */
export function readGeneratorEmission() {
  const genSrc = stripComments(read(GENERATOR_SRC))
  return {
    schemaEmittedKeys: [
      ...new Set([...genSrc.matchAll(/\bschema\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])),
    ],
  }
}

/** 读 MCP resource 服务的 `dialog-options.schema.json`（差集②的 legacy JSON 一侧）。 */
export function readDialogOptionsJsonKeys() {
  const src = read(DIALOG_OPTIONS_JSON_SRC)
  let json
  try {
    json = JSON.parse(src)
  } catch (e) {
    fail(`无法解析 ${DIALOG_OPTIONS_JSON_SRC}：${e.message}`)
    return null
  }
  return Object.keys(json.properties || {})
}

/**
 * 读 core 运行时权威 `DialogOptions` 的顶层键（差集②的 core 一侧）。
 * 索引签名 `[key: string]: unknown` 不以标识符开头，`topLevelKeys` 天然排除。
 */
export function readCoreDialogOptionsKeys() {
  return keysInBlock(stripComments(read(CORE_TYPES_SRC)), 'export interface DialogOptions {', '}', 2, 'core DialogOptions')
}
