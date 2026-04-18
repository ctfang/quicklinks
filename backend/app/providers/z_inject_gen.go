package providers

import (
	providers_0 "github.com/go-home-admin/home/bootstrap/providers"
	services "github.com/go-home-admin/home/bootstrap/services"
)

var _AppSingle *App

func NewApp() *App {
	if _AppSingle == nil {
		_AppSingle = &App{}
		_AppSingle.Container = services.NewContainer()
		_AppSingle.FrameworkProvider = providers_0.NewFrameworkProvider()
		providers_0.AfterProvider(_AppSingle, "")
	}
	return _AppSingle
}
