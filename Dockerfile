# Stage 1: build frontend assets
FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/metadata.json ./
COPY frontend/src ./src
RUN npm run build

# Stage 2: compile Go API + static server (go-home-admin / home + Gin)
FROM golang:1.22-bookworm AS gobuild
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /navihub .

# Stage 3: minimal runtime image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=gobuild /navihub /app/navihub
COPY --from=frontend /app/dist /app/dist
ENV STATIC_DIR=/app/dist
ENV PORT=3000
EXPOSE 3000
CMD ["/app/navihub"]
