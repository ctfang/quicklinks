package navihub

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ctfang/navihub/backend/pkg/linkmeta"
	"github.com/gin-gonic/gin"
)

type floatingLink struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
	Icon  string `json:"icon"`
}

type floatingConfig struct {
	LeftEnabled *bool          `json:"leftEnabled"`
	Left        []floatingLink `json:"left"`
}

func floatingNavigationGet(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var config string
		err := db.QueryRow(`SELECT config FROM floating_navigation WHERE userId = ?`, uid).Scan(&config)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, nil)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "读取悬浮导航失败"})
			return
		}
		c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(config))
	}
}

func floatingNavigationPut(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 256*1024)
		var config floatingConfig
		if err := c.ShouldBindJSON(&config); err != nil || config.LeftEnabled == nil || config.Left == nil || len(config.Left) > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的悬浮导航配置"})
			return
		}
		ids := make(map[string]bool)
		for i := range config.Left {
			link := &config.Left[i]
			link.Title = strings.TrimSpace(link.Title)
			link.URL = strings.TrimSpace(link.URL)
			u, err := url.Parse(link.URL)
			if link.ID == "" || len(link.ID) > 128 || ids[link.ID] || link.Title == "" || len(link.Title) > 512 || err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "导航名称、网址或标识无效"})
				return
			}
			ids[link.ID] = true
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()
		for i := range config.Left {
			link := &config.Left[i]
			link.Icon = strings.TrimSpace(link.Icon)
			if link.Icon == "" {
				link.Icon = linkmeta.AutoIcon(ctx, link.URL)
			}
		}
		raw, err := json.Marshal(config)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存悬浮导航失败"})
			return
		}
		_, err = db.Exec(`INSERT INTO floating_navigation (userId, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = VALUES(config)`, uid, string(raw))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存悬浮导航失败"})
			return
		}
		c.JSON(http.StatusOK, config)
	}
}
