package routes

import "github.com/ctfang/navihub/backend/app/navihub"

// GetAllProvider 由 Kernel.LoadRoute 注入 RouteProvider；NaviHub API 走框架 constraint.Route。
func GetAllProvider() []interface{} {
	return []interface{}{
		navihub.Routes{},
	}
}
