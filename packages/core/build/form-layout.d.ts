/**
 * 表单行列布局算法（框架无关）
 *
 * 把 formItemList 按 span 累计装进 24 栅格的"行"中，并产出：
 *   - columnRow: 二维数组 [行][行内项的全局索引]
 *   - rowNum: 总行数
 *   - columnNodeIndex: 每行最后一项的全局索引
 *
 * 这些数据用于：
 *   - 折叠展开：根据 minFoldRows 决定显示前 N 行
 *   - 按钮列定位：根据最后一行剩余 span 决定按钮放在末行尾部还是单独一行
 *   - 渲染：渲染层按 columnRow 输出 <ElRow><ElCol>... 结构
 *
 * 提取自 packages/vue3/src/composables/use-form-layout.ts (1.3.5)，
 * 仅保留纯函数部分（getRowColsAlgorithm + 衍生计算），剥离 ref/computed/watch。
 * Vue 2 / Vue 3 渲染层各自用 computed 包装该函数即可。
 */
import type { FormItemOption } from './types';
/**
 * 单行的元数据：包含项的全局索引列表
 */
export interface RowLayoutInfo {
    /** 行起始项在 formItemList 中的索引（含） */
    statIndex: number;
    /** 行结束项在 formItemList 中的索引（不含） */
    endIndex: number;
}
/**
 * 行列算法的产出
 */
export interface FormLayoutResult {
    /** 二维数组：[行][该行内每一项的全局索引] */
    columnRow: number[][];
    /** 总行数 */
    rowNum: number;
    /** 每行最后一项的全局索引 —— 用于折叠时确定第 N 行的截止位置 */
    columnNodeIndex: number[];
}
/**
 * 核心：按 24 栅格累加 span 拆分 formItemList 为多行
 *
 * 行为细节（对齐 1.3.5 实现）：
 * 1. 每项默认 span = 24（独占一行）
 * 2. 当累加 span > 24 时，当前项放入新行，前面的项构成上一行
 * 3. 当累加 span === 24 时，当前项作为本行末位，下一项另起新行
 * 4. 最后一项总会被收尾装入某一行
 *
 * @param formItemList 表单字段列表
 * @returns 行列布局结果
 */
export declare function getRowColsAlgorithm(formItemList: FormItemOption[]): FormLayoutResult;
/**
 * 根据布局结果与折叠配置，判断是否需要展示"展开/收起"按钮
 *
 * @param layoutResult getRowColsAlgorithm 的返回值
 * @param minFoldRows 折叠时显示行数（>0 启用）
 */
export declare function shouldShowFoldButton(layoutResult: FormLayoutResult, minFoldRows: number): boolean;
/**
 * 计算按钮列的 span
 *
 * 逻辑：
 * - 折叠状态：按钮独占整行 → span = 24
 * - 展开 + 末行剩余空间足够放按钮 → 按钮挤进末行
 * - 展开 + 末行空间不够 → 按钮独占一行
 *
 * @param layoutResult 布局结果
 * @param formItemList 字段列表（用于计算末行 span 总和）
 * @param folded 当前是否处于折叠状态
 * @param btnColSpan 用户配置的按钮列期望 span
 */
export declare function getBtnColSpan(layoutResult: FormLayoutResult, formItemList: FormItemOption[], folded: boolean, btnColSpan: number): number;
/**
 * 给每个 formItem 标注 isFold（折叠态下是否被隐藏）
 *
 * 折叠状态：从 minFoldRows-1 行的末位之后的项标记 isFold = true
 *
 * @returns 浅复制后的列表，每项额外带 isFold 字段
 */
export declare function applyFoldFlags(formItemList: FormItemOption[], layoutResult: FormLayoutResult, folded: boolean, minFoldRows: number): Array<FormItemOption & {
    isFold: boolean;
}>;
//# sourceMappingURL=form-layout.d.ts.map