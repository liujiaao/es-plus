# es-eui（Vue 2 文档站）部署说明

本目录是 **es-plus 三个文档站之一**，展示 es-plus 在 **Vue 2 + Element UI** 上的渲染结果。
它有两个发布目标：**腾讯云 EdgeOne Makers（规范地址）** 与 GitHub Pages 上的镜像。

## 线上地址

- 主站（Vue 3 + Element Plus）：https://main.esplus-ai.com/
- Ant Design Vue 站：https://antdv.esplus-ai.com/
- 本站（Vue 2 + Element UI）：https://esui.esplus-ai.com/

GitHub Pages 镜像（旧链接仍可用，不再是切换器与 canonical 公布的地址）：

- 主站：https://liujiaao.github.io/es-plus/
- Ant Design Vue 站：https://liujiaao.github.io/es-plus/es-pc/
- 本站：https://liujiaao.github.io/es-plus/es-eui/

## 如何部署（GitHub Pages 镜像）

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

## EdgeOne Makers（项目 `es-plus-vue2`）

项目根目录指向**本目录**（`es-eui`）。本站的 `prebuild` 会通过
`npm --prefix .. run build --workspace @es-plus/core` 重建 monorepo 库，因此
**必须同时安装仓库根的 devDependencies**（`tsc`、`vite` 都在那里）。只装本目录依赖会报：

```
sh: line 1: tsc: command not found
npm error code 127
```

| 配置项 | 值 |
| --- | --- |
| 安装命令 | `npm ci --include=dev && npm --prefix .. ci --include=dev` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

若控制台只能改构建命令，把根安装拼在最前面：
`npm --prefix .. ci --include=dev && npm run build`。

`--include=dev` 是必需的：构建环境若设了 `NODE_ENV=production`，`npm ci` 会默认省略
devDependencies。改完配置后必须重新部署。

## 旧文档（已废弃）

本目录曾以独立仓库 `es-eui` 发布到 `liujiaao.github.io/es-eui/`，该地址已下线。
如仍看到指导「用 gh-pages 分支部署」的旧说明，一律以上文为准。
