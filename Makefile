# Windows: use `mingw32-make` or run commands manually (see README).

.PHONY: dev-backend dev-frontend build-frontend build-backend serve docker

# 构建前端后由后端统一启动（默认 :3000，自动挂载 ../frontend/dist）
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

docker:
	docker compose up --build
