// es-plus-ui/resolver stub — re-exports @es-plus/vue3/resolver.
//
// Note: the resolver returns module names like `@es-plus/vue3` (not `es-plus-ui`)
// in its component map. unplugin-vue-components handles either name correctly,
// but if you've configured custom alias rules expecting the old `es-plus-ui` path,
// switch to `@es-plus/vue3` directly.

export { EsPlusResolver, default } from '@es-plus/vue3/resolver'
