import { describe, it, expect } from 'vitest'
import { generateCrudPage } from '../src/code-generator.js'
import { PRESET_EXAMPLES } from '../src/constants.js'
import { VALID_FORM_TYPES, SPECIAL_BTN_KEYS } from '../src/contract.js'

describe('generateCrudPage — snapshot tests', () => {
  for (const example of PRESET_EXAMPLES) {
    it(`generates stable output for: ${example.label}`, () => {
      const result = generateCrudPage(example.prompt)
      expect(result.code).toMatchSnapshot()
    })
  }
})

describe('generateCrudPage — contract compliance', () => {
  for (const example of PRESET_EXAMPLES) {
    it(`${example.label}: only uses valid formtype values`, () => {
      const result = generateCrudPage(example.prompt)
      const formtypeMatches = [...result.code.matchAll(/formtype['":\s]+['"](\w+)['"]/g)]
      for (const match of formtypeMatches) {
        expect(VALID_FORM_TYPES as readonly string[]).toContain(match[1])
      }
    })

    it(`${example.label}: uses '${SPECIAL_BTN_KEYS.RESET}' for reset button`, () => {
      const result = generateCrudPage(example.prompt)
      expect(result.code).toContain(`key: '${SPECIAL_BTN_KEYS.RESET}'`)
      expect(result.code).not.toMatch(/key:\s*['"]reset['"]/)
    })

    it(`${example.label}: generated code has valid SFC structure`, () => {
      const result = generateCrudPage(example.prompt)
      expect(result.code).toContain('<template>')
      expect(result.code).toContain('</template>')
      expect(result.code).toContain('<script setup>')
      expect(result.code).toContain('</script>')
    })

    it(`${example.label}: imports ElTag when status render exists`, () => {
      const result = generateCrudPage(example.prompt)
      if (result.config.hasStatusRender) {
        expect(result.code).toContain('ElTag')
        expect(result.code).toMatch(/import\s*\{[^}]*ElTag[^}]*\}\s*from\s*['"]element-plus['"]/)
      }
    })

    it(`${example.label}: imports ElMessageBox when delete action exists`, () => {
      const result = generateCrudPage(example.prompt)
      if (result.config.actions.includes('delete')) {
        expect(result.code).toContain('ElMessageBox')
        expect(result.code).toContain('ElMessage')
      }
    })
  }
})

describe('generateCrudPage — summary', () => {
  it('includes field count and action information', () => {
    const result = generateCrudPage(PRESET_EXAMPLES[0].prompt)
    expect(result.summary).toContain('query form fields')
    expect(result.summary).toContain('table columns')
    expect(result.summary).toContain('Actions:')
  })
})
