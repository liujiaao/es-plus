---
"@es-plus/core": patch
---

`exports` 补上 `"./package.json"`

只暴露了 9 个子路径，`require('@es-plus/core/package.json')` / `import … with { type: 'json' }`
会以 `ERR_PACKAGE_PATH_NOT_EXPORTED` 失败。读取包版本号与元数据是工具链（bundler 插件、
版本探针、发版脚本）的常规用法，加上这一条即可，其余子路径与产物文件不变。
