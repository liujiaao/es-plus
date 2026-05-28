// es-plus-ui stub — renamed to @es-plus/vue3 starting v1.4.0.
// CommonJS variant. See index.mjs for the rationale.

'use strict'

let _warned = false
function warnOnce() {
  if (_warned) return
  _warned = true
  if (typeof process !== 'undefined' && process.env && process.env.ES_PLUS_SILENCE_DEPRECATION) return
  // eslint-disable-next-line no-console
  console.warn(
    '[es-plus-ui] This package was renamed to @es-plus/vue3 in v1.4.0. ' +
      'es-plus-ui is now a re-export stub and is deprecated. ' +
      "Please update imports: require('es-plus-ui') → require('@es-plus/vue3'). " +
      'Set ES_PLUS_SILENCE_DEPRECATION=1 to silence this warning.'
  )
}

warnOnce()

module.exports = require('@es-plus/vue3')
