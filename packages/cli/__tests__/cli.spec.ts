import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  toPascalCase,
  toKebabCase,
  normalizeTarget,
  esPlusPkgFor,
  isValidTarget,
  isSafePathSegment,
  isPathInside,
  CLI_TARGETS,
} from '../src/utils/strings'
import { detectSchemaType } from '../src/commands/validate'
import { createCommand } from '../src/commands/create'
import { scaffoldCommand } from '../src/commands/scaffold'
import { extractJson, AiUnavailableError } from '../src/ai/nl-to-config'
import { writeGeneratedFiles } from '../src/utils/fs'

describe('strings.toPascalCase', () => {
  it('kebab → Pascal', () => {
    expect(toPascalCase('user-management')).toBe('UserManagement')
  })
  it('snake → Pascal', () => {
    expect(toPascalCase('order_list')).toBe('OrderList')
  })
  it('单词首字母大写', () => {
    expect(toPascalCase('user')).toBe('User')
  })
  it('已是 Pascal → 保持', () => {
    expect(toPascalCase('UserList')).toBe('UserList')
  })
})

describe('strings.toKebabCase', () => {
  it('Pascal → kebab', () => {
    expect(toKebabCase('UserManagement')).toBe('user-management')
  })
  it('camel → kebab', () => {
    expect(toKebabCase('orderList')).toBe('order-list')
  })
})

describe('strings.normalizeTarget', () => {
  it("'vue2' → vue2", () => expect(normalizeTarget('vue2')).toBe('vue2'))
  it("'antdv' → antdv", () => expect(normalizeTarget('antdv')).toBe('antdv'))
  it("'vue3' → vue3", () => expect(normalizeTarget('vue3')).toBe('vue3'))
  it('undefined → vue3（默认）', () => expect(normalizeTarget(undefined)).toBe('vue3'))
  it('未知值 → vue3（回落）', () => expect(normalizeTarget('svelte')).toBe('vue3'))
})

describe('strings.esPlusPkgFor', () => {
  it('vue3 → @es-plus/vue3', () => expect(esPlusPkgFor('vue3')).toBe('@es-plus/vue3'))
  it('vue2 → @es-plus/vue2', () => expect(esPlusPkgFor('vue2')).toBe('@es-plus/vue2'))
  it('antdv → @es-plus/adapter-antdv', () =>
    expect(esPlusPkgFor('antdv')).toBe('@es-plus/adapter-antdv'))
})

describe('strings.isValidTarget', () => {
  it('三端受支持值均合法', () => {
    for (const t of CLI_TARGETS) expect(isValidTarget(t)).toBe(true)
  })
  it('undefined（未传）合法（命令层默认 vue3）', () => {
    expect(isValidTarget(undefined)).toBe(true)
  })
  it('未知值不合法（不再静默降级 vue3）', () => {
    expect(isValidTarget('svelte')).toBe(false)
    expect(isValidTarget('vue4')).toBe(false)
    expect(isValidTarget('')).toBe(false)
  })
})

describe('validate.detectSchemaType', () => {
  it('含 columns → table-column', () => {
    expect(detectSchemaType({ columns: [] })).toBe('table-column')
  })
  it('含 tableData → table-column', () => {
    expect(detectSchemaType({ tableData: [] })).toBe('table-column')
  })
  it('含 rowkey → table-options', () => {
    expect(detectSchemaType({ rowkey: 'id' })).toBe('table-options')
  })
  it('含 virtual → table-options', () => {
    expect(detectSchemaType({ virtual: true })).toBe('table-options')
  })
  it('含 fullscreen → dialog-options', () => {
    expect(detectSchemaType({ fullscreen: true })).toBe('dialog-options')
  })
  it('含 maxHeight → dialog-options', () => {
    expect(detectSchemaType({ maxHeight: 400 })).toBe('dialog-options')
  })
  it('apiParams 不误判为 table-options（form-item 与 table 共享字段）', () => {
    expect(detectSchemaType({ apiParams: {} })).toBe('form-item')
  })
  it('普通对象 → form-item（兜底）', () => {
    expect(detectSchemaType({ label: '姓名' })).toBe('form-item')
  })
  it('非对象 → form-item（不崩溃）', () => {
    expect(detectSchemaType(null)).toBe('form-item')
    expect(detectSchemaType('x')).toBe('form-item')
  })
})

describe('nl-to-config.extractJson', () => {
  it('```json 围栏 → 解析内部对象', () => {
    expect(extractJson('前言\n```json\n{"a":1}\n```\n后记')).toEqual({ a: 1 })
  })
  it('``` 无语言标注围栏 → 解析', () => {
    expect(extractJson('```\n{"b":2}\n```')).toEqual({ b: 2 })
  })
  it('裸对象（含前后噪声）→ 截取首尾大括号', () => {
    expect(extractJson('好的，这是配置：{"c":3} 完成')).toEqual({ c: 3 })
  })
  it('无 JSON 对象 → 抛错', () => {
    expect(() => extractJson('没有任何对象')).toThrow(/no JSON object/)
  })
})

describe('nl-to-config.AiUnavailableError', () => {
  it('sdk-missing → 安装提示 + reason', () => {
    const e = new AiUnavailableError('sdk-missing')
    expect(e.reason).toBe('sdk-missing')
    expect(e.message).toMatch(/@anthropic-ai\/sdk/)
    expect(e.name).toBe('AiUnavailableError')
  })
  it('no-key → 缺 key 提示 + reason', () => {
    const e = new AiUnavailableError('no-key')
    expect(e.reason).toBe('no-key')
    expect(e.message).toMatch(/ANTHROPIC_API_KEY/)
  })
})

describe('fs.writeGeneratedFiles', () => {
  const mkTmp = () => mkdtempSync(join(tmpdir(), 'esplus-cli-'))

  it('正常写入多文件', () => {
    const dir = mkTmp()
    try {
      const a = join(dir, 'schema.ts')
      const b = join(dir, 'Page.vue')
      writeGeneratedFiles([{ path: a, content: 'export const x = 1' }, { path: b, content: '<template/>' }], dir)
      expect(readFileSync(a, 'utf-8')).toBe('export const x = 1')
      expect(readFileSync(b, 'utf-8')).toBe('<template/>')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('目录不存在时递归创建', () => {
    const dir = mkTmp()
    try {
      const nested = join(dir, 'a', 'b')
      const f = join(nested, 'Page.vue')
      writeGeneratedFiles([{ path: f, content: '<template/>' }], nested)
      expect(existsSync(f)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('空内容 → 落盘前整体抛错（不写出 0 字节文件）', () => {
    const dir = mkTmp()
    try {
      const a = join(dir, 'schema.ts')
      const b = join(dir, 'Page.vue')
      expect(() =>
        writeGeneratedFiles([{ path: a, content: 'ok' }, { path: b, content: '' }], dir)
      ).toThrow(/拒绝写入空文件/)
      // 校验在写入前完成——第一个文件也不应被写出
      expect(existsSync(a)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('strings.isSafePathSegment — 路径穿越防护', () => {
  it('拒绝路径分隔符 / "." / ".." / 盘符 / 空串', () => {
    for (const seg of ['../../evil', 'a/b', 'a\\b', '..', '.', 'C:evil', '']) {
      expect(isSafePathSegment(seg), seg).toBe(false)
    }
  })

  it('放行正常页面名（含中文）', () => {
    for (const seg of ['UserManage', 'user-management', '订单管理', 'A1_b2']) {
      expect(isSafePathSegment(seg), seg).toBe(true)
    }
  })
})

describe('strings.isPathInside — 输出目录越界兜底', () => {
  const base = join('root', 'views')

  it('目录内 → true', () => {
    expect(isPathInside(base, join(base, 'schema.ts'))).toBe(true)
    expect(isPathInside(base, join(base, 'Sub', 'Page.vue'))).toBe(true)
  })

  it('同级 / 上级 / 自身 → false', () => {
    expect(isPathInside(base, join('root', 'evil.ts'))).toBe(false)
    expect(isPathInside(base, join(base, '..', 'evil.ts'))).toBe(false)
    expect(isPathInside(base, base)).toBe(false)
  })
})

describe('create — [name] 路径穿越拦截（接线级）', () => {
  it('name 含 ../ 时拒绝生成，且写出目录之外不产生文件', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'esplus-c8-name-'))
    const outDir = join(dir, 'out')
    const prevExit = process.exitCode
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await createCommand.parseAsync([
        'node', 'create', '../evil',
        '-d', '用户管理，支持新增编辑', '--no-ai',
        '-o', outDir, '--force'
      ])
      expect(process.exitCode).toBe(1)
      // 输出目录不应被创建/写入
      expect(existsSync(outDir) ? readdirSync(outDir).length : 0).toBe(0)
      // 更不应在上一级留下逃逸产物
      expect(existsSync(join(dir, 'evil'))).toBe(false)
      expect(existsSync(join(dir, 'schema.ts'))).toBe(false)
    } finally {
      logSpy.mockRestore()
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('--from-config 载入 name 含 ../ 的配置 → schema 校验即拒绝，不落盘', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'esplus-c8-cfg-'))
    const outDir = join(dir, 'out')
    const cfgPath = join(dir, 'cfg.json')
    const prevExit = process.exitCode
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      writeFileSync(cfgPath, JSON.stringify({
        name: '../../evil',
        apiUrl: '/api/x',
        fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
        actions: ['add']
      }))
      await createCommand.parseAsync([
        'node', 'create', '--from-config', cfgPath, '-o', outDir, '--force'
      ])
      expect(process.exitCode).toBe(1)
      expect(existsSync(join(dir, 'evil'))).toBe(false)
      expect(existsSync(outDir)).toBe(false)
    } finally {
      logSpy.mockRestore()
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('scaffold 的 [name] 同样拒绝路径穿越', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'esplus-c8-scaffold-'))
    const outFile = join(dir, 'out', 'Page.vue')
    const prevExit = process.exitCode
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await scaffoldCommand.parseAsync([
        'node', 'scaffold', '../evil', '-o', outFile, '--force'
      ])
      expect(process.exitCode).toBe(1)
      expect(existsSync(outFile)).toBe(false)
    } finally {
      logSpy.mockRestore()
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
