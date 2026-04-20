# Windows: use `mingw32-make` or run commands manually (see README).

.PHONY: dev-backend dev-frontend build-frontend build-backend build-linux serve docker

# 构建前端后由后端统一启动（默认 :3000；Vite 输出到 backend/dist，见 frontend/vite.config.ts）
serve: build-frontend
	cd backend && go run .

dev-backend:
	cd backend && go run .

dev-frontend:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && go build -o navihub .

build-linux: build-frontend
	# 前端已直接构建到 backend/dist，go:embed dist 可以正确打包
	# GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-w -s" -o ./app/app ./
	cd backend && $env:GOOS="linux"; $env:GOARCH="amd64"; $env:CGO_ENABLED="0"; go build -ldflags="-s -w" -o ./app .

docker:
	docker compose up
