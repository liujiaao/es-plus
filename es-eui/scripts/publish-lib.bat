@echo off
chcp 65001 >nul
echo ==========================================
echo   ES-EUI Library Publish Tool
echo ==========================================
echo.

REM 检查 git 状态
echo [1/7] 检查 Git 状态...
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo [警告] 有未提交的更改，请先提交
    git status -s
    pause
    exit /b 1
)

REM 检查 npm 登录状态
echo [2/7] 检查 npm 登录状态...
npm whoami >nul 2>&1
if errorlevel 1 (
    echo [提示] 未登录 npm，请先登录
    echo 执行: npm login
    npm login
    if errorlevel 1 (
        echo [错误] 登录失败
        pause
        exit /b 1
    )
)
echo [成功] 已登录 npm

REM 保存原始 registry
echo [3/7] 切换 npm registry...
for /f "tokens=*" %%a in ('npm config get registry') do set ORIGINAL_REGISTRY=%%a
echo 原始 registry: %ORIGINAL_REGISTRY%

REM 切换到官方 npm registry
npm config set registry https://registry.npmjs.org/
echo [成功] 已切换到 https://registry.npmjs.org/

REM 更新版本号
echo [4/7] 更新版本号...
echo 当前版本:
npm version

set /p VERSION_TYPE="请输入版本类型 (patch/minor/major): "
if "%VERSION_TYPE%"=="" set VERSION_TYPE=patch

REM 备份并替换 package.json
echo [5/7] 准备构建...
copy /Y package.json package.json.backup >nul
copy /Y package.lib.json package.json >nul

REM 更新版本
npm version %VERSION_TYPE% --no-git-tag-version
if errorlevel 1 (
    echo [错误] 版本更新失败
    copy /Y package.json.backup package.json >nul
    npm config set registry %ORIGINAL_REGISTRY%
    pause
    exit /b 1
)

REM 构建库
echo [6/7] 构建库...
npm run build:lib
if errorlevel 1 (
    echo [错误] 构建失败
    copy /Y package.json.backup package.json >nul
    npm config set registry %ORIGINAL_REGISTRY%
    pause
    exit /b 1
)
echo [成功] 构建完成

REM 发布到 npm
echo [7/7] 发布到 npm...
npm publish --registry https://registry.npmjs.org/
if errorlevel 1 (
    echo [错误] 发布失败
    copy /Y package.json.backup package.json >nul
    npm config set registry %ORIGINAL_REGISTRY%
    pause
    exit /b 1
)

echo [成功] 发布完成！

REM 恢复原始 package.json
copy /Y package.json.backup package.json >nul
del package.json.backup >nul 2>&1

REM 恢复原始 registry
npm config set registry %ORIGINAL_REGISTRY%
echo [成功] 已恢复 registry: %ORIGINAL_REGISTRY%

REM 提交版本更新
echo.
echo 提交版本更新到 Git...
git add package.lib.json
for /f "tokens=*" %%a in ('node -e "console.log(require('./package.lib.json').version)"') do set NEW_VERSION=%%a
git commit -m "chore(release): %NEW_VERSION%"
git tag v%NEW_VERSION%

echo.
echo ==========================================
echo   [成功] ES-EUI v%NEW_VERSION% 已发布！
echo ==========================================
echo.
echo 查看包信息: npm view es-eui
echo.
pause
