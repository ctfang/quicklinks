package http

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// Cors 允许跨域与 OPTIONS 预检。
// 当环境变量 CORS_ALLOW_ORIGINS 非空时：仅回显列表中的 Origin，并设置 Access-Control-Allow-Credentials: true（供跨域携带 Cookie）。
// 为空时保持 Access-Control-Allow-Origin: *（与仅同域或 Vite 代理场景兼容；此时勿依赖跨域 Cookie）。
func Cors() gin.HandlerFunc {
	allowed := parseAllowedOrigins()
	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		if len(allowed) > 0 {
			if origin != "" && allowed[strings.ToLower(origin)] {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Vary", "Origin")
			}
		} else {
			c.Header("Access-Control-Allow-Origin", "*")
		}
		c.Header("Access-Control-Allow-Headers", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func parseAllowedOrigins() map[string]bool {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if raw == "" {
		return nil
	}
	m := make(map[string]bool)
	for _, p := range strings.Split(raw, ",") {
		o := strings.TrimSpace(p)
		if o != "" {
			m[strings.ToLower(o)] = true
		}
	}
	if len(m) == 0 {
		return nil
	}
	return m
}
