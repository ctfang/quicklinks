package navihub

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/ctfang/navihub/backend/pkg/linkmeta"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

// 本地快速造数：向 userId=1 写入「默认分组」常用国内站 + 「大模型」分组及全球主流大模型官网。
//
// 运行前请保证 MySQL 已 migrate，且 users 表中存在 id=1（首位注册用户通常为 1）。
// 在 backend 目录：
//
//	set NAVIHUB_SEED_TEST=1
//	go test ./app/navihub -run TestSeedUser1DemoLinks -v
//
// 会加载 backend/.env（若存在）。也可直接设置 DB_HOST、DB_PORT、DB_DATABASE、DB_USERNAME、DB_PASSWORD。
//
// 图标：对每个链接调用 linkmeta.Fetch 抓取页面内声明的 favicon（与「添加链接」一致）；需可访问对应网站。
// 若某站不可达，则回退为该站 /favicon.ico（同源，不依赖境外服务）。
func TestSeedUser1DemoLinks(t *testing.T) {
	loadDotEnv(t)
	db := openMySQL(t)
	defer db.Close()

	const uid = uint64(1)
	var exists int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE id = ?`, uid).Scan(&exists); err != nil {
		t.Fatalf("查询用户: %v", err)
	}
	if exists == 0 {
		t.Fatalf("users 表中不存在 id=%d，请先注册首位用户或手动插入用户", uid)
	}

	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 幂等：仅清理本测试此前写入的 seed 行（固定 id 前缀）
	if _, err := tx.Exec(`DELETE FROM links WHERE userId = ? AND id LIKE 'l_seed_u1_%'`, uid); err != nil {
		t.Fatalf("清理旧链接: %v", err)
	}
	if _, err := tx.Exec(`DELETE FROM `+"`groups`"+` WHERE userId = ? AND id LIKE 'g_seed_u1_%'`, uid); err != nil {
		t.Fatalf("清理旧分组: %v", err)
	}

	const groupDefaultID = "g_seed_u1_default"
	const groupLLMID = "g_seed_u1_llm"

	_, err = tx.Exec(`INSERT INTO `+"`groups`"+` (id, name, userId, teamId, projectId, order_num) VALUES (?, ?, ?, NULL, NULL, ?)`,
		groupDefaultID, "默认", uid, 0)
	if err != nil {
		t.Fatalf("插入默认分组: %v", err)
	}
	_, err = tx.Exec(`INSERT INTO `+"`groups`"+` (id, name, userId, teamId, projectId, order_num) VALUES (?, ?, ?, NULL, NULL, ?)`,
		groupLLMID, "大模型", uid, 1)
	if err != nil {
		t.Fatalf("插入大模型分组: %v", err)
	}

	type linkRow struct {
		id    string
		title string
		url   string
		gid   string
		ord   int
	}

	china := []linkRow{
		{"l_seed_u1_baidu", "百度", "https://www.baidu.com", groupDefaultID, 10},
		{"l_seed_u1_taobao", "淘宝", "https://www.taobao.com", groupDefaultID, 20},
		{"l_seed_u1_jd", "京东", "https://www.jd.com", groupDefaultID, 30},
		{"l_seed_u1_zhihu", "知乎", "https://www.zhihu.com", groupDefaultID, 40},
		{"l_seed_u1_bili", "哔哩哔哩", "https://www.bilibili.com", groupDefaultID, 50},
		{"l_seed_u1_weibo", "微博", "https://weibo.com", groupDefaultID, 60},
		{"l_seed_u1_douban", "豆瓣", "https://www.douban.com", groupDefaultID, 70},
		{"l_seed_u1_qq", "腾讯网", "https://www.qq.com", groupDefaultID, 80},
		{"l_seed_u1_163", "网易", "https://www.163.com", groupDefaultID, 90},
		{"l_seed_u1_sina", "新浪", "https://www.sina.com.cn", groupDefaultID, 100},
	}

	llms := []linkRow{
		{"l_seed_u1_chatgpt", "ChatGPT", "https://chatgpt.com", groupLLMID, 10},
		{"l_seed_u1_claude", "Claude", "https://claude.ai", groupLLMID, 20},
		{"l_seed_u1_gemini", "Gemini", "https://gemini.google.com", groupLLMID, 30},
		{"l_seed_u1_grok", "Grok", "https://grok.com", groupLLMID, 40},
		{"l_seed_u1_perplexity", "Perplexity", "https://www.perplexity.ai", groupLLMID, 50},
		{"l_seed_u1_mistral", "Le Chat (Mistral)", "https://chat.mistral.ai", groupLLMID, 60},
		{"l_seed_u1_deepseek", "DeepSeek", "https://chat.deepseek.com", groupLLMID, 70},
		{"l_seed_u1_meta", "Meta AI", "https://www.meta.ai", groupLLMID, 80},
		{"l_seed_u1_copilot", "Microsoft Copilot", "https://copilot.microsoft.com", groupLLMID, 90},
		{"l_seed_u1_openrouter", "OpenRouter", "https://openrouter.ai", groupLLMID, 100},
	}

	for _, rows := range [][]linkRow{china, llms} {
		for _, r := range rows {
			ctx, cancel := context.WithTimeout(context.Background(), 18*time.Second)
			icon := resolveLinkIcon(ctx, r.url)
			cancel()
			_, err := tx.Exec(`
				INSERT INTO links (id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num)
				VALUES (?, ?, ?, ?, 0, 0, NULL, NULL, ?, ?, 'small', ?)`,
				r.id, r.title, r.url, icon, uid, r.gid, r.ord,
			)
			if err != nil {
				t.Fatalf("插入链接 %s: %v", r.id, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	t.Logf("已写入 userId=%d：分组 %s（默认常用站）、%s（大模型）", uid, groupDefaultID, groupLLMID)
}

func loadDotEnv(t *testing.T) {
	t.Helper()
	// 自 app/navihub 向上找到 backend/.env
	for _, dir := range []string{
		filepath.Join("..", "..", ".env"),
		filepath.Join("..", "..", "..", ".env"),
		".env",
	} {
		if err := godotenv.Load(dir); err == nil {
			t.Logf("已加载 %s", dir)
			return
		}
	}
}

func openMySQL(t *testing.T) *sql.DB {
	t.Helper()
	host := getenvDefault("DB_HOST", "127.0.0.1")
	port := getenvDefault("DB_PORT", "3306")
	user := getenvDefault("DB_USERNAME", "root")
	pass := os.Getenv("DB_PASSWORD")
	name := getenvDefault("DB_DATABASE", "navihub")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		user, pass, host, port, name)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("连接 MySQL 失败（检查 DB_* 与 migrate）: %v", err)
	}
	return db
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// resolveLinkIcon 请求页面并解析图标 URL（复用 pkg/linkmeta，与 API 添加链接逻辑一致）；不使用 Google 等境外 favicon 代理。
func resolveLinkIcon(ctx context.Context, raw string) string {
	_, icon, err := linkmeta.Fetch(ctx, raw)
	if err != nil {
		return "Link"
	}
	if s := strings.TrimSpace(icon); s != "" {
		return s
	}
	return defaultFaviconFallback(raw)
}

func defaultFaviconFallback(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Hostname() == "" {
		return "Link"
	}
	return u.Scheme + "://" + u.Host + "/favicon.ico"
}
