/**
 * 跨页选择集合管理（框架无关纯逻辑）
 *
 * 处理"分页表格 + 多选"场景下的跨页选中持久化：
 * - 用户在第 1 页选了 A、B
 * - 翻到第 2 页，选了 C
 * - 期望最终 multipleSelection = [A, B, C]，并在回到第 1 页时仍能看到 A、B 高亮
 *
 * 实现要点：
 * 1. 按 rowkey 去重 —— 同一行可能在多页中被切换状态
 * 2. selectionsByPage 按页缓存当前页的选择，最终 reduce 为去重的全集
 * 3. 当不传 rowkey 时退化为单页模式（没有跨页持久化）
 *
 * 提取自 packages/es-plus/src/composables/use-table-selection.ts (1.3.5)，
 * 剥离 ref，把状态变更改为纯函数 + 由调用方持有可变状态。
 *
 * Vue 2 / Vue 3 渲染层各自创建 ref/reactive 包装这些状态。
 */
/**
 * 创建空的选择状态
 */
export function createSelectionState() {
    return {
        multipleSelection: [],
        selectionsByPage: {},
        isInitChange: false,
    };
}
/**
 * 处理 selection-change 事件 —— 把当前页选择合入全局集合并去重
 *
 * 注意：本函数直接 mutate state.selectionsByPage 与 state.multipleSelection。
 * 渲染层若需要触发响应式更新，应在调用前后通过浅拷贝或 ref.value = ... 重新赋值。
 *
 * @param state 选择状态
 * @param val 当前页 selection-change 抛出的最新选中行
 * @param currentPage 当前页码
 * @param rowkey 行唯一键（如 'id'），不传则退化为单页模式
 */
export function applySelectionChange(state, val, currentPage, rowkey) {
    if (rowkey) {
        if (state.isInitChange)
            return;
        state.selectionsByPage[currentPage] = val;
        const allSelections = [];
        const uniqueMap = {};
        Object.values(state.selectionsByPage).forEach((pageSelections) => {
            pageSelections.forEach((item) => {
                const key = item[rowkey];
                const keyStr = String(key);
                if (key !== undefined && key !== null && !uniqueMap[keyStr]) {
                    allSelections.push(item);
                    uniqueMap[keyStr] = true;
                }
            });
        });
        state.multipleSelection = allSelections;
    }
    else {
        state.multipleSelection = val;
    }
}
/**
 * 翻页后回显历史选择 —— 在新一页数据中找出已经选中的行，调用 toggleRowSelection 高亮
 *
 * @param state 选择状态
 * @param dataList 当前页数据
 * @param tableRef Element 表格 ref
 * @param rowkey 行唯一键
 */
export function restoreSelectionForPage(state, dataList, tableRef, rowkey) {
    if (!dataList?.length || !rowkey || !state.multipleSelection.length)
        return;
    const pageSelecteds = [];
    dataList.forEach((row) => {
        state.multipleSelection.forEach((selectedRow) => {
            if (row[rowkey] === selectedRow[rowkey]) {
                pageSelecteds.push(row);
            }
        });
    });
    pageSelecteds.forEach((row) => {
        tableRef.toggleRowSelection?.(row, true);
    });
}
/**
 * 清空所有页的选择（含跨页缓存）
 */
export function clearAllSelection(state, tableRef) {
    state.multipleSelection = [];
    state.selectionsByPage = {};
    tableRef.clearSelection?.();
}
//# sourceMappingURL=table-selection.js.map