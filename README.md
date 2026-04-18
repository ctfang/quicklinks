# NaviHub (团队导航与协作平台)

NaviHub 是一个集成了个人/团队导航、小组件定制以及 Wiki 知识库的全栈协作平台。仓库采用 **`frontend/`**（React + Vite）与 **`backend/`**（Go + SQLite）；**构建前端后，只需启动后端进程即可同时提供页面与 `/api`**（与 Docker 行为一致）。

## 功能特性

- **用户认证**：登录与注册（演示模式）。
- **个性化导航 (Links)**：个人/团队隔离，支持项目与分组；**未登录访客**展示「按注册顺序第一个用户」的个人链接与分组（由该账号在登录后维护）。
- **团队协作 (Teams)**：创建团队、邀请成员。
- **Wiki**：团队文档树与 Markdown 内容。
- **小组件 (Widgets)**：首页组件配置与同步。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite 6、Tailwind CSS、React Router |
| 后端 | Go 1.22、chi、SQLite（`modernc.org/sqlite`，无 CGO） |
| 部署 | 多阶段 Docker 镜像，单进程提供 `/api` 与静态前端 |

## 目录结构

```text
/
├── frontend/                 # 前端（npm run build 产出 dist/）
├── backend/                  # 后端（默认 :3000，自动服务 ../frontend/dist）
│   ├── cmd/server/main.go
│   └── internal/
├── Dockerfile
├── docker-compose.yml
└── Makefile
```

前端由 `backend/main.go` 中 **`//go:embed dist`** 打进二进制，运行时不再从磁盘挂载静态目录。

## 推荐：一键构建前端并由后端统一启动

1. 安装前端依赖（首次）：

   ```bash
   cd frontend && npm install
   ```

2. 构建前端 + 启动后端（需已安装 Go）：

   ```bash
   # 仓库根目录（Git Bash / WSL / macOS / Linux）
   make serve
   ```

   或手动：

   ```bash
   cd frontend && npm run build
   cd ../backend && go run ./cmd/server
   ```

3. 浏览器访问 **`http://localhost:3000`**（API 同域 `/api`）。

### 本地调试（非 docker-compose）

后端启动时会自动加载环境变量文件（**不依赖 Docker**）：

1. 先尝试 **`backend/.env`**（适合在仓库根目录执行 `go run ./backend/cmd/server`）。
2. 再加载**当前工作目录**下的 **`.env`**（适合在 `backend` 目录执行 `go run ./cmd/server`）。

请复制 [`backend/.env.example`](backend/.env.example) 为 **`backend/.env`**，按需填写端口、数据库路径、`APP_PUBLIC_URL`、SMTP 等。勿将含密钥的 `.env` 提交到 Git。

环境变量（可选，亦可写在上述 `.env` 中）：

| 变量 | 说明 |
|------|------|
| `PORT` | 默认 `3000` |
| `DATABASE_PATH` | SQLite 路径，默认 `./database.sqlite`（相对启动时工作目录） |
| `APP_PUBLIC_URL` | 公网访问根 URL（**无尾部斜杠**），用于邮件中的密码重置链接，如 `https://nav.example.com`；本地可设为 `http://localhost:3000` |
| `SMTP_HOST` | 默认 `smtp.qq.com` |
| `SMTP_PORT` | 默认 `587` |
| `SMTP_USER` | QQ 邮箱完整地址 |
| `SMTP_PASSWORD` | QQ 邮箱 **SMTP 授权码**（非 QQ 登录密码；在邮箱设置中开启 SMTP 并生成） |
| `SMTP_FROM` | 发件人，默认与 `SMTP_USER` 相同 |

忘记密码：`POST /api/auth/forgot-password` 发邮件；`POST /api/auth/reset-password` 提交 token 与新密码。未配置 SMTP 时仍会返回成功提示，但无法收到邮件（见服务端日志）。

访客默认导航：`GET /api/navigation/guest` 返回首用户的 `userId`、`links`、`groups`。

## 前端热更新开发（可选）

需要两个终端：先启动后端，再启动 Vite（`/api` 会代理到 `http://127.0.0.1:3000`）。

```bash
cd backend && go run ./cmd/server
```

```bash
cd frontend && npm run dev
```

若后端端口不是 3000，可设置 `VITE_API_PROXY_TARGET`。

## Docker

在项目根目录：

```bash
docker compose up --build
```

默认映射 **`3000`** 端口，SQLite 数据持久化在卷 `navihub-data`。

## API 说明

所有接口以 **`/api`** 为前缀；与 [`frontend/src/services/api.ts`](frontend/src/services/api.ts) 中的调用一致。

## 数据库

SQLite 路径由 **`DATABASE_PATH`** 指定。删除该文件并重启可清空数据（请先备份）。

登录 / 注册 / 重置密码时，**前端会先将密码做 SHA-256（十六进制）再提交**，服务端存储与比对该摘要；传输层仍建议使用 HTTPS。
