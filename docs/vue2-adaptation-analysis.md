# Vue 2 + Element UI 双版本适配方案 — 全面评估与架构设计

## Context

当前 es-plus-ui 是 Vue 3 + Element Plus 专用组件库。本文档评估以最低成本实现同时适配 Element Plus 和 Element UI，使核心依赖库可自由切换配置，兼容所有原有功能。已有 es-eui（Vue 2 + Element UI 独立实现）可作参考。

---

## 现状评估

### 代码库耦合度分析

| 模块 | Element Plus 耦合 | Vue 3 专属 API | 可复用比例 | 适配难度 |
|------|------------------|---------------|-----------|---------|
| `use-form-inputs.ts` | 16 个组件直接导入 | `h()` + `onUpdate:modelValue` | 9% | **极高** |
| `use-dialog.ts` | 0 | `createVNode` + `render` + `appContext` | 5% | **极高** |
| `es-form.vue` (648行) | ElRow/ElCol/ElForm/ElButton... | `<script setup>` + provide/inject | 30% | **高** |
| `es-table/component.vue` (707行) | ElTable/ElPagination/ElConfigProvider | `<script setup>` + provide/inject | 25% | **高** |
| `es-dialog/component.vue` (338行) | ElDialog/ElButton/ElIcon | `<script setup>` + v-model:visible | 20% | **高** |
| `use-form-layout.ts` | 0 | `ref/computed/watch` (可 vue-demi) | 95% | **低** |
| `use-table-resize.ts` | 0 | `ref/onMounted/onBeforeUnmount` | 90% | **低** |
| `use-table-selection.ts` | 0 | `ref/computed` | 90% | **低** |
| `use-form-request.ts` | 0 | `ref/watch/inject` | 85% | **低** |
| `utils/shared.ts` | 0 | 0 | 100% | **无** |
| `types/index.ts` | 3 类型导入 | `VNode/RenderFunction` | 60% | **低** |
| `config.ts` | 0 | 0 | 100% | **无** |
| `index.ts` | 0 | `app.component/provide/globalProperties` | 35% | **中** |

### 关键不兼容点 (Vue 3 → Vue 2)

| 差异维度 | Vue 3 (es-plus) | Vue 2 (es-eui) | 影响范围 |
|---------|----------------|----------------|---------|
| 渲染函数签名 | `h(Comp, { modelValue, 'onUpdate:modelValue': fn })` | `createElement(Comp, { props: { value }, on: { input: fn } })` | 全部 16 种表单输入 + 自定义渲染 |
| v-model 语法 | `v-model:visible`, `v-model:data-source` | `:visible.sync`, `:data-source.sync` | 所有双向绑定模板 |
| `<script setup>` | 所有 .vue 文件 | 不支持 | 7 个主要组件文件 |
| 组件实例化 | `createVNode()` + `render(vnode, container)` | `Vue.extend()` + `new Ctor().$mount()` | useDialog 整个实现 |
| 组件通信 | `provide/inject` (app-level) | `$parent/$children` 遍历 | EsForm ↔ EsTable 联动 |
| 事件监听器 | 合并到 attrs (`onXxx`) | 独立 `$listeners` + `v-on="$listeners"` | 所有组件透传 |
| 插件安装 | `app.component()` / `app.provide()` | `Vue.component()` / `Vue.prototype` | 入口文件 |
| Element Plus 组件名 | `ElInput`, `ElSelect`... | `Input`, `Select`... (或 `el-input` 字符串) | 所有 import |
| 图标系统 | `@element-plus/icons-vue` (组件) | 类名字符串 `el-icon-xxx` | 图标渲染 |
| 虚拟表格 | `ElTableV2` / `ElAutoResizer` | **无对应物** | virtual-engine 整个模块 |

### Element Plus vs Element UI 组件 API 差异

| 组件 | Element Plus | Element UI | 影响 |
|------|-------------|-----------|------|
| Dialog | `v-model` 控制 visible | `:visible.sync` | 模板 + 编程式调用 |
| Pagination | `v-model:current-page` / `v-model:page-size` | `:current-page.sync` / `:page-size.sync` | EsTable 分页 |
| Select | `modelValue` prop | `value` prop | 表单输入渲染 |
| DatePicker | 独立组件 `ElDatePicker` | `el-date-picker` (内置于 Element UI) | 导入方式 |
| Icon | `<ElIcon><Delete /></ElIcon>` 组件式 | `<i class="el-icon-delete">` 类名式 | 所有图标位置 |
| ConfigProvider | 有 (locale/size 注入) | 无 | 国际化配置 |
| TableV2 | 有 (虚拟滚动) | 无 | 虚拟滚动不可用 |
| Upload | `v-model:file-list` | `:file-list` + 事件 | 表单上传 |

---

## 三种适配方案对比

### 方案 A：vue-demi + Element 适配层（共享代码库）

**思路**：使用 `vue-demi` 抹平 Vue 2/3 差异，创建 Element 组件映射适配层。

```
packages/vue3/
  src/
    adapter/
      vue-compat.ts          # re-export from vue-demi
      element-compat.ts      # Element Plus / Element UI 组件映射
      render-compat.ts       # h() 签名适配器
      dialog-compat.ts       # 编程式弹窗适配
      install-compat.ts      # 插件安装适配
    composables/             # 用 vue-demi 的 ref/computed/watch
    components/              # 用适配层渲染
```

**优势**：
- 单一代码库，维护成本理论最低
- 共享业务逻辑和类型定义

**劣势与致命问题**：
- `<script setup>` 无法在 Vue 2 中使用 → 所有 7 个 .vue 文件必须重写为 `defineComponent` + setup 函数
- Element Plus/UI 组件 API 差异太大 → 适配层本身就是一层翻译器，复杂度高
- `h()` 函数签名不同 → `use-form-inputs.ts` 的 244 行渲染代码全部需要通过适配器包装
- `createVNode + render` vs `Vue.extend + $mount` → `use-dialog.ts` 需要完全双实现
- 虚拟滚动 (el-table-v2) 在 Element UI 中不存在 → 必须禁用或找替代方案
- 运行时适配层引入额外性能开销和调试困难
- TypeScript 类型需要条件化导出 (Element Plus types vs Element UI types)

**改动量估算**：~3000+ 行新代码 + 所有现有 .vue 文件重构

**评估**：❌ **不推荐** — 适配层复杂度接近重写，且引入运行时风险

---

### 方案 B：Monorepo 双包 + 共享核心层（推荐）

**思路**：提取框架无关的核心逻辑到 `@es-plus/core`，Vue 3 和 Vue 2 各自实现渲染层。

```
packages/
  core/                        # 新增：框架无关核心
    src/
      types.ts                 # 通用接口定义 (无 Vue/Element 依赖)
      config.ts                # 全局配置管理
      form-layout.ts           # 表单行列算法 (纯逻辑)
      field-resolver.ts        # 字段解析、默认值、格式化
      table-data.ts            # 分页计算、请求参数构造
      shared.ts                # 工具函数 (isObject, findValueByKey...)
      schema-validator.ts      # 配置校验
      constants.ts             # FORM_TYPES, CRUD_ACTIONS 等常量
  es-plus/                     # 现有：Vue 3 + Element Plus (几乎不改)
    src/
      composables/             # 使用 vue 3 API
      components/              # 使用 Element Plus
  es-plus-v2/                  # 新增：Vue 2 + Element UI
    src/
      composables/             # 使用 @vue/composition-api
      components/              # 使用 Element UI
  shared/                      # 已有：MCP/CLI 共享
  mcp-server/                  # 已有
  cli/                         # 已有
```

**优势**：
- 现有 es-plus 代码 **零改动**，完全向后兼容
- Vue 2 版本可针对 Element UI 最优实现，不需折中
- 核心层从现有代码提取，有约 400-600 行可复用（`shared.ts`, `config.ts`, `use-form-layout.ts` 的纯逻辑部分, `types`）
- 两个渲染包可独立演进、独立发布版本
- TypeScript 类型各自独立，无条件编译

**劣势**：
- 需要创建 Vue 2 渲染实现（约等于基于 es-eui 重写 + Composition API 化）
- 两套渲染层需要分别维护
- 核心层接口设计需要足够通用

**改动量估算**：
- `@es-plus/core` 提取：~600 行（主要从 shared.ts, config.ts, types, use-form-layout 提取）
- `es-plus-v2` 新建：~2500 行（参照 es-eui 但用 Composition API + TypeScript）
- 现有 `es-plus`：~50 行（import 改为从 `@es-plus/core` 导入共享部分）

**评估**：✅ **推荐** — 风险最低，现有功能零影响

---

### 方案 C：构建时条件编译 + 别名替换

**思路**：通过 Vite/Webpack resolve alias 在构建时替换 Element Plus → Element UI。

```typescript
// vite.config.ts (Vue 2 构建)
resolve: {
  alias: {
    'element-plus': 'element-ui-adapter',
    'vue': '@vue/composition-api',
  }
}
```

```typescript
// element-ui-adapter/index.ts
export { Input as ElInput, Select as ElSelect, ... } from 'element-ui'
```

**优势**：
- 代码层面改动最小
- 看起来"优雅"

**劣势与致命问题**：
- Element Plus 和 Element UI 的 **组件 API 不同**（props 名、事件名、slot 名），仅做名称映射无法解决行为差异
- 例如：`ElSelect` 的 `modelValue` prop 在 Element UI 中叫 `value`，事件 `update:modelValue` 变为 `input`
- `h()` 签名无法通过 alias 解决
- `<script setup>` 无法通过 alias 解决
- 必须写大量 wrapper 组件作为 adapter，几乎回到方案 A 的复杂度
- 类型系统完全崩溃（Element Plus types ≠ Element UI types）

**评估**：❌ **不可行** — 组件 API 差异无法通过简单别名映射解决

---

## 推荐方案详细设计（方案 B：双包 + 共享核心）

### 核心层提取清单 (`@es-plus/core`)

从现有代码中可直接提取的框架无关逻辑：

| 来源文件 | 可提取内容 | 行数 |
|---------|-----------|------|
| `utils/shared.ts` | 全部工具函数 | 59 |
| `config.ts` | `EsPlusGlobalConfig` + `configureEsPlus` + `getGlobalConfig` | 19 |
| `types/index.ts` | `ApiParams`, `PaginationConfig`, `LayoutFormProps`, `EsPlusOptions` 等数据接口 | ~80 |
| `use-form-layout.ts` | 行列算法 `getRowColsAlgorithm` 纯逻辑（剥离 ref/computed） | ~60 |
| `use-table-selection.ts` | 跨页选择集合管理算法 | ~40 |
| `use-form-request.ts` | API 参数构造 + configTableOut 映射 + findValueByKey 逻辑 | ~50 |
| 新增 | 表单输入类型注册表 (FormType → 配置) | ~30 |
| 新增 | 按钮配置解析 (code 分组、权限过滤) | ~20 |

**总计约 350-400 行**可复用核心逻辑。

### es-plus-v2 实现策略

基于 es-eui 现有实现 + Composition API 改造：

```
packages/es-plus-v2/
  package.json
    peerDependencies:
      vue: "^2.6.14"
      element-ui: "^2.15.0"
      @vue/composition-api: "^1.7.0"
  src/
    index.ts                    # Vue.use() 安装
    components/
      es-table/
        component.vue           # Options API + setup() 混合
        column-item.vue
        table-btns.vue
      es-form/
        es-form.vue
      es-dialog/
        component.vue
        use-dialog.ts           # Vue.extend() 模式
    composables/
      use-form-inputs.ts        # createElement 版本
      use-form-layout.ts        # 复用 @es-plus/core 算法
      use-form-request.ts
      use-table-resize.ts
      use-table-selection.ts
    types/
      index.ts                  # Element UI 类型引用
```

**关键适配点**：

1. **表单输入渲染** — 从 `onUpdate:modelValue` 改为 `{ props: { value }, on: { input } }` 格式
2. **useDialog** — 使用 `Vue.extend(EsDialog)` + `new Ctor({ propsData }).$mount(container)`
3. **组件通信** — 可选择：
   - `@vue/composition-api` 的 provide/inject（推荐）
   - 或保留 es-eui 的 `$parent/$children` 模式
4. **虚拟滚动** — Vue 2 版本不提供（Element UI 无对应能力），文档说明
5. **图标** — 使用 Element UI 的 class 字符串 (`el-icon-xxx`)

### 用户使用方式

```javascript
// Vue 3 项目（现有，不变）
import EsPlus from 'es-plus-ui'
import ElementPlus from 'element-plus'
app.use(ElementPlus)
app.use(EsPlus)

// Vue 2 项目（新增支持）
import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'
import ElementUI from 'element-ui'
import EsPlus from 'es-plus-v2'    // 或 @es-plus/vue2
Vue.use(VueCompositionAPI)
Vue.use(ElementUI)
Vue.use(EsPlus)
```

**配置 API 完全一致**：
```javascript
// 两个版本使用相同的 columns/formItemList/options 配置格式
const columns = [
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'status', label: '状态', render: (h, { row }) => h('span', row.status) }
]
// ↑ 这段配置在 Vue 2 和 Vue 3 版本中通用
```

---

## 影响范围评估

### 对现有 es-plus-ui (Vue 3) 的影响

| 方面 | 影响 |
|------|------|
| 源代码 | **极小** — 仅 import 路径可能从 `../utils/shared` 改为 `@es-plus/core` |
| API 兼容性 | **零影响** — 所有公共 API 不变 |
| 构建产物 | **不变** — 仍然 externalize vue + element-plus |
| 类型定义 | **不变** — 导出类型不变 |
| npm 包名 | **不变** — 仍然是 `es-plus-ui` |
| MCP/CLI | **不变** — 生成代码逻辑不需改动 |

### 不可完美适配的功能

| 功能 | 原因 | 处理方式 |
|------|------|---------|
| 虚拟滚动 (virtual: true) | Element UI 无 el-table-v2 | Vue 2 版本不支持，文档注明 |
| ElConfigProvider 国际化 | Element UI 无此机制 | 使用 Element UI 的 `locale` 全局配置替代 |
| ElAutoResizer | Element Plus 独有 | 自实现 ResizeObserver 宽度监听 |
| 按需自动导入 (unplugin) | Element Plus 专属 resolver | Vue 2 版本手动全量导入或按需 import |
| CSS 变量主题 | Element Plus 使用 CSS Variables | Element UI 使用 SCSS 变量，需独立主题方案 |
| `defineSlots` 类型推导 | Vue 3.3+ 特性 | Vue 2 版本无此类型安全 |

### 可完美适配的功能

| 功能 | 说明 |
|------|------|
| 配置化表格 (columns/options) | 核心逻辑相同，仅渲染层不同 |
| 配置化表单 (formItemList) | 所有 formtype 在 Element UI 均有对应 |
| useDialog 编程式弹窗 | 实现方式不同但 API 可保持一致 |
| 表单校验 | el-form validate API 两版本一致 |
| 分页 + 自动请求 | 纯逻辑 + 简单渲染 |
| provide/inject 联动 | @vue/composition-api 支持 |
| 工具栏按钮 + 权限 | 配置驱动，可完全复用 |
| 表单折叠 | 纯算法逻辑，完全可复用 |
| 多选 + 跨页持久化 | 纯集合运算，完全可复用 |
| 自定义 render 列/单元格 | 用户传入的 render 函数格式一致 |
| API 请求 + 响应映射 | httpRequest/configTableOut 纯逻辑 |
| EsCrudPage 配置模式 | JSON Schema 驱动，框架无关 |

---

## 工作量估算

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| Phase 1 | `@es-plus/core` 核心层提取 + 测试 | 2-3 天 |
| Phase 2 | `es-plus-v2` 基础组件实现 (EsForm + EsTable + EsDialog) | 5-7 天 |
| Phase 3 | useDialog + 表单输入完整适配 | 3-4 天 |
| Phase 4 | EsCrudPage Vue 2 版本 | 2-3 天 |
| Phase 5 | 测试 + 文档 + 发布 | 2-3 天 |
| **总计** | | **14-20 天** |

---

## 结论

### 能否做到"完美无缝对接"？

**答案：95% 可以，5% 不能。**

- ✅ **配置层面 100% 兼容**：同一份 `columns` / `formItemList` / `options` JSON 配置可在两个版本间直接复用
- ✅ **API 层面 95% 兼容**：`useDialog`, `httpRequestInstance`, `validate`, `getSelectionRows` 等公共方法签名一致
- ✅ **MCP/CLI 100% 兼容**：`generate_crud_from_config` 生成的 schema 配置两版本通用（仅 import 路径不同）
- ❌ **虚拟滚动不可用**：Element UI 无对应能力
- ❌ **render 函数内部差异**：用户自定义 `render: (h, ctx) => ...` 中 `h` 的签名不同（Vue 2 是 createElement，Vue 3 是全局 h），但可通过适配器包装使格式统一

### 最优策略

**方案 B（双包 + 共享核心）是唯一可行且低风险的方案。**

- 不动现有 es-plus-ui 代码 = 零回归风险
- 基于已有 es-eui 经验 = 不是从零开始
- Composition API 化 es-eui = 代码质量提升 + TypeScript 加持
- 共享核心层 = 未来可扩展更多框架（React? Svelte?）

---

## 验证方案

```bash
# 1. 核心层测试
cd packages/core && npx vitest run

# 2. Vue 3 版本回归
cd packages/vue3 && npx vitest run

# 3. Vue 2 版本测试
cd packages/es-plus-v2 && npx vitest run

# 4. 配置兼容性验证：同一份 CrudConfig 生成两个版本代码
npx @es-plus/cli generate --config employee.json --target vue3
npx @es-plus/cli generate --config employee.json --target vue2
```

手动验证：
1. Vue 3 demo 项目：所有现有功能正常（回归）
2. Vue 2 demo 项目：EsTable + EsForm + useDialog + EsCrudPage 功能完整
3. 同一份配置 JSON 在两个项目中渲染结果一致
