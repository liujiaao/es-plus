/**
 * 将 TableOptions 一等公民字段映射为 vxe-grid 局部配置
 * 纯函数，零框架依赖，可被 vue3 / adapter-antdv / vue2 包共享
 */
export function buildFirstClassGridOptions(opts) {
    const result = {};
    // 合计行
    if (opts.showFooter) {
        result.showFooter = true;
        if (typeof opts.footerMethod === 'function') {
            const fn = opts.footerMethod;
            result.footerMethod = (params) => fn(params);
        }
        if (opts.footerData !== undefined)
            result.footerData = opts.footerData;
    }
    // 行内编辑
    if (opts.editConfig !== undefined)
        result.editConfig = opts.editConfig;
    // Excel / CSV 导出
    if (opts.exportConfig !== undefined) {
        result.exportConfig = opts.exportConfig === true ? {} : opts.exportConfig;
    }
    // 工具栏（true 展开为常用默认）
    if (opts.toolbarConfig !== undefined) {
        result.toolbarConfig = opts.toolbarConfig === true
            ? { export: true, refresh: true, custom: true }
            : opts.toolbarConfig;
    }
    // 列宽拖拽（浅拷贝，防止外部修改影响 gridConfig）
    if (opts.columnConfig !== null && typeof opts.columnConfig === 'object') {
        result.columnConfig = { ...opts.columnConfig };
    }
    // 键盘导航 / 单元格选中 / 剪贴板 / 校验（直传）
    if (opts.keyboardConfig !== undefined)
        result.keyboardConfig = opts.keyboardConfig;
    if (opts.mouseConfig !== undefined)
        result.mouseConfig = opts.mouseConfig;
    if (opts.clipboardConfig !== undefined)
        result.clipboardConfig = opts.clipboardConfig;
    if (opts.validConfig !== undefined)
        result.validConfig = opts.validConfig;
    return result;
}
//# sourceMappingURL=build-grid-config.js.map