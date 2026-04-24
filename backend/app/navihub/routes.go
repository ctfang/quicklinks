package navihub

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-home-admin/home/bootstrap/constraint"
	"github.com/go-home-admin/home/bootstrap/http/api"
	"github.com/go-home-admin/home/database"
)

var _ constraint.Route = Routes{}

// withDB 从框架全局 database.DB() 解析 *sql.DB，再交给现有 handler 工厂（保持业务 SQL 不变）。
func withDB(h func(*sql.DB) gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		applyJWTToContext(c)
		sqlDB, err := database.DB().DB()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		h(sqlDB)(c)
	}
}

// Routes 实现 constraint.Route，由 RouteProvider.LoadRoute 注册（与 Kernel 手写 Group 分离）。
type Routes struct{}

func (Routes) GetGroup() string {
	return "api"
}

func (Routes) GetRoutes() map[*api.Config]func(c *gin.Context) {
	m := make(map[*api.Config]func(c *gin.Context))
	reg := func(cfg *api.Config, h func(*sql.DB) gin.HandlerFunc) {
		m[cfg] = withDB(h)
	}

	reg(api.Post("/auth/login"), login)
	reg(api.Post("/auth/register"), register)
	reg(api.Get("/auth/me"), authMe)
	reg(api.Post("/auth/logout"), authLogout)
	reg(api.Post("/auth/forgot-password"), forgotPassword)
	reg(api.Post("/auth/reset-password"), resetPasswordWithToken)
	reg(api.Post("/auth/change-password"), changePassword)

	reg(api.Get("/navigation/guest"), navigationGuest)

	reg(api.Get("/links/popular"), linksPopular)
	reg(api.Get("/links/personal/:userId"), linksPersonal)
	reg(api.Get("/links/team/:teamId"), linksTeam)
	reg(api.Post("/links"), linksCreate)
	reg(api.Put("/links/:id"), linksUpdate)
	reg(api.Delete("/links/:id"), linksDelete)

	reg(api.Get("/groups"), groupsList)
	reg(api.Post("/groups"), groupsCreate)
	reg(api.Put("/groups/:id"), groupsUpdate)
	reg(api.Delete("/groups/:id"), groupsDelete)

	reg(api.Get("/projects/team/:teamId"), projectsByTeam)
	reg(api.Post("/projects"), projectsCreate)
	reg(api.Put("/projects/:id"), projectsUpdate)
	reg(api.Delete("/projects/:id"), projectsDelete)

	reg(api.Get("/teams/user/:userId"), teamsByUser)
	reg(api.Post("/teams"), teamsCreate)
	reg(api.Put("/teams/:id"), teamsUpdate)
	reg(api.Delete("/teams/:id"), teamsDelete)

	reg(api.Get("/teams/:teamId/members"), teamMembersList)
	reg(api.Post("/teams/:teamId/members"), teamMembersAdd)
	reg(api.Delete("/team-members/:id"), teamMembersDelete)

	reg(api.Get("/wiki/team/:teamId"), wikiList)
	reg(api.Post("/wiki"), wikiCreate)
	reg(api.Put("/wiki/:id"), wikiUpdate)
	reg(api.Delete("/wiki/:id"), wikiDelete)

	reg(api.Get("/widgets/user/:userId"), widgetsGet)
	reg(api.Put("/widgets/user/:userId"), widgetsPut)
	reg(api.Get("/weather"), getWeather)
	reg(api.Get("/weather/location"), getWeatherLocation)

	return m
}
