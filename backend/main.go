package main

import (
	"embed"
	"io/fs"

	"github.com/ctfang/navihub/backend/app/http"
	"github.com/ctfang/navihub/backend/app/providers"

	"github.com/go-home-admin/home/bootstrap/constraint"

	fp "github.com/go-home-admin/home/bootstrap/providers"
)

//go:embed config
var config embed.FS

//go:embed dist
var frontend embed.FS

func init() {
	fp.SetConfigDir(&config)
	// //go:embed dist 的根 FS 下是 dist/ 目录，需 Sub 后路径才是 index.html、assets/…
	sub, err := fs.Sub(frontend, "dist")
	if err != nil {
		panic(err)
	}
	http.SetFrontend(sub)
}

func main() {
	app := providers.NewApp()
	providers.NewNavihubBootstrap()
	app.Run([]constraint.KernelServer{
		http.GetServer(),
	})
}
