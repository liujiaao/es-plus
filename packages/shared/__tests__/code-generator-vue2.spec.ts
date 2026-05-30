// Vue 2 output coverage for the same generator that powers vue3 codegen.
// The JSON schema is byte-identical between targets — only the SFC syntax
// differs (defineComponent + setup vs <script setup>, :sync vs v-model:*,
// element-ui vs element-plus, etc.). These tests lock the vue2 output shape
// so regressions in target.ts (rewriteVModelSync / rewriteElementUsage /
// transformScriptSetupToOptions) get caught at PR time.

import { describe, it, expect } from 'vitest'
import { generateCrudPage } from '../src/code-generator.js'
import { PRESET_EXAMPLES } from '../src/constants.js'
import { VALID_FORM_TYPES, SPECIAL_BTN_KEYS } from '../src/contract.js'

const TARGET = 'vue2'

describe(`generateCrudPage (target=${TARGET}) — snapshot tests`, () => {
  for (const example of PRESET_EXAMPLES) {
    it(`generates stable output for: ${example.label}`, () => {
      const result = generateCrudPage(example.prompt, TARGET)
      expect(result.code).toMatchSnapshot()
    })
  }
})

describe(`generateCrudPage (target=${TARGET}) — contract compliance`, () => {
  for (const example of PRESET_EXAMPLES) {
    it(`${example.label}: uses @es-plus/vue2 (not vue3) and element-ui (not element-plus)`, () => {
      const result = generateCrudPage(example.prompt, TARGET)
      expect(result.code).toContain('@es-plus/vue2')
      expect(result.code).not.toContain('@es-plus/vue3')
      // ES-Plus runtime always re-exports useDialog from element-ui side; the
      // generated code should not pull in element-plus.
      expect(result.code).not.toMatch(/from\s*['"]element-plus['"]/)
    })

    it(`${example.label}: only uses valid formtype values`, () => {
      const result = generateCrudPage(example.prompt, TARGET)
      const matches = [...result.code.matchAll(/formtype['":\s]+['"](\w+)['"]/g)]
      for (const m of matches) {
        expect(VALID_FORM_TYPES as readonly string[]).toContain(m[1])
      }
    })

    it(`${example.label}: uses '${SPECIAL_BTN_KEYS.RESET}' for reset button`, () => {
      const result = generateCrudPage(example.prompt, TARGET)
      expect(result.code).toContain(`key: '${SPECIAL_BTN_KEYS.RESET}'`)
      expect(result.code).not.toMatch(/key:\s*['"]reset['"]/)
    })

    it(`${example.label}: uses Vue 2 SFC structure (defineComponent + setup, no <script setup>)`, () => {
      const result = generateCrudPage(example.prompt, TARGET)
      expect(result.code).toContain('<template>')
      expect(result.code).toContain('</template>')
      // Vue 2 output uses `defineComponent` (from vue-demi or vue@2.7) with a
      // setup() function. We deliberately avoid `<script setup>` because the
      // tooling story is weaker on Vue 2 and confuses element-ui's runtime.
      expect(result.code).toMatch(/defineComponent\s*\(/)
      expect(result.code).not.toMatch(/<script setup/)
    })

    it(`${example.label}: uses :sync v-model syntax (not v-model:prop)`, () => {
      const result = generateCrudPage(example.prompt, TARGET)
      // Vue 2 emits `:data-source.sync` etc. Vue 3's `v-model:data-source`
      // must NOT appear in the vue2 output.
      expect(result.code).not.toMatch(/v-model:[a-zA-Z-]+="/)
    })
  }
})
