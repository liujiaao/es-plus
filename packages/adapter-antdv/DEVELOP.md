# @es-plus/adapter-antdv 开发文档

本文档面向 `@es-plus/adapter-antdv` 的包维护者，描述包的架构、目录结构、本地开发、构建产物与发布流程。面向使用者的文档见 [README.md](./README.md)。

## 1. 包定位与架构

`@es-plus/adapter-antdv` 是 [ES-Plus](https://github.com/liujiaao/es-plus) 的 **Ant Design Vue 4.x** 渲染适配器。ES-Plus 将「配置契约」与「渲染实现」分离：

```
@es-plus/core          框架无关的核心：共享类型、纯逻辑、渲染契约
    ├── @es-plus/vue3          → Element Plus 组件 (Vue 3)
    ├── @es-plus/vue2          → Element UI 组件 (Vue 2)
    └── @es-plus/adapter-antdv → Ant Design Vue 组件 (Vue 3)  ← 本包
```

- **配置 Schema 100% 兼容**：所有 `FormItemOption`、`TableColumn`、`TableOptions`、`DialogOptions`、`CrudPageSchema` 等类型由 `@es-plus/core` 定义，三个渲染器共享同一份 JSON 配置。
- **Plugin 安装模式对齐 vue3**：`install()` 内部调用 `configureEsPlus()` 写入模块级单例；per-component `Plugin` 展开 `options.methods` 至 provide。详见 [src/index.ts](./src/index.ts) 顶部注释。
- **本包只做「配置 → Ant Design Vue 组件」的映射**，不重复实现业务逻辑——通用逻辑（表单布局、表格选择、请求封装、字段解析等）已下沉到 `@es-plus/core` 与本包的 `composables`。

## 2. 目录结构

```
packages/adapter-antdv/
├── src/
│   ├── index.ts                  # 入口：install()、命名导出、版本号
│   ├── config.ts                 # configureEsPlus 模块单例（对齐 vue3）
│   ├── resolver.ts               # unplugin-vue-components 自动导入解析器
│   ├── resolver.d.ts             # resolver 类型声明（构建时复制到 dist）
│   ├── shims-vue.d.ts
│   ├── components/
│   │   ├── es-form/              # 动态表单（16 种控件）
│   │   ├── es-table/             # 动态表格（含虚拟滚动）
│   │   ├── es-dialog/            # 动态弹窗 + useDialog
│   │   ├── es-crud-page/         # CRUD 编排组件
│   │   └── svg-icon/             # SVG 图标组件
│   ├── composables/
│   │   ├── use-form-inputs.ts    # 表单控件适配
│   │   ├── use-form-layout.ts    # 表单布局/折叠
│   │   ├── use-form-request.ts   # 远程选项加载
│   │   ├── use-table-resize.ts   # 表格尺寸
│   │   └── use-table-selection.ts# 表格选择列
│   ├── utils/
│   │   ├── icon.ts               # 图标解析
│   │   └── shared.ts             # 共享工具
│   └── types/index.ts            # 本包对外类型再导出
├── schemas/                      # JSON Schema（IDE 校验 / AI 辅助）
├── __tests__/                    # vitest 测试（12 个 spec）
├── vite.config.ts                # 构建配置（含 resolver 子产物构建）
├── tsconfig.json / tsconfig.build.json
├── vitest.config.ts
└── package.json
```

## 3. 本地开发

本包位于 monorepo 根的 `packages/*` workspace 下。常用命令（在 `packages/adapter-antdv` 目录执行）：

```bash
npm run typecheck     # vue-tsc --noEmit -p tsconfig.build.json
npm run build         # vite build（产物输出到 dist/）
npm test              # vitest run
npm run test:watch    # vitest 监听模式
```

### 在演示项目中调试

monorepo 内的 `es-pc`、`es-eui` 通过 workspace 链接本包，修改源码后重新 `npm run build`，演示项目即可生效。若需热更新调试，可在演示项目的 `vite.config.ts` 中将 alias 指向 `packages/adapter-antdv/src/index.ts`。

## 4. 构建产物

`npm run build` 由 [vite.config.ts](./vite.config.ts) 驱动，产出：

| 产物 | 说明 |
|------|------|
| `dist/es-plus-antdv.js` | ESM 产物（`import`） |
| `dist/es-plus-antdv.umd.cjs` | UMD 产物（`require`，global 名 `EsPlusAntdv`） |
| `dist/index.d.ts` | 类型入口（由 `vite-plugin-dts` 生成） |
| `dist/resolver.mjs` | 自动导入解析器 ESM（esbuild 单独构建） |
| `dist/resolver.cjs` | 自动导入解析器 CJS |
| `dist/resolver.d.ts` | 解析器类型声明（从 `src/resolver.d.ts` 复制） |
| `dist/style.css` | 本包少量覆盖样式（`index.css` 重命名而来） |
| `dist/src/**` | 各源文件的 `.d.ts`（由 dts 插件按源码结构生成） |

**external 列表**（不打包进产物，由宿主提供）：
`vue`、`ant-design-vue`、`@ant-design/icons-vue`、`@es-plus/core`、`dayjs`。

> `dayjs` 必须保持 external：Ant Design Vue 的 DatePicker 与本包共用同一个 dayjs 实例，若被打包进产物会引发 `isDayjs` / locale 跨实例失效。

### resolver 子产物构建

主 lib 构建只产出 `index` 入口，`resolver` 子路径（`package.json` 的 `exports["./resolver"]` 声明）由 `vite.config.ts` 中的 `buildResolver()` 插件在 `closeBundle` 钩子用 esbuild 单独编译，对齐 `packages/vue3` 的做法。**修改 `src/resolver.ts` 后务必重新 `npm run build`，否则 `dist/resolver.*` 不会更新。**

## 5. 测试

测试位于 `__tests__/`，基于 `vitest` + `happy-dom`，覆盖：

- `column-adapter.spec.ts` / `es-table.spec.ts` — 表格列适配与渲染
- `icon.spec.ts` / `shared.spec.ts` — 工具函数
- `use-form-inputs.spec.ts` / `use-form-layout.spec.ts` / `use-form-request.spec.ts` — 表单 composables
- `use-table-selection.spec.ts` — 表格选择
- `scenario-*.spec.ts` — CRUD 页面、表单全控件、表格高级、边界场景的端到端场景测试

发布前确保 `npm test` 全部通过。

## 6. 发布流程

> ⚠️ 本包**独立于 changesets `linked` 体系**。根 `.changeset/config.json` 的 `linked` 仅含 `@es-plus/shared` / `@es-plus/mcp-server` / `@es-plus/cli`。本包需手动发布。

### 首次发布检查清单

- [ ] `npm whoami --registry=https://registry.npmjs.org/` 已登录
- [ ] `npm view @es-plus/core version` 满足本包 `dependencies` 中的 `^1.0.0`
- [ ] `npm test` 与 `npm run typecheck` 通过
- [ ] `npm run build` 后 `dist/` 含 `resolver.mjs` / `resolver.cjs` / `resolver.d.ts`
- [ ] `package.json` 的 `publishConfig.access` 为 `"public"`、`registry` 为 `https://registry.npmjs.org/`

### 发布步骤

```bash
cd packages/adapter-antdv

npm run build                                   # 重新构建，确保 dist 最新
npm pack --dry-run                              # 检查打包清单（应仅含 dist/、schemas/、README.md）
npm publish --registry=https://registry.npmjs.org/
npm view @es-plus/adapter-antdv version         # 验证，应返回已发布版本号
```

说明：
- `prepublishOnly` 脚本会自动执行 `npm run typecheck && npm run build`，发布前再次校验。
- 本机默认 registry 可能是 `npmmirror`（淘宝镜像），**必须显式 `--registry=https://registry.npmjs.org/`**；`package.json` 的 `publishConfig.registry` 已锁定官方源作为兜底。
- 发布为不可逆操作，建议先 `npm pack --dry-run` 核对产物清单再 publish。

### 版本号规则

| 场景 | 级别 | 示例 |
|------|------|------|
| 修复 bug、文档更新 | `patch` | 1.0.0 → 1.0.1 |
| 新增功能、新增控件 | `minor` | 1.0.0 → 1.1.0 |
| 破坏性 API / 配置 Schema 变更 | `major` | 1.0.0 → 2.0.0 |

由于本包与 `@es-plus/vue3` 共享 Schema，**破坏性 Schema 变更应与 vue3 同步升 major**，并在 `@es-plus/core` 中先行调整类型。

## 7. 与 vue3 的开发约定对齐

为降低双端维护成本，本包在以下方面刻意与 `packages/vue3` 保持一致：

- **入口结构**：`install()` 签名、`configureEsPlus` 单例写入、组件列表注册顺序、`globalProperties.$useDialog` 注入、`provide('$EsPlus', ...)` 结构。
- **per-component Plugin**：`isPlugin` / `Plugin` 定义在各组件 `index.ts`，`install()` 中按 `component.name` 取对应 options 展开。
- **版本号读取**：`import { version } from '../package.json'`，`default export { version, install }`。
- **resolver 构建方式**：`buildResolver()` 插件 + esbuild，与 vue3 完全一致。
- **类型再导出**：`src/types/index.ts` 对齐 vue3 的对外类型集合，并额外导出 CRUD 高级类型（`CrudAction`、`RowBtnConfig` 等）。

差异点（刻意保留，勿强行对齐）：
- external 列表不同（antdv 额外含 `dayjs`）。
- UMD global 名 `EsPlusAntdv`（vue3 为 `EsPlus`）。
- 产物文件名 `es-plus-antdv.*`（vue3 为 `es-plus.*`）。
- ColorPicker 降级为原生 `input[type=color]`（ADV 4.x 无独立组件）。
- v-model 字段名差异由内部 composables 映射，配置层不变。

## 8. 常见开发任务

- **新增表单控件**：在 `src/components/es-form` 的控件映射中新增 `formtype`，并在 `use-form-inputs.ts` 补充适配逻辑；同步更新 `__tests__/scenario-form-all-types.spec.ts`。
- **新增表格特性**：在 `src/components/es-table` 实现，复用 `@es-plus/core` 的 `table-selection` / `form-layout` 等纯逻辑。
- **修改自动导入行为**：编辑 `src/resolver.ts`，重新 `npm run build` 后 `dist/resolver.*` 才会更新。
- **更新 JSON Schema**：编辑 `schemas/*.schema.json`，三者（vue3/vue2/antdv）应保持一致。
