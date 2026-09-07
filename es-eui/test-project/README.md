# ES-EUI 组件库测试项目

这是一个用于验证 ES-EUI 组件库功能的生产环境测试项目。

## 项目结构

```
test-project/
├── package.json          # 测试项目配置
├── .npmrc               # 本地 npm 包引用配置
├── index.html           # 测试页面
├── src/
│   ├── main.js          # 入口文件
│   └── App.vue          # 应用组件（包含测试用例）
└── README.md            # 本文档
```

## 功能测试

本项目测试以下 ES-EUI 组件和功能：

1. **EsDialog 组件** - 可拖拽对话框组件
2. **Es**Form 组件** - 动态表单组件
3. **EsTable 组件** - 增强表格组件
4. **useDialog 函数** - 对话框组合式函数

## 安装步骤

### 1. 确保已打包 ES-EUI 组件库

在运行测试项目之前，请确保 ES-EUI 组件库已经打包完成。检查上级目录是否存在 `dist` 文件夹：

```bash
cd ..
npm run build:lib
cd test-project
```

### 2. 安装依赖

```bash
# 安装所有依赖（包括本地 es-eui 包）
npm install

# 或者只安装本地 es-eui 包
npm run install:local
```

## 运行项目

### 开发模式

```bash
npm run serve
```

项目将在 `http://localhost:8080` 启动。

### 生产构建

```bash
npm run build
```

## 测试说明

### 自动测试

项目启动后会自动检测组件是否正确注册，并在页面顶部显示测试结果：

- ✓ 绿色标签表示测试通过
- ✗ 红色标签表示测试失败

### 手动测试

1. **EsDialog 组件测试**
   - 点击 "打开测试对话框" 按钮
   - 验证对话框是否正常显示
   - 测试拖拽功能
   - 测试确认和取消按钮

2. **useDialog 函数测试**
   - 点击 "使用 useDialog 打开" 按钮
   - 验证通过函数调用的对话框是否正常工作

3. **EsForm 组件测试**
   - 填写表单字段
   - 测试表单验证
   - 提交表单验证数据是否正确

4. **EsTable 组件测试**
   - 查看表格数据是否正确显示
   - 测试行选择功能
   - 测试行点击事件
   - 测试编辑和删除按钮

## 依赖说明

### 核心依赖

- `vue@^2.6.14` - Vue.js 框架
- `element-ui@^2.15.14` - Element UI 组件库
- `es-eui@file:../dist` - 本地 ES-EUI 组件库

### 开发依赖

- `@vue/cli-service@^5.0.8` - Vue CLI 服务
- `vue-template-compiler@^2.6.14` - Vue 模板编译器

## 本地包引用

项目通过 `.npmrc` 文件配置使用本地的 ES-EUI 包：

```
es-eui=file:../dist
```

这种方式允许在开发过程中直接使用本地打包的组件库，无需发布到 npm 仓库。

## 故障排除

### 问题：找不到 es-eui 包

**解决方案：**
1. 确保上级目录存在 `dist` 文件夹
2. 确保已运行 `npm run build:lib` 打包组件库
3. 删除 `node_modules` 和 `package-lock.json` 后重新安装

### 问题：组件未正确注册

**解决方案：**
1. 检查 `src/main.js` 中是否正确导入和注册组件
2. 检查浏览器控制台是否有错误信息
3. 确认 ES-EUI 组件库导出正确

### 问题：样式未加载

**解决方案：**
1. 检查 `src/main.js` 中是否正确导入 CSS 文件
2. 确认 `dist` 目录中存在 `es-eui.css` 文件
3. 检查浏览器开发者工具中的网络请求

## 预期结果

如果所有测试通过，您应该看到：

1. 页面顶部显示四个绿色的 "✓ 通过" 标签
2. EsDialog 对话框可以正常打开和关闭
3. useDialog 函数可以正常调用
4. EsForm 表单可以正常提交和验证
5. EsTable 表格可以正常显示和交互

## 技术支持

如遇到问题，请检查：

1. 浏览器控制台的错误信息
2. 网络请求是否成功
3. 依赖版本是否兼容
4. ES-EUI 组件库是否正确打包

## 许可证

本测试项目仅用于验证 ES-EUI 组件库功能，不适用于生产环境。