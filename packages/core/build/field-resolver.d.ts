/**
 * 字段/按钮解析逻辑（框架无关）
 *
 * 提取自 EsForm 与 EsTable 中的纯逻辑：
 *   - 表单字段隐藏过滤
 *   - 自动 span 计算
 *   - 工具栏按钮按 position/code 分左右
 *   - 旧 API：按 direction 分左右（EsForm 内置按钮使用）
 *   - 权限过滤
 *   - 按钮 disabled 状态归一化（支持函数形式）
 *
 * 这些函数完全不依赖 Vue / Element，渲染层只需调用即可。
 */
import type { BtnConfig, FormItemOption, ModelData } from './types';
/**
 * 根据 isHidden 函数过滤字段
 *
 * @param formItemList 字段列表
 * @param model 当前表单 model（传给 isHidden）
 * @param formProps 透传给 isHidden 的 form props 上下文
 */
export declare function filterVisibleFormItems(formItemList: FormItemOption[], model: ModelData, formProps: unknown): FormItemOption[];
/**
 * 计算自动 span 值
 *
 * 算法（与 EsForm 1.3.5 保持一致）：
 *   - 没有任何字段配 span：按字段数 1/2/3/N → 24/12/8/6
 *   - 部分字段配了 span：剩余空间 ÷ 未配置字段数，min 4 max 12
 *
 * @param visibleFormItemList 已过滤可见的字段列表
 * @returns 自动 span 数值（4-24 之间）
 */
export declare function calculateAutoSpan(visibleFormItemList: FormItemOption[]): number;
/**
 * 把可见字段填上 span（对未配 span 的字段使用 autoSpan）
 *
 * @returns 浅复制后的字段列表，每项 span 字段必填
 */
export declare function applyAutoSpan(visibleFormItemList: FormItemOption[]): Array<FormItemOption & {
    span: number;
}>;
/**
 * 按 direction 字段把按钮分左右两组（EsForm 内置按钮使用）
 *
 * 默认（不配 direction）视为右侧。
 */
export declare function splitButtonsByDirection(buttons: BtnConfig[]): {
    colLeftBtn: BtnConfig[];
    colRightBtn: BtnConfig[];
};
/**
 * 解析按钮位置 —— 优先 position，fallback code
 *
 * - position 字段优先（推荐，语义自解释）
 * - code 字段兜底（@deprecated 兼容旧 API）
 * - 两者都未配时默认 'left'
 */
export declare function getButtonPosition(btn: BtnConfig): 'left' | 'right';
/**
 * 按 position/code 字段把表格工具栏按钮分左右两组
 * - position: 'right' 或 code === 2 → 右侧
 * - position: 'left' 或 code === 1 或未配置 → 左侧
 *
 * 注意：未配 position/code 的按钮默认归到 left。
 */
export declare function splitToolbarButtonsByCode(buttons: BtnConfig[]): {
    leftBtns: BtnConfig[];
    rightBtns: BtnConfig[];
};
/**
 * 按权限校验函数过滤按钮
 *
 * @param buttons 按钮列表
 * @param permission 全局权限校验函数（返回 true 表示有权限）
 */
export declare function filterButtonsByPermission(buttons: BtnConfig[], permission?: (value: string) => boolean): BtnConfig[];
/**
 * 处理按钮 isHide 状态（结合权限 + 函数式 isHide）
 *
 * 这是 EsTable table-btns 中 processButtonConfig 的纯化版本：
 * - 无权限 → isHide = true
 * - isHide 是函数 → 调用得到布尔
 * - 其它 → 直接转布尔
 *
 * @returns 浅复制后的按钮列表，每项 isHide 已被规范化为 boolean
 */
export declare function normalizeButtonsHideState(buttons: BtnConfig[], permission?: (value: string) => boolean): Array<BtnConfig & {
    isHide: boolean;
}>;
/**
 * 解析按钮 disabled —— 支持布尔值或函数
 *
 * @param btn 按钮配置
 * @param model 当前 model（用于函数式 disabled）
 */
export declare function resolveButtonDisabled(btn: BtnConfig, model?: ModelData): boolean;
/**
 * 把 ConfigTableOut（如 { tableData: 'rows', total: 'records' }）应用于一个响应对象
 *
 * 与 request.ts 中 formatConfigOut 的区别：
 * - 此函数面向表格（用 tableData 而不是 listData）
 * - 不做数字 parseInt 强转，保持原值
 * - 找不到时不会通过 findValueByKey 深搜，仅按平铺路径取
 *
 * 调用方：EsTable 在收到响应时把 { rows, records } 映射到 { tableData, total }
 */
export declare function applyConfigTableOut(response: Record<string, unknown> | unknown[], configTableOut: {
    total?: string;
    tableData?: string;
    pageSize?: string;
    current?: string;
}): {
    tableData: unknown[];
    total: number;
    pageSize?: number;
    current?: number;
};
/**
 * 解析表单项要注入到底层 form-item 的校验配置（`required` / `rules`）。
 *
 * 优先级：**`formItemOptions` 中的同名键优先**，`item.required` / `item.rules`
 * 只在前者未提供该键时才注入。
 *
 * 依据：本库对「快捷方式 vs 低层透传袋」的既有约定就是低层袋优先 ——
 * `FormItemOption` 的 `placeholder` / `clearable` / `disabled` 均标注
 * 「attrs 中的同名属性优先」。`formItemOptions` 与 `attrs` 同属透传给底层组件的
 * 逃生舱，故沿用同一方向。
 *
 * 返回值只含**需要注入的键**，调用方展开合并即可，不会覆盖 `formItemOptions`
 * 中已有的其他键。
 *
 * @example
 * // formItemOptions 赢，item.required 被忽略
 * { prop: 'name', required: false, formItemOptions: { required: true } }
 */
export declare function resolveItemValidateProps(item: {
    required?: boolean;
    rules?: Array<Record<string, unknown>>;
    formItemOptions?: Record<string, unknown>;
}): Record<string, unknown>;
/**
 * 合并 form 级校验规则：全局配置兜底，组件 props 同名键优先。
 *
 * `rules` 形如 `{ 字段路径: 规则数组 }`。底层组件（Element Plus / Element UI / ADV）
 * 会把 form 级规则与 form-item 级规则**合并**（item 级在前），所以这里只需按字段名做
 * 一层浅合并：组件 props 给了某字段就用组件的，否则回落到全局配置。
 *
 * 之所以不是「全局整体被组件整体覆盖」：全局配置的用途是给一批表单提供公共字段
 * （例如所有表单都校验 `createTime` 区间），而组件只关心自己那几个字段 ——
 * 整体覆盖会让全局配置基本失效。
 */
export declare function resolveFormRules(globalRules: unknown, propRules: unknown): Record<string, unknown>;
//# sourceMappingURL=field-resolver.d.ts.map