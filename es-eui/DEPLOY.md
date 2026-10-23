# es-eui（Vue 2 文档站）部署说明

本目录是 **es-plus 三个文档站之一**，展示 es-plus 在 **Vue 2 + Element UI** 上的渲染结果。
它不单独发布：三个站点由 `.github/workflows/deploy-docs.yml` 一次构建、合并进同一个
GitHub Pages 站点。

## 线上地址

- 主站（Vue 3 + Element Plus）：https://liujiaao.github.io/es-plus/
- Ant Design Vue 站：https://liujiaao.github.io/es-plus/es-pc/
- 本站（Vue 2 + Element UI）：https://liujiaao.github.io/es-plus/es-eui/

## 如何部署

推送到 `master` 即可。流程：

1. `Typecheck` 工作流跑绿（三个站点的构建、golden 语料编译都在里面）；
2. `Deploy Docs` 由 `workflow_run` 触发，依次执行 `npm ci` → 三个站点 `npm run build`；
3. 构建产物合并：`es-plus-docs/dist` 放根目录，`es-pc/dist` → `/es-pc/`，`es-eui/dist` → `/es-eui/`；
4. `actions/deploy-pages` 发布。

本站构建时通过 `PUBLIC_PATH=/es-plus/es-eui/` 注入子路径前缀。

**注意**：`Typecheck` 失败或被超时取消时，`Deploy Docs` 会显示 **skipped**（不是红色失败），
线上仍然是上一次成功的构建。此时先看 Typecheck 的运行结论。

## 本地预览

```bash
cd es-eui
npm run serve        # 默认 http://localhost:8080
```

## 旧文档（已废弃）

本目录曾以独立仓库 `es-eui` 发布到 `liujiaao.github.io/es-eui/`，该地址已下线。
如仍看到指导「用 gh-pages 分支部署」的旧说明，一律以上文为准。
