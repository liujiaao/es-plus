/**
 * codegen-escape — 转义层单测
 *
 * 目前只覆盖 `sanitizeForComment`。它是**唯一**同时服务两种注释方言的转义器：
 * HTML 注释（模板）与 `//` 行注释（`<script setup>` 内），所以「`</` 必须打断」
 * 这条规则在两种方言里都成立 —— 而 JS 行注释这一路最容易被漏掉：
 * HTML 解析**先于** JS 解析 `<script>` 块，`// ... </script>` 里的结束标签照样
 * 会闭合宿主脚本块。
 */
import { describe, it, expect } from 'vitest'
import { sanitizeForComment, isStaticSlotNameSafe, qAttr, qExprAttr, q } from '../src/codegen-escape.js'

/**
 * `q()` 的换行处理是 `check:generator-fuzz` 的载荷 01 咬出来的真实缺陷：
 * 旧实现用 `/\r?\n/` 归一化，**单独的 `\r` 匹配不上**（老 Mac 换行、或从 Windows 剪贴板
 * 带来的半个换行），于是裸 CR 落进单引号字面量 —— 而 CR 在 JS 里就是行终止符，
 * 整份产物变成「未闭合字符串」。这类输入在语料里没有，靠 Tier A 编译腿永远看不见。
 */
describe('q — JS 单引号字面量', () => {
  it('三种换行都必须落成转义序列（裸 CR 就是行终止符）', () => {
    expect(q('a\rb')).toBe(String.raw`'a\rb'`)
    expect(q('a\nb')).toBe(String.raw`'a\nb'`)
    expect(q('a\r\nb')).toBe(String.raw`'a\r\nb'`)
  })

  it('反斜杠先于引号转义（顺序反了会多出一个裸反斜杠，把字面量撑破）', () => {
    // 期望值用 `BS.repeat(3)` 拼：三等号和六反斜杠在源码里读不出「到底几个」，
    // 而这条判据的**全部**内容就是反斜杠的个数。
    const BS = '\\'
    expect(q("a\\'b")).toBe(`'a${BS.repeat(3)}'b'`)
  })

  it('`</` 打断：字符串里的结束标签会闭合宿主 <script> 块', () => {
    expect(q('A</script>')).toBe(String.raw`'A<\/script>'`)
  })

  it('普通文本逐字节不变（正常路径零漂移）', () => {
    expect(q('状态-正常')).toBe(String.raw`'状态-正常'`)
  })
})

describe('sanitizeForComment', () => {
  it('转义 `</`：注释里不会残留任何能闭合宿主 <script> 的序列', () => {
    expect(sanitizeForComment('A</script><script>alert(1)</script>')).toBe(
      'A<\\/script><script>alert(1)<\\/script>',
    )
    // 判据：产物里不再存在原始的结束标签
    expect(sanitizeForComment('A</script>')).not.toContain('</script')
  })

  it('对大小写不敏感（HTML 的结束标签名不区分大小写）', () => {
    expect(sanitizeForComment('x</SCRIPT>y</Style>')).toBe('x<\\/SCRIPT>y<\\/Style>')
  })

  it('已是 `<\\/` 的输入不会被二次转义', () => {
    expect(sanitizeForComment('a<\\/script>')).toBe('a<\\/script>')
  })

  it('HTML 注释约束：折叠空白、连续短横换破折号、首尾去空白', () => {
    expect(sanitizeForComment('  a  --  b\n\tc  ')).toBe('a — b c')
  })

  it('超长源码截断到 200 字符', () => {
    expect(sanitizeForComment('x'.repeat(500))).toHaveLength(200)
  })

  it('普通文本逐字节不变（正常路径零漂移）', () => {
    const src = "(_, { row }) => h(ElTag, () => row.statusLabel)"
    expect(sanitizeForComment(src)).toBe(src)
  })
})

describe('qAttr / qExprAttr — 属性值定界符', () => {
  it('qAttr 实体化 `"` 并转义 HTML 元字符（属性值不会被提前收尾）', () => {
    expect(qAttr('x"@mouseover="alert(1)')).toBe('x&quot;@mouseover=&quot;alert(1)')
    expect(qAttr('<a>&')).toBe('&lt;a&gt;&amp;')
  })

  it('qExprAttr 只实体化 `"`，`\'`/`&` 保持裸（Volar 把属性值原样交给 TS）', () => {
    expect(qExprAttr(`row.x === 'a' && b`)).toBe(`row.x === 'a' && b`)
    expect(qExprAttr('row["a"]')).toBe('row[&quot;a&quot;]')
  })
})

describe('isStaticSlotNameSafe — 静态插槽名可表达性', () => {
  it('裸标识符 / 点号路径 / 带中划线 → 可写进 #column-xxx', () => {
    for (const p of ['status', 'userName', 'user.name', 'a[0].b', 'col-name', '状态']) {
      expect(isStaticSlotNameSafe(`column-${p}`)).toBe(true)
    }
  })

  it('空白 / 引号 / 尖括号 / 反引号 / 等号 → 不可表达（会拆坏属性名）', () => {
    for (const p of ['foo bar', 'a\tb', 'a"b', "a'b", 'a<b', 'a>b', 'a`b', 'a=b', 'a/b']) {
      expect(isStaticSlotNameSafe(`column-${p}`)).toBe(false)
    }
  })
})
