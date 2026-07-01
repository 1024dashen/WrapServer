# WrapServer API

Hono + TypeScript + SQLite 后端 API 服务

## 安装

```bash
npm install
```

## 运行

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

## API 接口

### 认证接口

#### 注册

```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "用户名",
  "password": "密码"
}
```

#### 登录

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}

响应：
{
  "token": "jwt-token",
  "user": { ... }
}
```

#### 获取当前用户

```
GET /api/auth/me
Authorization: Bearer <token>
```

### 用户管理（需要认证）

```
GET    /api/users          - 获取所有用户
GET    /api/users/:id      - 获取单个用户
POST   /api/users          - 创建用户
PUT    /api/users/:id      - 更新用户
DELETE /api/users/:id      - 删除用户
```

### 项目管理（需要认证）

```
GET    /api/projects          - 获取所有项目（包含卡密数量）
GET    /api/projects/:id      - 获取单个项目
POST   /api/projects          - 创建项目
PUT    /api/projects/:id      - 更新项目
DELETE /api/projects/:id      - 删除项目
```

### 卡密管理（需要认证）

```
GET    /api/cardkeys                    - 获取所有卡密
GET    /api/cardkeys/project/:projectId - 获取项目的卡密
GET    /api/cardkeys/:id                - 获取单个卡密
POST   /api/cardkeys                    - 创建卡密
POST   /api/cardkeys/batch              - 批量生成卡密
PUT    /api/cardkeys/:id                - 更新卡密
DELETE /api/cardkeys/:id                - 删除卡密
```

批量生成卡密：

```
POST /api/cardkeys/batch
{
  "projectId": 1,
  "type": "monthly",  // daily, weekly, monthly, yearly, permanent
  "count": 10
}
```

### 模板管理（需要认证）

```
GET    /api/templates          - 获取所有模板
GET    /api/templates/:id      - 获取单个模板
POST   /api/templates          - 创建模板
DELETE /api/templates/:id      - 删除模板
```

### 角色管理（需要认证）

```
GET    /api/roles          - 获取所有角色
GET    /api/roles/:id      - 获取单个角色
POST   /api/roles          - 创建角色
PUT    /api/roles/:id      - 更新角色
DELETE /api/roles/:id      - 删除角色
```

### 权限管理（需要认证）

```
GET /api/permissions - 获取所有权限
```

### 仪表盘（需要认证）

```
GET /api/dashboard/stats - 获取统计数据
```

## 默认数据

系统初始化时会创建：

- 默认管理员账户：
  - 邮箱：admin@example.com
  - 密码：admin123
  - 角色：超级管理员

- 默认角色：
  - 超级管理员（所有权限）
  - 普通管理员（除角色管理外的所有权限）
  - 运营人员（卡密管理权限）

- 默认权限：
  - 仪表盘、用户管理、项目管理、卡密管理、模板管理、角色管理

## 技术栈

- **框架**: Hono
- **语言**: TypeScript
- **数据库**: SQLite (sql.js)
- **认证**: JWT
- **密码加密**: bcryptjs
