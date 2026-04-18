package providers

import (
	"github.com/go-home-admin/home/bootstrap/constraint"
	"github.com/go-home-admin/home/bootstrap/providers"
	"github.com/go-home-admin/home/bootstrap/services"
	"github.com/sirupsen/logrus"
)

// App 系统引导结构体（go-home-admin 风格，精简无 Swagger/Admin UI）
//
// @Bean
type App struct {
	*services.Container       `inject:""`
	*providers.FrameworkProvider `inject:""`
}

func (a *App) Init() {
	logrus.Debug("navihub app init")
}

func (a *App) Boot() {
	logrus.Debug("navihub app boot")
}

func (a *App) Run(servers []constraint.KernelServer) {
	a.Container.Run(servers)
}

func (a *App) Exit() {}
