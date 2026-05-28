/**
 * 框架无关的工具函数集合
 *
 * 这些函数被 @es-plus/vue3 (Vue 3) 和 @es-plus/vue2 (Vue 2) 共享。
 * 严禁引入任何 Vue / Element 依赖，保证 0 副作用、0 框架耦合。
 *
 * 提取自 packages/es-plus/src/utils/shared.ts (1.3.5)，
 * 行为完全一致，仅迁移位置以便跨框架复用。
 */
/** 判断是否为纯对象（plain object，不含数组/Date/RegExp 等） */
export const isObject = (value) => {
    return (typeof value === 'object' &&
        value !== null &&
        Object.prototype.toString.call(value) === '[object Object]');
};
/** 判断是否为数组 */
export const isArray = (value) => {
    return Array.isArray(value);
};
/** 判断是否为函数 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const isFunction = (value) => {
    return typeof value === 'function';
};
/** 判断是否为字符串 */
export const isString = (value) => {
    return typeof value === 'string';
};
/** 判断是否为有效数字（排除 NaN） */
export const isNumber = (value) => {
    return typeof value === 'number' && !isNaN(value);
};
/**
 * 判断值是否"空"
 * - null / undefined → true
 * - 空数组 → true
 * - 空对象（无可枚举键）→ true
 * - 其它 → false
 *
 * 注意：空字符串不视为 empty（与原实现一致）
 */
export const isEmpty = (value) => {
    if (value == null)
        return true;
    if (isArray(value))
        return value.length === 0;
    if (isObject(value))
        return Object.keys(value).length === 0;
    return false;
};
/** 首字母大写其余小写（注意：会把后续大写字母转小写） */
export const firstWordUpperCase = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
/** kebab-case 转 camelCase（如 'min-width' → 'minWidth'） */
export const kebabToCamel = (str) => {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};
/** kebab-case / 普通字符串 转 PascalCase（如 'es-table' → 'EsTable'） */
export const toPascalCase = (str) => {
    return str.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase());
};
/**
 * 在嵌套对象中递归查找指定 key 的值
 * 用于从后端响应中取出 total/listData 等字段（兼容 { data: { rows } } 这类嵌套结构）
 *
 * @param obj - 要搜索的对象
 * @param key - 要查找的字段名
 * @param depth - 当前递归深度，最大 3 层防止深嵌套爆栈
 * @returns 找到的值或 undefined
 */
export const findValueByKey = (obj, key, depth = 0) => {
    if (depth > 3)
        return undefined;
    if (!isObject(obj))
        return undefined;
    // 当前层直接持有则记录候选值（不立即返回，仍递归子对象优先深层匹配？
    // —— 实际逻辑：先记录当前候选，再尝试深层；若深层有则返回深层。
    // 这与原实现保持一致。
    const currentValue = Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    for (const prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop) && isObject(obj[prop])) {
            const deepValue = findValueByKey(obj[prop], key, depth + 1);
            if (deepValue !== undefined)
                return deepValue;
        }
    }
    return currentValue;
};
/**
 * 包装 Promise：永远 resolve，把成功/失败统一打平为 status 标记的对象
 * 与 Promise.allSettled 等价，但兼容旧环境（不依赖 ES2020）
 */
export const wrapPromise = (promise) => {
    return promise
        .then((value) => ({ status: 'fulfilled', value }))
        .catch((reason) => ({ status: 'rejected', reason }));
};
/**
 * 按路径取嵌套对象的值，支持点号和方括号表示法
 * 例如 getNestedValue({ a: { b: 1 } }, 'a.b') === 1
 *      getNestedValue({ list: [{ name: 'x' }] }, 'list[0].name') === 'x'
 *
 * 提取自 packages/es-plus/src/composables/use-form-inputs.ts，
 * 用于表单 v-model 绑定嵌套字段（如 user.address.city）。
 */
export const getNestedValue = (obj, path) => {
    if (obj == null || !path)
        return undefined;
    const keys = path.split(/\.|\[|\]/).filter(Boolean);
    let result = obj;
    for (const key of keys) {
        if (result == null)
            return undefined;
        result = result[key];
    }
    return result;
};
/**
 * 按路径设置嵌套对象的值（缺失中间层时自动创建普通对象）
 *
 * 注意：本函数直接修改 obj，不会触发 Vue 响应式（仅做路径写入）。
 * 调用方需要保证 obj 自身已被 reactive/ref 包裹，否则视图不会更新。
 */
export const setNestedValue = (obj, path, value) => {
    if (obj == null || !path)
        return;
    const keys = path.split(/\.|\[|\]/).filter(Boolean);
    const lastKey = keys.pop();
    let current = obj;
    for (const key of keys) {
        if (current[key] == null || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    if (lastKey) {
        current[lastKey] = value;
    }
};
//# sourceMappingURL=shared.js.map