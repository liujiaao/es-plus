/**
 * 框架无关的类型定义
 *
 * 这些类型描述 es-plus 的"配置层"数据形状（columns / formItemList / options 等），
 * 它们不依赖任何 Vue 或 Element 类型，可被 Vue 2 / Vue 3 渲染层共享。
 *
 * 设计原则：
 * 1. 不 import 任何 vue / element-plus / element-ui 类型
 * 2. 使用 unknown 替代具体 VNode 类型 —— 由各渲染层包装
 * 3. 对 Element 特定 props（type/size 等）使用宽松字面量联合
 *
 * 提取自 packages/es-plus/src/types/index.ts，
 * 移除 VNode / RenderFunction / FormProps / ButtonProps 引用。
 */
export {};
//# sourceMappingURL=types.js.map