/**
 * 场景注册表子路径入口。
 *
 * 单独开 `@es-plus/shared/scene` 而不是全走 barrel：
 * `scripts/eval/scenes.mjs` 与多个守卫只需要四场景常量；从 barrel 进会连带把
 * esbuild / Zod / 生成器全部加载进来，既慢又让「场景元数据」与「发射实现」耦合。
 */
export {
  SCENE_IDS,
  ARTIFACT_KINDS,
  SCENE_REGISTRY,
  DEFAULT_SCENE,
  SCENES,
  SCENE_TOOL,
  MODES,
  DIALOG_MODES,
  MODELESS,
  sceneContract,
  modesOf,
  artifactFamilyOf,
  isScene,
  sceneOf,
  type SceneId,
  type SceneMode,
  type SceneIntentKind,
  type ArtifactKind,
  type SceneContract,
} from './registry.js'
