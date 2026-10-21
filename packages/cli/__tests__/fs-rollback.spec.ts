import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 事务回滚：**抛错的那个文件**也必须删掉。
 *
 * 原实现把 `created.push(path)` 放在 `writeFileSync` 返回之后 —— 而 `writeFileSync`
 * 可能在「创建文件」之后才失败（典型：磁盘写满 ENOSPC）。那一刻文件已经存在，
 * 却从未登记进 `created`，回滚只删掉更早的文件，留下半截 `.vue`。
 *
 * 用真实 `rmSync` 做断言，只覆写 `writeFileSync`：第二个文件写入后抛错，
 * 模拟「已创建 → 失败」。若登记顺序改回写后，本用例会红。
 */
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    writeFileSync: (p: unknown, c: unknown, o?: unknown) => {
      // 走真实写入：文件确实被创建，再模拟写入中途失败
      ;(actual.writeFileSync as any)(p, c, o)
      if (String(p).endsWith('Page.vue')) throw new Error('ENOSPC: no space left on device')
    },
  }
})

const { writeGeneratedFiles } = await import('../src/utils/fs')

describe('fs.writeGeneratedFiles — 事务回滚', () => {
  it('写入中途抛错：抛错的文件本身也被回滚（不留下半截产物）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'esplus-cli-rollback-'))
    try {
      const a = join(dir, 'schema.ts')
      const b = join(dir, 'Page.vue')
      expect(() =>
        writeGeneratedFiles(
          [
            { path: a, content: 'export const x = 1' },
            { path: b, content: '<template/>' },
          ],
          dir
        )
      ).toThrow(/ENOSPC/)
      // 先写的那个已登记，自然要删；关键是 b —— 它已落盘才抛错
      expect(existsSync(a)).toBe(false)
      expect(existsSync(b)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('已存在（被覆盖）的文件不回滚：用户原文件不被误删', () => {
    const dir = mkdtempSync(join(tmpdir(), 'esplus-cli-rollback-'))
    try {
      const a = join(dir, 'schema.ts')
      const b = join(dir, 'Page.vue')
      writeGeneratedFiles([{ path: a, content: 'original' }], dir)
      expect(() =>
        writeGeneratedFiles(
          [
            { path: a, content: 'overwritten' },
            { path: b, content: '<template/>' },
          ],
          dir
        )
      ).toThrow(/ENOSPC/)
      // a 在本次调用前已存在 → 不在 created 里 → 不被回滚删除
      expect(existsSync(a)).toBe(true)
      expect(existsSync(b)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
