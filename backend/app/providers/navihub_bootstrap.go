package providers

import (
	"log"

	"github.com/ctfang/navihub/backend/app/navihub"
	"github.com/ctfang/navihub/backend/pkg/mail"
	homepv "github.com/go-home-admin/home/bootstrap/providers"
	"github.com/go-home-admin/home/bootstrap/services"
	"github.com/go-home-admin/home/bootstrap/services/app"
	"github.com/go-home-admin/home/database"
)

// NavihubBootstrap 在 DB 就绪后执行迁移与种子数据，并打印 SMTP 诊断。
//
// @Bean
type NavihubBootstrap struct{}

func NewNavihubBootstrap() *NavihubBootstrap {
	b := &NavihubBootstrap{}
	app.AfterProvider(b, "")
	return b
}

func (n *NavihubBootstrap) Init() {}

func (n *NavihubBootstrap) Boot() {
	nv := homepv.GetBean("config").(homepv.Bean).GetBean("navihub").(*services.Config)
	mail.BindNavihub(nv)

	gdb := database.DB()
	if gdb == nil {
		log.Fatal("[navihub] database.DB() is nil before migrate")
	}
	if err := navihub.MigrateAndSeed(gdb); err != nil {
		log.Fatalf("[navihub] migrate: %v", err)
	}
	mail.LogStartupSMTP()
}
