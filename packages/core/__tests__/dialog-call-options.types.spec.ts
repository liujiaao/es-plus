import { describe, expect, it } from 'vitest'
import type { DialogCallOptions, DialogDrawerOptions, DialogModalOptions } from '../src/types'

/**
 * P1-6：`DialogCallOptions` 是**按 `type` 判别**的联合 —— 误配的键在编译期报错，
 * 而不是像运行时那样静默忽略。
 *
 * 这些 `@ts-expect-error` 由 `npm run typecheck -w @es-plus/core`（tsc --noEmit，
 * include 含 __tests__）真的检查；vitest 本身不做类型检查，所以本文件同时留一条
 * 运行时断言，避免被当成空测试套件。
 */
describe('DialogCallOptions 判别联合', () => {
  it('合法组合可赋值，越界键在类型层被拒绝', () => {
    const modal: DialogModalOptions = { type: 'dialog', isDraggable: true, fullscreen: true }
    const drawer: DialogDrawerOptions = { type: 'drawer', direction: 'ltr' }
    const omitted: DialogCallOptions = { title: '默认弹窗' }
    const union: DialogCallOptions[] = [modal, drawer, omitted]

    // 抽屉形态：弹窗专有键（拖拽 / 全屏 / 全屏按钮 / 居中 / 外边距）一律 never
    // @ts-expect-error drawer 没有拖拽手柄
    const badDrawerDraggable: DialogCallOptions = { type: 'drawer', isDraggable: true }
    // @ts-expect-error drawer 不是弹窗，没有 fullscreen
    const badDrawerFullscreen: DialogCallOptions = { type: 'drawer', fullscreen: true }
    // @ts-expect-error drawer 没有底部全屏按钮
    const badDrawerHiddenBtn: DialogCallOptions = { type: 'drawer', hiddenFullBtn: true }
    // @ts-expect-error drawer 没有弹窗的垂直居中
    const badDrawerAlign: DialogCallOptions = { type: 'drawer', alignCenter: true }
    // @ts-expect-error drawer 没有弹窗的 margin-top
    const badDrawerTop: DialogCallOptions = { type: 'drawer', top: '10vh' }

    // 弹窗形态：抽屉专有的 direction 一律 never
    // @ts-expect-error dialog 没有弹出方向
    const badModalDirection: DialogCallOptions = { type: 'dialog', direction: 'rtl' }

    // 索引签名仍开键：扩展键不受影响（公开契约的一部分）
    const extended: DialogCallOptions = { type: 'dialog', dataTestId: 'dlg' }

    expect(union).toHaveLength(3)
    expect([
      badDrawerDraggable,
      badDrawerFullscreen,
      badDrawerHiddenBtn,
      badDrawerAlign,
      badDrawerTop,
      badModalDirection,
      extended,
    ]).toHaveLength(7)
  })
})
