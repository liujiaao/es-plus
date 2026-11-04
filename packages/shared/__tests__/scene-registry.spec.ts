import { describe, it, expect } from 'vitest'
import {
  SCENES,
  SCENE_IDS,
  SCENE_REGISTRY,
  SCENE_TOOL,
  DEFAULT_SCENE,
  MODES,
  DIALOG_MODES,
  MODELESS,
  DIALOG_TITLES,
  dialogTitleFor,
  modesOf,
  artifactFamilyOf,
  isScene,
  sceneOf,
} from '../src/scene/index.js'

describe('scene registry — 单一真源不变量', () => {
  it('四场景齐全且顺序稳定', () => {
    expect(SCENES).toEqual(['crud', 'table', 'form', 'dialog'])
    for (const id of SCENE_IDS) expect(SCENES).toContain(id)
  })

  it('每个场景至少一个 artifact、三端齐全、模式轴符合事实', () => {
    for (const scene of SCENE_REGISTRY) {
      expect(scene.artifacts.length).toBeGreaterThan(0)
      expect(scene.targets).toEqual(['vue3', 'vue2', 'antdv'])
      if (scene.id === 'crud') {
        expect(scene.modes).toEqual(['schema', 'sfc'])
      } else if (scene.id === 'dialog') {
        expect(scene.modes).toEqual(['composable', 'component'])
      } else {
        expect(scene.modes).toEqual([MODELESS])
      }
    }
  })

  it('SCENE_TOOL 从 entry.tool 派生，不另写一份', () => {
    for (const scene of SCENES) {
      const contract = SCENE_REGISTRY.find((s) => s.id === scene)!
      expect(SCENE_TOOL[scene]).toBe(contract.entry.tool)
      // P2：canonical 入口统一为场景路由器；旧工具降为 adapter。
      expect(contract.entry.tool).toBe('generate_scene')
      expect(contract.entry.adapters.length).toBeGreaterThan(0)
    }
  })

  it('modesOf / artifactFamilyOf 与注册表一致', () => {
    expect(modesOf('crud')).toEqual(MODES)
    expect(modesOf('dialog')).toEqual(DIALOG_MODES)
    expect(modesOf('table')).toEqual([MODELESS])
    expect(artifactFamilyOf('crud')).toBe('crud-page')
    expect(artifactFamilyOf('table')).toBe('table')
  })

  it('sceneOf 缺省/非法值都落到 crud，isScene 只认四场景', () => {
    expect(DEFAULT_SCENE).toBe('crud')
    expect(sceneOf({})).toBe('crud')
    expect(sceneOf({ scene: 'nope' })).toBe('crud')
    expect(sceneOf({ scene: 'dialog' })).toBe('dialog')
    expect(isScene('table')).toBe(true)
    expect(isScene('composition')).toBe(false)
  })

  it('片段场景在样本不足时不得自称 definition95', () => {
    for (const scene of SCENE_REGISTRY) {
      if (scene.id === 'crud') continue
      expect(scene.eval.gate).toBe('fragment-global')
      expect(scene.eval.minCasesFor95).toBeGreaterThanOrEqual(60)
    }
  })

  // P5：标题既是文案又是提交方法 / 只读语义的判据，必须单源。
  it('罐头弹窗标题单源：add/edit/view 各有默认标题，未知 key 原样返回', () => {
    expect(DIALOG_TITLES).toEqual({ add: '新增', edit: '编辑', view: '查看' })
    expect(dialogTitleFor('add')).toBe('新增')
    expect(dialogTitleFor('view')).toBe('查看')
    expect(dialogTitleFor('order-detail')).toBe('order-detail')
    expect(Object.isFrozen(DIALOG_TITLES)).toBe(true)
  })
})
