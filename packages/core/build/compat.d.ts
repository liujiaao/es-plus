/**
 * 向后兼容适配层
 *
 * 集中管理旧 API → 新 API 的运行时桥接逻辑，
 * 确保旧写法在新版本中仍然可用。
 */
import type { BtnConfig, FormItemOption, ListenToCallBack } from './types';
/**
 * 将 FormType 归一化为 PascalCase
 * 旧写法（如 'datePicker'）会被转换为推荐写法（'DatePicker'），
 * 未知值原样返回。
 */
export declare function normalizeFormType(type: string): string;
/**
 * 从 LayoutFormProps 中读取表单布局配置
 * 优先读 formLayProps（正确拼写），fallback 到 fromLayProps（旧拼写）
 */
export declare function resolveFormLayProps(layoutProps?: {
    formLayProps?: Record<string, unknown>;
    fromLayProps?: Record<string, unknown>;
}): Record<string, unknown>;
/**
 * 解析按钮位置 —— 优先 position，fallback code
 *
 * - position 字段优先（推荐，语义自解释）
 * - code 字段兜底（@deprecated 兼容旧 API）
 * - 两者都未配时默认 'left'
 */
export declare function getButtonPosition(btn: BtnConfig): 'left' | 'right';
/**
 * 判断按钮是否在右侧
 */
export declare function isButtonRight(btn: BtnConfig): boolean;
/**
 * 判断按钮是否在左侧
 */
export declare function isButtonLeft(btn: BtnConfig): boolean;
/**
 * 从 ListenToCallBack 中获取回调函数
 * 优先新名称，fallback 旧名称，确保两种写法均可使用
 *
 * @param cb 回调映射对象
 * @param name 回调名（推荐新名称，也支持旧名称）
 * @returns 回调函数或 undefined
 */
export declare function getCallback(cb: ListenToCallBack | Record<string, (...args: unknown[]) => unknown> | undefined, name: string): ((...args: unknown[]) => unknown) | undefined;
/**
 * 归一化 FormItemOption：将顶层快捷属性合并到 attrs
 *
 * 规则：
 * - placeholder/clearable/disabled 等快捷属性自动注入到 attrs
 * - attrs 中已有的同名属性不会被覆盖（显式 attrs 优先）
 * - 原始顶层属性保留不删除（保持数据完整性）
 */
export declare function normalizeFormItem(item: FormItemOption): FormItemOption;
/**
 * 批量归一化 FormItemOption 列表
 */
export declare function normalizeFormItemList(items: FormItemOption[]): FormItemOption[];
//# sourceMappingURL=compat.d.ts.map