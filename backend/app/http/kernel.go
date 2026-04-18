package http

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/ctfang/navihub/backend/routes"
	"github.com/gin-gonic/gin"
	"github.com/go-home-admin/home/bootstrap/constraint"
	homepv "github.com/go-home-admin/home/bootstrap/providers"
	"github.com/go-home-admin/home/bootstrap/services"
	"github.com/go-home-admin/home/bootstrap/servers"
)

// Kernel @Bean
type Kernel struct {
	*servers.Http `inject:""`
	*homepv.RouteProvider `inject:""`
}

func (k *Kernel) Init() {
	k.LoadRoute(routes.GetAllProvider())
	k.Middleware = []gin.HandlerFunc{}
	k.MiddlewareGroup = map[string][]gin.HandlerFunc{
		"admin": {Cors()},
		"api":   {Cors()},
	}
	k.Group("admin").Prefix("/admin").Middleware("admin")
	k.Group("api").Prefix("/api").Middleware("api")
}

func (k *Kernel) Boot() {
	staticDir := resolveStaticDir()
	if staticDir == "" {
		return
	}
	dir := http.Dir(staticDir)
	k.Engine.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		rel := strings.TrimPrefix(c.Request.URL.Path, "/")
		fpath := filepath.Join(staticDir, filepath.Clean(rel))
		if rel != "" {
			if fi, err := os.Stat(fpath); err == nil && !fi.IsDir() {
				http.FileServer(dir).ServeHTTP(c.Writer, c.Request)
				return
			}
		}
		http.ServeFile(c.Writer, c.Request, filepath.Join(staticDir, "index.html"))
	})
}

func resolveStaticDir() string {
	if s := strings.TrimSpace(os.Getenv("STATIC_DIR")); s != "" {
		return filepath.Clean(s)
	}
	if root := homepv.GetBean("config"); root != nil {
		if b, ok := root.(homepv.Bean); ok {
			if v := b.GetBean("navihub"); v != nil {
				if nv, ok := v.(*services.Config); ok {
					if s := strings.TrimSpace(nv.GetString("static_dir")); s != "" {
						return filepath.Clean(s)
					}
				}
			}
		}
	}
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	for _, dir := range []string{
		filepath.Join(wd, "frontend", "dist"),
		filepath.Join(wd, "..", "frontend", "dist"),
	} {
		idx := filepath.Join(dir, "index.html")
		if fi, err := os.Stat(idx); err == nil && !fi.IsDir() {
			return filepath.Clean(dir)
		}
	}
	return ""
}

func (k *Kernel) Exit() {}

func GetServer() constraint.KernelServer {
	return NewKernel()
}
