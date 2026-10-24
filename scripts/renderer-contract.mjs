/**
 * 三端 formtype → 渲染组件 的**行为层契约**（单源）
 *
 * check-renderer-parity.mjs 用它把「键集一致」升级为「键指向的组件语义一致」：
 * 每个 formtype 在每个渲染器里必须真的绑到声明中的组件（或已登记的降级实现），
 * 从而挡住「键还在、但实现被换成别的控件」这类现有门禁抓不到的分叉
 * （例如把 `'DatePicker': ElDatePicker` 误改成 `'TimePicker'`）。
 *
 * token 形态：
 *   - 标识符（如 `ElInput` / `InputComp`）按单词边界匹配
 *   - 含 `-` 或原生标签名（如 `el-input` / `input`）按带引号字符串匹配
 *   - antdv 的 DatePicker/TimePicker 经渲染函数间接实现，token 声明为函数名
 *
 * deviation：该端为有意的降级/差异实现，必须写明原因（文档化强制）。
 */
export const FORM_RENDER_CONTRACT = {
  Input: { vue3: ['ElInput'], vue2: ['el-input'], antdv: ['InputComp', 'Input'] },
  InputNumber: { vue3: ['ElInputNumber'], vue2: ['el-input-number'], antdv: ['InputNumber'] },
  Select: { vue3: ['ElSelect'], vue2: ['el-select'], antdv: ['Select'] },
  DatePicker: { vue3: ['ElDatePicker'], vue2: ['el-date-picker'], antdv: ['renderDatePicker'] },
  TimePicker: { vue3: ['ElTimePicker'], vue2: ['el-time-picker'], antdv: ['renderTimePicker'] },
  Slider: { vue3: ['ElSlider'], vue2: ['el-slider'], antdv: ['Slider'] },
  ColorPicker: {
    vue3: ['ElColorPicker'],
    vue2: ['el-color-picker'],
    antdv: ['input'],
    deviation: {
      antdv: 'Ant Design Vue 无 ColorPicker，降级为原生 <input type="color">（丢失 alpha/predefine/history，且不触发 a-form-item 校验）',
    },
  },
  Transfer: { vue3: ['ElTransfer'], vue2: ['el-transfer'], antdv: ['Transfer'] },
  Cascader: { vue3: ['ElCascader'], vue2: ['el-cascader'], antdv: ['Cascader'] },
  Radio: { vue3: ['ElRadioGroup'], vue2: ['el-radio-group'], antdv: ['RadioGroup'] },
  Checkbox: { vue3: ['ElCheckboxGroup'], vue2: ['el-checkbox-group'], antdv: ['CheckboxGroup'] },
  Switch: { vue3: ['ElSwitch'], vue2: ['el-switch'], antdv: ['Switch'] },
  Rate: { vue3: ['ElRate'], vue2: ['el-rate'], antdv: ['Rate'] },
  Upload: { vue3: ['ElUpload'], vue2: ['el-upload'], antdv: ['Upload'] },
}

/**
 * 三端组件的**对外事件**契约（单源，W2.3 / F5 + F7）
 *
 * 判据是「声明 ⇄ 存在」：
 *   - 一端声明了、另一端没声明 → 同一份宿主代码在两端一静默一触发（跨端分叉）；
 *   - 声明了却**没有任何 emit 调用点** → 宿主写 `@confirm` 得到静默 ——
 *     这正是 `禁止声明了等于承诺不存在的能力` 的最隐蔽形态（编译过、类型对、零报错）。
 *
 * 投递方式有两种，`expected` 是两者的并集（对外能力清单）：
 *   1. **组件 emit**：声明进 emits 并真有调用点；
 *   2. **原生透传**：内层表格的原生事件经 attrs / `$listeners` 直接送到宿主，组件自身
 *      不 emit（若再 emit 一次就是双触发）。这类事件必须用 `forwarded` 登记，并逐引擎
 *      证明投递链路仍在 —— 只写「豁免」而不证明，守卫会从「查幻影 API」退化成
 *      「永久谎言」（该教训已在 check-site-api-drift 的 FORWARDED_EVENTS 上吃过一次）。
 *
 * 形态：`{ [component]: { sources, expected, deviation?, forwarded?, why? } }`
 *   - `expected`：三端应当一致对外提供的事件全集（**权威清单**，不靠从源码反推 ——
 *     否则三端一起漂移时守卫会跟着漂）。
 *   - `deviation[renderer] = { keys: [...], reason }`：该端**有意缺席**的事件；
 *     `keys` 必须真的缺席（补上后要删登记 —— 只减不增），`reason` 非空。
 *   - `forwarded[renderer][event] = { reason, paths: [...] }`：该端**由内层组件透传**、
 *     emit 声明里刻意没有的事件。每个 `path` 钉在一个引擎上：
 *     `{ engine, anchor, anchorTokens, sourceTokens? }` —— `anchor` 是引擎开标签前缀，
 *     开标签切片内必须出现全部 `anchorTokens`（防止 vue2 两个引擎共用 token、删掉一个还绿）；
 *     `sourceTokens` 在全文出现即可（用于桥接函数等不在开标签里的证据）。
 *   - 每个实际声明的事件都必须在**同一文件**里至少有一个 `emit('name'` 调用点
 *     （`stripComments` 之后匹配，注释里写 `emit('x')` 不算数）；透传事件反过来：
 *     已登记为 forwarded 的端**不得**再声明它（投递方式互斥，二选一）。
 *
 * 已裁决的偏差：
 *   - es-form `confirm`/`reset`：vue3/antdv 曾声明并定义却零调用点，vue2 连声明都没有。
 *     正确方向是**删除**（查询/重置由 triggerEvent 在内部联动表格，antdv 头注早已写明），
 *     而不是在三端补一套新的向外事件。
 *   - es-table `update:dataSource`：vue2 引擎**有意移除**回传（组件注释自述），
 *     故 vue2 不声明；片段/SFC/legacy 生成器的 vue2 分支也不得发 `.sync`（F7）。
 */
export const EMIT_CONTRACT = {
  'es-form': {
    sources: {
      vue3: 'packages/vue3/src/components/es-form/src/es-form.vue',
      vue2: 'packages/vue2/src/components/es-form/es-form.vue',
      antdv: 'packages/adapter-antdv/src/components/es-form/src/es-form.vue',
    },
    expected: [],
    why: 'es-form 的查询/重置在内部联动 es-table（triggerEvent），不向外派发事件。',
  },
  'es-dialog': {
    sources: {
      vue3: 'packages/vue3/src/components/es-dialog/src/component.vue',
      vue2: 'packages/vue2/src/components/es-dialog/component.vue',
      antdv: 'packages/adapter-antdv/src/components/es-dialog/src/component.vue',
    },
    expected: ['update:visible', 'closed', 'open'],
    why: '弹窗生命周期：update:visible（v-model 回写）/ closed（真实关闭）/ open（显示）。',
  },
  'es-table': {
    sources: {
      vue3: 'packages/vue3/src/components/es-table/src/component.vue',
      vue2: 'packages/vue2/src/components/es-table/component.vue',
      antdv: 'packages/adapter-antdv/src/components/es-table/src/component.vue',
    },
    expected: [
      'selection-change',
      'update:dataSource',
      'update:pagination',
      'pagination-current-change',
      'size-change',
      'change-table-sort',
      'request-error',
    ],
    deviation: {
      vue2: {
        keys: ['update:dataSource'],
        reason:
          'Vue 2 引擎有意移除 update:dataSource 回传：httpRequest 模式下数据落在内部 tableData，' +
          'props.dataSource 恒为空（component.vue 注释自述）。保留单向 :data-source 输入；' +
          '片段/SFC 生成器同步改发单向绑定（F7）。',
      },
    },
    forwarded: {
      vue3: {
        'selection-change': {
          reason:
            'el-table / vxe-grid / virtual-engine 的原生事件：默认与 vxe 引擎经 attrs 透传，' +
            'virtual 引擎显式绑定后转调 attrs 上的宿主监听器；组件不 emit，避免与原生派发重复。' +
            '三端载荷一致：当前页选中行数组（跨页全集用 getSelectionRows()）。',
          paths: [
            {
              engine: 'el-table',
              anchor: '<el-table',
              anchorTokens: ['v-bind="tableBindAttrs"', '@selection-change="handleTableSelectionChange"'],
              sourceTokens: ['const tableBindAttrs = computed', 'filteredFallthrough[k] = v'],
            },
            {
              engine: 'vxe-grid',
              anchor: '<vxe-engine',
              anchorTokens: ['v-bind="vxePassthroughAttrs"', '@selection-change="handleVirtualSelectionChange"'],
            },
            {
              engine: 'virtual-engine',
              anchor: '<virtual-engine',
              anchorTokens: ['@selection-change="handleVirtualEngineSelectionChange"'],
              sourceTokens: ['fallthroughAttrs.onSelectionChange'],
            },
          ],
        },
      },
      vue2: {
        'selection-change': {
          reason:
            'Element UI / vxe-grid 的原生事件：两个引擎都经 v-on="$listeners" 透传，' +
            'Vue 2 的 _g 会把宿主监听器与显式内部监听合并为数组；组件不 emit，避免双触发。' +
            'virtual 引擎在 Vue 2 不支持，降级 el-table，链路同上。',
          paths: [
            {
              engine: 'vxe-grid',
              anchor: '<vxe-engine',
              anchorTokens: ['v-on="$listeners"', '@selection-change="handleTableSelectionChange"'],
            },
            {
              engine: 'el-table',
              anchor: '<el-table',
              anchorTokens: ['v-on="$listeners"', '@selection-change="handleTableSelectionChange"'],
            },
          ],
        },
      },
    },
    why: '表格事件：选择变化 / 数据回写 / 分页 / 排序 / 自动加载失败外抛。',
  },
}

/**
 * 三端 formtype 的**行为层**契约（单源）。
 *
 * FORM_RENDER_CONTRACT 只回答「这个 formtype 绑到了哪个组件」。但 C 系列缺陷全都满足
 * 「键在、组件对、编译过、门禁全绿」，却让配置静默失效 —— 组件绑对了，**行为没接通**：
 *   - Upload：三端都绑了 ElUpload/el-upload/a-upload，但 vue3/antdv 的 `model[prop]`
 *     从未被写入（连 fileList 都没绑）—— 上传完表单提交上去是空的，零报错；
 *   - Transfer：vue3 绑了 ElTransfer 却从未消费 `dataOptions` —— 穿梭框两侧永远是空的。
 * 两者都是「绑定正确」之外的另一条边，只查组件名在结构上看不见。
 *
 * 形态：`{ [formtype]: { [behaviorId]: { why, tokens, deviation? } } }`
 *   - `tokens[renderer]`：该端**在该 formtype 的渲染分支窗口内**必须出现的全部 token
 *     （组内 AND：少一个就没接通）。token 沿用 FORM_RENDER_CONTRACT 的匹配规则
 *     （含 `-` 或全小写按带引号字符串匹配，否则按标识符单词边界）。
 *   - `deviation[renderer]`：该端在这一维度上是有意的差异实现，**必须写明原因**
 *     （与 FORM_RENDER_CONTRACT 的 deviation 同一套规则与检查）。
 *
 * 加一条行为的门槛：它必须能区分「接通了」和「没接通」两种实现。像 `setNestedValue`
 * 这种全分支都在的 token，只有放在**该 formtype 的分支窗口里**才有意义 —— 窗口外出现
 * 多少次都不算数（extractBranchWindows 天然保证了这一点）。
 */
export const FORM_BEHAVIOR_CONTRACT = {
  Upload: {
    // 读侧：把 model 里的文件列表交给组件。缺了它，组件自己的列表永远是空的。
    // 两个 token 都要：`getNestedValue` 钉住「列表来自 model」，`fileList` 钉住「交到了组件手上」。
    // 只写 `fileList` 不够 —— 一个同名的局部变量就能满足它，而 model 根本没被读过
    // （写这个契约时踩过：把 Transfer 的 token 写成裸 `dataOptions`，注入
    //  `const dataOptions = undefined` 依然全绿）。
    'bind-fileList': {
      why:
        '组件必须拿到 model 里的文件列表作为初值，否则回显为空；' +
        'vue3/antdv 此前连 fileList 都没绑（Vue 里传 undefined 还会让 ElUpload 首屏 .find() 抛错）',
      tokens: {
        vue3: ['getNestedValue', 'fileList'],
        vue2: ['getNestedValue', 'fileList'],
        antdv: ['getNestedValue', 'fileList'],
      },
    },
    // 写侧：把列表写回 model。缺了它，上传成功但 model[prop] 仍是初始值。
    'writeback-to-model': {
      why:
        '上传/失败/删除三个生命周期都必须把最新列表写回 model，否则表单提交的是空值且不报错；' +
        '三端入口不同（vue3 接管 onSuccess/onError/onRemove + update:fileList，' +
        'antdv 只有内部 onUpdate:fileList，vue2 走 :file-list + 三个回调），' +
        '但最终都必须落到 setNestedValue 写 model',
      tokens: { vue3: ['setNestedValue'], vue2: ['setNestedValue'], antdv: ['setNestedValue'] },
    },
  },
  Transfer: {
    // 数据源：三端都必须把 dataOptions 喂给穿梭框，否则两侧是空的。
    // token 用 `row.dataOptions`（取值点）而不是裸 `dataOptions` —— 后者是个局部变量名就能满足。
    'consume-dataOptions': {
      why:
        'dataOptions 是 es-plus 的标准选项字段，三端都必须把它映射成穿梭框的数据源；' +
        'vue3 此前只传了 modelValue 与透传袋，dataOptions 完全没消费 —— 两侧永远为空、零报错',
      tokens: {
        vue3: ['row.dataOptions'],
        vue2: ['row.dataOptions'],
        antdv: ['row.dataOptions'],
      },
    },
  },
}

/**
 * 三端**表格列语义**契约（单源）。
 *
 * 前两张契约只覆盖 formtype（表单控件）。表格列是另一条完全独立的渲染路径，
 * 此前 `check:parity` 对它零覆盖，`check-contract-consumption` 又只做「字段名是否在源码出现」
 * （`type`/`key` 这类通用名恒真）——结构上看不见列处理的漂移。而三端对 `type`/`groups`/
 * `expandConfig`/`permissionValue` 确有真实、有意、且**方向相反**的分叉（见各行 why），无人守。
 * 本契约把这些列语义纳入与 formtype 同一套 token 机制，使每处差异要么被正向 token 钉死、
 * 要么登记在 deviation（跨端有意差异）或 knownGaps（三端一致的已知限制）里并写明原因。
 *
 * 行形态（`{ [rowId]: { why, sources, tokens?, forbid?, deviation?, knownGaps? } }`）：
 *   - sources[renderer]：**文件路径数组**（仓库相对）。守卫逐文件 `stripComments` 后拼接，
 *     再在同一段文本里匹配 token —— 故**注释里的 token 不算数**（这正是本守卫要的：
 *     例如 antdv 的 `column-adapter.ts` 只在注释里提 `rowSelection`，真实接线在 component.vue）。
 *   - tokens[renderer]：正向，组内 AND —— 全部须出现，少一个即「列语义漂移」。
 *   - forbid[renderer]：反向 —— 出现任何一个即失败（用来钉住「原生透传 / 只展 1 层」这类否定事实）。
 *   - deviation / knownGaps：原因**非空强制**（空串占位会红）；deviation=跨端有意差异，knownGaps=三端一致的限制。
 *
 * ⚠ token 规则两个实测坑（沿用 FORM_* 契约的 tokenRe，务必遵守）：
 *   (1) tokenRe 对**全小写** token（含点号连接的）按**带引号字符串**匹配 —— 所以像
 *       `col.groups` / `item.groups` 这种点号全小写 token **不可用**（源码里是 `cols.groups`，
 *       不是 `'col.groups'`）。需要用时改用含大写的精确文本，如 `adaptColumn(child`。
 *   (2) 全小写裸词会命中**引号内**的出现 —— `forbid: ['index']` 只能拦住 `type === 'index'`
 *       这种带引号的比较，拦不住 `v-for="(item, index)"` 里的循环变量（那没引号）。
 *       这对「vue3/vue2 不显式分派 type:'index'」的断言恰好够用，但要清楚它的边界。
 */
export const COLUMN_CONTRACT = {
  // —— 内置列类型（type:'index'/'selection'/'expand'）在**三端默认引擎**里的处理 ——
  'type:index': {
    why:
      "内置序号列：antdv 默认把 type:'index' 映射为合成列（el-table 的 type:'index' 在 ADV 无原生等价，用 customRender 渲染行号）；" +
      'vue3/vue2 默认引擎**原生透传** `type` 给 el-table-column（不显式分派，靠组件自身识别）',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/column-item.vue'],
      vue2: ['packages/vue2/src/components/es-table/column-item.vue'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/column-adapter.ts'],
    },
    // 正向：antdv 默认路径确有合成序号列工厂。
    tokens: { antdv: ['createSnAdvColumn'] },
    // 反向：vue3/vue2 默认路径不得出现 type:'index' 的显式分派（靠原生透传）。
    forbid: { vue3: ['index'], vue2: ['index'] },
  },
  'type:selection': {
    why:
      "内置选择列：antdv 默认经 rowSelection 渲染（列适配器跳过 type:'selection'，组件用 rowSelection 承接）；" +
      'vue3/vue2 默认引擎原生透传',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/column-item.vue'],
      vue2: ['packages/vue2/src/components/es-table/column-item.vue'],
      // 真实接线在 component.vue；column-adapter.ts 只在注释里提 rowSelection（会被 stripComments 去掉）。
      antdv: ['packages/adapter-antdv/src/components/es-table/src/component.vue'],
    },
    tokens: { antdv: ['rowSelection'] },
    forbid: { vue3: ['selection'], vue2: ['selection'] },
  },
  'type:expand': {
    why:
      "内置展开列：三端默认引擎都消费列上的 expandConfig；antdv 另经 expandedRowRender 整行渲染展开内容",
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/column-item.vue'],
      vue2: ['packages/vue2/src/components/es-table/column-item.vue'],
      antdv: [
        'packages/adapter-antdv/src/components/es-table/src/column-adapter.ts',
        'packages/adapter-antdv/src/components/es-table/src/component.vue',
      ],
    },
    tokens: {
      vue3: ['expand', 'expandConfig'],
      vue2: ['expand', 'expandConfig'],
      // 刻意避开裸 'expand'（component.vue 的 TABLE_INTERNAL_KEYS 是噪声），用两个只属于展开内容的 token。
      antdv: ['expandedRowRender', 'expandContent'],
    },
  },
  // —— 同一组内置类型在**引擎路径**（vxe ×3 + vue3 虚拟引擎）里的处理：与默认引擎**极性相反** ——
  // 默认引擎「原生透传」，引擎路径则**显式分派** type 来生成自己的列模型（虚拟列 / vxe 列）。
  'type:mapped-engines': {
    why:
      '引擎路径（vxe ×3 + vue3 虚拟 use-column-adapter）必须显式分派 index/selection/expand，' +
      '生成各自的列模型；并与默认引擎的「原生透传」形成对照——两处漂移各有一种信号',
    sources: {
      // vue3 有两条引擎路径：vxe 与虚拟（二者都显式分派，合并为同一段的 token 来源）。
      vue3: [
        'packages/vue3/src/components/es-table/src/engines/use-vxe-column-adapter.ts',
        'packages/vue3/src/components/es-table/src/engines/use-column-adapter.ts',
      ],
      vue2: ['packages/vue2/src/components/es-table/engines/use-vxe-column-adapter.ts'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/engines/use-vxe-column-adapter.ts'],
    },
    tokens: {
      // create*Column 是 vue3 虚拟引擎独有的合成列工厂，钉住「虚拟引擎确实映射了三种类型」。
      vue3: ['index', 'selection', 'expand', 'createIndexColumn', 'createSelectionColumn', 'createExpandColumn'],
      vue2: ['index', 'selection', 'expand'],
      antdv: ['index', 'selection', 'expand'],
    },
  },
  // —— 多级表头（groups）深度 ——
  'groups:default': {
    why:
      '多级表头：三端默认引擎都展开 col.groups 成子列，但 antdv 递归任意层（adaptColumn 自调），' +
      'vue3/vue2 只展 1 层（columnBindAttr 的跳过表含 groups，孙列不渲染）——**跨端安全上限是 2 级**',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/column-item.vue'],
      vue2: ['packages/vue2/src/components/es-table/column-item.vue'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/column-adapter.ts'],
    },
    tokens: {
      vue3: ['groups'],
      vue2: ['groups'],
      // 含大写的精确文本：递归调用点，钉住「antdv 会再进 adaptColumn」。
      antdv: ['adaptColumn(child'],
    },
    deviation: {
      antdv: 'antdv 默认列适配器递归任意层 groups；vue3/vue2 默认只展 1 层（孙列被丢弃）。跨端给 <2 级表头才三端一致。',
    },
  },
  'groups:engines': {
    why:
      '引擎路径的多级表头一律只展 1 层：adaptGroupCol 建父列、其 children 用 adaptSingleCol 逐个转，' +
      '不再递归（vxe ×3 一致）',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/engines/use-vxe-column-adapter.ts'],
      vue2: ['packages/vue2/src/components/es-table/engines/use-vxe-column-adapter.ts'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/engines/use-vxe-column-adapter.ts'],
    },
    tokens: {
      vue3: ['adaptGroupCol', 'adaptSingleCol(child'],
      vue2: ['adaptGroupCol', 'adaptSingleCol(child'],
      antdv: ['adaptGroupCol', 'adaptSingleCol(child'],
    },
  },
  // —— 展开内容列（列上的 expandConfig）——
  'expandConfig:column': {
    why:
      '展开列的展开内容来自列声明 expandConfig（title + fields 明细）；三端默认引擎都消费它',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/column-item.vue'],
      vue2: ['packages/vue2/src/components/es-table/column-item.vue'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/component.vue'],
    },
    tokens: {
      vue3: ['expandConfig'],
      vue2: ['expandConfig'],
      antdv: ['expandContent', 'expandedRowRender'],
    },
    deviation: {
      antdv: 'antdv 默认引擎只取其**第一个** type:\'expand\' 列的 expandConfig 作为整表展开内容；vue3/vue2 逐列消费。多展开列时 antdv 只认首个。',
    },
  },
  // —— 列级权限（permissionValue / hidCol）——
  'permissionValue:column': {
    why:
      '列级权限：三端都在列列表上按 hidCol + permissionValue 过滤（无权限的列不渲染；未配全局 permission 时放行）',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/component.vue'],
      vue2: ['packages/vue2/src/components/es-table/component.vue'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/component.vue'],
    },
    tokens: {
      vue3: ['filteredColumns', 'checkPermission', 'permissionValue', 'hidCol'],
      vue2: ['filteredColumns', 'checkPermission', 'permissionValue', 'hidCol'],
      antdv: ['filteredColumns', 'checkPermission', 'permissionValue', 'hidCol'],
    },
    knownGaps: {
      vue3: '权限过滤只作用于顶层 columns；groups 的子列从不被 hidCol/permissionValue 过滤（三端一致，非跨端差异）。',
      vue2: '权限过滤只作用于顶层 columns；groups 的子列从不被 hidCol/permissionValue 过滤（三端一致，非跨端差异）。',
      antdv: '权限过滤只作用于顶层 columns；groups 的子列从不被 hidCol/permissionValue 过滤（三端一致，非跨端差异）。',
    },
  },
  // —— 声明式合并单元格（AI-23：顶层 mergeConfig.rowsBy，跨端窄子集）——
  //    **机制三端不同构，故本行是 deviation 的典型**：el-table 有 span-method 通道，
  //    a-table 没有 —— antdv 必须改走列级 customCell。但三端**求值同源**（core 的
  //    buildRowSpanMethod / buildColumnSpans），所以「相邻相等 → rowspan」的语义由构造保证。
  'merge:rows': {
    why:
      '声明式合并（顶层 mergeConfig.rowsBy）：默认引擎里 vue3/vue2 把 rowsBy 翻成 el-table 的 spanMethod，' +
      'antdv 翻成列级 customCell（a-table 无 span-method 通道）。三端语义同源（core 纯函数求值）',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/component.vue'],
      vue2: ['packages/vue2/src/components/es-table/component.vue'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/component.vue'],
    },
    tokens: {
      // 正向：resolveMergeConfig 求值 + buildRowSpanMethod 建 span 函数 + 落到 el-table 的 spanMethod。
      vue3: ['resolveMergeConfig', 'buildRowSpanMethod', 'spanMethod'],
      vue2: ['resolveMergeConfig', 'buildRowSpanMethod', 'spanMethod'],
      // antdv：预计算列级 span（buildColumnSpans）+ 装到列上的 customCell。
      // `rowSpan: spans` 是**决定性** token —— 它只在桥真的注入返回 `{rowSpan}` 的函数时出现
      // （裸 `customCell` 不够：`typeof c.customCell` 的防御守卫也会命中它）。
      antdv: ['resolveMergeConfig', 'buildColumnSpans', 'rowSpan: spans'],
    },
    deviation: {
      antdv:
        'a-table **没有** span-method 通道，antdv 默认引擎把 mergeConfig 翻成**列级 customCell**' +
        '（`(record, rowIndex) => ({ rowSpan, colSpan })`，rowSpan:0 = 该格被合并掉）；' +
        'vue3/vue2 走 el-table 的 `span-method`。机制不同但语义同源 —— 三端都由 core 求值，跨端一致。',
    },
  },
  // —— 同一 mergeConfig 在**引擎路径**（vxe ×3）里的处理：键名在三端有 v3/v4 分叉 ——
  'merge:rows-engines': {
    why:
      '引擎路径的声明式合并：三端 vxe-engine 都复用 core 的 buildRowSpanMethod 建 span 函数，' +
      '但 vxe v3 回调键名是 `spanMethod`、v4 改名为 `mergeMethod` —— vue2 按 v3、vue3/antdv 按 v4 发射',
    sources: {
      vue3: ['packages/vue3/src/components/es-table/src/engines/vxe-engine.vue'],
      vue2: ['packages/vue2/src/components/es-table/engines/vxe-engine.vue'],
      antdv: ['packages/adapter-antdv/src/components/es-table/src/engines/vxe-engine.vue'],
    },
    tokens: {
      vue3: ['resolveMergeConfig', 'buildRowSpanMethod', 'mergeMethod'],
      vue2: ['resolveMergeConfig', 'buildRowSpanMethod', 'spanMethod'],
      antdv: ['resolveMergeConfig', 'buildRowSpanMethod', 'mergeMethod'],
    },
    deviation: {
      vue2:
        'vxe v3 的合并回调键名是 `spanMethod`（v4 改名为 `mergeMethod`）；vue2 的 vxe-engine 按 v3 键名发射，' +
        'vue3/antdv 按 v4 键名 `mergeMethod`。三端都复用 core 的 buildRowSpanMethod，语义一致。',
    },
  },
  // —— 列选项：省略号（AN-10，契约键 `ellipsis`）——
  //    生成器此前发的是 `showOverflowTooltip` —— 那是 **el-table 原生 prop**，只有 vue3/vue2
  //    的默认引擎吃；vxe ×3 / 虚拟引擎 / a-table 全部静默丢弃（同一份配置三端两种结果）。
  //    现 IR 统一 `ellipsis`，存量 `showOverflowTooltip` 三端一并认（向后兼容），
  //    每条路径各自翻译成自己的机制。
  'column:ellipsis': {
    why:
      '列级省略号：契约键 `ellipsis` 必须翻译成各端真正的机制 —— vue3/vue2 默认引擎译成 el-table 的 ' +
      'showOverflowTooltip，vxe ×3 译成 showOverflow:\'tooltip\'，antdv 译成列 ellipsis（CSS 省略 + 原生 title）；' +
      '存量写法 `showOverflowTooltip` 三端一并认，否则老配置换端后静默消失',
    sources: {
      vue3: [
        'packages/vue3/src/components/es-table/src/column-item.vue',
        'packages/vue3/src/components/es-table/src/engines/use-vxe-column-adapter.ts',
        'packages/vue3/src/components/es-table/src/engines/use-column-adapter.ts',
      ],
      vue2: [
        'packages/vue2/src/components/es-table/column-item.vue',
        'packages/vue2/src/components/es-table/engines/use-vxe-column-adapter.ts',
      ],
      antdv: [
        'packages/adapter-antdv/src/components/es-table/src/column-adapter.ts',
        'packages/adapter-antdv/src/components/es-table/src/engines/use-vxe-column-adapter.ts',
      ],
    },
    tokens: {
      // 默认引擎的翻译点 + 引擎路径的翻译点（两段文本拼接后同一段里匹配）。
      vue3: ['options.showOverflowTooltip', 'base.showOverflow', 'createEllipsisCellRenderer'],
      vue2: ['options.showOverflowTooltip', 'base.showOverflow'],
      antdv: ['advCol.ellipsis', 'base.showOverflow'],
    },
    deviation: {
      antdv:
        'a-table 的列 ellipsis 是 CSS 省略 + 浏览器原生 title 提示；el-table 的 show-overflow-tooltip 与 ' +
        'vxe 的 showOverflow:\'tooltip\' 是带浮层的 tooltip。**可见效果等价**（截断 + 悬停看全文），' +
        '但浮层组件不同 —— 这是 a-table 没有对应 prop 导致的机制差异，非语义差异。',
    },
  },
  // —— 列选项：默认排序（AN-10，`tableOptions.defaultSort`）——
  //    坑在「默认排序状态挂在列上」：el-table 要整表 `default-sort` **且**目标列 sortable；
  //    vxe 走 sortConfig.defaultSort；a-table 根本没有整表 prop，只有列级 `defaultSortOrder`
  //    —— 此前 antdv 完全没读 defaultSort（静默失效）。
  'column:defaultSort': {
    why:
      '默认排序：vue3/vue2 默认引擎把 tableOptions.defaultSort 送到 el-table 的 default-sort，' +
      'antdv 默认引擎译成目标列的 defaultSortOrder（a-table 无整表 prop），三端 vxe 引擎译成 sortConfig.defaultSort'
      + '（语法不同，语义同）；三端都只在**目标列可排序**时生效，派生列的 sortable 由生成器补',
    sources: {
      vue3: [
        'packages/vue3/src/components/es-table/src/component.vue',
        'packages/vue3/src/components/es-table/src/engines/vxe-engine.vue',
      ],
      vue2: [
        'packages/vue2/src/components/es-table/component.vue',
        'packages/vue2/src/components/es-table/engines/vxe-engine.vue',
      ],
      antdv: [
        'packages/adapter-antdv/src/components/es-table/src/component.vue',
        'packages/adapter-antdv/src/components/es-table/src/engines/vxe-engine.vue',
      ],
    },
    tokens: {
      vue3: ['result.defaultSort', 'defaultSort: { field: ds.prop'],
      vue2: ['result.defaultSort', 'defaultSort: { field: ds.prop'],
      // 决定性 token：`defaultSortOrder` 只在「真把状态落到列上」时出现。
      antdv: ['target.defaultSortOrder', 'defaultSort: { field: ds.prop'],
    },
    deviation: {
      antdv:
        'a-table 没有整表 default-sort，默认排序状态只能落在列上的 `defaultSortOrder`（ascend/descend）；' +
        'el-table 走 `default-sort`（ascending/descending）。同样地，antd 在列无 sorter 时忽略 defaultSortOrder，' +
        '与 el-table 的「列需 sortable」同构 —— 组件不硬塞 sorter，保持三端「只对可排序列生效」一致。',
    },
  },
}

