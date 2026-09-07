@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo ES-EUI 组件库发布脚本
echo ========================================
echo.

REM 检查是否已登录 npm
echo [1/6] 检查 npm 登录状态...
npm whoami >nul 2>&1
if errorlevel 1 (
    echo [错误] 未登录 npm，请先执行 npm login
    echo.
    pause
    exit /b 1
)
echo [成功] 已登录 npm
echo.

REM 备份当前 package.json
echo [2/6] 备份原始 package.json...
if exist "package.json" (
    copy /Y "package.json" "package.json.backup" >nul
    if errorlevel 1 (
        echo [错误] 备份 package.json 失败
        echo.
        pause
        exit /b 1
    )
    echo [成功] 已备份到 package.json.backup
) else (
    echo [错误] package.json 不存在
    echo.
    pause
    exit /b 1
)
echo.

REM 检查 package.lib.json 是否存在
echo [3/6] 检查 package.lib.json...
if not exist "package.lib.json" (
    echo [错误] package.lib.json 不存在
    echo [提示] 请先创建 package.lib.json 配置文件
    echo.
    pause
    exit /b 1
)
echo [成功] package.lib.json 存在
echo.

REM 使用 package.lib.json 替换 package.json
echo [4/6] 替换 package.json...
copy /Y "package.lib.json" "package.json" >nul
if errorlevel 1 (
    echo [错误] 替换 package.json 失败
    echo [恢复] 正在恢复原始 package.json...
    copy /Y "package.json.backup" "package.json" >nul
    del "package.json.backup" >nul 2>&1
    echo.
    pause
    exit /b 1
)
echo [成功] 已使用 package.lib.json 替换 package.json
echo.

REM 执行打包
echo [5/6] 开始打包...
call npm run build:lib
if errorlevel 1 (
    echo [错误] 打包失败
    echo [恢复] 正在恢复原始 package.json...
    copy /Y "package.json.backup" "package.json" >nul
    del "package.json.backup" >nul 2>&1
    echo.
    pause
    exit /b 1
)
echo [成功] 打包完成
echo.

REM 检查 dist 目录
echo [检查] 验证 dist 目录...
if not exist "dist" (
    echo [错误] dist 目录不存在，打包可能失败
    echo [恢复] 正在恢复原始 package.json...
    copy /Y "package.json.backup" "package.json" >nul
    del "package.json.backup" >nul 2>&1
    echo.
    pause
    exit /b 1
)
echo [成功] dist 目录存在
echo.

REM 发布到 npm
echo [6/6] 发布到 npm...
echo [提示] 正在发布，请稍候...
call npm publish
if errorlevel 1 (
    echo [错误] 发布失败
    echo [恢复] 正在恢复原始 package.json...
    copy /Y "package.json.backup" "package.json" >nul
    del "package.json.backup" >nul 2>&1
    echo.
    pause
    exit /b 1
)
echo [成功] 发布成功
echo.

REM 恢复原始 package.json
echo [清理] 恢复原始 package.json...
copy /Y "package.json.backup" "package.json" >nul
if errorlevel 1 (
    echo [警告] 恢复 package.json 失败，请手动恢复
) else (
    echo [成功] 已恢复原始 package.json
)
del "package.json.backup" >nul 2>&1
echo.

echo ========================================
echo 发布完成！
echo ========================================
echo.
echo [提示] 您可以使用以下命令验证发布：
echo   npm view es-eui
echo   npm info es-eui
echo.

pause
