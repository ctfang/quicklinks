package navihub

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ctfang/navihub/backend/pkg/linkmeta"
	"github.com/ctfang/navihub/backend/pkg/mail"
	"github.com/gin-gonic/gin"
)

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userPublic struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Avatar string `json:"avatar"`
}

type WeatherData struct {
	Code        int    `json:"code"`
	Weather1    string `json:"weather1"`
	Temperature int    `json:"temperature"`
	Place       string `json:"place"`
	Humidity    int    `json:"humidity,omitempty"`
	Wind        string `json:"wind,omitempty"`
	Error       string `json:"error,omitempty"`
}

type cachedWeather struct {
	data      interface{}
	timestamp time.Time
}

var (
	weatherCache = make(map[string]cachedWeather)
	cacheMutex   sync.RWMutex
)

var (
	gaodeKey  string
	gaodeName string
)

// BindGaode 绑定高德配置（在 Bootstrap 阶段调用）。
func BindGaode(key, name string) {
	gaodeKey = strings.TrimSpace(key)
	gaodeName = strings.TrimSpace(name)
}

func login(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body loginBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if body.Email == "" || body.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱和密码不能为空"})
			return
		}
		var u userPublic
		var stored string
		err := db.QueryRow(
			`SELECT id, name, email, avatar, password FROM users WHERE email = ?`,
			body.Email,
		).Scan(&u.ID, &u.Name, &u.Email, &u.Avatar, &stored)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !verifyPassword(body.Password, stored) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
			return
		}
		token, err := issueAccessToken(u.ID)
		if err != nil {
			if errors.Is(err, errJWTSecretMissing) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器未配置 JWT_SECRET，无法登录"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		setAuthCookie(c, token)
		c.JSON(http.StatusOK, u)
	}
}

type registerBody struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func register(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body registerBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if body.Name == "" || body.Email == "" || body.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "姓名、邮箱和密码不能为空"})
			return
		}
		var exists int
		_ = db.QueryRow(`SELECT 1 FROM users WHERE LOWER(TRIM(email)) = ?`, strings.ToLower(strings.TrimSpace(body.Email))).Scan(&exists)
		if exists == 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "该邮箱已被注册"})
			return
		}
		avatar := fmt.Sprintf("https://api.dicebear.com/7.x/avataaars/svg?seed=%s", body.Email)
		stored, err := hashPasswordStored(body.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(
			`INSERT INTO users (name, email, avatar, password) VALUES (?, ?, ?, ?)`,
			body.Name, body.Email, avatar, stored,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		newID, err := res.LastInsertId()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var u userPublic
		err = db.QueryRow(`SELECT id, name, email, avatar FROM users WHERE id = ?`, newID).Scan(&u.ID, &u.Name, &u.Email, &u.Avatar)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		token, err := issueAccessToken(u.ID)
		if err != nil {
			if errors.Is(err, errJWTSecretMissing) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器未配置 JWT_SECRET，无法完成注册"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		setAuthCookie(c, token)
		c.JSON(http.StatusOK, u)
	}
}

func forgotPassword(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email string `json:"email"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if !mail.Configured() {
			mail.LogForgotPassword503()
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "邮件服务未配置，无法发送重置邮件（请设置 SMTP_USER / SMTP_PASSWORD）"})
			return
		}
		email := strings.TrimSpace(body.Email)
		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请填写邮箱"})
			return
		}
		var uid int64
		err := db.QueryRow(`SELECT id FROM users WHERE LOWER(TRIM(email)) = ?`, strings.ToLower(email)).Scan(&uid)
		msg := gin.H{"message": "若该邮箱已注册，您将收到重置邮件"}
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, msg)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, _ = db.Exec(`DELETE FROM `+passwordResetsTable+` WHERE userId = ?`, uid)
		code, err := randomNumericCode(6)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		expires := time.Now().Add(15 * time.Minute).UTC().Format(time.RFC3339)
		_, err = db.Exec(`INSERT INTO `+passwordResetsTable+` (token, userId, expiresAt, usedAt) VALUES (?, ?, ?, NULL)`,
			code, uid, expires)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := mail.SendPasswordResetCode(email, code); err != nil {
			mail.LogSendFailure(email, err)
			_, _ = db.Exec(`DELETE FROM `+passwordResetsTable+` WHERE token = ?`, code)
		}
		c.JSON(http.StatusOK, msg)
	}
}

func resetPasswordWithToken(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Email    string `json:"email"`
			Code     string `json:"code"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		email := strings.TrimSpace(strings.ToLower(body.Email))
		code := strings.TrimSpace(body.Code)
		if email == "" || code == "" || body.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱、验证码与密码不能为空"})
			return
		}
		var userID sql.NullInt64
		var expiresAt, usedAt sql.NullString
		err := db.QueryRow(
			`SELECT pr.userId, pr.expiresAt, pr.usedAt FROM `+passwordResetsTable+` pr
			 INNER JOIN users u ON u.id = pr.userId
			 WHERE LOWER(TRIM(u.email)) = ? AND pr.token = ?`,
			email, code,
		).Scan(&userID, &expiresAt, &usedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱或验证码不正确"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if usedAt.Valid && strings.TrimSpace(usedAt.String) != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "该验证码已使用"})
			return
		}
		t, err := time.Parse(time.RFC3339, expiresAt.String)
		if err != nil || time.Now().UTC().After(t) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "验证码已过期，请重新获取"})
			return
		}
		if !userID.Valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱或验证码不正确"})
			return
		}
		stored, err := hashPasswordStored(body.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = db.Exec(`UPDATE users SET password = ? WHERE id = ?`, stored, userID.Int64)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, _ = db.Exec(`UPDATE `+passwordResetsTable+` SET usedAt = ? WHERE token = ?`, time.Now().UTC().Format(time.RFC3339), code)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// changePassword 登录状态下直接修改密码（需要验证旧密码）
func changePassword(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var body struct {
			OldPassword string `json:"oldPassword"`
			NewPassword string `json:"newPassword"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if body.OldPassword == "" || body.NewPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "旧密码和新密码不能为空"})
			return
		}
		if len(body.NewPassword) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "新密码至少 6 位"})
			return
		}
		// 验证旧密码
		var currentPassword string
		err := db.QueryRow(`SELECT password FROM users WHERE id = ?`, uid).Scan(&currentPassword)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !verifyPassword(body.OldPassword, currentPassword) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "旧密码不正确"})
			return
		}
		stored, err := hashPasswordStored(body.NewPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = db.Exec(`UPDATE users SET password = ? WHERE id = ?`, stored, uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// randomNumericCode 生成 6 位数字验证码（100000–999999）。
func randomNumericCode(length int) (string, error) {
	_ = length
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	x := binary.BigEndian.Uint64(buf[:])
	v := 100000 + int(x%900000)
	return strconv.Itoa(v), nil
}

type linkOut struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	Icon        *string `json:"icon,omitempty"`
	Clicks      int     `json:"clicks"`
	IsPublic    bool    `json:"isPublic"`
	TeamID      *string `json:"teamId,omitempty"`
	ProjectID   *string `json:"projectId,omitempty"`
	UserID      *int64  `json:"userId,omitempty"`
	GroupID     *string `json:"groupId,omitempty"`
	DisplaySize *string `json:"displaySize,omitempty"`
	Order       int     `json:"order"`
	BgColor     *string `json:"bgColor,omitempty"`
	RowNum      int     `json:"rowNum"`
}

type navGroupOut struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	UserID    *int64  `json:"userId,omitempty"`
	TeamID    *string `json:"teamId,omitempty"`
	ProjectID *string `json:"projectId,omitempty"`
	Order     int     `json:"order"`
}

func scanLink(rows *sql.Rows) (*linkOut, error) {
	var (
		id, title, url string
		icon           sql.NullString
		clicks, isPub  int
		teamID         sql.NullString
		projectID      sql.NullString
		userID         sql.NullInt64
		groupID        sql.NullString
		displaySize    sql.NullString
		orderNum       int
		bgColor        sql.NullString
		rowNum         int
	)
	if err := rows.Scan(&id, &title, &url, &icon, &clicks, &isPub, &teamID, &projectID, &userID, &groupID, &displaySize, &orderNum, &bgColor, &rowNum); err != nil {
		return nil, err
	}
	out := &linkOut{
		ID: id, Title: title, URL: url, Clicks: clicks, IsPublic: isPub != 0, Order: orderNum, RowNum: rowNum,
	}
	if icon.Valid {
		out.Icon = &icon.String
	}
	if teamID.Valid {
		out.TeamID = &teamID.String
	}
	if projectID.Valid {
		out.ProjectID = &projectID.String
	}
	if userID.Valid {
		v := userID.Int64
		out.UserID = &v
	}
	if groupID.Valid {
		out.GroupID = &groupID.String
	}
	if displaySize.Valid {
		out.DisplaySize = &displaySize.String
	}
	if bgColor.Valid {
		out.BgColor = &bgColor.String
	}
	return out, nil
}

func navigationGuest(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var firstID sql.NullInt64
		err := db.QueryRow(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).Scan(&firstID)
		if err == sql.ErrNoRows || !firstID.Valid {
			c.JSON(http.StatusOK, gin.H{
				"userId": nil,
				"links":  []*linkOut{},
				"groups": []navGroupOut{},
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		uid := firstID.Int64
		rows, err := db.Query(`SELECT id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor, row_num FROM links WHERE userId = ? ORDER BY row_num, order_num, id`, uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		links := make([]*linkOut, 0)
		for rows.Next() {
			l, err := scanLink(rows)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			links = append(links, l)
		}
		grows, err := db.Query(`SELECT id, name, userId, teamId, projectId, order_num FROM `+"`groups`"+` WHERE userId = ? ORDER BY order_num, id`, uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer grows.Close()
		groups := make([]navGroupOut, 0)
		for grows.Next() {
			var id, name string
			var u sql.NullInt64
			var t, p sql.NullString
			var orderNum int
			if err := grows.Scan(&id, &name, &u, &t, &p, &orderNum); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			groups = append(groups, navGroupFromScan(id, name, u, t, p, orderNum))
		}
		c.JSON(http.StatusOK, gin.H{
			"userId": uid,
			"links":  links,
			"groups": groups,
		})
	}
}

func navGroupFromScan(id, name string, uid sql.NullInt64, teamID, projectID sql.NullString, orderNum int) navGroupOut {
	o := navGroupOut{ID: id, Name: name, Order: orderNum}
	if uid.Valid {
		v := uid.Int64
		o.UserID = &v
	}
	if teamID.Valid {
		o.TeamID = &teamID.String
	}
	if projectID.Valid {
		o.ProjectID = &projectID.String
	}
	return o
}

func linksPopular(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor, row_num FROM links WHERE isPublic = 1 ORDER BY clicks DESC LIMIT 50`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := make([]*linkOut, 0)
		for rows.Next() {
			l, err := scanLink(rows)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			list = append(list, l)
		}
		c.JSON(http.StatusOK, list)
	}
}

func linksPersonal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		uid, ok := parseInt64Param(c, "userId")
		if !ok {
			return
		}
		if uid != jwtUID {
			forbid(c, "只能访问本人的链接列表")
			return
		}
		rows, err := db.Query(`SELECT id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor, row_num FROM links WHERE userId = ? ORDER BY row_num, order_num, id`, uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := make([]*linkOut, 0)
		for rows.Next() {
			l, err := scanLink(rows)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			list = append(list, l)
		}
		c.JSON(http.StatusOK, list)
	}
}

func linksTeam(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid := c.Param("teamId")
		if !assertTeamMember(c, db, tid, jwtUID) {
			return
		}
		rows, err := db.Query(`SELECT id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor, row_num FROM links WHERE teamId = ? ORDER BY row_num, order_num, id`, tid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := make([]*linkOut, 0)
		for rows.Next() {
			l, err := scanLink(rows)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			list = append(list, l)
		}
		c.JSON(http.StatusOK, list)
	}
}

type linkCreateBody struct {
	Title       string          `json:"title"`
	URL         string          `json:"url"`
	Icon        *string         `json:"icon"`
	IsPublic    *bool           `json:"isPublic"`
	TeamID      *string         `json:"teamId"`
	ProjectID   *string         `json:"projectId"`
	UserID      json.RawMessage `json:"userId"`
	GroupID     *string         `json:"groupId"`
	DisplaySize *string         `json:"displaySize"`
	BgColor     *string         `json:"bgColor"`
}

func linksCreate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body linkCreateBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		rawURL := strings.TrimSpace(body.URL)
		if rawURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请填写链接地址"})
			return
		}
		low := strings.ToLower(rawURL)
		if !strings.HasPrefix(low, "http://") && !strings.HasPrefix(low, "https://") {
			rawURL = "https://" + rawURL
		}
		if u, err := url.Parse(rawURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "链接地址无效"})
			return
		}

		title := strings.TrimSpace(body.Title)
		needTitle := title == ""

		icon := "Link"
		if body.Icon != nil {
			icon = strings.TrimSpace(*body.Icon)
		}
		needIcon := body.Icon == nil || icon == ""

		if needTitle || needIcon {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
			defer cancel()
			t, ico, _ := linkmeta.Fetch(ctx, rawURL)
			if needTitle && strings.TrimSpace(t) != "" {
				title = strings.TrimSpace(t)
			}
			if needIcon && ico != "" {
				icon = ico
			}
		}

		if title == "" {
			if u, err := url.Parse(rawURL); err == nil && u.Hostname() != "" {
				title = u.Hostname()
			} else {
				title = "未命名链接"
			}
		}
		if icon == "" {
			icon = "Link"
		}

		isPub := 0
		if body.IsPublic != nil && *body.IsPublic {
			isPub = 1
		}
		ds := "small"
		if body.DisplaySize != nil && *body.DisplaySize != "" {
			ds = *body.DisplaySize
		}
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}

		var userIDCol interface{}
		var teamIns interface{}
		var projIns interface{}

		hasProj := body.ProjectID != nil && strings.TrimSpace(*body.ProjectID) != ""
		hasTeam := body.TeamID != nil && strings.TrimSpace(*body.TeamID) != ""

		switch {
		case hasProj:
			pid := strings.TrimSpace(*body.ProjectID)
			tid, err := projectTeamID(db, pid)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{"error": "无效的项目"})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if !assertTeamMember(c, db, tid, jwtUID) {
				return
			}
			if body.GroupID != nil && strings.TrimSpace(*body.GroupID) != "" {
				okG, err := groupReadable(db, strings.TrimSpace(*body.GroupID), jwtUID)
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{"error": "无效的分组"})
					return
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				if !okG {
					forbid(c, "无权在该分组下创建链接")
					return
				}
			}
			teamIns = tid
			projIns = pid
			userIDCol = nil
		case hasTeam:
			tid := strings.TrimSpace(*body.TeamID)
			if !assertTeamMember(c, db, tid, jwtUID) {
				return
			}
			if body.GroupID != nil && strings.TrimSpace(*body.GroupID) != "" {
				okG, err := groupReadable(db, strings.TrimSpace(*body.GroupID), jwtUID)
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{"error": "无效的分组"})
					return
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				if !okG {
					forbid(c, "无权在该分组下创建链接")
					return
				}
			}
			teamIns = tid
			projIns = nil
			userIDCol = nil
		default:
			if body.GroupID != nil && strings.TrimSpace(*body.GroupID) != "" {
				okG, err := groupReadable(db, strings.TrimSpace(*body.GroupID), jwtUID)
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{"error": "无效的分组"})
					return
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				if !okG {
					forbid(c, "无权在该分组下创建链接")
					return
				}
			}
			teamIns = nil
			projIns = nil
			userIDCol = jwtUID
		}

		id := fmt.Sprintf("l_%d", time.Now().UnixMilli())
		_, err := db.Exec(`
			INSERT INTO links (id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, title, rawURL, icon, 0, isPub, teamIns, projIns, userIDCol, nullStr(body.GroupID), ds, 100, nullStr(body.BgColor),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor, row_num FROM links WHERE id = ?`, id)
		var l linkOut
		var iconN sql.NullString
		var teamID, projectID, groupID, displaySize, bgColor sql.NullString
		var userID sql.NullInt64
		var isP, orderNum, rowNum int
		err = row.Scan(&l.ID, &l.Title, &l.URL, &iconN, &l.Clicks, &isP, &teamID, &projectID, &userID, &groupID, &displaySize, &orderNum, &bgColor, &rowNum)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		l.IsPublic = isP != 0
		l.Order = orderNum
		l.RowNum = rowNum
		if iconN.Valid {
			l.Icon = &iconN.String
		}
		if teamID.Valid {
			l.TeamID = &teamID.String
		}
		if projectID.Valid {
			l.ProjectID = &projectID.String
		}
		if userID.Valid {
			v := userID.Int64
			l.UserID = &v
		}
		if groupID.Valid {
			l.GroupID = &groupID.String
		}
		if displaySize.Valid {
			l.DisplaySize = &displaySize.String
		}
		if bgColor.Valid {
			l.BgColor = &bgColor.String
		}
		c.JSON(http.StatusOK, l)
	}
}

func nullStr(p *string) interface{} {
	if p == nil {
		return nil
	}
	return *p
}

var linkUpdateWhitelist = map[string]string{
	"title":       "title",
	"url":         "url",
	"icon":        "icon",
	"clicks":      "clicks",
	"isPublic":    "isPublic",
	"teamId":      "teamId",
	"projectId":   "projectId",
	"userId":      "userId",
	"groupId":     "groupId",
	"displaySize": "displaySize",
	"order":       "order_num",
	"bgColor":     "bgColor",
	"rowNum":      "row_num",
}

func linksUpdate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		okW, err := linkWritable(db, id, jwtUID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !okW {
			forbid(c, "无权修改该链接")
			return
		}
		var raw map[string]json.RawMessage
		if err := c.ShouldBindJSON(&raw); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if len(raw) > 0 && !validateLinkUpdateMutation(c, db, jwtUID, raw) {
			return
		}
		if len(raw) > 0 {
			var sets []string
			var args []any
			for k, v := range raw {
				col, ok := linkUpdateWhitelist[k]
				if !ok {
					continue
				}
				switch k {
				case "isPublic":
					var b bool
					if err := json.Unmarshal(v, &b); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid isPublic"})
						return
					}
					val := 0
					if b {
						val = 1
					}
					sets = append(sets, col+" = ?")
					args = append(args, val)
				case "clicks":
					var n int
					if err := json.Unmarshal(v, &n); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid clicks"})
						return
					}
					sets = append(sets, col+" = ?")
					args = append(args, n)
				case "order":
					var n int
					if err := json.Unmarshal(v, &n); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order"})
						return
					}
					sets = append(sets, col+" = ?")
					args = append(args, n)
				case "rowNum":
					var n int
					if err := json.Unmarshal(v, &n); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rowNum"})
						return
					}
					sets = append(sets, col+" = ?")
					args = append(args, n)
				case "userId":
					var z any
					if err := json.Unmarshal(v, &z); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
						return
					}
					if z == nil {
						sets = append(sets, col+" = ?")
						args = append(args, nil)
						continue
					}
					switch t := z.(type) {
					case float64:
						sets = append(sets, col+" = ?")
						args = append(args, int64(t))
					case string:
						parsed, err := strconv.ParseInt(strings.TrimSpace(t), 10, 64)
						if err != nil {
							c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
							return
						}
						sets = append(sets, col+" = ?")
						args = append(args, parsed)
					default:
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
						return
					}
				default:
					var s string
					if err := json.Unmarshal(v, &s); err != nil {
						var null interface{}
						if err2 := json.Unmarshal(v, &null); err2 == nil && null == nil {
							sets = append(sets, col+" = ?")
							args = append(args, nil)
							continue
						}
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field " + k})
						return
					}
					sets = append(sets, col+" = ?")
					args = append(args, s)
				}
			}
			if len(sets) > 0 {
				args = append(args, id)
				q := "UPDATE links SET " + strings.Join(sets, ", ") + " WHERE id = ?"
				if _, err := db.Exec(q, args...); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
			}
		}
		row := db.QueryRow(`SELECT id, title, url, icon, clicks, isPublic, teamId, projectId, userId, groupId, displaySize, order_num, bgColor, row_num FROM links WHERE id = ?`, id)
		var l linkOut
		var iconN sql.NullString
		var teamID, projectID, groupID, displaySize, bgColor sql.NullString
		var userID sql.NullInt64
		var isP, orderNum, rowNum int
		if err = row.Scan(&l.ID, &l.Title, &l.URL, &iconN, &l.Clicks, &isP, &teamID, &projectID, &userID, &groupID, &displaySize, &orderNum, &bgColor, &rowNum); err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		l.IsPublic = isP != 0
		l.Order = orderNum
		l.RowNum = rowNum
		if iconN.Valid {
			l.Icon = &iconN.String
		}
		if teamID.Valid {
			l.TeamID = &teamID.String
		}
		if projectID.Valid {
			l.ProjectID = &projectID.String
		}
		if userID.Valid {
			v := userID.Int64
			l.UserID = &v
		}
		if groupID.Valid {
			l.GroupID = &groupID.String
		}
		if displaySize.Valid {
			l.DisplaySize = &displaySize.String
		}
		if bgColor.Valid {
			l.BgColor = &bgColor.String
		}
		c.JSON(http.StatusOK, l)
	}
}

func linksDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		okW, err := linkWritable(db, id, jwtUID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !okW {
			forbid(c, "无权删除该链接")
			return
		}
		_, err = db.Exec(`DELETE FROM links WHERE id = ?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func groupsList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		q := c.Request.URL.Query()
		userID := q.Get("userId")
		teamID := q.Get("teamId")
		projectID := q.Get("projectId")
		var query string
		var args []any
		query = `SELECT id, name, userId, teamId, projectId, order_num FROM ` + "`groups`" + ` WHERE 1=1`
		if projectID != "" {
			tid, err := projectTeamID(db, projectID)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{"error": "无效的项目"})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if !assertTeamMember(c, db, tid, jwtUID) {
				return
			}
			query += ` AND projectId = ?`
			args = append(args, projectID)
		} else if teamID != "" {
			if !assertTeamMember(c, db, teamID, jwtUID) {
				return
			}
			query += ` AND teamId = ? AND projectId IS NULL`
			args = append(args, teamID)
		} else if userID != "" {
			uid, err := parseInt64Query(userID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 userId"})
				return
			}
			if uid != jwtUID {
				forbid(c, "只能访问本人的分组列表")
				return
			}
			query += ` AND userId = ?`
			args = append(args, uid)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请指定 userId、teamId 或 projectId"})
			return
		}
		query += ` ORDER BY order_num, id`
		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := make([]navGroupOut, 0)
		for rows.Next() {
			var id, name string
			var u sql.NullInt64
			var t, p sql.NullString
			var orderNum int
			if err := rows.Scan(&id, &name, &u, &t, &p, &orderNum); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			list = append(list, navGroupFromScan(id, name, u, t, p, orderNum))
		}
		c.JSON(http.StatusOK, list)
	}
}

type groupBody struct {
	Name      string          `json:"name"`
	UserID    json.RawMessage `json:"userId"`
	TeamID    *string         `json:"teamId"`
	ProjectID *string         `json:"projectId"`
	Order     int             `json:"order"`
}

func groupsCreate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var body groupBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		var userIDCol interface{}
		var teamIns interface{}
		var projIns interface{}
		hasProj := body.ProjectID != nil && strings.TrimSpace(*body.ProjectID) != ""
		hasTeam := body.TeamID != nil && strings.TrimSpace(*body.TeamID) != ""
		switch {
		case hasProj:
			pid := strings.TrimSpace(*body.ProjectID)
			tid, err := projectTeamID(db, pid)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{"error": "无效的项目"})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if !assertTeamMember(c, db, tid, jwtUID) {
				return
			}
			teamIns = tid
			projIns = pid
			userIDCol = nil
		case hasTeam:
			tid := strings.TrimSpace(*body.TeamID)
			if !assertTeamMember(c, db, tid, jwtUID) {
				return
			}
			teamIns = tid
			projIns = nil
			userIDCol = nil
		default:
			teamIns = nil
			projIns = nil
			userIDCol = jwtUID
		}
		id := fmt.Sprintf("g_%d", time.Now().UnixMilli())
		_, err := db.Exec(`INSERT INTO `+"`groups`"+` (id, name, userId, teamId, projectId, order_num) VALUES (?, ?, ?, ?, ?, ?)`,
			id, body.Name, userIDCol, teamIns, projIns, body.Order)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, name, userId, teamId, projectId, order_num FROM `+"`groups`"+` WHERE id = ?`, id)
		var gid, gname string
		var u sql.NullInt64
		var t, p sql.NullString
		var orderNum int
		_ = row.Scan(&gid, &gname, &u, &t, &p, &orderNum)
		c.JSON(http.StatusOK, navGroupFromScan(gid, gname, u, t, p, orderNum))
	}
}

func groupsUpdate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		okG, err := groupReadable(db, id, jwtUID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !okG {
			forbid(c, "无权修改该分组")
			return
		}
		var body struct {
			Name  string `json:"name"`
			Order int    `json:"order"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		_, err = db.Exec(`UPDATE `+"`groups`"+` SET name = ?, order_num = ? WHERE id = ?`, body.Name, body.Order, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, name, userId, teamId, projectId, order_num FROM `+"`groups`"+` WHERE id = ?`, id)
		var gid, gname string
		var u sql.NullInt64
		var t, p sql.NullString
		var orderNum int
		_ = row.Scan(&gid, &gname, &u, &t, &p, &orderNum)
		c.JSON(http.StatusOK, navGroupFromScan(gid, gname, u, t, p, orderNum))
	}
}

func groupsDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		okG, err := groupReadable(db, id, jwtUID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !okG {
			forbid(c, "无权删除该分组")
			return
		}
		_, _ = db.Exec(`DELETE FROM `+"`groups`"+` WHERE id = ?`, id)
		_, _ = db.Exec(`UPDATE links SET groupId = NULL WHERE groupId = ?`, id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func projectsByTeam(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid := c.Param("teamId")
		if !assertTeamMember(c, db, tid, jwtUID) {
			return
		}
		rows, err := db.Query(`SELECT id, teamId, name, description FROM projects WHERE teamId = ?`, tid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		type pOut struct {
			ID          string `json:"id"`
			TeamID      string `json:"teamId"`
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
		}
		list := make([]pOut, 0)
		for rows.Next() {
			var o pOut
			var desc sql.NullString
			if err := rows.Scan(&o.ID, &o.TeamID, &o.Name, &desc); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if desc.Valid {
				o.Description = desc.String
			}
			list = append(list, o)
		}
		c.JSON(http.StatusOK, list)
	}
}

func projectsCreate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var body struct {
			TeamID      string `json:"teamId"`
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if !assertTeamMember(c, db, body.TeamID, jwtUID) {
			return
		}
		id := fmt.Sprintf("p_%d", time.Now().UnixMilli())
		_, err := db.Exec(`INSERT INTO projects (id, teamId, name, description) VALUES (?, ?, ?, ?)`, id, body.TeamID, body.Name, body.Description)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, teamId, name, description FROM projects WHERE id = ?`, id)
		type pOut struct {
			ID          string `json:"id"`
			TeamID      string `json:"teamId"`
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
		}
		var o pOut
		var desc sql.NullString
		_ = row.Scan(&o.ID, &o.TeamID, &o.Name, &desc)
		if desc.Valid {
			o.Description = desc.String
		}
		c.JSON(http.StatusOK, o)
	}
}

func projectsUpdate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var teamID string
		err := db.QueryRow(`SELECT teamId FROM projects WHERE id = ?`, id).Scan(&teamID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !assertTeamMember(c, db, teamID, jwtUID) {
			return
		}
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		_, err = db.Exec(`UPDATE projects SET name = ?, description = ? WHERE id = ?`, body.Name, body.Description, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, teamId, name, description FROM projects WHERE id = ?`, id)
		type pOut struct {
			ID          string `json:"id"`
			TeamID      string `json:"teamId"`
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
		}
		var o pOut
		var desc sql.NullString
		_ = row.Scan(&o.ID, &o.TeamID, &o.Name, &desc)
		if desc.Valid {
			o.Description = desc.String
		}
		c.JSON(http.StatusOK, o)
	}
}

func projectsDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var teamID string
		err := db.QueryRow(`SELECT teamId FROM projects WHERE id = ?`, id).Scan(&teamID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !assertTeamMember(c, db, teamID, jwtUID) {
			return
		}
		_, _ = db.Exec(`DELETE FROM projects WHERE id = ?`, id)
		_, _ = db.Exec(`DELETE FROM links WHERE projectId = ?`, id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func teamsByUser(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		uid, ok := parseInt64Param(c, "userId")
		if !ok {
			return
		}
		if uid != jwtUID {
			forbid(c, "只能访问本人的团队列表")
			return
		}
		rows, err := db.Query(`
			SELECT t.id, t.name, t.description, t.ownerId FROM teams t
			JOIN team_members tm ON t.id = tm.teamId
			WHERE tm.userId = ?`, uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		type tOut struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
			OwnerID     int64  `json:"ownerId"`
		}
		list := make([]tOut, 0)
		for rows.Next() {
			var o tOut
			var desc sql.NullString
			if err := rows.Scan(&o.ID, &o.Name, &desc, &o.OwnerID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if desc.Valid {
				o.Description = desc.String
			}
			list = append(list, o)
		}
		c.JSON(http.StatusOK, list)
	}
}

func teamsCreate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			OwnerID     int64  `json:"ownerId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		ownerID := jwtUID
		if body.OwnerID != 0 && body.OwnerID != jwtUID {
			forbid(c, "只能以自己为团队所有者创建团队")
			return
		}
		ts := time.Now().UnixMilli()
		tid := fmt.Sprintf("t_%d", ts)
		tmid := fmt.Sprintf("tm_%d", ts)
		_, err := db.Exec(`INSERT INTO teams (id, name, description, ownerId) VALUES (?, ?, ?, ?)`, tid, body.Name, body.Description, ownerID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = db.Exec(`INSERT INTO team_members (id, teamId, userId, role) VALUES (?, ?, ?, ?)`, tmid, tid, ownerID, "owner")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, name, description, ownerId FROM teams WHERE id = ?`, tid)
		type tOut struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
			OwnerID     int64  `json:"ownerId"`
		}
		var o tOut
		var desc sql.NullString
		_ = row.Scan(&o.ID, &o.Name, &desc, &o.OwnerID)
		if desc.Valid {
			o.Description = desc.String
		}
		c.JSON(http.StatusOK, o)
	}
}

func teamsUpdate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		if !teamMemberIsManager(db, id, jwtUID) {
			forbid(c, "需要团队管理员权限")
			return
		}
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "团队名称不能为空"})
			return
		}
		_, err := db.Exec(`UPDATE teams SET name = ?, description = ? WHERE id = ?`, body.Name, body.Description, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, name, description, ownerId FROM teams WHERE id = ?`, id)
		type tOut struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description,omitempty"`
			OwnerID     int64  `json:"ownerId"`
		}
		var o tOut
		var desc sql.NullString
		if err := row.Scan(&o.ID, &o.Name, &desc, &o.OwnerID); err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if desc.Valid {
			o.Description = desc.String
		}
		c.JSON(http.StatusOK, o)
	}
}

func teamsDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		if !assertTeamOwner(c, db, id, jwtUID) {
			return
		}
		_, _ = db.Exec(`DELETE FROM team_members WHERE teamId = ?`, id)
		_, _ = db.Exec(`DELETE FROM links WHERE teamId = ?`, id)
		_, _ = db.Exec(`DELETE FROM projects WHERE teamId = ?`, id)
		_, _ = db.Exec(`DELETE FROM `+"`groups`"+` WHERE teamId = ?`, id)
		_, _ = db.Exec(`DELETE FROM wiki_nodes WHERE teamId = ?`, id)
		_, _ = db.Exec(`DELETE FROM teams WHERE id = ?`, id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func teamMembersList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid := c.Param("teamId")
		if !assertTeamMember(c, db, tid, jwtUID) {
			return
		}
		rows, err := db.Query(`
			SELECT tm.id, tm.teamId, tm.userId, tm.role, u.name, u.email, u.avatar
			FROM team_members tm
			JOIN users u ON tm.userId = u.id
			WHERE tm.teamId = ?`, tid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		type mOut struct {
			ID     string     `json:"id"`
			TeamID string     `json:"teamId"`
			UserID int64      `json:"userId"`
			Role   string     `json:"role"`
			User   userPublic `json:"user"`
		}
		list := make([]mOut, 0)
		for rows.Next() {
			var o mOut
			if err := rows.Scan(&o.ID, &o.TeamID, &o.UserID, &o.Role, &o.User.Name, &o.User.Email, &o.User.Avatar); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			o.User.ID = o.UserID
			list = append(list, o)
		}
		c.JSON(http.StatusOK, list)
	}
}

func teamMembersAdd(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		teamID := c.Param("teamId")
		if !teamMemberIsManager(db, teamID, jwtUID) {
			forbid(c, "需要团队管理员权限")
			return
		}
		var body struct {
			Email string `json:"email"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		var u userPublic
		err := db.QueryRow(`SELECT id, name, email, avatar FROM users WHERE email = ?`, body.Email).Scan(&u.ID, &u.Name, &u.Email, &u.Avatar)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var existingID string
		err = db.QueryRow(`SELECT id FROM team_members WHERE teamId = ? AND userId = ?`, teamID, u.ID).Scan(&existingID)
		if err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User is already a member"})
			return
		}
		if err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		id := fmt.Sprintf("tm_%d", time.Now().UnixMilli())
		_, err = db.Exec(`INSERT INTO team_members (id, teamId, userId, role) VALUES (?, ?, ?, ?)`, id, teamID, u.ID, "member")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"id": id, "teamId": teamID, "userId": u.ID, "role": "member", "user": u,
		})
	}
}

func teamMembersDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var teamID string
		err := db.QueryRow(`SELECT teamId FROM team_members WHERE id = ?`, id).Scan(&teamID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !teamMemberIsManager(db, teamID, jwtUID) {
			forbid(c, "需要团队管理员权限")
			return
		}
		_, _ = db.Exec(`DELETE FROM team_members WHERE id = ?`, id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func wikiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid := c.Param("teamId")
		if !assertTeamMember(c, db, tid, jwtUID) {
			return
		}
		rows, err := db.Query(`SELECT id, teamId, parentId, type, title, content, updatedAt FROM wiki_nodes WHERE teamId = ?`, tid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		type wn struct {
			ID        string  `json:"id"`
			TeamID    string  `json:"teamId"`
			ParentID  *string `json:"parentId"`
			Type      string  `json:"type"`
			Title     string  `json:"title"`
			Content   string  `json:"content"`
			UpdatedAt string  `json:"updatedAt"`
		}
		list := make([]wn, 0)
		for rows.Next() {
			var o wn
			var pid sql.NullString
			var content sql.NullString
			if err := rows.Scan(&o.ID, &o.TeamID, &pid, &o.Type, &o.Title, &content, &o.UpdatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if pid.Valid {
				o.ParentID = &pid.String
			}
			if content.Valid {
				o.Content = content.String
			}
			list = append(list, o)
		}
		c.JSON(http.StatusOK, list)
	}
}

func wikiCreate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var body struct {
			TeamID   string  `json:"teamId"`
			ParentID *string `json:"parentId"`
			Type     string  `json:"type"`
			Title    string  `json:"title"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if !assertTeamMember(c, db, body.TeamID, jwtUID) {
			return
		}
		id := fmt.Sprintf("wn_%d", time.Now().UnixMilli())
		content := ""
		if body.Type == "document" {
			content = fmt.Sprintf("# %s\n\n", body.Title)
		}
		updatedAt := time.Now().UTC().Format(time.RFC3339)
		_, err := db.Exec(`INSERT INTO wiki_nodes (id, teamId, parentId, type, title, content, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, body.TeamID, nullStr(body.ParentID), body.Type, body.Title, content, updatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, teamId, parentId, type, title, content, updatedAt FROM wiki_nodes WHERE id = ?`, id)
		type wn struct {
			ID        string  `json:"id"`
			TeamID    string  `json:"teamId"`
			ParentID  *string `json:"parentId"`
			Type      string  `json:"type"`
			Title     string  `json:"title"`
			Content   string  `json:"content"`
			UpdatedAt string  `json:"updatedAt"`
		}
		var o wn
		var pid, cont sql.NullString
		_ = row.Scan(&o.ID, &o.TeamID, &pid, &o.Type, &o.Title, &cont, &o.UpdatedAt)
		if pid.Valid {
			o.ParentID = &pid.String
		}
		if cont.Valid {
			o.Content = cont.String
		}
		c.JSON(http.StatusOK, o)
	}
}

func wikiUpdate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid, err := wikiNodeTeamID(db, id)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !assertTeamMember(c, db, tid, jwtUID) {
			return
		}
		var body struct {
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		updatedAt := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
		_, err = db.Exec(`UPDATE wiki_nodes SET content = ?, updatedAt = ? WHERE id = ?`, body.Content, updatedAt, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		row := db.QueryRow(`SELECT id, teamId, parentId, type, title, content, updatedAt FROM wiki_nodes WHERE id = ?`, id)
		type wn struct {
			ID        string  `json:"id"`
			TeamID    string  `json:"teamId"`
			ParentID  *string `json:"parentId"`
			Type      string  `json:"type"`
			Title     string  `json:"title"`
			Content   string  `json:"content"`
			UpdatedAt string  `json:"updatedAt"`
		}
		var o wn
		var pid, cont sql.NullString
		_ = row.Scan(&o.ID, &o.TeamID, &pid, &o.Type, &o.Title, &cont, &o.UpdatedAt)
		if pid.Valid {
			o.ParentID = &pid.String
		}
		if cont.Valid {
			o.Content = cont.String
		}
		c.JSON(http.StatusOK, o)
	}
}

func wikiDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rootID := c.Param("id")
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid, err := wikiNodeTeamID(db, rootID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !assertTeamMember(c, db, tid, jwtUID) {
			return
		}
		rows, err := db.Query(`SELECT id, parentId FROM wiki_nodes`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type node struct {
			id       string
			parentID *string
		}
		var nodes []node
		for rows.Next() {
			var n node
			var p sql.NullString
			if err := rows.Scan(&n.id, &p); err != nil {
				_ = rows.Close()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if p.Valid {
				n.parentID = &p.String
			}
			nodes = append(nodes, n)
		}
		_ = rows.Close()

		toDelete := map[string]struct{}{rootID: {}}
		changed := true
		for changed {
			changed = false
			for _, n := range nodes {
				if n.parentID != nil {
					if _, ok := toDelete[*n.parentID]; ok {
						if _, has := toDelete[n.id]; !has {
							toDelete[n.id] = struct{}{}
							changed = true
						}
					}
				}
			}
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`SET FOREIGN_KEY_CHECKS=0`); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for id := range toDelete {
			if _, err := tx.Exec(`DELETE FROM wiki_nodes WHERE id = ?`, id); err != nil {
				_, _ = tx.Exec(`SET FOREIGN_KEY_CHECKS=1`)
				_ = tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if _, err := tx.Exec(`SET FOREIGN_KEY_CHECKS=1`); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func widgetsGet(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		uid, ok := parseInt64Param(c, "userId")
		if !ok {
			return
		}
		if uid != jwtUID {
			forbid(c, "只能访问本人的小组件")
			return
		}
		rows, err := db.Query(`SELECT id, userId, type, visible, order_num, settings FROM widgets WHERE userId = ? ORDER BY order_num`, uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		type wOut struct {
			ID       string           `json:"id"`
			UserID   int64            `json:"userId"`
			Type     string           `json:"type"`
			Visible  bool             `json:"visible"`
			Order    int              `json:"order"`
			Settings *json.RawMessage `json:"settings,omitempty"`
		}
		list := make([]wOut, 0)
		for rows.Next() {
			var o wOut
			var vis int
			var orderNum int
			var settings sql.NullString
			if err := rows.Scan(&o.ID, &o.UserID, &o.Type, &vis, &orderNum, &settings); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			o.Visible = vis != 0
			o.Order = orderNum
			if settings.Valid && settings.String != "" {
				raw := json.RawMessage(settings.String)
				o.Settings = &raw
			}
			list = append(list, o)
		}
		c.JSON(http.StatusOK, list)
	}
}

func widgetsPut(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jwtUID, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		uid, ok := parseInt64Param(c, "userId")
		if !ok {
			return
		}
		if uid != jwtUID {
			forbid(c, "只能修改本人的小组件")
			return
		}
		var items []struct {
			ID       string          `json:"id"`
			Type     string          `json:"type"`
			Visible  bool            `json:"visible"`
			Order    int             `json:"order"`
			Settings json.RawMessage `json:"settings"`
		}
		if err := c.ShouldBindJSON(&items); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		stmt, err := tx.Prepare(`REPLACE INTO widgets (id, userId, type, visible, order_num, settings) VALUES (?, ?, ?, ?, ?, ?)`)
		if err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer stmt.Close()
		for _, widget := range items {
			var settings interface{}
			if len(widget.Settings) > 0 && string(widget.Settings) != "null" {
				settings = string(widget.Settings)
			}
			vis := 0
			if widget.Visible {
				vis = 1
			}
			_, err := stmt.Exec(widget.ID, uid, widget.Type, vis, widget.Order, settings)
			if err != nil {
				_ = tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// cacheWeatherData 将天气数据写入缓存并限制容量。
func cacheWeatherData(key string, data interface{}) {
	cacheMutex.Lock()
	weatherCache[key] = cachedWeather{
		data:      data,
		timestamp: time.Now(),
	}
	if len(weatherCache) > 100 {
		for k := range weatherCache {
			if len(weatherCache) <= 50 {
				break
			}
			delete(weatherCache, k)
		}
	}
	cacheMutex.Unlock()
}

// getWeather 获取天气数据；优先使用 adcode 调用高德天气，无 adcode 时回退旧接口。
// 若没有任何参数，自动根据请求 IP 定位并返回天气。
func getWeather(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adcode := c.Query("adcode")
		province := c.DefaultQuery("province", "广东")
		city := c.DefaultQuery("city", "深圳")

		now := time.Now()
		hourKey := now.Format("2006-01-02-15")
		var cacheKey string
		if adcode != "" {
			cacheKey = fmt.Sprintf("gaode_%s_%s", adcode, hourKey)
		} else {
			cacheKey = fmt.Sprintf("%s_%s_%s", province, city, hourKey)
		}

		// 检查缓存 (缓存30分钟)
		cacheMutex.RLock()
		if entry, ok := weatherCache[cacheKey]; ok && now.Sub(entry.timestamp) < 30*time.Minute {
			cacheMutex.RUnlock()
			c.JSON(http.StatusOK, entry.data)
			return
		}
		cacheMutex.RUnlock()

		// 1. 优先使用 adcode 查询高德天气
		if adcode != "" && gaodeKey != "" {
			data, err := gaodeWeather(adcode)
			if err == nil {
				cacheWeatherData(cacheKey, data)
				c.JSON(http.StatusOK, data)
				return
			}
		}

		// 2. 没有任何参数时，自动根据 IP 定位并查询天气
		if adcode == "" && c.Query("province") == "" && c.Query("city") == "" {
			clientIP := c.ClientIP()
			if gaodeKey != "" {
				p, ci, ad, err := gaodeIPLocation(clientIP)
				if err == nil && ad != "" {
					data, err := gaodeWeather(ad)
					if err == nil {
						cacheWeatherData(cacheKey, data)
						c.JSON(http.StatusOK, data)
						return
					}
				}
				// IP 定位失败但获得了省/市，尝试用旧接口
				if p != "" && ci != "" {
					province = p
					city = ci
				}
			}
		}

		// 3. 回退到原有第三方天气API（兼容旧前端 province/city 传参）
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		apiURL := fmt.Sprintf("https://cn.apihz.cn/api/tianqi/tqyb.php?id=88888888&key=88888888&sheng=%s&place=%s",
			url.QueryEscape(province), url.QueryEscape(city))

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
		if err != nil {
			c.JSON(http.StatusOK, defaultWeather(city))
			return
		}

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			if resp != nil {
				resp.Body.Close()
			}
			c.JSON(http.StatusOK, defaultWeather(city))
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusOK, defaultWeather(city))
			return
		}

		var apiData map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&apiData); err != nil {
			c.JSON(http.StatusOK, defaultWeather(city))
			return
		}

		if code, ok := apiData["code"].(float64); ok && int(code) != 200 {
			c.JSON(http.StatusOK, defaultWeather(city))
			return
		}

		if code, ok := apiData["code"].(float64); ok && int(code) == 200 {
			weatherData := WeatherData{
				Code: 200,
			}
			if w, ok := apiData["weather1"].(string); ok {
				weatherData.Weather1 = w
			} else {
				weatherData.Weather1 = "晴"
			}
			if nowinfo, ok := apiData["nowinfo"].(map[string]interface{}); ok {
				if temp, ok := nowinfo["temperature"].(float64); ok {
					weatherData.Temperature = int(temp)
				}
			}
			if weatherData.Temperature == 0 {
				if wd1, ok := apiData["wd1"].(string); ok {
					if t, err := strconv.Atoi(wd1); err == nil {
						weatherData.Temperature = t
					}
				}
			}
			if name, ok := apiData["name"].(string); ok && name != "" {
				weatherData.Place = name
			} else if shi, ok := apiData["shi"].(string); ok && shi != "" {
				weatherData.Place = shi
			} else {
				weatherData.Place = city
			}
			cacheWeatherData(cacheKey, weatherData)
			c.JSON(http.StatusOK, weatherData)
			return
		}

		c.JSON(http.StatusOK, defaultWeather(city))
	}
}

// getWeatherLocation 根据请求 IP 调用高德 IP 定位，返回省、市、adcode。
func getWeatherLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if gaodeKey == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "高德密钥未配置"})
			return
		}
		clientIP := c.ClientIP()
		province, city, adcode, err := gaodeIPLocation(clientIP)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"province": province,
				"city":     city,
				"adcode":   adcode,
				"error":    err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"province": province,
			"city":     city,
			"adcode":   adcode,
		})
	}
}

// gaodeIPLocation 调用高德 IP 定位接口，根据 IP 获取省、市、adcode。
func gaodeIPLocation(clientIP string) (province, city, adcode string, err error) {
	if gaodeKey == "" {
		return "", "", "", fmt.Errorf("gaode key not configured")
	}
	var apiURL string
	if clientIP != "" && clientIP != "127.0.0.1" && clientIP != "::1" {
		apiURL = fmt.Sprintf("https://restapi.amap.com/v3/ip?key=%s&ip=%s", gaodeKey, url.QueryEscape(clientIP))
	} else {
		apiURL = fmt.Sprintf("https://restapi.amap.com/v3/ip?key=%s", gaodeKey)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", "", "", err
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	var result struct {
		Status   string      `json:"status"`
		Info     string      `json:"info"`
		Infocode string      `json:"infocode"`
		Province interface{} `json:"province"`
		City     interface{} `json:"city"`
		Adcode   interface{} `json:"adcode"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", "", err
	}
	if result.Status != "1" {
		return "", "", "", fmt.Errorf("gaode ip location failed: %s", result.Info)
	}
	return ifaceString(result.Province), ifaceString(result.City), ifaceString(result.Adcode), nil
}

// ifaceString 将 interface{} 转为字符串；如果是数组则返回空串（兼容高德空值返回 []）。
func ifaceString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// gaodeWeather 调用高德天气接口，根据 adcode 获取实时天气。
func gaodeWeather(adcode string) (*WeatherData, error) {
	if gaodeKey == "" {
		return nil, fmt.Errorf("gaode key not configured")
	}
	apiURL := fmt.Sprintf("https://restapi.amap.com/v3/weather/weatherInfo?key=%s&city=%s&extensions=base", gaodeKey, url.QueryEscape(adcode))

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Status   string `json:"status"`
		Info     string `json:"info"`
		Infocode string `json:"infocode"`
		Lives    []struct {
			Province      string `json:"province"`
			City          string `json:"city"`
			Adcode        string `json:"adcode"`
			Weather       string `json:"weather"`
			Temperature   string `json:"temperature"`
			Winddirection string `json:"winddirection"`
			Windpower     string `json:"windpower"`
			Humidity      string `json:"humidity"`
			Reporttime    string `json:"reporttime"`
		} `json:"lives"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if result.Status != "1" || len(result.Lives) == 0 {
		return nil, fmt.Errorf("gaode weather failed: %s", result.Info)
	}

	live := result.Lives[0]
	temp, _ := strconv.Atoi(live.Temperature)
	humidity, _ := strconv.Atoi(live.Humidity)

	wind := live.Winddirection
	if live.Windpower != "" {
		wind += "风" + live.Windpower + "级"
	}

	return &WeatherData{
		Code:        200,
		Weather1:    live.Weather,
		Temperature: temp,
		Place:       live.City,
		Humidity:    humidity,
		Wind:        wind,
	}, nil
}

func defaultWeather(city string) WeatherData {
	return WeatherData{
		Code:  0,
		Error: "天气数据获取失败",
		Place: city,
	}
}
