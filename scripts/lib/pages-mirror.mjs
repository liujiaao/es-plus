/**
 * GitHub Pages 镜像的部署形状。
 *
 * **镜像不是规范地址**：三站的规范地址在 `SITES`（EdgeOne Makers 的自有域名）。
 * GitHub Pages 仍在 `deploy-docs.yml` 里合成发布，作用是让旧链接（README 历史版本、
 * 外部文章、聊天记录）继续可打开。它不在切换器、canonical 或 sitemap 里公布。
 *
 * 站点目录 → 子路径的映射从工作流读取，不在这里另抄一份：工作流改了而这里没改，
 * 404 兜底就会把用户送去一个不存在的子站。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEPLOY_WORKFLOW = '.github/workflows/deploy-docs.yml'

/** GitHub Pages 的发布根（仓库页）与主站基准路径 */
export const PAGES_ORIGIN = 'https://liujiaao.github.io'
export const PAGES_BASE = '/es-plus/'

/** 三站在镜像里的目录（与 check-site-nav 的 SITE_TARGETS 对应） */
export const MIRROR_DIRS = ['es-plus-docs', 'es-pc', 'es-eui']

/** 从 deploy-docs.yml 的 `cp -r <dir>/dist/. _site/<sub>/` 解析「目录 → 子路径」 */
export function readDeployPaths() {
  const file = join(ROOT, DEPLOY_WORKFLOW)
  if (!existsSync(file)) {
    throw new Error(`缺少 ${DEPLOY_WORKFLOW} —— 无法确认 GitHub Pages 镜像是否仍在发布`)
  }
  const src = readFileSync(file, 'utf8')
  const byDir = new Map()
  for (const match of src.matchAll(/cp\s+-r\s+([\w.-]+)\/dist\/\.\s+_site\/([\w./-]*)/g)) {
    byDir.set(match[1], match[2].replace(/\/$/, ''))
  }
  if (!byDir.size) {
    throw new Error(
      `未能从 ${DEPLOY_WORKFLOW} 解析出站点子路径（依赖 cp -r <dir>/dist/. _site/<sub>/ 形式）`,
    )
  }
  return byDir
}

/** 镜像里某站点的完整前缀，例如 `/es-plus/` 或 `/es-plus/es-pc/` */
export function mirrorPrefix(dir, deployPaths = readDeployPaths()) {
  const sub = deployPaths.get(dir)
  if (sub === undefined) {
    throw new Error(`${DEPLOY_WORKFLOW} 没有把 ${dir} 拷进 Pages 产物`)
  }
  return sub ? `${PAGES_BASE}${sub}/` : PAGES_BASE
}

/** 镜像里的两个子站前缀（按长度降序，404 兜底按前缀匹配时天然正确） */
export function mirrorSubSites(deployPaths = readDeployPaths()) {
  return MIRROR_DIRS.filter((dir) => dir !== 'es-plus-docs')
    .map((dir) => mirrorPrefix(dir, deployPaths))
    .sort((a, b) => b.length - a.length)
}
