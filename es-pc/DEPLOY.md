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
允许的最大值（65535 → 16384 → 4096 → 1024 依次尝试）再跑 vite；Linux 上还会

1. 关掉从构建器**继承**来的普通文件 fd（`pipe:` / `socket:` / `anon_inode:` 与 stdio
   一律不动），并报出关了几个；
2. 留一个只握几个 fd 的父进程采样子进程 `/proc/<pid>/fd`，失败或峰值偏高时打印：

```
[build-vite] RLIMIT_NOFILE=1024（硬上限 1024）
[build-vite] 起始 fd 1031，其中 1019 个是继承来的普通文件，已关闭
[build-vite] 子进程 fd：起始 12，峰值 48
```

判读：

- **硬上限就是 1024**（实测如此，抬不动）→ 只能「少开 fd」或换构建环境；
- 起始值就接近上限 / 关掉一大把继承 fd → 是构建器带进来的占用，条目 1 已经在治；
- 峰值那几行指向 `node_modules/*/package.json`、`socket:`、`pipe:` 时按目标对症：
  解析阶段并发峰值、网络/子进程、还是真漏了。

Windows 没有 `ulimit`、也没有 `/proc`，脚本直接调 vite，本地行为与改动前完全一致。
