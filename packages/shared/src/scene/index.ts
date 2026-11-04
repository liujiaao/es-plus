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
  DIALOG_TITLES,
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
  dialogTitleFor,
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
  fingerprintPayload,
  type ArtifactDraft,
  type ArtifactEnvelope,
  type ArtifactFile,
} from './artifact.js'

// P9：场景能力台账（`es-plus.capabilities@1`）。与信封一样是只读元数据 + 纯函数：
// 场景词汇来自接口（编译期对账），CRUD 降级直接投影 `RENDER_PLAN_CONTRACT`。
export {
  CAPABILITY_CONTRACT_VERSION,
  CAPABILITY_VERDICTS,
  SCENE_INTENT_KEYS,
  CRUD_INTENT_KEYS,
  TABLE_INTENT_KEYS,
  FORM_INTENT_KEYS,
  DIALOG_INTENT_KEYS,
  assessIntent,
  capabilityLedger,
  type CapabilityVerdict,
  type CapabilityKeyVerdict,
  type CapabilityAssessmentInput,
  type CapabilityLedger,
  type IntentCapability,
} from './capability.js'

// P13：宿主抽取契约 —— 生成前校验（只判不改）+ 逐页覆盖分级（L1/L2/L3）。
// 与台账同属「只读元数据 + 纯函数」：不依赖生成器，故可以从场景子路径导出。
export {
  INTENT_VALIDATION_CONTRACT_VERSION,
  SURFACE_NAMES,
  MEMBERSHIP_FLAGS,
  validateIntentPlan,
  type SurfaceName,
  type IntentIssue,
  type IntentSurfaceStats,
  type IntentValidationReport,
  type ValidateIntentInput,
} from './intent-validation.js'

export {
  COVERAGE_CONTRACT_VERSION,
  COVERAGE_LEVELS,
  COVERAGE_LEVEL_MEANING,
  classifyCoverage,
  type CoverageLevel,
  type CoveragePartResult,
  type CoveragePageResult,
  type CoverageReport,
} from './coverage.js'
