#!/usr/bin/env node
import { Command } from 'commander'
import prompts from 'prompts'
import pc from 'picocolors'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  copyFileSync,
} from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 模板根目录。tsc 把本文件编译到 build/index.js，templates/ 与 build/ 同级
 * （见 package.json 的 "files": ["build", "templates"]）。开发态（ts-node 直接
 * 跑 src/）与发布态（build/）下 ../templates 都成立，故统一用 ../templates。
 */
const TEMPLATES_DIR = resolve(__dirname, '..', 'templates')

type Target = 'vue3' | 'vue2' | 'antdv'

interface RendererMeta {
  value: Target
  title: string
  /** 该端装 es-plus 后还需要的宿主依赖，用于 next-steps 提示 */
  stack: string
}

const RENDERERS: RendererMeta[] = [
  { value: 'vue3', title: 'Vue 3 + Element Plus  (@es-plus/vue3)', stack: 'vue@3 · element-plus' },
  { value: 'vue2', title: 'Vue 2 + Element UI    (@es-plus/vue2)', stack: 'vue@2.7 · element-ui' },
  { value: 'antdv', title: 'Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)', stack: 'vue@3 · ant-design-vue' },
]

const isValidTarget = (t: unknown): t is Target =>
  t === 'vue3' || t === 'vue2' || t === 'antdv'

/** 目标目录为空 / 不存在 / 只有 .git 时视为可直接写入 */
function isEmptyEnough(dir: string): boolean {
  if (!existsSync(dir)) return true
  const entries = readdirSync(dir).filter((e) => e !== '.git')
  return entries.length === 0
}

/**
 * 递归拷贝模板目录到目标目录。
 * - `_gitignore` / `_npmrc` 还原成 `.gitignore` / `.npmrc`：npm 发包时会把
 *   真实的 dotfile（尤其 .gitignore）从 tarball 里剥掉，模板里必须用 `_` 前缀存。
 */
function copyTemplate(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true })
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry)
    const renamed = entry === '_gitignore' ? '.gitignore' : entry === '_npmrc' ? '.npmrc' : entry
    const destPath = join(destDir, renamed)
    if (statSync(srcPath).isDirectory()) {
      copyTemplate(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

/** 把拷贝出的 package.json 的 name 改成用户项目名（其余字段原样保留） */
function rewritePackageName(destDir: string, projectName: string): void {
  const pkgPath = join(destDir, 'package.json')
  if (!existsSync(pkgPath)) return
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  pkg.name = projectName
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

/**
 * 写入 MCP 配置（项目根 `.mcp.json`，Claude Code / 支持 .mcp.json 的客户端直接识别）。
 * 默认用 npx 形态：零预装、克隆即用。npx 首跑冷启动慢（可能触发客户端连接超时），
 * 故在 README 里引导升级到全局安装（`mcp-server-es-plus`）。
 */
function writeMcpConfig(destDir: string): void {
  const mcp = {
    mcpServers: {
      'es-plus': {
        command: 'npx',
        args: ['-y', '@es-plus/mcp-server'],
      },
    },
  }
  writeFileSync(join(destDir, '.mcp.json'), JSON.stringify(mcp, null, 2) + '\n')
}

async function run(): Promise<void> {
  const program = new Command('create-es-plus')
    .argument('[dir]', '项目目录（省略则交互询问；"." 表示当前目录）')
    .option('-t, --target <target>', '渲染器: vue3 | vue2 | antdv')
    .option('--mcp', '写入 MCP (AI 生成) 配置')
    .option('--no-mcp', '跳过 MCP 配置')
    .option('-y, --yes', '全部用默认值，不交互（CI / 一把梭）')
    .option('-f, --force', '目标目录非空时仍写入')
    .description('脚手架一个开箱即跑的 ES-Plus 工程')
    .allowExcessArguments(false)

  program.parse(process.argv)
  const opts = program.opts<{ target?: string; mcp?: boolean; yes?: boolean; force?: boolean }>()
  const dirArg = program.args[0]

  // 显式传了未知 target 直接报错，避免静默降级
  if (opts.target !== undefined && !isValidTarget(opts.target)) {
    console.log(pc.red(`✗ 未知 target: ${opts.target}（可选: vue3, vue2, antdv）`))
    process.exitCode = 1
    return
  }

  console.log('')
  console.log(pc.cyan(pc.bold('  create-es-plus')) + pc.dim('  — 一份配置，三端一致的 CRUD 脚手架'))
  console.log('')

  // 1) 项目目录
  let dir = dirArg
  if (!dir && !opts.yes) {
    const res = await prompts({
      type: 'text',
      name: 'dir',
      message: '项目目录',
      initial: 'my-es-plus-app',
    })
    if (!res.dir) {
      console.log(pc.yellow('已取消'))
      return
    }
    dir = res.dir
  }
  dir = dir || 'my-es-plus-app'
  const destDir = resolve(process.cwd(), dir)
  const projectName = basename(destDir)

  // 2) 渲染器
  let target: Target | undefined = isValidTarget(opts.target) ? opts.target : undefined
  if (!target && !opts.yes) {
    const res = await prompts({
      type: 'select',
      name: 'target',
      message: '选择渲染器',
      choices: RENDERERS.map((r) => ({ title: r.title, value: r.value })),
      initial: 0,
    })
    if (!res.target) {
      console.log(pc.yellow('已取消'))
      return
    }
    target = res.target
  }
  target = target || 'vue3'

  // 3) MCP (AI) 接线
  let wantMcp: boolean
  if (opts.mcp === true || opts.mcp === false) {
    wantMcp = opts.mcp
  } else if (opts.yes) {
    wantMcp = true
  } else {
    const res = await prompts({
      type: 'confirm',
      name: 'mcp',
      message: '接入 MCP（让 Claude Code / Cursor 用自然语言生成 es-plus CRUD）？',
      initial: true,
    })
    wantMcp = res.mcp !== false
  }

  // 4) 目录可写性
  if (!isEmptyEnough(destDir) && !opts.force) {
    if (opts.yes) {
      console.log(pc.red(`✗ 目标目录非空：${destDir}（加 --force 覆盖）`))
      process.exitCode = 1
      return
    }
    const res = await prompts({
      type: 'confirm',
      name: 'go',
      message: `目录 ${pc.yellow(dir)} 非空，仍要写入？`,
      initial: false,
    })
    if (!res.go) {
      console.log(pc.yellow('已取消'))
      return
    }
  }

  const templateDir = join(TEMPLATES_DIR, target)
  if (!existsSync(templateDir)) {
    console.log(pc.red(`✗ 模板缺失：${templateDir}`))
    process.exitCode = 1
    return
  }

  // 5) 落盘
  copyTemplate(templateDir, destDir)
  rewritePackageName(destDir, projectName)
  if (wantMcp) writeMcpConfig(destDir)

  // 6) next steps
  const meta = RENDERERS.find((r) => r.value === target)!
  console.log('')
  console.log(pc.green(`✔ 已创建 ${pc.bold(projectName)}  (${meta.title})`))
  console.log('')
  console.log(pc.bold('  下一步：'))
  if (dir !== '.') console.log(`    cd ${dir}`)
  console.log('    npm install')
  console.log('    npm run dev')
  console.log('')
  console.log(pc.dim(`  技术栈：${meta.stack}`))
  console.log(pc.dim('  示例页：src/views/DemoCrud.vue（查询表单 + 表格，零后端可跑）'))
  if (wantMcp) {
    console.log('')
    console.log(pc.cyan('  已写入 .mcp.json —— 在 Claude Code / Cursor 里对 AI 说：'))
    console.log(pc.cyan('    “用 es-plus 做一个订单管理 CRUD 页”'))
    console.log(pc.dim('  （npx 首跑较慢；想免等可全局装 @es-plus/mcp-server，见项目 README）'))
  }
  console.log('')
}

run().catch((err) => {
  console.log(pc.red(`✗ ${err instanceof Error ? err.message : String(err)}`))
  process.exitCode = 1
})
