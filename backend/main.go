package main

import (
	"embed"

	"github.com/ctfang/navihub/backend/app/http"

	"github.com/ctfang/navihub/backend/app/providers"

	"github.com/go-home-admin/home/bootstrap/constraint"

	fp "github.com/go-home-admin/home/bootstrap/providers"
)

//go:embed config
var config embed.FS

func init() {
	fp.SetConfigDir(&config)
}

func main() {

	app := providers.NewApp()

	providers.NewNavihubBootstrap()

	app.Run([]constraint.KernelServer{

		http.GetServer(),
	})

}
