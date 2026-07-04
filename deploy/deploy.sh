#!/bin/bash

# WrapServer 部署脚本
# 使用 tsx 直接运行 TypeScript，pm2 管理进程

set -e

APP_NAME="wrap-server"
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$DEPLOY_DIR")"

echo "=== WrapServer 部署开始 ==="
echo "项目目录: $PROJECT_DIR"

cd "$PROJECT_DIR"

# 1. 安装依赖
echo ""
echo ">>> [1/4] 安装依赖..."
npm install --production=false

# 2. 确保 tsx 可用
echo ""
echo ">>> [2/4] 检查 tsx..."
if ! npx tsx --version > /dev/null 2>&1; then
  echo "tsx 未找到，正在安装..."
  npm install tsx
fi

# 3. 安装 pm2（如果未安装）
echo ""
echo ">>> [3/4] 检查 pm2..."
if ! command -v pm2 &> /dev/null; then
  echo "pm2 未安装，正在全局安装..."
  npm install -g pm2
fi

# 4. 启动/重启服务
echo ""
echo ">>> [4/4] 启动服务..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  echo "服务已存在，执行重启..."
  pm2 restart "$PROJECT_DIR/deploy/ecosystem.config.cjs"
else
  echo "首次启动..."
  pm2 start "$PROJECT_DIR/deploy/ecosystem.config.cjs"
fi

# 设置 pm2 开机自启
echo ""
echo ">>> 配置 pm2 开机自启..."
pm2 startup 2>/dev/null || true
pm2 save

echo ""
echo "=== 部署完成 ==="
echo ""
echo "常用命令:"
echo "  pm2 status              # 查看服务状态"
echo "  pm2 logs $APP_NAME      # 查看日志"
echo "  pm2 restart $APP_NAME   # 重启服务"
echo "  pm2 stop $APP_NAME      # 停止服务"
echo "  pm2 delete $APP_NAME    # 删除服务"
