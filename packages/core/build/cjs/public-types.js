"use strict";
/**
 * @es-plus/core 公共类型契约 barrel（单一权威源）
 *
 * 这里列出的每一个类型都是「跨渲染器契约类型」：@es-plus/vue3 / @es-plus/vue2 /
 * @es-plus/adapter-antdv 三个渲染器都**必须**对外导出同名类型，以兑现
 * “换渲染器只换 import 路径”的家族承诺。
 *
 * 说明：
 *  - vue3 / adapter-antdv 会对其中的「配置类」类型（FormItemOption / TableColumn…）
 *    做框架特化（把 attrs / props 精确到 Element Plus / Ant Design Vue 的 props 类型），
 *    因此它们从各自的 ./types 导出**形状兼容**的特化版本，而非直接透传 core。
 *  - vue2 不做特化，直接透传 core 版本。
 *  - 「框架无关类」类型（ModelData / FormType / Vxe*…）三端一致，均可直接源自 core。
 *
 * CI（scripts/check-type-exports.mjs）读取下方 PUBLIC_CONTRACT_TYPES 常量，
 * 断言三个渲染器 index.ts 的导出类型名集合都覆盖该清单，防止再次漂移。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_CONTRACT_TYPES = void 0;
/**
 * 跨渲染器必须一致导出的契约类型名清单（运行时常量，供 CI 断言使用）。
 *
 * 顺序/内容需与上方 `export type { ... }` 保持一致。
 * 新增契约类型时：先加到 core/types.ts，再同时补进上方 barrel 与此清单，
 * 三个渲染器的 index.ts 会被 CI 强制要求同步导出。
 */
exports.PUBLIC_CONTRACT_TYPES = [
    'ModelData',
    'RenderFn',
    'AnyVNode',
    'EsButtonType',
    'EsButtonSize',
    'EsTableSize',
    'ApiParams',
    'FormType',
    'FormItemOption',
    'BtnConfig',
    'LayoutFormProps',
    'ListenToCallBack',
    'TableColumn',
    'ConfigTableOut',
    'TableOptions',
    'PaginationConfig',
    'DialogOptions',
    'EsFormInstance',
    'EsTableInstance',
    'EsPlusOptions',
    'VxeEditRender',
    'VxeEditConfig',
    'VxeExportConfig',
    'VxeToolbarConfig',
    'VxeColumnConfig',
    'VxeKeyboardConfig',
    'VxeMouseConfig',
    'VxeClipboardConfig',
    'VxeValidConfig',
    'VxeFooterMethod',
    'VxeTreeConfig',
    'VxeProxyConfig',
    'VxeExpandConfig',
    'VxeSeqConfig',
    'TableEngineExposed',
];
