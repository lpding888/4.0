@echo off
REM #########################
REM 数据库重置和初始化脚本 (Windows版本)
REM 用于本地开发环境快速重建数据库
REM #########################

setlocal enabledelayedexpansion

echo ========================================
echo 🔥 老王的数据库重置脚本 - 开始执行
echo ========================================
echo.

cd /d "%~dp0.."

echo 步骤 1/5: 停止并删除现有容器...
docker-compose -f docker-compose.dev.yml down -v
if errorlevel 1 (
    echo ❌ 停止容器失败！请检查Docker是否运行
    pause
    exit /b 1
)

echo.
echo 步骤 2/5: 启动数据库容器...
docker-compose -f docker-compose.dev.yml up -d mysql redis
if errorlevel 1 (
    echo ❌ 启动容器失败！
    pause
    exit /b 1
)

echo.
echo 步骤 3/5: 等待MySQL启动（最多60秒）...
set /a timeout=30
set /a elapsed=0

:wait_loop
if !elapsed! geq !timeout! (
    echo.
    echo ❌ MySQL启动超时！
    pause
    exit /b 1
)

docker exec ai-photo-mysql-dev mysqladmin ping -h localhost -uroot -pdev_password_123 --silent >nul 2>&1
if errorlevel 1 (
    echo|set /p="."
    timeout /t 2 /nobreak >nul
    set /a elapsed=!elapsed!+1
    goto wait_loop
)

echo.
echo ✅ MySQL已就绪！

echo.
echo 步骤 4/5: 执行数据库迁移...
call npm run db:migrate
if errorlevel 1 (
    echo ❌ 数据库迁移失败！
    pause
    exit /b 1
)

echo.
echo 步骤 5/5: 查看迁移状态...
call npx knex migrate:status

echo.
echo ========================================
echo ✅ 数据库初始化完成！
echo.
echo 📊 容器状态：
docker-compose -f docker-compose.dev.yml ps
echo.
echo 🚀 可以启动后端服务了：
echo    npm run dev
echo.

pause
