/**
 * MCP 工具名 → 源文件名（不靠机械命名猜）。
 *
 * 大多数工具是 `generate_foo_bar` → `generate-foo-bar.ts`，但 `generate_crud_from_config`
 * 的实现文件叫 `generate-from-config.ts`（历史名）。守卫用它断言「注册表里的 canonical
 * 入口与 adapter 真的存在于源码」，机械推导会在这种历史命名上产生**假红**。
 *
 * 新增工具时在这里登记一行；未登记的仍按机械规则推导，避免为了一个例外维护整张表。
 */
const OVERRIDES = Object.freeze({
  generate_crud_from_config: 'generate-from-config.ts',
})

export function toolFileFor(name) {
  return OVERRIDES[name] ?? `${name.replace(/^generate_/, 'generate-').replace(/_/g, '-')}.ts`
}
