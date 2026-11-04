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

// P4：产物运行时契约（片段包装层向宿主暴露什么）。从子路径导出，避免场景元数据
// 反过来依赖生成器实现 —— 本文件仍是「只读常量」。
export {
  ARTIFACT_RUNTIME,
  runtimeOf,
  type ArtifactRuntimeContract,
  type ArtifactSuccessContract,
  type SuccessKind,
} from './runtime.js'

// P5：产物信封（`es-plus.artifact@1`）。与运行时契约一样是只读元数据 + 纯函数，
// 不依赖生成器实现，因此可以从子路径导出。
export {
  ARTIFACT_CONTRACT_VERSION,
  buildArtifactEnvelope,
  fingerprintArtifact,
  type ArtifactDraft,
  type ArtifactEnvelope,
  type ArtifactFile,
} from './artifact.js'
