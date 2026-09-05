"use strict";
/**
 * 分页请求判定（框架无关纯逻辑）
 *
 * 三个渲染器（@es-plus/vue3 / @es-plus/adapter-antdv / @es-plus/vue2）的
 * `httpRequestInstance` 都包含两段逐字节一致、且带微妙边界条件的判定逻辑：
 *
 *   1. keepPage 解析 —— 本次调用显式传入的 keepPage 优先，其次回退到表级
 *      options.refetchKeepPage（默认 false，向后兼容）。
 *   2. 分页边界回退 —— 保留页模式下，若拉取后当前页已无数据且非首页
 *      （如删除了本页最后一条），需回退到最后一个有效页并再次拉取。
 *
 * 这两段是「相同 API、三端一致行为」承诺里最容易在三处产生漂移的纯计算，
 * 提取到 core 后成为单一权威源；渲染层仍各自持有响应式状态与 emit 语义
 * （Vue 2 的整体替换 vs Vue 3 的就地 mutate、antdv 的 update:pagination 等）。
 *
 * 提取自 packages/{vue3,adapter-antdv,vue2}/**\/es-table 的 httpRequestInstance。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveKeepPage = resolveKeepPage;
exports.computeBoundaryRollback = computeBoundaryRollback;
/**
 * 解析本次请求是否保留当前页码。
 *
 * @param explicit        本次调用显式传入的 reqOptions.keepPage（可为 undefined）
 * @param refetchKeepPage 表级 options.refetchKeepPage（任意值，仅当严格等于 true 才生效）
 * @returns explicit 非 undefined 时取 explicit；否则回退到 refetchKeepPage === true
 */
function resolveKeepPage(explicit, refetchKeepPage) {
    return explicit ?? refetchKeepPage === true;
}
/**
 * 判定「保留页拉取后当前页已空」是否需要回退到最后一个有效页。
 *
 * 仅当以下条件全部成立时才回退（对齐三端原有行为）：
 *   - keepPage 为 true（非搜索语义，否则本就回到第 1 页）
 *   - 当前页拉取结果为空（rowCount === 0）
 *   - 当前页非首页（current > 1）
 *   - 计算出的最后有效页 maxPage 确实小于 current（避免无意义/死循环递归）
 *
 * 数值经 `Number(...) || 兜底` 归一，与三端原逻辑逐字节一致：
 *   current 兜底 1、total 兜底 0、pageSize 兜底 10。
 */
function computeBoundaryRollback(input) {
    const current = Number(input.current) || 1;
    if (!(input.keepPage && input.rowCount === 0 && current > 1)) {
        return { shouldRollback: false, maxPage: current };
    }
    const total = Number(input.total) || 0;
    const pageSize = Number(input.pageSize) || 10;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    return { shouldRollback: maxPage < current, maxPage };
}
