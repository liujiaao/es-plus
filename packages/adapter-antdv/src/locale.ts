/**
 * 渲染器侧的 locale 桥（P2-4 运行期热切换）
 *
 * 与 `@es-plus/vue3` 的同名模块逻辑一致：`@es-plus/core` 的 `resolveBuiltinText`
 * 读普通全局单例（非响应式），这里先读一次包内 `ref`（locale 版本号）再取文案，
 * 让 computed / render / 模板里的调用点自动在 `configureEsPlus({ locale })` 后重算。
 *
 * 组件必须从**本模块** import `resolveBuiltinText`，不要直接 `from '@es-plus/core'`。
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

/** 取一条内置文案（locale 热切换感知）。 */
export function resolveBuiltinText(key: BuiltinTextKey): string {
  void localeTick.value
  return resolveCoreBuiltinText(key)
}
