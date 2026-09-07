@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM 检查参数
if "%~1"=="" (
    echo ========================================
    echo ES-EUI 组件库版本更新脚本
    echo ========================================
    echo.
    echo 用法: version.bat [patch^|minor^|major^|prerelease]
    echo.
    echo 参数说明:
    echo   patch      - 修订版本 (1.0.0 -^> 1.0.1)
    echo   minor      - 次版本   (1.0.0 -^> 1.1.0)
    echo   major      - 主版本   (1.0.0 -^> 2.0.0)
    echo   prerelease - 预发布版本 (1.0.0 -^> 1.0.1-0)
    echo.
    pause
    exit /b 1
)

set "VERSION_TYPE=%~1"

REM 验证版本类型
if /i not "%VERSION_TYPE%"=="patch" if /i not "%VERSION_TYPE%"=="minor" if /i not "%VERSION_TYPE%"=="major" if /i not "%VERSION_TYPE%"=="prerelease" (
    echo [错误] 无效的版本类型: %VERSION_TYPE%
    echo [提示] 请使用: patch, minor, major 或 prerelease
    echo.
    pause
    exit /b 1
)

echo ========================================
echo ES-EUI 组件库版本更新脚本
echo ========================================
echo.
echo [信息] 版本类型: %VERSION_TYPE%
echo.

REM 检查 package.lib.json 是否存在
echo [1/5] 检查 package.lib.json...
if not exist "package.lib.json" (
    echo [错误] package.lib.json 不存在
    echo.
    pause
    exit /b 1
)
echo [成功] package.lib.json 存在
echo.

REM 读取当前版本号
echo [2/5] 读取当前版本号...
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" package.lib.json') do (
    set "CURRENT_VERSION=%%~a"
    set "CURRENT_VERSION=!CURRENT_VERSION:"=!"
)
echo [信息] 当前版本: %CURRENT_VERSION%
echo.

REM 使用 npm version 更新版本号
echo [3/5] 更新版本号...
call npm version %VERSION_TYPE% --no-git-tag-version >nul 2>&1
if errorlevel 1 (
    echo [错误] 更新版本号失败
    echo.
    pause
    exit /b 1
)

REM 读取新版本号
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" package.json') do (
    set "NEW_VERSION=%%~a"
    set "NEW_VERSION=!NEW_VERSION:"=!"
)
echo [成功] 新版本: %NEW_VERSION%
echo.

REM 更新 package.lib.json 中的版本号
echo [4/5] 更新 package.lib.json 中的版本号...
powershell -Command "(Get-Content package.lib.json) -replace '\"version\": \"[^\"]+\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.lib.json"
if errorlevel 1 (
    echo [错误] 更新 package.lib.json 失败
    echo.
    pause
    exit /b 1
)
echo [成功] 已更新 package.lib.json
echo.

REM 检查是否需要更新 LIBRARY_README.md
echo [检查] 检查 LIBRARY_README.md 是否需要更新...
if exist "LIBRARY_README.md" (
    findstr /C:"npm install es-eui" LIBRARY_README.md >nul 2>&1
    if not errorlevel 1 (
        echo [信息] LIBRARY_README.md 包含安装命令，跳过版本号更新
    ) else (
        echo [信息] LIBRARY_README.md 不需要更新
    )
) else (
    echo [信息] LIBRARY_README.md 不存在，跳过
)
echo.

REM 创建 Git 标签
echo [5/5] 创建 Git 标签...
git tag -a "v%NEW_VERSION%" -m "Release version %NEW_VERSION%" >nul 2>&1
if errorlevel 1 (
    echo [警告] 创建 Git 标签失败
    echo [提示] 请确保已初始化 Git 仓库
) else (
    echo [成功] 已创建 Git 标签: v%NEW_VERSION%
)
echo.

REM 提示提交
echo ========================================
echo 版本更新完成！
echo ========================================
echo.
echo [信息] 新版本号: %NEW_VERSION%
echo [信息] Git 标签: v%NEW_VERSION%
echo.
echo [提示] 请执行以下命令提交更改:
echo   git add package.lib.json package.json
echo   git commit -m "chore(release): bump version to %NEW_VERSION%"
echo   git push origin v%NEW_VERSION%
echo.

pause