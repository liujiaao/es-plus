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

### 构建期 `EMFILE: too many open files`（已定位并修复）

2026-11-09 的构建在 400~1600 个模块之间（每次位置不同）失败：

```
[commonjs--resolver] EMFILE: too many open files,
  open '/dev/shm/repo/es-plus-antdv-xxxx/es-pc/node_modules/vue/package.json'
```

**真因不是代码，也不是 vite 解析 package.json 的并发**：vite 的
`vite:load-fallback` 用 `fsp.readFile` **异步**读每个模块的源码，而 rollup 的模块
加载对每个 import 扇出并发、且没有上限。实测这个站的**峰值在途读取 = 1001**
（每个在途读取占一个 fd）。本地 Windows 的 fd 上限很高，永远碰不到；云构建容器
`RLIMIT_NOFILE` 硬上限就是 1024（抬高全部被拒），于是 400 多个模块就顶穿了。
位置每次不同，正是因为并发峰值随调度浮动。

修法在仓库里，不需要改平台配置：`es-pc` 的 `build` 走 `../scripts/build-vite.mjs`，
用 `-r` 预加载 `../scripts/limit-fs-concurrency.cjs`，把在途读取压到 32：

```
[fs-limit] 峰值并发读取 32（限制 32）
```

本地实测峰值 1001 → 32，构建耗时 16.25s → 16.59s（可忽略）。想调可以用
`ES_BUILD_FS_CONCURRENCY`（默认 32；设 0 = 只观测不限制）。

脚本在 Linux 上还有两件事，用于下次出问题时自证：

```
[build-vite] RLIMIT_NOFILE=1024（硬上限 1024）
[build-vite] 起始 fd 1031，其中 1019 个是继承来的普通文件，已关闭
[build-vite] 子进程 fd：起始 12，峰值 48
[build-vite]   998 × node_modules/vue/package.json
```

- 起始值大 → 是构建器继承来的 fd（条目 1 会先关掉指向真实路径的那些，
  `pipe:` / `socket:` / `anon_inode:` 与 stdio 不动）；
- 峰值那几行 → 失败瞬间 fd 都指向什么；若再次顶到 1024，按这里继续收敛。

Windows 没有 `ulimit`、也没有 `/proc`，脚本直接调 vite，本地行为与改动前一致。
