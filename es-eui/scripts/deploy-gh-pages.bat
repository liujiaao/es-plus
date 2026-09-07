@echo off
chcp 65001 >nul
echo ==========================================
echo   ES-EUI Docs - GitHub Pages Deploy Tool
echo ==========================================
echo.

REM 检查 git 是否安装
git --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Git 未安装，请先安装 Git
    pause
    exit /b 1
)

REM 检查是否有未提交的更改
echo [1/6] 检查工作区状态...
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo [警告] 有未提交的更改，请先提交
    git status -s
    set /p continue="是否继续? (y/n): "
    if /i not "%continue%"=="y" exit /b 1
)

REM 获取仓库 URL
echo [2/6] 获取仓库信息...
for /f "tokens=*" %%a in ('git config --get remote.origin.url') do set REPO_URL=%%a
echo 仓库地址: %REPO_URL%

REM 构建项目
echo [3/6] 构建项目...
call npm run build
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [成功] 构建完成

REM 创建 .nojekyll 文件（禁用 Jekyll 处理）
echo [4/6] 准备部署文件...
echo. > dist\.nojekyll

REM 复制 README.md 到 dist（如果有）
if exist README.md (
    copy README.md dist\ >nul
)

REM 创建 404.html（单页应用路由支持）
echo ^<!DOCTYPE html^> > dist\404.html
echo ^<html^> >> dist\404.html
echo ^<head^> >> dist\404.html
echo   ^<meta charset="utf-8"^> >> dist\404.html
echo   ^<title^>ES-EUI Documentation^</title^> >> dist\404.html
echo   ^<script^> >> dist\404.html
echo     // 单页应用 GitHub Pages 重定向 >> dist\404.html
echo     sessionStorage.redirect = location.href; >> dist\404.html
echo   ^</script^> >> dist\404.html
echo   ^<meta http-equiv="refresh" content="0;URL='/es-eui/'"^> >> dist\404.html
echo ^</head^> >> dist\404.html
echo ^<body^>^</body^> >> dist\404.html
echo ^</html^> >> dist\404.html

echo [成功] 部署文件准备完成

REM 部署到 gh-pages 分支
echo [5/6] 部署到 GitHub Pages...

REM 使用 npx gh-pages 部署
echo 正在安装/使用 gh-pages 工具...
call npx gh-pages -d dist --branch gh-pages --message "docs: deploy to GitHub Pages"

if errorlevel 1 (
    echo.
    echo [错误] 部署失败，尝试手动安装 gh-pages...
    call npm install -g gh-pages
    if errorlevel 1 (
        echo [错误] 无法安装 gh-pages，请手动安装: npm install -g gh-pages
        pause
        exit /b 1
    )
    call gh-pages -d dist --branch gh-pages --message "docs: deploy to GitHub Pages"
)

echo [6/6] 清理临时文件...
if exist dist\.nojekyll del dist\.nojekyll

echo.
echo ==========================================
echo   [成功] 部署完成!
echo ==========================================
echo.
echo 访问地址: https://liujiaao.github.io/es-eui/
echo.
echo 注意:
echo - 部署可能需要几分钟才能生效
echo - 首次部署后需要在 GitHub 仓库设置中启用 GitHub Pages
echo   Settings ^> Pages ^> Source ^> gh-pages branch
echo.
pause
