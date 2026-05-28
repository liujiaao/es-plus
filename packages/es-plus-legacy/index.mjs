// es-plus-ui stub — renamed to @es-plus/vue3 starting v1.4.0.
// This package re-exports @es-plus/vue3 unchanged. Future development
// happens on @es-plus/vue3; please update your dependencies.
//
// Migration: replace `from 'es-plus-ui'` with `from '@es-plus/vue3'`.

let _warned = false
function warnOnce() {
  if (_warned) return
  _warned = true
  if (typeof process !== 'undefined' && process.env && process.env.ES_PLUS_SILENCE_DEPRECATION) return
  // eslint-disable-next-line no-console
  console.warn(
    '[es-plus-ui] This package was renamed to @es-plus/vue3 in v1.4.0. ' +
      'es-plus-ui is now a re-export stub and is deprecated. ' +
      'Please update imports: `from \'es-plus-ui\'` → `from \'@es-plus/vue3\'`. ' +
      'Set ES_PLUS_SILENCE_DEPRECATION=1 to silence this warning.'
  )
}

warnOnce()

export * from '@es-plus/vue3'
export { default } from '@es-plus/vue3'
