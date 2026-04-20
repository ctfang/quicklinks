package navihub

import (
	"fmt"

	"gorm.io/gorm"
)

// MigrateAndSeed 使用框架注入的 *gorm.DB 做 AutoMigrate；不预置任何用户，首位账号由注册接口创建。
func MigrateAndSeed(gdb *gorm.DB) error {
	if err := gdb.Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci").AutoMigrate(
		&User{},
		&Team{},
		&TeamMember{},
		&Project{},
		&Group{},
		&Link{},
		&Widget{},
		&WikiNode{},
		&PasswordReset{},
	); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
