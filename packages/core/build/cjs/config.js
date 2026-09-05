"use strict";
/**
 * 全局配置管理
 *
 * 通过单例模块变量保存 es-plus 的全局配置（permission/t/httpRequest 等），
 * 由 Vue 2 / Vue 3 各自的 install 函数在 use(EsPlus, options) 时调用 configureEsPlus 写入。
 *
 * 设计原则：
 * 1. 不依赖 Vue —— 单例对象由模块作用域闭包保管，跨框架共享
 * 2. 使用浅合并而非深合并，避免覆盖用户在新一次 use 时的显式 undefined
 * 3. getGlobalConfig 返回 readonly 引用，调用方不应直接修改其内容
 *
 * 提取自 packages/vue3/src/config.ts (1.3.5)，行为完全一致。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureEsPlus = configureEsPlus;
exports.getGlobalConfig = getGlobalConfig;
exports.resetGlobalConfig = resetGlobalConfig;
exports.httpRequest = httpRequest;
/**
 * 模块作用域单例 —— 整个应用生命周期内唯一
 *
 * 注意：此模式在 SSR 多实例环境（如多租户 server-side）下会发生串扰，
 * 当前 1.x 版本不针对此场景特殊处理。
 */
let globalConfig = {};
/**
 * 写入/合并全局配置
 *
 * 采用浅合并（top-level Object spread），子级 EsTable/EsForm 等会被整体覆盖，
 * 与原 1.3.5 版本行为保持一致。如需保留旧子级配置，调用方应自行展开。
 *
 * @param options 新的配置项
 */
function configureEsPlus(options) {
    globalConfig = { ...globalConfig, ...options };
}
/**
 * 读取全局配置（直接引用，请勿原地修改）
 */
function getGlobalConfig() {
    return globalConfig;
}
/**
 * 重置全局配置（主要供测试使用）
 *
 * 业务代码不应调用此函数 —— 一旦重置，已经从 getGlobalConfig 取过引用的代码
 * 会读到旧值，造成不一致。
 */
function resetGlobalConfig() {
    globalConfig = {};
}
/**
 * 从全局配置中解析出用户配置的 HTTP 请求函数。
 *
 * 兼容三端 install 写入单例后的三种键位约定：
 *   1. 顶层 `httpRequest` —— core 权威字段（app.use(EsPlus, { httpRequest })）
 *   2. `EsTable/EsForm.methods.$httpRequest` —— vue3 / adapter-antdv 原样透传的 options.methods
 *   3. `EsTable/EsForm.$httpRequest` —— vue2 normalizeLegacyOptions 展平 methods 之后
 */
function resolveHttpRequest(cfg) {
    if (typeof cfg.httpRequest === 'function')
        return cfg.httpRequest;
    for (const key of ['EsTable', 'EsForm']) {
        const sub = cfg[key];
        if (!sub || typeof sub !== 'object')
            continue;
        const methods = sub.methods;
        const nested = methods && typeof methods.$httpRequest === 'function' ? methods.$httpRequest : undefined;
        const flat = typeof sub.$httpRequest === 'function' ? sub.$httpRequest : undefined;
        const fn = nested || flat;
        if (typeof fn === 'function')
            return fn;
    }
    return null;
}
/**
 * 全局 HTTP 请求自由函数（配置驱动 / 多端同构 / AI 原生）。
 *
 * 供 AI + mcp-server 生成的 CRUD 包装代码直接
 *   `import { httpRequest } from '@es-plus/vue3'`（或 '@es-plus/vue2' / '@es-plus/adapter-antdv'）
 * 后调用，而无需在组件 provide/inject 树内取用。它解析 install 时写入模块单例的全局 HTTP 客户端，
 * 因此与 EsTable / EsForm 内部使用的是同一个请求实例（单一实例，避免重复配置）。
 *
 * @param params 传给用户配置的 HTTP 请求函数的参数对象（如 { url, method, params, data }）
 * @throws 若未通过 configureEsPlus / app.use(EsPlus, { httpRequest }) 配置，抛出明确错误，
 *         而非静默返回 undefined —— 便于在开发期立刻定位「忘记配置全局请求函数」。
 */
function httpRequest(params) {
    const fn = resolveHttpRequest(getGlobalConfig());
    if (!fn) {
        throw new Error('[es-plus] 全局 httpRequest 未配置。请在应用入口配置全局请求函数，例如：\n' +
            '  app.use(EsPlus, { httpRequest: (params) => axios(params) })\n' +
            '  // 或（兼容旧约定）app.use(EsPlus, { EsTable: { methods: { $httpRequest } } })\n' +
            'AI 生成的 CRUD 代码依赖该全局请求函数完成列表查询与增删改查。');
    }
    return fn(params);
}
