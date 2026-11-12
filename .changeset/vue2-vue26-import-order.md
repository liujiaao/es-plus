---
"@es-plus/vue2": patch
---

修复 Vue 2.6 下 `import '@es-plus/vue2'` 即抛错（1.6.0 回归）

1.6.0 把内置文案收敛到 core 的 `resolveBuiltinText` 后，`locale.ts` 在模块顶层执行
`ref(getLocaleVersion())`。ES 模块的依赖先于使用方求值，所以这行发生在用户
`Vue.use(EsPlus)` 之前；而 `@vue/composition-api` 的安装当时仍只在 `install()` 里，
Vue 2.6 宿主因此在 import 阶段就命中：

```
[vue-composition-api] must call Vue.use(VueCompositionAPI) before using any function.
```

现在 `vue-compat` 在导出 `ref` 等 API 之前，按 `Vue.version` 判断并在模块求值阶段安装
polyfill（Vue 2.7+ 走原生分支，不受影响），同时以 `__composition_api_installed__`
标记避免 `install()` 二次安装。新增 `vue26-import-order.spec.ts` 回归覆盖安装时机。

受影响范围：仅 Vue 2.6.x 宿主；Vue 2.7+ 行为不变。用户侧无需改代码。
