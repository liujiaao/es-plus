"use strict";
/**
 * 向后兼容适配层
 *
 * 集中管理旧 API → 新 API 的运行时桥接逻辑，
 * 确保旧写法在新版本中仍然可用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTN_ORCHESTRATION_KEYS = void 0;
exports.normalizeFormType = normalizeFormType;
exports.resolveFormLayProps = resolveFormLayProps;
exports.getButtonPosition = getButtonPosition;
exports.isButtonRight = isButtonRight;
exports.isButtonLeft = isButtonLeft;
exports.filterBtnProps = filterBtnProps;
exports.getCallback = getCallback;
exports.normalizeFormItem = normalizeFormItem;
exports.normalizeFormItemList = normalizeFormItemList;
const constants_1 = require("./constants");
// ============================================================================
// FormType 归一化
// ============================================================================
/**
 * 将 FormType 归一化为 PascalCase
 * 旧写法（如 'datePicker'）会被转换为推荐写法（'DatePicker'），
 * 未知值原样返回。
 */
function normalizeFormType(type) {
    return constants_1.FORM_TYPE_ALIASES[type] ?? type;
}
// ============================================================================
// LayoutFormProps 兼容
// ============================================================================
/**
 * 从 LayoutFormProps 中读取表单布局配置
 * 优先读 formLayProps（正确拼写），fallback 到 fromLayProps（旧拼写）
 */
function resolveFormLayProps(layoutProps) {
    if (!layoutProps)
        return {};
    return layoutProps.formLayProps ?? layoutProps.fromLayProps ?? {};
}
// ============================================================================
// 按钮位置兼容
// ============================================================================
/**
 * 解析按钮位置 —— 优先 position，fallback code
 *
 * - position 字段优先（推荐，语义自解释）
 * - code 字段兜底（@deprecated 兼容旧 API）
 * - 两者都未配时默认 'left'
 */
function getButtonPosition(btn) {
    if (btn.position)
        return btn.position;
    if (btn.code === 2)
        return 'right';
    return 'left';
}
/**
 * 判断按钮是否在右侧
 */
function isButtonRight(btn) {
    return getButtonPosition(btn) === 'right';
}
/**
 * 判断按钮是否在左侧
 */
function isButtonLeft(btn) {
    return getButtonPosition(btn) === 'left';
}
// ============================================================================
// 按钮配置透传过滤（单一权威源）
// ============================================================================
/**
 * 按钮编排字段：这些键 **不应** 随 v-bind 透传给底层按钮组件（el-button / a-button）。
 *
 * 分两类：
 * 1. es-plus 编排语义键（click/render/position/code/permissionValue/... / dialogKey / actionType）
 *    —— 属于配置协议，不是按钮组件的 prop。
 * 2. 各端模板已显式单独绑定/渲染的键（icon 用 getCompIcon 绑、disabled 求值后绑、name 作文本渲染）
 *    —— 再随 v-bind 摊一次会重复甚至冲突（如 disabled 的函数形被原样透传触发告警）。
 *
 * 最关键的是 `click`：它是函数，若透传到原生 <button>，Vue 会执行 `el.click = fn`
 * （因 `'click' in HTMLElement`），**遮蔽原生 HTMLElement.prototype.click()**，
 * 使程序化 `.click()` 调到无上下文的原始回调而非派发真实点击事件。
 */
exports.BTN_ORCHESTRATION_KEYS = [
    'click', 'render', 'name', 'key', 'icon', 'disabled',
    'permissionValue', 'position', 'code', 'direction',
    'action', 'actionType', 'dialogKey', 'triggerEvent',
    'isHide', 'isHidden', 'hidden',
];
/**
 * 过滤按钮配置：剥离编排字段，仅保留可安全透传给底层按钮组件的 props
 * （type/size/loading/plain/round/... 及用户自定义 props）。
 *
 * @param btn 按钮配置对象
 * @param extraOmit 额外需剥离的键 —— 各端模板已显式绑定的键（如 table 工具栏另绑 :type/:size/:loading）
 * @returns 可安全 v-bind 到按钮组件的属性对象
 */
function filterBtnProps(btn, extraOmit) {
    const omit = new Set(exports.BTN_ORCHESTRATION_KEYS);
    if (extraOmit)
        for (const k of extraOmit)
            omit.add(k);
    const out = {};
    for (const [k, v] of Object.entries(btn)) {
        if (!omit.has(k))
            out[k] = v;
    }
    return out;
}
// ============================================================================
// 回调别名兼容
// ============================================================================
/**
 * 回调名映射：新名 → 旧名列表
 */
const CALLBACK_ALIASES = {
    responseTransform: ['crtn'],
    beforeRequest: ['brcb'],
    afterResponse: ['qrcb'],
};
/**
 * 反向映射缓存：旧名 → 新名
 */
const CALLBACK_REVERSE_ALIASES = {};
for (const [newName, oldNames] of Object.entries(CALLBACK_ALIASES)) {
    for (const old of oldNames) {
        CALLBACK_REVERSE_ALIASES[old] = newName;
    }
}
/**
 * 从 ListenToCallBack 中获取回调函数
 * 优先新名称，fallback 旧名称，确保两种写法均可使用
 *
 * @param cb 回调映射对象
 * @param name 回调名（推荐新名称，也支持旧名称）
 * @returns 回调函数或 undefined
 */
function getCallback(cb, name) {
    if (!cb)
        return undefined;
    // 1. 直接按名称查找
    const direct = cb[name];
    if (typeof direct === 'function')
        return direct;
    // 2. 如果 name 是新名称，查找旧别名
    const aliases = CALLBACK_ALIASES[name];
    if (aliases) {
        for (const alias of aliases) {
            const fn = cb[alias];
            if (typeof fn === 'function')
                return fn;
        }
    }
    // 3. 如果 name 是旧名称，查找新名称
    const newName = CALLBACK_REVERSE_ALIASES[name];
    if (newName) {
        const fn = cb[newName];
        if (typeof fn === 'function')
            return fn;
    }
    return undefined;
}
// ============================================================================
// FormItem 快捷属性合并
// ============================================================================
/**
 * FormItem 快捷属性列表
 * 这些属性可以被定义在 FormItemOption 顶层，
 * 内部会自动合并到 attrs 中（attrs 中已有的同名属性优先）
 */
const FORM_ITEM_SHORTCUT_KEYS = ['placeholder', 'clearable', 'disabled'];
/**
 * 归一化 FormItemOption：将顶层快捷属性合并到 attrs
 *
 * 规则：
 * - placeholder/clearable/disabled 等快捷属性自动注入到 attrs
 * - attrs 中已有的同名属性不会被覆盖（显式 attrs 优先）
 * - 原始顶层属性保留不删除（保持数据完整性）
 */
function normalizeFormItem(item) {
    const merged = { ...item };
    const mergedAttrs = { ...item.attrs };
    for (const key of FORM_ITEM_SHORTCUT_KEYS) {
        const value = item[key];
        if (value !== undefined && !(key in mergedAttrs)) {
            mergedAttrs[key] = value;
        }
    }
    if (Object.keys(mergedAttrs).length > 0) {
        merged.attrs = mergedAttrs;
    }
    return merged;
}
/**
 * 批量归一化 FormItemOption 列表
 */
function normalizeFormItemList(items) {
    return items.map(normalizeFormItem);
}
