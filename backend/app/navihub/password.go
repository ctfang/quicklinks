package navihub

import (
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// hashPasswordStored 对前端已摘要的密码（当前为 MD5 十六进制）再做 bcrypt，写入数据库。
func hashPasswordStored(clientDigest string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(clientDigest), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// verifyPassword 校验前端提交的摘要与库中 bcrypt 存储是否一致。
func verifyPassword(clientDigest, stored string) bool {
	stored = strings.TrimSpace(stored)
	if stored == "" || !strings.HasPrefix(stored, "$2") {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(stored), []byte(clientDigest)) == nil
}
