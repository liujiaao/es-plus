/**
 * 渲染器侧的 locale 桥（P2-4 运行期热切换）
 *
 * 为什么需要它：`@es-plus/core` 的 `resolveBuiltinText` 读的是普通全局单例，单例本身
 * 不是响应式的 —— 只发版本号、组件也不会重算。这里的 `resolveBuiltinText` 先读一次
 * 包内 `ref`（当前 locale 版本号），**再**去 core 取文案；调用点只要在 computed /
 * render / 模板里，就自动把「locale 变化」登记成依赖，配置一改便重算。
 *
 * 于是宿主可以在任何时刻切换语言：
 *
 *   configureEsPlus({ locale: 'en-US' })   // 已挂载组件在下一 tick 显示英文
 *
 * 注意：组件必须从**本模块** import `resolveBuiltinText`（而不是直接
 * `from '@es-plus/core'`），否则该文件的热切换无效 —— 它会读到 core 的静态函数，
 * 拿不到这里的响应式依赖。
 */
import { ref } from 'vue'
import {
  getLocaleVersion,
  subscribeLocaleChange,
  resolveBuiltinText as resolveCoreBuiltinText,
  type BuiltinTextKey,
} from '@es-plus/core'

const localeTick = ref(getLocaleVersion())

subscribeLocaleChange(() => {
  localeTick.value = getLocaleVersion()
})

/**
 * 取一条内置文案（locale 热切换感知）。
 *
 * 优先返回 `core` 的解析结果；`void localeTick.value` 只为依赖登记，不参与返回值。
 */
export function resolveBuiltinText(key: BuiltinTextKey): string {
  void localeTick.value
  return resolveCoreBuiltinText(key)
}
