# es-plus-ui (DEPRECATED)

> **Renamed to [`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3) starting v1.4.0.**

This package is now a thin re-export of `@es-plus/vue3`, kept on npm so existing installs continue to work. **All future development happens on `@es-plus/vue3`** — please migrate.

## Why the rename?

`es-plus` now ships a sibling Vue 2 + Element UI renderer ([`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2)) sharing the same JSON schema-driven config. Putting both renderers in the same npm scope makes the family obvious:

| Renderer | Old name | New name |
| --- | --- | --- |
| Vue 3 + Element Plus | `es-plus-ui` | **`@es-plus/vue3`** |
| Vue 2 + Element UI | (new) | **`@es-plus/vue2`** |
| Framework-agnostic core | (new) | **`@es-plus/core`** |
| MCP server | `@es-plus/mcp-server` | (unchanged) |
| CLI | `@es-plus/cli` | (unchanged) |

## Migration

```diff
- npm install es-plus-ui
+ npm install @es-plus/vue3
```

```diff
- import EsPlus from 'es-plus-ui'
- import 'es-plus-ui/dist/style.css'
- import { EsPlusResolver } from 'es-plus-ui/resolver'
+ import EsPlus from '@es-plus/vue3'
+ import '@es-plus/vue3/dist/style.css'
+ import { EsPlusResolver } from '@es-plus/vue3/resolver'
```

The public API is **100% identical** — only the import path changes.

See the full migration guide: <https://github.com/liujiaao/es-plus/blob/master/docs/migrate-v1.4.md>

## What still works

- `npm install es-plus-ui` — installs this stub, which depends on `@es-plus/vue3@1.4.0`
- `import ... from 'es-plus-ui'` — re-exports `@es-plus/vue3`
- `import 'es-plus-ui/dist/style.css'` — re-imports `@es-plus/vue3/dist/style.css`
- `import { EsPlusResolver } from 'es-plus-ui/resolver'` — re-exports `@es-plus/vue3/resolver`

A one-time deprecation warning prints to the console at runtime. Set `ES_PLUS_SILENCE_DEPRECATION=1` to silence it.

## Versions <= 1.3.5

The original `es-plus-ui` packages (1.0.x – 1.3.5) remain on npm and are unaffected. They have been `npm deprecate`-d with a notice pointing to `@es-plus/vue3`.

## License

[MIT](./LICENSE) © liujiaao
