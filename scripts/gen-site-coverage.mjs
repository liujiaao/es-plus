#!/usr/bin/env node
/**
 * AN-28 —— 生成三站案例台账（`feature-coverage.json` 的 `sites` 段）。
 *
 * 只改 `sites`，其余键原样保留；行尾符跟随源文件（Windows 工作区是 CRLF，不要人为翻成 LF）。
 * 派发规则与守卫共用 `scripts/lib/site-coverage.mjs`，所以生成结果与 `check:feature-coverage`
 * 的现算结果**必然同源**。
 *
 * 用法：node scripts/gen-site-coverage.mjs
 * 退出码：0 = 已写入；1 = 输入缺失/解析失败。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildSiteCoverage } from './lib/site-coverage.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = join(ROOT, 'docs/ai/feature-coverage.json')

const raw = readFileSync(MANIFEST, 'utf-8')
const manifest = JSON.parse(raw)
const sites = buildSiteCoverage(manifest.demos, ROOT)

const next = { ...manifest, sites }
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const text = JSON.stringify(next, null, 2).replace(/\n/g, eol) + eol

// 只在内容真的变了时写，避免无意义的 mtime 变化。
if (text !== raw) writeFileSync(MANIFEST, text)

const total = sites.reduce((n, s) => n + s.cases.length, 0)
const refs = sites.reduce((n, s) => n + s.refs, 0)
console.log(
  `✅ 已生成三站案例台账：${sites.map((s) => `${s.site} ${s.cases.length}（映射 ${s.refs} / D ${s.uncovered}）`).join(' · ')}` +
    ` · 合计 ${total} 例，映射 ${refs} 例`,
)
