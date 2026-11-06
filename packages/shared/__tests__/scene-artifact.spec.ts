// P5：产物信封 `es-plus.artifact@2`。
//
// 这里钉的是信封的**身份语义**：版本字面量、指纹的确定性与敏感性、结构不变量
// （非空 files / 唯一路径 / 未知 artifact 拒绝），以及「信封是附加视图 —— 不改变
// emitScene 的文本」。语料全量对照在 `scripts/check-artifact-envelope.mjs`。
import { describe, it, expect } from 'vitest'
import {
  ARTIFACT_CONTRACT_VERSION,
  buildArtifactEnvelope,
  fingerprintArtifact,
  type ArtifactDraft,
} from '../src/scene/artifact'
import { ARTIFACT_KINDS } from '../src/scene/registry'
import { emitScene, emitSceneArtifact } from '../src/scene/emit'

const draft = (over: Partial<ArtifactDraft> = {}): ArtifactDraft => ({
  scene: 'form',
  artifact: 'form',
  target: 'vue3',
  mode: null,
  files: [{ path: 'FormBlock.vue', code: '<template><div /></template>', language: 'vue' }],
  config: { name: 'Demo', fields: [{ prop: 'name', label: '姓名' }] },
  warnings: ['w1'],
  ...over,
})

describe('buildArtifactEnvelope — 盖章与结构不变量', () => {
  it('contract 是版本字面量，fingerprint 是 16 位十六进制', () => {
    const e = buildArtifactEnvelope(draft())
    expect(e.contract).toBe('es-plus.artifact@2')
    expect(ARTIFACT_CONTRACT_VERSION).toBe('es-plus.artifact@2')
    expect(e.fingerprint).toMatch(/^[0-9a-f]{16}$/)
  })

  it('信封字段与草稿一一对应（files 冻结、warnings 复制）', () => {
    const d = draft()
    const e = buildArtifactEnvelope(d)
    expect(e.scene).toBe(d.scene)
    expect(e.artifact).toBe(d.artifact)
    expect(e.target).toBe(d.target)
    expect(e.mode).toBe(d.mode)
    expect(e.files).toEqual(d.files)
    expect(e.warnings).toEqual(d.warnings)
    expect(Object.isFrozen(e)).toBe(true)
    expect(Object.isFrozen(e.files)).toBe(true)
  })

  it('空 files / 重复路径 / 未知 artifact 都抛错', () => {
    expect(() => buildArtifactEnvelope(draft({ files: [] }))).toThrow(/没有任何文件/)
    expect(() =>
      buildArtifactEnvelope({
        ...draft(),
        files: [draft().files[0], { ...draft().files[0] }],
      }),
    ).toThrow(/重复文件路径/)
    expect(() => buildArtifactEnvelope(draft({ artifact: 'not-a-kind' as never }))).toThrow(/未知 artifact/)
  })
})

describe('fingerprintArtifact — 确定性与敏感性', () => {
  it('对象键序不影响指纹', () => {
    const a = buildArtifactEnvelope(draft({ config: { a: 1, b: 2 } }))
    const b = buildArtifactEnvelope(draft({ config: { b: 2, a: 1 } }))
    expect(a.fingerprint).toBe(b.fingerprint)
  })

  it('改一个字节 / 改路径 / 改告警 / 改 target 都让指纹变化', () => {
    const base = draft()
    const fp = fingerprintArtifact(base)
    expect(fingerprintArtifact({ ...base, files: [{ ...base.files[0], code: base.files[0].code + ' ' }] })).not.toBe(fp)
    expect(fingerprintArtifact({ ...base, files: [{ ...base.files[0], path: 'Other.vue' }] })).not.toBe(fp)
    expect(fingerprintArtifact({ ...base, warnings: ['w2'] })).not.toBe(fp)
    expect(fingerprintArtifact({ ...base, target: 'vue2' })).not.toBe(fp)
  })

  it('函数值不会让指纹失稳（同一函数两次得到同一指纹）', () => {
    const fn = () => true
    const a = fingerprintArtifact(draft({ config: { render: fn } }))
    const b = fingerprintArtifact(draft({ config: { render: fn } }))
    expect(a).toBe(b)
  })
})

describe('emitSceneArtifact — 信封是附加视图', () => {
  const plan = {
    scene: 'form' as const,
    intent: {
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        { prop: 'age', label: '年龄', formtype: 'InputNumber' as const },
      ],
      target: 'vue3' as const,
    },
  }

  it('text 与 emitScene 逐字节相同，envelope 描述同一份产物', () => {
    const plain = emitScene(plan)
    const rich = emitSceneArtifact(plan)
    expect(rich.text).toBe(plain.text)
    expect(rich.isError).toBeUndefined()
    expect(rich.envelope).toBeDefined()
    const e = rich.envelope!
    expect(e.scene).toBe('form')
    expect(e.artifact).toBe('form')
    expect(e.mode).toBeNull()
    expect(e.files).toHaveLength(1)
    expect(e.files[0].path).toBe('FormBlock.vue')
    // 信封里的代码真的出现在文本里（不是另编的一份）
    expect(rich.text).toContain(e.files[0].code)
    expect(ARTIFACT_KINDS).toContain(e.artifact)

    // @2：发射路径的信封必带能力台账；直接盖章的草稿不带（没有意图可评估）。
    expect(e.capability?.contract).toBe('es-plus.capabilities@1')
    expect(e.capability?.scene).toBe('form')
    expect(e.capability?.unsupported).toEqual([])
    expect('capability' in buildArtifactEnvelope(draft())).toBe(false)
  })

  it('失败分支没有信封', () => {
    const rich = emitSceneArtifact({
      scene: 'crud',
      intent: { name: 'x', apiUrl: '/x', surfaces: {} } as never,
    })
    expect(rich.isError).toBe(true)
    expect(rich.envelope).toBeUndefined()
  })
})
