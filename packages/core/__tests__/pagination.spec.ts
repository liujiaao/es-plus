/**
 * pagination — 来自 @es-plus/core（src/pagination.ts）
 *
 * 分页请求判定纯逻辑：resolveKeepPage + computeBoundaryRollback。
 * 这两段原本在三个渲染器的 es-table httpRequestInstance 里逐字节重复，
 * 提取到 core 后由本文件锁定行为，作为三端一致的单一权威源。
 */
import { describe, it, expect } from 'vitest'
import { resolveKeepPage, computeBoundaryRollback } from '../src/pagination'

describe('resolveKeepPage', () => {
  it('显式 true → true（覆盖表级配置）', () => {
    expect(resolveKeepPage(true, false)).toBe(true)
  })
  it('显式 false → false（覆盖表级配置）', () => {
    expect(resolveKeepPage(false, true)).toBe(false)
  })
  it('未显式传入 → 回退到 refetchKeepPage === true', () => {
    expect(resolveKeepPage(undefined, true)).toBe(true)
  })
  it('未显式传入且 refetchKeepPage 非 true → false', () => {
    expect(resolveKeepPage(undefined, false)).toBe(false)
    expect(resolveKeepPage(undefined, undefined)).toBe(false)
    // 仅严格 === true 生效，truthy 值不算
    expect(resolveKeepPage(undefined, 'true')).toBe(false)
    expect(resolveKeepPage(undefined, 1)).toBe(false)
  })
})

describe('computeBoundaryRollback', () => {
  it('非保留页模式 → 不回退', () => {
    const r = computeBoundaryRollback({ keepPage: false, rowCount: 0, current: 3, total: 5, pageSize: 10 })
    expect(r.shouldRollback).toBe(false)
  })
  it('当前页仍有数据 → 不回退', () => {
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 2, current: 3, total: 25, pageSize: 10 })
    expect(r.shouldRollback).toBe(false)
  })
  it('首页且为空 → 不回退（current 不 > 1）', () => {
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 0, current: 1, total: 0, pageSize: 10 })
    expect(r.shouldRollback).toBe(false)
  })
  it('保留页且当前页空且非首页且 maxPage < current → 回退到 maxPage', () => {
    // 删除了第 3 页唯一一条：total 21 → 20，maxPage=2，current=3
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 0, current: 3, total: 20, pageSize: 10 })
    expect(r).toEqual({ shouldRollback: true, maxPage: 2 })
  })
  it('maxPage 恰等于 current → 不回退（避免无意义递归）', () => {
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 0, current: 2, total: 20, pageSize: 10 })
    expect(r.shouldRollback).toBe(false)
    expect(r.maxPage).toBe(2)
  })
  it('total=0 → maxPage 兜底为 1，从非首页回退到 1', () => {
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 0, current: 4, total: 0, pageSize: 10 })
    expect(r).toEqual({ shouldRollback: true, maxPage: 1 })
  })
  it('数值归一：pageSize 非法兜底 10、current 非法兜底 1', () => {
    // current 兜底 1 → 不满足 current > 1 → 不回退
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 0, current: NaN as unknown as number, total: 20, pageSize: 0 })
    expect(r.shouldRollback).toBe(false)
  })
  it('pageSize 非法兜底 10 参与 maxPage 计算', () => {
    // total 25, pageSize 兜底 10 → maxPage=3；current=5 → 回退
    const r = computeBoundaryRollback({ keepPage: true, rowCount: 0, current: 5, total: 25, pageSize: 0 })
    expect(r).toEqual({ shouldRollback: true, maxPage: 3 })
  })
})
