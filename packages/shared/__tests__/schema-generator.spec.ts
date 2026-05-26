import { describe, it, expect } from 'vitest'
import { generateCrudSchema } from '../src/schema-generator.js'
import { PRESET_EXAMPLES } from '../src/constants.js'
import { VALID_FORM_TYPES, VALID_CRUD_ACTIONS } from '../src/contract.js'

describe('generateCrudSchema — snapshot tests', () => {
  for (const example of PRESET_EXAMPLES) {
    it(`generates stable schema for: ${example.label}`, () => {
      const result = generateCrudSchema(example.prompt)
      expect(result.schema).toMatchSnapshot()
    })

    it(`generates stable wrapper SFC for: ${example.label}`, () => {
      const result = generateCrudSchema(example.prompt)
      expect(result.wrapperCode).toMatchSnapshot()
    })
  }
})

describe('generateCrudSchema — schema structure', () => {
  for (const example of PRESET_EXAMPLES) {
    it(`${example.label}: has required columns array`, () => {
      const result = generateCrudSchema(example.prompt)
      expect(result.schema).toHaveProperty('columns')
      expect(Array.isArray(result.schema.columns)).toBe(true)
    })

    it(`${example.label}: actions are from valid set`, () => {
      const result = generateCrudSchema(example.prompt)
      const actions = result.schema.actions as string[]
      for (const action of actions) {
        expect(VALID_CRUD_ACTIONS as readonly string[]).toContain(action)
      }
    })

    it(`${example.label}: formItems use valid formtype`, () => {
      const result = generateCrudSchema(example.prompt)
      const formItems = (result.schema.formItems || []) as any[]
      for (const item of formItems) {
        if (item.formtype) {
          expect(VALID_FORM_TYPES as readonly string[]).toContain(item.formtype)
        }
      }
    })

    it(`${example.label}: schema is JSON-serializable (no functions)`, () => {
      const result = generateCrudSchema(example.prompt)
      const json = JSON.stringify(result.schema)
      const parsed = JSON.parse(json)
      expect(parsed).toEqual(result.schema)
    })
  }
})

describe('generateCrudSchema — wrapper SFC', () => {
  it('has valid SFC structure', () => {
    const result = generateCrudSchema(PRESET_EXAMPLES[0].prompt)
    expect(result.wrapperCode).toContain('<template>')
    expect(result.wrapperCode).toContain('<es-crud-page')
    expect(result.wrapperCode).toContain('</template>')
    expect(result.wrapperCode).toContain('<script setup>')
    expect(result.wrapperCode).toContain('</script>')
  })

  it('includes fetchData function', () => {
    const result = generateCrudSchema(PRESET_EXAMPLES[0].prompt)
    expect(result.wrapperCode).toContain('async function fetchData')
  })

  it('includes handleDelete when delete action present', () => {
    const result = generateCrudSchema('用户管理，支持新增编辑删除')
    expect(result.wrapperCode).toContain('handleDelete')
    expect(result.wrapperCode).toContain('ElMessageBox')
  })

  it('includes handleBtnClick for add/edit confirm', () => {
    const result = generateCrudSchema('用户管理，支持新增编辑')
    expect(result.wrapperCode).toContain('add-confirm')
    expect(result.wrapperCode).toContain('edit-confirm')
  })
})
