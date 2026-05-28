/**
 * 表单 / 表格请求逻辑（框架无关纯函数）
 *
 * 处理三件事：
 *   1. 把组件配置（apiParams + httpRequest）拼装成统一的请求 payload
 *   2. 把后端响应映射到组件内部约定字段（total / pageSize / current / listData）
 *   3. 批量并发拉取多个表单字段的远端选项数据
 *
 * 提取自 packages/es-plus/src/composables/use-form-request.ts (1.3.5)，
 * 移除 vue 的 nextTick / toRaw / unref 依赖：
 *   - nextTick：仅用于让初始化时机 fall behind reactive flush，渲染层可在自己的
 *     微任务里再包一层（例如 Vue 3 nextTick / Vue 2 Vue.nextTick）。core 不感知。
 *   - toRaw / unref：core 接收的已经是普通对象，调用方在传入前自行 unwrap。
 */
import type { ApiParams, FormItemOption } from './types';
/**
 * 单次请求配置 —— 由调用方传入，描述本次请求要怎么发
 */
export interface RequestConfig {
    /** 该字段/组件级 httpRequest，未配则降级到 global */
    httpRequest?: (params: Record<string, unknown>) => Promise<unknown>;
    /** 字段级 apiParams */
    apiParams?: ApiParams;
    /** 成功回调 */
    success?: (res: Record<string, unknown>) => void;
    /** 失败回调 */
    fail?: (err: unknown) => void;
    /** 允许携带其它扩展字段透传给请求方法 */
    [key: string]: unknown;
}
/**
 * 后端响应字段映射的内部 shape
 * 与 ConfigTableOut 不同，这里使用 listData 这个内部约定 key
 * （ConfigTableOut.tableData 在更早的版本里叫 listData）
 */
export interface ConfigFormFieldOut {
    total: string;
    pageSize: string;
    current: string;
    listData: string;
}
/**
 * 默认字段映射（与 1.3.5 保持一致）
 */
export declare const DEFAULT_CONFIG_FORM_FIELD_OUT: ConfigFormFieldOut;
/**
 * 校验 configFormOut 是否所有 key 都齐全且都是非空字符串
 */
export declare function checkQueryFields(obj: unknown): boolean;
/**
 * 从用户配置中解析最终生效的字段映射
 *
 * 优先级：组件 options.configFormOut > fieldFieldOutput 注入函数 > 默认值
 */
export declare function configFormField(options?: Record<string, unknown>, fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut): ConfigFormFieldOut;
/**
 * 把后端响应按字段映射规则提取出来
 *
 * 行为细节（1.3.5 对齐）：
 * - 若 keyList 含 'listData' 且 row 本身是数组 → 直接把 row 当作列表
 * - 否则按 configFieldOut 的 mapping 取值
 * - 取值优先 row[mapped]，再 fallback 到 findValueByKey 深度查找
 * - listData 强制转数组；其它字段强制转数字
 *
 * @param row API 响应原始数据
 * @param keyList 需要提取的内部 key 列表（'total' | 'pageSize' | 'current' | 'listData'）
 * @param options 字段配置（可能含 configFormOut）
 * @param fieldFieldOutput 字段映射注入函数
 */
export declare function formatConfigOut(row: Record<string, unknown> | unknown[], keyList: string[], options?: Record<string, unknown>, fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut): Record<string, unknown>;
/**
 * 把 ApiParams + 用户 model + 全局 httpRequest 拼装成请求 payload 并发送
 *
 * 注意：
 * - 调用方应已对 model/options 做过 toRaw/unref，core 不感知响应式
 * - success/fail 是同步回调，core 不会链式 then 它们的返回值
 *
 * @param params 表单 model 参数
 * @param options 字段级 RequestConfig
 * @param httpRequestGlobal 全局 httpRequest
 */
export declare function queryTableListMethod(params: Record<string, unknown>, options?: RequestConfig, httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>): void;
/**
 * 单字段远端拉取并解析（Promise 化）
 *
 * 与原 es-eui httpRquestFormInstace 行为对齐：
 *   - resolve 的 data 字段是 `res?.data`（已从外层响应中"剥一层"），不是原始响应。
 *   - 这样下游 crtn / 默认 fallback 拿到的就是真正的列表数组，无需再二次解包。
 *   - 如果 res 本身就是数组（无 .data 包裹），data 会是 undefined；
 *     此时 configRows.listData 会兜住（formatConfigOut 已处理数组直传路径）。
 *
 * @param model 表单参数
 * @param options 字段级 RequestConfig
 * @param rows 字段配置（apiParams 来源）
 * @param httpRequestGlobal 全局 httpRequest
 * @param fieldFieldOutput 字段映射注入
 */
export declare function httpRequestFormInstance(model: Record<string, unknown>, options: RequestConfig, rows: FormItemOption, httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>, fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut): Promise<{
    data: unknown;
    configRows: Record<string, unknown>;
}>;
/**
 * 远程选项加载结果
 */
export interface FormFieldOptionResult {
    prop: string;
    listData: unknown[];
}
/**
 * 批量拉取所有字段的远端选项
 *
 * 处理流程（与原 es-eui getEveryFormQueryFiled 行为对齐）：
 * 1. 过滤出有 apiParams.url 的字段
 * 2. 并发请求所有字段（用 wrapPromise 容错，单字段失败不影响其它）
 * 3. 计算"预提取列表" preExtractedList：
 *      configRows.listData (按字段映射提取) → data (剥一层后的) → dataOptions → []
 * 4. 若配置了 listenToCallBack.crtn：把 preExtractedList 传给 crtn，crtn 返回数组才采纳
 * 5. 否则若有 callOptionListFormat，则把 preExtractedList 交给它格式化
 * 6. 最终再兜底到 configRows.listData / dataOptions / []
 */
export declare function getEveryFormQueryField(rowsList: FormItemOption[], httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>, fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut): Promise<FormFieldOptionResult[]>;
//# sourceMappingURL=request.d.ts.map