# es-plus

基于 Vue 3 + Element Plus 的企业级中后台前端组件库，以配置化驱动为核心，大幅减少 CRUD 页面开发代码量。

[![npm version](https://img.shields.io/npm/v/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![license](https://img.shields.io/npm/l/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)

## 核心特性

- **配置化开发** — JSON 配置生成复杂表单与表格，替代大量模板代码
- **表单表格联动** — `triggerEvent` + `apiParams.model` 实现零事件代码查询
- **编程式弹窗** — `useDialog` Hook 命令式调用，支持 JSX 渲染、嵌套弹窗
- **自适应高度** — `ResizeObserver` 自动重算表格高度
- **跨页选择** — `rowkey` + `cachePageSelection` 解决分页选择丢失
- **任意后端适配** — `configTableOut` + `qrcb` 配置化适配不同后端响应格式
- **TypeScript** — 完整类型定义

## 项目结构

```
es-plus/
├── packages/es-plus/     # 组件库源码（npm: es-plus-ui）
│   ├── src/
│   │   ├── components/   # EsForm / EsTable / EsDialog / SvgIcon
│   │   ├── composables/  # useDialog / useFormLayout / useTableResize 等
│   │   ├── types/        # TypeScript 类型定义
│   │   └── utils/        # 工具函数
│   ├── README.md         # 完整 API 开发者文档
│   └── package.json
├── es-plus-docs/         # 文档站点（Vite + Vue 3）
│   ├── src/
│   │   ├── components/   # 交互式示例组件
│   │   ├── views/        # 文档页面
│   │   └── docs/         # Markdown 指南文档
│   └── package.json
└── LICENSE
```

## 快速安装

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
```

## 快速上手

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import EsPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(EsPlus)
app.mount('#app')
```

## 组件总览

| 组件 | 说明 | 文档 |
|------|------|------|
| EsForm | 配置化表单，13 种输入类型，动态显隐，异步数据加载 | [packages/es-plus/README.md](packages/es-plus/README.md) |
| EsTable | 配置化表格，远程数据，跨页选择，自适应高度 | [packages/es-plus/README.md](packages/es-plus/README.md) |
| EsDialog | 增强弹窗，拖拽，全屏，自定义渲染 | [packages/es-plus/README.md](packages/es-plus/README.md) |
| useDialog | 编程式弹窗 Hook，JSX 渲染，嵌套弹窗 | [packages/es-plus/README.md](packages/es-plus/README.md) |
| SvgIcon | SVG 图标组件 | [packages/es-plus/README.md](packages/es-plus/README.md) |

## 开发

```bash
# 组件库开发
cd packages/es-plus
npm install
npm run build

# 文档站点开发
cd es-plus-docs
npm install
npm run dev
```

## 相关项目

- [es-eui](https://github.com/liujiaao/es-eui) — Vue 2 + Element UI 版本

## License

[MIT](LICENSE)
