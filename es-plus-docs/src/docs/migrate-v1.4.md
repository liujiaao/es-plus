# Migrating to v1.4.0 — `es-plus-ui` → `@es-plus/vue3`

Starting with v1.4.0, the npm package **`es-plus-ui` has been renamed to `@es-plus/vue3`** to align with the new sibling package `@es-plus/vue2` (Vue 2 + Element UI) and the framework-agnostic `@es-plus/core`.

> **TL;DR — your code keeps working.** `es-plus-ui@1.4.0` is now a thin re-export stub of `@es-plus/vue3@1.4.0`. Existing installs continue to function. A one-time deprecation warning prints at runtime; please migrate at your convenience.

---

## What changed

| Before (≤ v1.3.5) | After (v1.4.0) |
| --- | --- |
| `es-plus-ui` | **`@es-plus/vue3`** (Vue 3 + Element Plus) |
| — | **`@es-plus/vue2`** (Vue 2 + Element UI, new) |
| — | **`@es-plus/core`** (framework-agnostic shared core, new) |
| `@es-plus/mcp-server` | (unchanged) |
| `@es-plus/cli` | (unchanged) |

The rename groups all renderers under the `@es-plus/*` scope so the package family is obvious at a glance.

---

## Why the rename?

`es-plus` now ships **two renderers** sharing the same JSON schema-driven configuration:

- **`@es-plus/vue3`** — Vue 3 + Element Plus
- **`@es-plus/vue2`** — Vue 2 + Element UI

A single `columns` / `formItemList` / `options` config can drive both. Putting both renderers in the same npm scope makes the relationship discoverable. The old `es-plus-ui` name became misleading once a Vue 2 sibling existed.

---

## Migration steps

### 1. Update `package.json`

```diff
{
  "dependencies": {
-   "es-plus-ui": "^1.3.5"
+   "@es-plus/vue3": "^1.4.0"
  }
}
```

Then reinstall:

```bash
npm install
# or
pnpm install
# or
yarn install
```

### 2. Update imports

```diff
- import EsPlus from 'es-plus-ui'
- import 'es-plus-ui/dist/style.css'
+ import EsPlus from '@es-plus/vue3'
+ import '@es-plus/vue3/dist/style.css'
```

### 3. Update auto-import resolver (if used)

```diff
// vite.config.ts
- import { EsPlusResolver } from 'es-plus-ui/resolver'
+ import { EsPlusResolver } from '@es-plus/vue3/resolver'
```

### 4. (Optional) Update TypeScript type imports

```diff
- import type { EsTableColumn, FormItem } from 'es-plus-ui'
+ import type { EsTableColumn, FormItem } from '@es-plus/vue3'
```

That's it. **No code changes required** — the public API is 100% identical.

---

## What still works (without migrating)

If you haven't migrated yet, **everything continues to function**:

- `npm install es-plus-ui` — installs the v1.4.0 stub, which depends on `@es-plus/vue3@1.4.0`
- `import EsPlus from 'es-plus-ui'` — re-exports `@es-plus/vue3`
- `import 'es-plus-ui/dist/style.css'` — re-imports `@es-plus/vue3/dist/style.css`
- `import { EsPlusResolver } from 'es-plus-ui/resolver'` — re-exports `@es-plus/vue3/resolver`

A one-time console warning prints on first import:

```
[es-plus-ui] This package was renamed to @es-plus/vue3 in v1.4.0.
Please update your imports: `npm install @es-plus/vue3` and replace
`import ... from 'es-plus-ui'` with `import ... from '@es-plus/vue3'`.
Set ES_PLUS_SILENCE_DEPRECATION=1 to silence this warning.
```

Set `ES_PLUS_SILENCE_DEPRECATION=1` in your environment to silence it, or migrate to remove it permanently.

---

## Deprecation timeline

| Version range | Status |
| --- | --- |
| `es-plus-ui@<1.4.0` | `npm deprecate`'d with notice pointing to `@es-plus/vue3`. Still installable but flagged at install time. |
| `es-plus-ui@1.4.0+` | Stub package. Re-exports `@es-plus/vue3`. Maintained for backward compatibility. Will not receive new features. |
| `@es-plus/vue3@1.4.0+` | **Active development happens here.** All new features, bug fixes, and releases. |

The stub will continue to track `@es-plus/vue3` patch releases for a reasonable period so existing installs aren't stranded. New features go to `@es-plus/vue3` only.

---

## Adding the Vue 2 renderer

If you also have a Vue 2 codebase and want to share configs:

```bash
npm install @es-plus/vue2 @es-plus/core
```

```js
// Vue 2.7
import Vue from 'vue'
import ElementUI from 'element-ui'
import EsPlus from '@es-plus/vue2'
import 'element-ui/lib/theme-chalk/index.css'
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)
```

```js
// Vue 2.6 (also needs the composition-api plugin)
import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'
import ElementUI from 'element-ui'
import EsPlus from '@es-plus/vue2'

Vue.use(VueCompositionAPI)
Vue.use(ElementUI)
Vue.use(EsPlus)
```

The same `columns` / `formItemList` / `options` config works in both versions. See [`@es-plus/vue2` README](https://www.npmjs.com/package/@es-plus/vue2) for renderer-specific differences (virtual scrolling, ConfigProvider, icon syntax).

---

## Sharing types across Vue 2 and Vue 3

Hoist your config types into `@es-plus/core` and import from there:

```ts
// shared/columns.ts
import type { EsTableColumn } from '@es-plus/core/types'

export const userColumns: EsTableColumn[] = [
  { prop: 'name', label: 'Name', width: 120 },
  { prop: 'email', label: 'Email' },
]
```

```ts
// vue3-app/src/UserList.vue
import { userColumns } from '../../shared/columns'
// pass to <es-table :columns="userColumns" />
```

```ts
// vue2-app/src/UserList.vue
import { userColumns } from '../../shared/columns'
// pass to <es-table :columns="userColumns" />
```

Same config, two renderers.

---

## CLI / MCP users

If you use `@es-plus/cli` or `@es-plus/mcp-server` to generate CRUD pages, you can now target either renderer:

```bash
npx @es-plus/cli create --target vue3 ./src/pages/Users.vue
npx @es-plus/cli create --target vue2 ./src/pages/Users.vue
```

The MCP `generate_crud_page` tool accepts the same `target` parameter. Generated code imports from `@es-plus/vue3` or `@es-plus/vue2` accordingly.

---

## Reporting issues

If anything breaks after migrating — or if the stub package misbehaves — please file an issue: <https://github.com/liujiaao/es-plus/issues>.

Include:
- Old import (`es-plus-ui` or `@es-plus/vue3`)
- Vue version (3.x or 2.x)
- Element Plus / Element UI version
- Minimal reproduction
