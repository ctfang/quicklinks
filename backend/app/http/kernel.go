package http

import (
	"io/fs"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/ctfang/navihub/backend/routes"
	"github.com/gin-gonic/gin"
	"github.com/go-home-admin/home/bootstrap/constraint"
	homepv "github.com/go-home-admin/home/bootstrap/providers"
	"github.com/go-home-admin/home/bootstrap/servers"
)

// embeddedFrontend 由 main.go //go:embed dist 注入
var embeddedFrontend fs.FS

func SetFrontend(f fs.FS) {
	embeddedFrontend = f
}

// Kernel @Bean
type Kernel struct {
	*servers.Http         `inject:""`
	*homepv.RouteProvider `inject:""`
}

func (k *Kernel) Init() {
	k.LoadRoute(routes.GetAllProvider())
	k.Middleware = []gin.HandlerFunc{}

	if gin.IsDebugging() {
		k.Middleware = append(k.Middleware, gin.Logger())
	}

	k.MiddlewareGroup = map[string][]gin.HandlerFunc{
		"admin": {Cors()},
		"api":   {Cors()},
	}
	k.Group("admin").Prefix("/admin").Middleware("admin")
	k.Group("api").Prefix("/api").Middleware("api")
}

func (k *Kernel) Boot() {
	if embeddedFrontend == nil {
		return
	}
	k.Engine.NoRoute(func(c *gin.Context) {
		k.serveEmbeddedSPA(c, embeddedFrontend)
	})
}

// serveEmbeddedSPA：静态资源仅来自 embed；勿用 http.FileServer（见 net/http fs.go 对 /index.html 的 301）
func (k *Kernel) serveEmbeddedSPA(c *gin.Context, distFS fs.FS) {
	if strings.HasPrefix(c.Request.URL.Path, "/api") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	urlPath := strings.TrimPrefix(c.Request.URL.Path, "/")
	if urlPath == "" {
		urlPath = "index.html"
	}

	if f, err := distFS.Open(urlPath); err == nil {
		f.Close()
		setEmbeddedCacheHeaders(c, urlPath)
		http.ServeFileFS(c.Writer, c.Request, distFS, urlPath)
		return
	}

	setEmbeddedCacheHeaders(c, "index.html")
	http.ServeFileFS(c.Writer, c.Request, distFS, "index.html")
}

func (k *Kernel) Exit() {}

// setEmbeddedCacheHeaders：HTML 壳不长期缓存；带 hash 的 JS/CSS 与静态资源强缓存
func setEmbeddedCacheHeaders(c *gin.Context, urlPath string) {
	lower := strings.ToLower(urlPath)
	if strings.HasSuffix(lower, ".html") {
		c.Header("Cache-Control", "no-cache")
		return
	}
	switch strings.ToLower(filepath.Ext(urlPath)) {
	case ".js", ".css", ".map":
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot":
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	default:
		if urlPath != "" {
			c.Header("Cache-Control", "public, max-age=86400")
		}
	}
}

func GetServer() constraint.KernelServer {
	return NewKernel()
}
