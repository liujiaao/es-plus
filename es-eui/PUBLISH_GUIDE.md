# ES-EUI 组件库发布指南

本文档提供了 ES-EUI 组件库发布到 npm 的完整流程和最佳实践。

## 目录

- [发布前准备](#发布前准备)
- [版本管理](#版本管理)
- [打包流程](#打包流程)
- [发布到 npm](#发布到-npm)
- [发布后验证](#发布后验证)
- [常见问题解答](#常见问题解答)

---

## 发布前准备

### 1. 检查清单

在发布之前，请确保完成以下检查：

- [ ] **代码审查**：所有代码已通过审查，无明显的 bug 或问题
- [ ] **测试通过**：所有单元测试和集成测试通过
- [ ] **文档更新**：README.md 和 LIBRARY_README.md 已更新
- [ ] **版本号更新**：package.lib.json 中的版本号已更新
- [ ] **CHANGELOG 更新**：CHANGELOG.md 已记录本次变更
- [ ] **构建测试**：本地构建成功，dist 目录生成正确
- [ ] **npm 账号**：已拥有 npm 账号并已登录
- [ ] **Git 提交**：所有更改已提交到 Git 仓库
- [ ] **Git 标签**：已创建对应的 Git 标签

### 2. npm 账号准备

如果您还没有 npm 账号，请先注册：

```bash
npm adduser
```

按照提示输入用户名、密码和邮箱。

### 3. 登录 npm

在发布前，确保已登录 npm：

```bash
npm whoami
```

如果显示您的用户名，说明已登录。如果没有，请执行：

```bash
npm login
```

### 4. 检查包名可用性

在发布前，检查包名是否已被占用：

```bash
npm view es-eui
```

如果返回包信息，说明包名已被占用。如果是您自己的包，可以继续发布；如果是他人的包，需要更换包名。

---

## 版本管理

### 语义化版本 (Semantic Versioning)

ES-EUI 遵循语义化版本规范：`主版本号.次版本号.修订号`

- **主版本号 (MAJOR)**：不兼容的 API 修改
- **次版本号 (MINOR)**：向下兼容的功能性新增
- **修订号 (PATCH)**：向下兼容的问题修正

### 版本更新类型

| 类型 | 命令 | 说明 |
|------|------|------|
| 补丁版本 | `npm version patch` | 1.0.0 → 1.0.1 |
| 次版本 | `npm version minor` | 1.0.0 → 1.1.0 |
| 主版本 | `npm version major` | 1.0.0 → 2.0.0 |

### 使用版本更新脚本

我们提供了自动化版本更新脚本：

```bash
# Windows
scripts\version.bat patch
scripts\version.bat minor
scripts\version.bat major
```

脚本会自动：
1. 更新 `package.lib.json` 中的版本号
2. 更新 `LIBRARY_README.md` 中的版本号（如果需要）
3. 创建 Git 标签
4. 提交版本变更

---

## 打包流程

### 1. 手动打包

#### 步骤 1：备份原始 package.json

```bash
copy package.json package.json.backup
```

#### 步骤 2：替换为库配置的 package.json

```bash
copy package.lib.json package.json
```

#### 步骤 3：执行打包

```bash
npm run build:lib
```

打包完成后，会在项目根目录生成 `dist` 文件夹，包含：
- `es-eui.common.js` - CommonJS 格式
- `es-eui.esm.js` - ES Module 格式
- `es-eui.js` - UMD 格式
- `es-eui.css` - 样式文件

#### 步骤 4：恢复原始 package.json

```bash
copy package.json.backup package.json
del package.json.backup
```

### 2. 使用发布脚本（推荐）

我们提供了自动化发布脚本，可以一键完成打包和发布：

```[bash
scripts\publish.bat
```

脚本会自动：
1. 检查是否已登录 npm
2. 备份当前 package.json
3. 使用 package.lib.json 替换 package.json
4. 执行打包
5. 发布到 npm
6. 恢复原始 package.json

---

## 发布到 npm

### 1. 手动发布

#### 步骤 1：确保已打包

```bash
dir dist
```

确认 `dist` 目录存在且包含所有必要的文件。

#### 步骤 2：检查发布内容

```bash
npm pack --dry-run
```

这会显示将要发布的文件列表，确保没有包含不必要的文件。

#### 步骤 3：发布到 npm

```bash
npm publish
```

#### 步骤 4：发布到特定标签

```bash
# 发布到 beta 标签
npm publish --tag beta

# 发布到 next 标签
npm publish --tag next
```

### 2. 使用发布脚本（推荐）

```bash
scripts\publish.bat
```

### 3. 发布到私有 npm 仓库

如果需要发布到私有 npm 仓库：

```bash
npm publish --registry https://your-registry.com
```

或在 `.npmrc` 中配置：

```
registry=https://your-registry.com
```

---

## 发布后验证

### 1. 验证包是否发布成功

```bash
npm view es-eui
```

### 2. 查看包的详细信息

```bash
npm info es-eui
```

### 3. 在测试项目中安装验证

创建一个新的测试项目：

```bash
mkdir test-es-eui
cd test-es-eui
npm init -y
npm install vue@^2.6.14 element-ui@^2.15.14 es-eui
```

创建测试文件 `test.js`：

```javascript
const EsEui = require('es-eui')
console.log('ES-EUI loaded successfully:', typeof EsEui)
```

运行测试：

```bash
node test.js
```

### 4. 检查 CDN 可用性

访问以下链接检查 CDN 是否可用：

- unpkg: `https://unpkg.com/es-eui@版本号/dist/es-eui.js`
- jsDelivr: `https://cdn.jsdelivr.net/npm/es-eui@版本号/dist/es-eui.js`

---

## 常见问题解答

### Q1: 发布时提示 "403 Forbidden"

**原因**：包名已被他人占用或没有发布权限。

**解决方案**：
1. 检查包名是否被占用：`npm view es-eui`
2. 如果是您自己的包，确保已登录正确的 npm 账号
3. 如果包名被占用，需要更换包名

### Q2: 发布时提示 "E401 Unauthorized"

**原因**：npm 登录已过期或未登录。

**解决方案**：
```bash
npm login
```

### Q3: 打包后 dist 目录为空

**原因**：打包配置或入口文件有问题。

**解决方案**：
1. 检查 `vue.lib.config.js` 配置是否正确
2. 检查 `src/components/es-eui/index.js` 是否存在且正确
3. 查看打包日志中的错误信息

### Q4: 发布的包缺少样式文件

**原因**：`.npmignore` 或 `package.json` 的 `files` 字段配置不正确。

**解决方案**：
检查 `package.lib.json` 中的 `files` 字段：
```json
{
  "files": [
    "dist",
    "src/components/es-eui",
    "package.json",
    "README.md"
  ]
}
```

### Q5: 如何撤销已发布的版本？

**注意**：npm 不允许撤销已发布超过 24 小时的版本。

**解决方案**：
```bash
# 撤销特定版本（24小时内）
npm unpublish es-eui@1.0.0

# 撤销整个包（谨慎使用）
npm unpublish es-eui --force
```

### Q6: 如何发布预发布版本？

**解决方案**：
```bash
# 使用 prerelease 命令
npm version prerelease

# 或手动设置版本号
npm version 1.0.0-beta.1

# 发布时指定标签
npm publish --tag beta
```

### Q7: 如何从私有 npm 仓库发布？

**解决方案**：
```bash
# 方法 1：命令行指定
npm publish --registry https://your-registry.com

# 方法 2：配置 .npmrc
echo "registry=https://your-registry.com" > .npmrc
npm publish
```

### Q8: 发布时提示 "package.json not found"

**原因**：package.json 文件不存在或路径不正确。

**解决方案**：
确保在项目根目录执行发布命令，并且 package.json 文件存在。

### Q9: 如何查看已发布的版本列表？

**解决方案**：
```bash
npm view es-eui versions
```

### Q10: 如何设置包的访问权限？

**解决方案**：
```bash
# 设置为公开包
npm access public es-eui

# 设置为私有包（需要付费账户）
npm access restricted es-eui
```

---

## 最佳实践

### 1. 使用 CI/CD 自动化发布

推荐使用 GitHub Actions 或其他 CI/CD 工具自动化发布流程：

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build:lib
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. 使用 .npmignore 排除不必要的文件

创建 `.npmignore` 文件：

```
# 开发文件
src/
public/
test/
tests/
*.spec.js
*.test.js

# 配置文件
.babelrc
.eslintrc
.prettierrc
.gitignore
.editorconfig

# 构建文件
vue.config.js
vue.lib.config.js
babel.config.js

# 文档
docs/
*.md
!README.md

# 其他
.env
.env.*
coverage/
.nyc_output/
```

### 3. 使用 npm scripts 简化操作

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "prepublishOnly": "npm run build:lib",
    "version": "git add -A && git commit -m 'chore(release): %s'",
    "postversion": "git push && git push --tags"
  }
}
```

### 4. 使用语义化版本工具

推荐使用 `standard-version` 或 `semantic-release` 自动管理版本和 CHANGELOG：

```bash
npm install standard-version -D
```

在 `package.json` 中添加：

```json
{
  "scripts": {
    "release": "standard-version"
  }
}
```

---

## 相关资源

- [npm 官方文档](https://docs.npmjs.com/)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [Vue CLI 库模式构建](https://cli.vuejs.org/guide/build-targets.html#library)
- [npm 发布最佳实践](https://docs.npmjs.com/cli/v8/commands/npm-publish)

---

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue：[GitHub Issues](https://github.com/your-repo/es-eui/issues)
- 发送邮件：your-email@example.com

---

**最后更新时间**：2026-02-11
