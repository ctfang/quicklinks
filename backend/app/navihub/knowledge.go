package navihub

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const knowledgeFileLimit int64 = 10 << 20
const knowledgeColumns = "id, teamId, userId, parentId, type, title, COALESCE(content,''), updatedAt, fileName, mimeType, fileSize"

type knowledgeNode struct {
	ID        string  `json:"id"`
	TeamID    string  `json:"teamId"`
	UserID    *int64  `json:"userId"`
	ParentID  *string `json:"parentId"`
	Type      string  `json:"type"`
	Title     string  `json:"title"`
	Content   string  `json:"content"`
	UpdatedAt string  `json:"updatedAt"`
	FileName  string  `json:"fileName"`
	MimeType  string  `json:"mimeType"`
	FileSize  int64   `json:"fileSize"`
}
type knowledgeScanner interface{ Scan(...any) error }

func scanKnowledge(row knowledgeScanner) (knowledgeNode, error) {
	var n knowledgeNode
	err := row.Scan(&n.ID, &n.TeamID, &n.UserID, &n.ParentID, &n.Type, &n.Title, &n.Content, &n.UpdatedAt, &n.FileName, &n.MimeType, &n.FileSize)
	return n, err
}
func knowledgeError(c *gin.Context, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(404, gin.H{"error": "内容不存在"})
	} else {
		c.JSON(500, gin.H{"error": "知识库操作失败，请重试"})
	}
}
func knowledgeAccess(c *gin.Context, db *sql.DB, n knowledgeNode, uid int64) bool {
	if n.TeamID != "" {
		return assertTeamMember(c, db, n.TeamID, uid)
	}
	if n.UserID == nil || *n.UserID != uid {
		forbid(c, "无权访问此知识库")
		return false
	}
	return true
}
func knowledgeScope(c *gin.Context, db *sql.DB, tid string, uid int64) (string, any, bool) {
	if tid != "" {
		if !assertTeamMember(c, db, tid, uid) {
			return "", nil, false
		}
		return "teamId = ?", tid, true
	}
	return "teamId = '' AND userId = ?", uid, true
}
func knowledgeParent(c *gin.Context, db *sql.DB, pid *string, tid string, uid int64) bool {
	if pid == nil {
		return true
	}
	p, err := scanKnowledge(db.QueryRow("SELECT "+knowledgeColumns+" FROM wiki_nodes WHERE id = ?", *pid))
	if err != nil {
		knowledgeError(c, err)
		return false
	}
	if p.Type != "folder" || p.TeamID != tid || (tid == "" && (p.UserID == nil || *p.UserID != uid)) {
		c.JSON(400, gin.H{"error": "请选择当前知识库中的文件夹"})
		return false
	}
	return true
}
func knowledgeList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		tid := strings.TrimSpace(c.Query("teamId"))
		if c.Param("teamId") != "" {
			tid = c.Param("teamId")
		}
		where, arg, ok := knowledgeScope(c, db, tid, uid)
		if !ok {
			return
		}
		rows, err := db.Query("SELECT "+knowledgeColumns+" FROM wiki_nodes WHERE "+where+" ORDER BY title", arg)
		if err != nil {
			knowledgeError(c, err)
			return
		}
		defer rows.Close()
		nodes := []knowledgeNode{}
		for rows.Next() {
			n, err := scanKnowledge(rows)
			if err != nil {
				knowledgeError(c, err)
				return
			}
			nodes = append(nodes, n)
		}
		if err := rows.Err(); err != nil {
			knowledgeError(c, err)
			return
		}
		c.JSON(200, nodes)
	}
}
func insertKnowledge(c *gin.Context, db *sql.DB, uid int64, n knowledgeNode, data []byte) {
	var idBytes [16]byte
	if _, err := rand.Read(idBytes[:]); err != nil {
		knowledgeError(c, err)
		return
	}
	n.ID = "kb_" + hex.EncodeToString(idBytes[:])
	n.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if n.TeamID == "" {
		n.UserID = &uid
	}
	tx, err := db.Begin()
	if err != nil {
		knowledgeError(c, err)
		return
	}
	defer tx.Rollback()
	// Keep the parent locked through insertion so a concurrent folder deletion
	// cannot leave newly uploaded files orphaned.
	if n.ParentID != nil {
		var kind, team string
		var owner sql.NullInt64
		err := tx.QueryRow("SELECT type,teamId,userId FROM wiki_nodes WHERE id=? FOR UPDATE", *n.ParentID).Scan(&kind, &team, &owner)
		if err != nil || kind != "folder" || team != n.TeamID || (team == "" && (!owner.Valid || owner.Int64 != uid)) {
			c.JSON(400, gin.H{"error": "目标文件夹已失效，请重新选择"})
			return
		}
	}
	_, err = tx.Exec("INSERT INTO wiki_nodes (id,teamId,userId,parentId,type,title,content,updatedAt,fileName,mimeType,fileSize,fileData) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", n.ID, n.TeamID, n.UserID, n.ParentID, n.Type, n.Title, n.Content, n.UpdatedAt, n.FileName, n.MimeType, n.FileSize, data)
	if err != nil {
		knowledgeError(c, err)
		return
	}
	if err := tx.Commit(); err != nil {
		knowledgeError(c, err)
		return
	}
	c.JSON(201, n)
}
func knowledgeCreate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
		var n knowledgeNode
		if c.ShouldBindJSON(&n) != nil {
			c.JSON(400, gin.H{"error": "文档请求无效或过大"})
			return
		}
		n.Title = strings.TrimSpace(n.Title)
		n.TeamID = strings.TrimSpace(n.TeamID)
		if n.Title == "" || len([]rune(n.Title)) > 255 || (n.Type != "folder" && n.Type != "document") {
			c.JSON(400, gin.H{"error": "请填写有效的名称及内容类型"})
			return
		}
		if _, _, ok := knowledgeScope(c, db, n.TeamID, uid); !ok {
			return
		}
		if !knowledgeParent(c, db, n.ParentID, n.TeamID, uid) {
			return
		}
		// Ownership and attachment metadata are never accepted from the client.
		n.UserID = nil
		n.FileName = ""
		n.MimeType = ""
		n.FileSize = 0
		if n.Type == "folder" {
			n.Content = ""
		} else if n.Content == "" {
			n.Content = "# " + n.Title + "\n\n"
		}
		insertKnowledge(c, db, uid, n, nil)
	}
}

var knowledgeFormats = map[string]string{
	".md": "text/markdown", ".markdown": "text/markdown", ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json",
	".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
	".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

func knowledgeUpload(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, knowledgeFileLimit+(1<<20))
		if err := c.Request.ParseMultipartForm(1 << 20); err != nil {
			c.JSON(413, gin.H{"error": "上传请求无效，单文件最大 10 MB"})
			return
		}
		if c.Request.MultipartForm != nil {
			defer c.Request.MultipartForm.RemoveAll()
		}
		tid := strings.TrimSpace(c.PostForm("teamId"))
		if _, _, ok := knowledgeScope(c, db, tid, uid); !ok {
			return
		}
		var pid *string
		if p := c.PostForm("parentId"); p != "" {
			pid = &p
		}
		if !knowledgeParent(c, db, pid, tid, uid) {
			return
		}
		f, h, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(400, gin.H{"error": "请选择上传文件"})
			return
		}
		defer f.Close()
		name := filepath.Base(strings.ReplaceAll(h.Filename, "\\", "/"))
		ext := strings.ToLower(filepath.Ext(name))
		contentType, allowed := knowledgeFormats[ext]
		if !allowed || len([]rune(name)) > 255 {
			c.JSON(400, gin.H{"error": "不支持此文件格式或文件名过长"})
			return
		}
		data, err := io.ReadAll(io.LimitReader(f, knowledgeFileLimit+1))
		if err != nil {
			knowledgeError(c, err)
			return
		}
		if len(data) == 0 || int64(len(data)) > knowledgeFileLimit {
			c.JSON(413, gin.H{"error": "文件不能为空，且不能超过 10 MB"})
			return
		}
		n := knowledgeNode{TeamID: tid, ParentID: pid, Type: "file", Title: name, FileName: name, MimeType: contentType, FileSize: int64(len(data))}
		if strings.HasPrefix(contentType, "text/") || contentType == "application/json" {
			if !utf8.Valid(data) {
				c.JSON(400, gin.H{"error": "文本文件需使用 UTF-8 编码"})
				return
			}
			n.Content = string(data)
		}
		if strings.HasPrefix(contentType, "image/") && http.DetectContentType(data) != contentType {
			c.JSON(400, gin.H{"error": "图片内容与扩展名不匹配"})
			return
		}
		if contentType == "application/pdf" && !strings.HasPrefix(string(data), "%PDF-") {
			c.JSON(400, gin.H{"error": "无效的 PDF 文件"})
			return
		}
		insertKnowledge(c, db, uid, n, data)
	}
}
func knowledgeUpdate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		n, err := scanKnowledge(db.QueryRow("SELECT "+knowledgeColumns+" FROM wiki_nodes WHERE id = ?", c.Param("id")))
		if err != nil {
			knowledgeError(c, err)
			return
		}
		if !knowledgeAccess(c, db, n, uid) {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
		var body struct {
			Content *string `json:"content"`
			Title   *string `json:"title"`
		}
		if c.ShouldBindJSON(&body) != nil {
			c.JSON(400, gin.H{"error": "请求无效或过大"})
			return
		}
		if body.Content != nil {
			if n.Type != "document" {
				c.JSON(400, gin.H{"error": "只有在线文档可编辑，文件请重新上传"})
				return
			}
			n.Content = *body.Content
		}
		if body.Title != nil {
			n.Title = strings.TrimSpace(*body.Title)
		}
		if n.Title == "" || len([]rune(n.Title)) > 255 {
			c.JSON(400, gin.H{"error": "名称应为 1–255 个字符"})
			return
		}
		n.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		_, err = db.Exec("UPDATE wiki_nodes SET title=?,content=?,updatedAt=? WHERE id=?", n.Title, n.Content, n.UpdatedAt, n.ID)
		if err != nil {
			knowledgeError(c, err)
			return
		}
		c.JSON(200, n)
	}
}
func knowledgeFile(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		n, err := scanKnowledge(db.QueryRow("SELECT "+knowledgeColumns+" FROM wiki_nodes WHERE id = ?", c.Param("id")))
		if err != nil {
			knowledgeError(c, err)
			return
		}
		if !knowledgeAccess(c, db, n, uid) {
			return
		}
		if n.Type != "file" {
			c.JSON(400, gin.H{"error": "此内容不是上传文件"})
			return
		}
		var data []byte
		if err := db.QueryRow("SELECT fileData FROM wiki_nodes WHERE id=?", n.ID).Scan(&data); err != nil {
			knowledgeError(c, err)
			return
		}
		disposition := "attachment"
		if c.Query("download") != "1" && (strings.HasPrefix(n.MimeType, "image/") || n.MimeType == "application/pdf" || strings.HasPrefix(n.MimeType, "text/")) {
			disposition = "inline"
		}
		c.Header("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": n.FileName}))
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Cache-Control", "private, no-store")
		c.Header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'self'")
		c.Data(200, n.MimeType, data)
	}
}
func knowledgeDelete(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		n, err := scanKnowledge(db.QueryRow("SELECT "+knowledgeColumns+" FROM wiki_nodes WHERE id=?", c.Param("id")))
		if err != nil {
			knowledgeError(c, err)
			return
		}
		if !knowledgeAccess(c, db, n, uid) {
			return
		}
		where, arg, ok := knowledgeScope(c, db, n.TeamID, uid)
		if !ok {
			return
		}
		tx, err := db.Begin()
		if err != nil {
			knowledgeError(c, err)
			return
		}
		defer tx.Rollback()
		rows, err := tx.Query("SELECT id,parentId FROM wiki_nodes WHERE "+where+" FOR UPDATE", arg)
		if err != nil {
			knowledgeError(c, err)
			return
		}
		children := map[string][]string{}
		for rows.Next() {
			var id string
			var pid sql.NullString
			if err := rows.Scan(&id, &pid); err != nil {
				rows.Close()
				knowledgeError(c, err)
				return
			}
			if pid.Valid {
				children[pid.String] = append(children[pid.String], id)
			}
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			knowledgeError(c, err)
			return
		}
		visited := map[string]bool{}
		var remove func(string) error
		remove = func(id string) error {
			if visited[id] {
				return nil
			}
			visited[id] = true
			for _, child := range children[id] {
				if err := remove(child); err != nil {
					return err
				}
			}
			_, err := tx.Exec("DELETE FROM wiki_nodes WHERE id=? AND "+where, id, arg)
			return err
		}
		if err := remove(n.ID); err != nil {
			knowledgeError(c, err)
			return
		}
		if err := tx.Commit(); err != nil {
			knowledgeError(c, err)
			return
		}
		c.JSON(200, gin.H{"success": true})
	}
}
