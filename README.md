# WrapServer

基于 Hono + TypeScript + SQLite 的卡密管理系统后端服务。

## 技术栈

- **框架**: Hono
- **语言**: TypeScript
- **数据库**: SQLite (sql.js)
- **认证**: JWT (hono/jwt)
- **密码加密**: bcryptjs
- **运行时**: @hono/node-server

## 开始使用

```bash
# 安装依赖
npm install

# 启动开发服务器（热重载）
npm run dev

# 构建
npm run build

# 生产模式运行
npm start
```

服务默认运行在 `http://localhost:3000`。

## API 接口

### 公开接口（无需认证）

| 方法 | 路径                         | 说明                     |
| ---- | ---------------------------- | ------------------------ |
| POST | `/api/auth/register`         | 用户注册                 |
| POST | `/api/auth/login`            | 用户登录                 |
| GET  | `/api/auth/me`               | 获取当前用户（需 token） |
| GET  | `/api/templates/preview/:id` | 预览卡密模板             |
| GET  | `/api/cardkeys/verify/:key`  | 验证卡密有效性           |

### 认证接口（需 Bearer Token）

| 模块   | 方法                | 路径                               | 说明                 |
| ------ | ------------------- | ---------------------------------- | -------------------- |
| 用户   | GET                 | `/api/users`                       | 获取所有用户         |
| 用户   | GET/PUT/DELETE      | `/api/users/:id`                   | 用户详情/更新/删除   |
| 项目   | GET                 | `/api/projects`                    | 获取项目列表（分页） |
| 项目   | GET/PUT/DELETE      | `/api/projects/:id`                | 项目详情/更新/删除   |
| 项目   | POST                | `/api/projects`                    | 创建项目             |
| 卡密   | GET                 | `/api/cardkeys/project/:projectId` | 获取项目卡密（分页） |
| 卡密   | POST                | `/api/cardkeys`                    | 创建卡密             |
| 卡密   | POST                | `/api/cardkeys/batch`              | 批量生成卡密         |
| 卡密   | PUT                 | `/api/cardkeys/:id`                | 更新卡密             |
| 卡密   | DELETE              | `/api/cardkeys/:id`                | 删除卡密             |
| 模板   | GET/POST/DELETE     | `/api/templates`                   | 模板管理             |
| 角色   | GET/POST/PUT/DELETE | `/api/roles`                       | 角色管理             |
| 权限   | GET                 | `/api/permissions`                 | 获取权限列表         |
| 仪表盘 | GET                 | `/api/dashboard/stats`             | 获取统计数据         |

### 分页参数

列表接口支持分页查询：

| 参数       | 类型   | 默认值 | 说明     |
| ---------- | ------ | ------ | -------- |
| `page`     | number | 1      | 当前页码 |
| `pageSize` | number | 10     | 每页条数 |

响应格式：`{ items: [...], total: number }`

### 卡密字段说明

**类型 (type)**

| 类型    | 值          | 默认时长（秒） |
| ------- | ----------- | -------------- |
| 1小时卡 | `hourly`    | 3,600          |
| 日卡    | `daily`     | 86,400         |
| 周卡    | `weekly`    | 604,800        |
| 月卡    | `monthly`   | 2,592,000      |
| 年卡    | `yearly`    | 31,536,000     |
| 永久    | `permanent` | 999,999,999    |

**状态 (status)**

| 状态   | 值         | 说明                       |
| ------ | ---------- | -------------------------- |
| 未使用 | `unused`   | 可用                       |
| 已使用 | `used`     | 已绑定（自动记录 used_at） |
| 已过期 | `expired`  | 超过有效期                 |
| 已禁用 | `disabled` | 手动禁用，可恢复为 unused  |

**功能开关**

| 字段               | 类型    | 说明                             |
| ------------------ | ------- | -------------------------------- |
| `oneDeviceOneCode` | boolean | 一机一码，开启后只能绑定一个设备 |
| `deviceId`         | string  | 已绑定的设备ID                   |

## 数据库

使用 SQLite 存储数据，数据库文件为项目根目录下的 `data.db`。

主要表结构：

- **users** - 用户表
- **projects** - 项目表
- **card_keys** - 卡密表
- **templates** - 模板表
- **roles** - 角色表
- **permissions** - 权限表

## 默认数据

系统初始化时自动创建：

- **管理员账户**
    - 邮箱：`admin@example.com`
    - 密码：`admin123`
    - 角色：超级管理员

- **默认角色**
    - 超级管理员 - 所有权限
    - 普通管理员 - 除角色管理外的所有权限
    - 运营人员 - 卡密管理权限

## 项目结构

```
src/
├── middleware/
│   └── auth.ts        # JWT 认证中间件
├── routes/
│   ├── auth.ts        # 认证路由
│   ├── cardkeys.ts    # 卡密管理
│   ├── dashboard.ts   # 仪表盘
│   ├── permissions.ts # 权限管理
│   ├── projects.ts    # 项目管理
│   ├── roles.ts       # 角色管理
│   ├── templates.ts   # 模板管理
│   └── users.ts       # 用户管理
├── db.ts              # 数据库初始化
└── index.ts           # 应用入口
```

使用 hono + ts + sqlite

## 部署

使用 `tsx` 直接运行 TypeScript 源码，`pm2` 管理进程，无需编译步骤。

### 前置要求

- Node.js >= 18
- npm

### 一键部署

```bash
# 赋予执行权限并运行部署脚本
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

脚本会自动完成：安装依赖 → 检查 tsx → 安装 pm2（如缺失）→ 启动服务 → 配置开机自启

### 手动部署

```bash
# 1. 安装依赖
npm install

# 2. 安装 pm2（如未安装）
npm install -g pm2

# 3. 启动服务
pm2 start ecosystem.config.cjs

pm2 reload ecosystem.config.cjs

pm2 restart ecosystem.config.cjs

# 4. 设置开机自启
pm2 startup
pm2 save
```

### 常用 pm2 命令

| 命令                      | 说明         |
| ------------------------- | ------------ |
| `pm2 status`              | 查看服务状态 |
| `pm2 logs wrap-server`    | 查看实时日志 |
| `pm2 restart wrap-server` | 重启服务     |
| `pm2 stop wrap-server`    | 停止服务     |
| `pm2 delete wrap-server`  | 删除服务     |
| `pm2 monit`               | 监控面板     |

### 部署目录结构

```
deploy/
├── ecosystem.config.cjs   # pm2 配置文件
└── deploy.sh              # 一键部署脚本
```

### 配置说明

`ecosystem.config.cjs` 关键配置：

- **运行方式**: `npx tsx src/index.ts`，直接执行 TypeScript
- **日志路径**: `./logs/error.log`、`./logs/output.log`
- **内存限制**: 超过 512M 自动重启
- **自动重启**: 进程异常退出后自动恢复

### 更新代码后重启

```bash
# 拉取最新代码后只需重启
pm2 restart wrap-server
```

## Nginx 反向代理

使用 Nginx 将外部请求代理到本地 3000 端口的后端服务。

### 配置文件

项目中已提供 `nginx.conf`，核心配置如下：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 使用步骤

```bash
# 1. 修改 nginx.conf 中的 server_name 为实际域名或 IP
#    例如：server_name api.example.com;

# 2. 将配置复制到 Nginx 站点目录（以 Linux 为例）
sudo cp nginx.conf /etc/nginx/sites-available/wrapserver
sudo ln -s /etc/nginx/sites-available/wrapserver /etc/nginx/sites-enabled/

# 3. 测试配置是否正确
sudo nginx -t

# 4. 重载 Nginx
sudo nginx -s reload
```

如需 HTTPS，推荐使用 Certbot 自动申请证书：

```bash
sudo certbot --nginx -d your-domain.com
```

配置完成后，外部请求会通过 Nginx 代理到 `http://127.0.0.1:3000` 的 WrapServer 服务。

# 服务器备份

zip -r dist.zip dist

unzip dist.zip
