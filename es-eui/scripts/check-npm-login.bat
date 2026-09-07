@echo off
chcp 65001 >nul
echo.
echo ========== NPM 登录状态检测 ==========
echo.

REM 获取当前 registry
for /f "tokens=*" %%a in ('npm config get registry') do set REGISTRY=%%a
echo 当前 Registry: %REGISTRY%
echo.

REM 检测登录状态
npm whoami >nul 2>&1
if errorlevel 1 (
    echo [❌] 未登录 npm
    echo.
    echo 请先登录：
    echo   npm login
    echo.
    echo 或切换到淘宝镜像（免登录）：
    echo   npm config set registry https://registry.npmmirror.com/
    exit /b 1
) else (
    for /f "tokens=*" %%a in ('npm whoami') do set USERNAME=%%a
    echo [✅] 已登录 npm
    echo 用户名: %USERNAME%
    echo.
    echo 如需切换账号：
    echo   npm logout
    echo   npm login
    exit /b 0
)
