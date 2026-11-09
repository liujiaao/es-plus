# es-pc（Ant Design Vue 文档站）部署说明

本目录是 **es-plus 三个文档站之一**，展示 es-plus 在 **Vue 3 + Ant Design Vue 4** 上的渲染结果。
发布目标与另两站相同：**腾讯云 EdgeOne Makers（规范地址）** 与 GitHub Pages 镜像。

## 线上地址

- 主站（Vue 3 + Element Plus）：https://main.esplus-ai.com/
- 本站（Ant Design Vue）：https://antdv.esplus-ai.com/
- es-eui（Vue 2 + Element UI）：https://esui.esplus-ai.com/

GitHub Pages 镜像（旧链接仍可用）：

- 主站：https://liujiaao.github.io/es-plus/
- Ant Design Vue 站：https://liujiaao.github.io/es-plus/es-pc/
- es-eui：https://liujiaao.github.io/es-plus/es-eui/

## 本地构建

```bash
npm ci --legacy-peer-deps
npm run build     # 经 ../scripts/build-vite.mjs 调 vite build
npm run preview
```

## EdgeOne Makers（项目 `es-plus-antdv`）

项目根目录指向**本目录**（`es-pc`）。

| 配置项 | 值 |
| --- | --- |
| 安装命令 | `npm ci --legacy-peer-deps` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

### 构建期 `EMFILE: too many open files`

2026-11-09 的构建在渲染 1582 个模块之后失败：

```
[commonjs--resolver] EMFILE: too many open files,
  open '/dev/shm/repo/es-plus-antdv-xxxx/es-pc/node_modules/vue/package.json'
```

**不是代码问题**：同一个提交在本地 Windows 构建正常，报错点是 vite 解析依赖时并发读
`package.json`，而构建容器的 `RLIMIT_NOFILE` 偏低，fd 被用尽。

现在 `es-pc` 的 `build` 走 `../scripts/build-vite.mjs`：POSIX 上先把软上限抬到硬上限
允许的最大值（65535 → 16384 → 4096 → 1024 依次尝试）再跑 vite，并把实际生效的
值打进构建日志；Linux 上还会留一个父进程采样子进程的 `/proc/<pid>/fd`：

```
[build-vite] RLIMIT_NOFILE=1024（硬上限 1024）
[build-vite] 子进程 fd：起始 12，峰值 1019
[build-vite]   998 × node_modules/vue/package.json
```

- **硬上限就是 1024**（实测如此，抬不动）→ 只能在「少开 fd」上做文章，或者换构建环境。
  看峰值那几行：指向 `node_modules/*/package.json` 说明是解析阶段的并发峰值；
  指向 `socket:` / `pipe:` 说明是别的东西在占；起始值就接近上限说明是**继承来的**。
- 这行数值仍很小 → 把控制台构建命令改成 `ulimit -n 65535 2>/dev/null; npm run build`，
  或请平台放宽。

Windows 没有 `ulimit`，脚本直接调 vite，本地行为与改动前完全一致。
