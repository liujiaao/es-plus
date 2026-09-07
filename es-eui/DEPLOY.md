# ES-EUI 文档部署指南

本文档介绍如何将 ES-EUI 文档站点部署到 GitHub Pages。

## 自动部署（推荐）

### 方法一：使用部署脚本

```bash
# Windows
scripts\deploy-gh-pages.bat
```

脚本会自动完成：
1. 检查工作区状态
2. 构建项目（`npm run build`）
3. 准备部署文件（创建 .nojekyll 和 404.html）
4. 使用 `gh-pages` 工具部署到 gh-pages 分支
5. 清理临时文件

### 方法二：使用 npm 脚本

```bash
# 安装 gh-pages 工具（首次使用）
npm install -g gh-pages

# 部署
npm run deploy
```

## 手动部署

如果自动部署失败，可以手动部署：

### 步骤 1：构建项目

```bash
npm run build
```

### 步骤 2：准备部署文件

```bash
# 进入 dist 目录
cd dist

# 创建 .nojekyll 文件（禁用 Jekyll 处理）
touch .nojekyll

# 创建 404.html（单页应用路由支持）
cat > 404.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ES-EUI Documentation</title>
  <script>
    sessionStorage.redirect = location.href;
  </script>
  <meta http-equiv="refresh" content="0;URL='/es-eui/'">
</head>
<body></body>
</html>
EOF

# 返回项目根目录
cd ..
```

### 步骤 3：部署到 gh-pages 分支

```bash
# 初始化 git 仓库（如果还没有）
git init

# 添加 dist 目录为工作树
git worktree add dist-temp gh-pages 2>/dev/null || git branch gh-pages
git worktree add dist-temp gh-pages

# 复制构建文件
rsync -av --delete --exclude='.git' dist/ dist-temp/

# 提交并推送
cd dist-temp
git add -A
git commit -m "docs: deploy to GitHub Pages"
git push origin gh-pages

# 清理
cd ..
git worktree remove dist-temp
```

## GitHub 设置

部署完成后，需要在 GitHub 仓库设置中启用 GitHub Pages：

1. 打开 GitHub 仓库页面
2. 点击 **Settings** 标签
3. 左侧菜单选择 **Pages**
4. **Source** 部分选择 **Deploy from a branch**
5. **Branch** 选择 **gh-pages** / **root**
6. 点击 **Save**

等待几分钟后，访问 `https://liujiaao.github.io/es-eui/`

## 配置自定义域名（可选）

1. 在 `public` 目录下创建 `CNAME` 文件：
   ```
   www.yourdomain.com
   ```

2. 重新构建并部署

3. 在你的域名 DNS 设置中添加 CNAME 记录：
   - 主机记录：`www`
   - 记录值：`liujiaao.github.io`

## 故障排除

### 部署后页面空白

1. 检查 `vue.config.js` 中的 `publicPath` 配置：
   ```javascript
   publicPath: process.env.NODE_ENV === 'production' ? '/es-eui/' : '/'
   ```

2. 确保仓库名称与 `publicPath` 一致

### 路由 404 错误

1. 确认 `404.html` 已正确部署
2. 检查 GitHub Pages 设置中的域名配置

### 样式丢失

1. 检查构建输出是否有 CSS 文件
2. 确认 `publicPath` 配置正确

## 相关链接

- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [Vue CLI 部署指南](https://cli.vuejs.org/guide/deployment.html#github-pages)
