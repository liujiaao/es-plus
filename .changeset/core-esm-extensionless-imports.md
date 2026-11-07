---
"@es-plus/core": patch
---

`@es-plus/core` 的 ESM 产物在普通 Node 里 import 会 `ERR_MODULE_NOT_FOUND`

`build/` 里 33 处相对说明符是 `from './shared'`（无扩展名）。打包器会自己补，
所以三个文档站从来遇不到；但 `node --input-type=module -e "import('@es-plus/core')"`
直接失败。1.3.0 与 1.4.0 都带着这个形态。

改动：

- `packages/core/src` 的 61 处相对说明符补全为 `./x.js`（TS 仍映射回 `.ts` 源文件，
  CJS 那趟 `require('./x.js')` 同样成立）
- `tsconfig.build.json` 的 ESM 那趟改用 `module/moduleResolution: nodenext`，漏写
  扩展名从此是**编译错误**，不会再靠人记
- `check:distribution` 新增两条判据：ESM 产物里不得有无扩展名的相对说明符；无 bin
  的库包必须能被动态 import 一次

CJS 入口（`build/cjs`）与子路径导出行为不变。
