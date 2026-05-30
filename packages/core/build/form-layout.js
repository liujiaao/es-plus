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
export function getRowColsAlgorithm(formItemList) {
    let pre = 0;
    const groupArrayList = [];
    const columnRows = [];
    for (let i = 0; i < formItemList.length; i++) {
        const item = formItemList[i];
        pre += item.span || 24;
        if (pre > 24) {
            // 当前项使本行溢出 → 上一项之前为一行，当前项进入新行
            const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0;
            columnRows.push({ statIndex, endIndex: i });
            pre = item.span || 24;
            // 如果当前项也是最后一项，则它独占新行
            if (i === formItemList.length - 1) {
                columnRows.push({ statIndex: i, endIndex: i + 1 });
            }
        }
        else {
            if (i === formItemList.length - 1) {
                // 最后一项收尾
                const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0;
                columnRows.push({ statIndex, endIndex: i + 1 });
            }
            else if (pre === 24) {
                // 恰好填满一行
                const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0;
                columnRows.push({ statIndex, endIndex: i + 1 });
                pre = 0;
            }
        }
    }
    columnRows.forEach((it) => {
        groupArrayList.push(formItemList.slice(it.statIndex, it.endIndex));
    });
    // 把每项映射为它在 formItemList 中的全局索引（连续递增）
    const columRowIndexs = groupArrayList.map((it) => it.map(() => 0));
    let rowColIndex = -1;
    columRowIndexs.forEach((row) => {
        row.forEach((_, idx) => {
            row[idx] = (rowColIndex += 1);
        });
    });
    return {
        columnRow: columRowIndexs,
        rowNum: columRowIndexs.length,
        columnNodeIndex: columRowIndexs.map((it) => it[it.length - 1]),
    };
}
/**
 * 根据布局结果与折叠配置，判断是否需要展示"展开/收起"按钮
 *
 * @param layoutResult getRowColsAlgorithm 的返回值
 * @param minFoldRows 折叠时显示行数（>0 启用）
 */
export function shouldShowFoldButton(layoutResult, minFoldRows) {
    return minFoldRows > 0 && minFoldRows < layoutResult.rowNum;
}
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
export function getBtnColSpan(layoutResult, formItemList, folded, btnColSpan) {
    const { rowNum, columnRow } = layoutResult;
    const lastColumn = columnRow[rowNum - 1] || [];
    const totalSpan = lastColumn.reduce((sum, idx) => sum + (formItemList[idx]?.span || 24), 0);
    const hasSpan = 24 - totalSpan;
    return !folded && btnColSpan <= hasSpan ? hasSpan : 24;
}
/**
 * 给每个 formItem 标注 isFold（折叠态下是否被隐藏）
 *
 * 折叠状态：从 minFoldRows-1 行的末位之后的项标记 isFold = true
 *
 * @returns 浅复制后的列表，每项额外带 isFold 字段
 */
export function applyFoldFlags(formItemList, layoutResult, folded, minFoldRows) {
    if (!folded) {
        return formItemList.map((it) => ({ ...it, isFold: false }));
    }
    const { columnNodeIndex } = layoutResult;
    const lastFoldIndex = columnNodeIndex[minFoldRows - 1] ??
        columnNodeIndex[columnNodeIndex.length - 1] ??
        9999;
    return formItemList.map((it, index) => ({
        ...it,
        isFold: index > lastFoldIndex,
    }));
}
//# sourceMappingURL=form-layout.js.map