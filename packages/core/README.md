# @es-plus/core

> Framework-agnostic core for the **es-plus** ecosystem — shared types, configuration, layout algorithms, request helpers, and pure logic powering both the Vue 3 (`@es-plus/vue3`) and Vue 2 (`@es-plus/vue2`) renderers.

[![npm version](https://img.shields.io/npm/v/@es-plus/core.svg)](https://www.npmjs.com/package/@es-plus/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**Live demos, one config, three renderers**: [Vue 3 + Element Plus](https://liujiaao.github.io/es-plus/) · [Vue 3 + Ant Design Vue](https://liujiaao.github.io/es-plus/es-pc/) · [Vue 2 + Element UI](https://liujiaao.github.io/es-plus/es-eui/) — this package is the shared core underneath all three. [Docs](https://liujiaao.github.io/es-plus/) · [GitHub](https://github.com/liujiaao/es-plus)

## Overview

`@es-plus/core` contains **zero Vue / Element / framework dependencies**. It is the single source of truth for the schema-driven CRUD configuration shared by every renderer in the family:

| Renderer | Package | Framework | UI |
| --- | --- | --- | --- |
| Vue 3 | [`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3) | Vue 3 | Element Plus |
| Vue 2 | [`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2) | Vue 2 / 2.7 | Element UI 2 |
| MCP server | [`@es-plus/mcp-server`](https://www.npmjs.com/package/@es-plus/mcp-server) | Node | — |
| CLI | [`@es-plus/cli`](https://www.npmjs.com/package/@es-plus/cli) | Node | — |

A `columns` / `formItemList` JSON config that validates against the core schemas works **identically** in every renderer.

## Install

```bash
npm install @es-plus/core
# or
pnpm add @es-plus/core
```

You normally don't install this directly — it ships as a dependency of the renderer packages.

## What's inside

| Subpath | Purpose |
| --- | --- |
| `@es-plus/core` (default) | Re-exports of every public symbol below |
| `@es-plus/core/types` | Shared TypeScript interfaces: `ColumnConfig`, `FormItemConfig`, `BtnConfig`, `PaginationConfig`, `ApiParams`, `EsPlusOptions`, … |
| `@es-plus/core/config` | `configureEsPlus`, `getGlobalConfig`, `EsPlusGlobalConfig` |
| `@es-plus/core/constants` | `FORM_TYPES`, `CRUD_ACTIONS`, default page sizes |
| `@es-plus/core/shared` | Pure utilities (`isObject`, `findValueByKey`, `flattenColumns`, `deepClone`, …) |
| `@es-plus/core/form-layout` | `getRowColsAlgorithm` — responsive row/col allocator |
| `@es-plus/core/table-selection` | Cross-page selection set algorithm |
| `@es-plus/core/request` | Request param construction + `configTableOut` response mapping |
| `@es-plus/core/field-resolver` | Field default-value, formatter, and resolver helpers |

## Quick example

```ts
import { configureEsPlus } from '@es-plus/core/config'
import { getRowColsAlgorithm } from '@es-plus/core/form-layout'
import { findValueByKey } from '@es-plus/core/shared'

configureEsPlus({
  httpRequest: async ({ url, method, data }) => {
    return fetch(url, { method, body: JSON.stringify(data) }).then(r => r.json())
  },
  configTableOut: (res) => ({ list: res.data.records, total: res.data.total }),
  permission: (code) => userPermissions.includes(code),
})

const layout = getRowColsAlgorithm({
  width: 1200,
  span: { xs: 24, sm: 12, md: 8, lg: 6, xl: 4 },
})

const status = findValueByKey(record, 'profile.status')
```

## Versioning & compatibility

- Follows [SemVer](https://semver.org/). Breaking changes bump the major version.
- Renderer packages declare a caret range on `@es-plus/core` (e.g. `^1.0.0`). Upgrading a renderer pulls compatible core upgrades automatically.
- Pre-release renderers may pin tighter ranges; check each renderer's `peerDependencies` / `dependencies`.

## Repository

Monorepo: [github.com/liujiaao/es-plus](https://github.com/liujiaao/es-plus)

```
packages/
├── core/        ← this package
├── es-plus/     ← @es-plus/vue3 (formerly es-plus-ui)
├── vue2/        ← @es-plus/vue2
├── mcp-server/  ← @es-plus/mcp-server
└── cli/         ← @es-plus/cli
```

## License

[MIT](./LICENSE) © liujiaao
