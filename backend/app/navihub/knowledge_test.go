package navihub

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	drivermysql "github.com/go-sql-driver/mysql"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// Uses a disposable database; never migrates or seeds the application database.
func TestKnowledgeIntegration(t *testing.T) {
	dsn := os.Getenv("NAVIHUB_KNOWLEDGE_TEST_DSN")
	if dsn == "" {
		t.Skip("set NAVIHUB_KNOWLEDGE_TEST_DSN for isolated MySQL integration tests")
	}
	cfg, err := drivermysql.ParseDSN(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.DBName = ""
	admin, err := gorm.Open(gormmysql.Open(cfg.FormatDSN()), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	dbName := fmt.Sprintf("navihub_knowledge_test_%d", time.Now().UnixNano())
	if err := admin.Exec("CREATE DATABASE " + dbName + " CHARACTER SET utf8mb4").Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Exec("DROP DATABASE " + dbName); pool, _ := admin.DB(); pool.Close() })
	cfg.DBName = dbName
	gdb, err := gorm.Open(gormmysql.Open(cfg.FormatDSN()), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := gdb.AutoMigrate(&WikiNode{}, &TeamMember{}); err != nil {
		t.Fatal(err)
	}
	db, err := gdb.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec("INSERT INTO team_members (id,teamId,userId,role) VALUES ('member-a','team-a',11,'owner'),('member-b','team-b',22,'owner')"); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if uid, _ := strconv.ParseInt(c.GetHeader("X-Test-User"), 10, 64); uid > 0 {
			c.Set(ginKeyUserID, uid)
		}
	})
	router.GET("/knowledge", knowledgeList(db))
	router.POST("/knowledge", knowledgeCreate(db))
	router.PUT("/knowledge/:id", knowledgeUpdate(db))
	router.DELETE("/knowledge/:id", knowledgeDelete(db))
	router.POST("/knowledge/upload", knowledgeUpload(db))
	router.GET("/knowledge/:id/file", knowledgeFile(db))
	request := func(method, path, body, user string, want int) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-User", user)
		out := httptest.NewRecorder()
		router.ServeHTTP(out, req)
		if out.Code != want {
			t.Fatalf("%s %s: status %d want %d: %s", method, path, out.Code, want, out.Body.String())
		}
		return out
	}
	decode := func(out *httptest.ResponseRecorder) knowledgeNode {
		t.Helper()
		var n knowledgeNode
		if err := json.Unmarshal(out.Body.Bytes(), &n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	upload := func(name string, data []byte, parent, team, user string, want int) *httptest.ResponseRecorder {
		t.Helper()
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		file, err := writer.CreateFormFile("file", name)
		if err != nil {
			t.Fatal(err)
		}
		file.Write(data)
		writer.WriteField("parentId", parent)
		writer.WriteField("teamId", team)
		writer.Close()
		req := httptest.NewRequest("POST", "/knowledge/upload", &body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("X-Test-User", user)
		out := httptest.NewRecorder()
		router.ServeHTTP(out, req)
		if out.Code != want {
			t.Fatalf("upload %s status %d want %d: %s", name, out.Code, want, out.Body.String())
		}
		return out
	}
	request("GET", "/knowledge", "", "", 401)
	root := decode(request("POST", "/knowledge", `{"type":"folder","title":"个人资料","userId":22}`, "11", 201))
	if root.UserID == nil || *root.UserID != 11 {
		t.Fatal("ownership must come from authentication")
	}
	doc := decode(request("POST", "/knowledge", fmt.Sprintf(`{"type":"document","title":"笔记","parentId":%q}`, root.ID), "11", 201))
	request("PUT", "/knowledge/"+doc.ID, `{"content":"# 已保存"}`, "11", 200)
	request("PUT", "/knowledge/"+doc.ID, `{"content":"intrusion"}`, "22", 403)
	request("DELETE", "/knowledge/"+root.ID, "", "22", 403)
	renamed := decode(request("PUT", "/knowledge/"+root.ID, `{"title":"重命名资料"}`, "11", 200))
	if renamed.Title != "重命名资料" || renamed.Type != "folder" {
		t.Fatal("folder rename failed")
	}
	saved := decode(request("PUT", "/knowledge/"+doc.ID, `{"title":"操作指南","content":"# 指南\n\n保存后的正文"}`, "11", 200))
	if saved.Content != "# 指南\n\n保存后的正文" || saved.ParentID == nil || *saved.ParentID != root.ID {
		t.Fatal("document save lost content or folder")
	}
	request("PUT", "/knowledge/"+doc.ID, `{"title":" "}`, "11", 400)
	if !strings.Contains(request("GET", "/knowledge", "", "11", 200).Body.String(), "保存后的正文") {
		t.Fatal("saved content not persisted in list")
	}

	out := request("GET", "/knowledge", "", "22", 200)
	if strings.Contains(out.Body.String(), root.ID) {
		t.Fatal("personal list leaked another user's nodes")
	}
	request("POST", "/knowledge", fmt.Sprintf(`{"type":"document","title":"跨用户","parentId":%q}`, root.ID), "22", 400)
	teamRoot := decode(request("POST", "/knowledge", `{"teamId":"team-a","type":"folder","title":"团队资料"}`, "11", 201))
	request("GET", "/knowledge?teamId=team-a", "", "22", 403)
	if _, err := db.Exec("INSERT INTO wiki_nodes (id,teamId,parentId,type,title,content,updatedAt) VALUES ('legacy-wiki','team-a',NULL,'document','旧 Wiki 文档','# 原有内容','2026-01-01T00:00:00Z')"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(request("GET", "/knowledge?teamId=team-a", "", "11", 200).Body.String(), "原有内容") {
		t.Fatal("legacy team wiki content was not preserved")
	}
	if _, err := db.Exec("INSERT INTO team_members (id,teamId,userId,role) VALUES ('shared-member','team-a',22,'member')"); err != nil {
		t.Fatal(err)
	}
	request("PUT", "/knowledge/legacy-wiki", `{"content":"# 团队协作编辑"}`, "22", 200)
	request("POST", "/knowledge", fmt.Sprintf(`{"teamId":"team-a","type":"document","title":"跨空间","parentId":%q}`, root.ID), "11", 400)
	request("POST", "/knowledge", `{"type":"file","title":"伪造文件"}`, "11", 400)
	file := decode(upload("说明.txt", []byte("知识库上传测试"), root.ID, "", "11", 201))
	downloaded := request("GET", "/knowledge/"+file.ID+"/file?download=1", "", "11", 200)
	if downloaded.Body.String() != "知识库上传测试" || !strings.HasPrefix(downloaded.Header().Get("Content-Disposition"), "attachment") {
		t.Fatal("file roundtrip failed")
	}
	request("GET", "/knowledge/"+file.ID+"/file", "", "22", 403)
	request("PUT", "/knowledge/"+file.ID, `{"content":"overwrite"}`, "11", 400)
	upload("unsafe.html", []byte("<script>alert(1)</script>"), "", "", "11", 400)
	upload("fake.png", []byte("not an image"), "", "", "11", 400)
	upload("fake.pdf", []byte("not a PDF"), "", "", "11", 400)
	upload("big.txt", bytes.Repeat([]byte("x"), int(knowledgeFileLimit)+1), "", "", "11", 413)
	upload("invalid.txt", []byte{0xff, 0xfe}, "", "", "11", 400)
	upload("空文件.txt", nil, "", "", "11", 413)
	upload("sample.docx", []byte("office file stored verbatim"), teamRoot.ID, "team-a", "11", 201)
	pdf := decode(upload("sample.pdf", []byte("%PDF-1.4\n%%EOF"), "", "", "11", 201))
	if result := request("GET", "/knowledge/"+pdf.ID+"/file", "", "11", 200); result.Header().Get("Content-Type") != "application/pdf" || !strings.HasPrefix(result.Header().Get("Content-Disposition"), "inline") {
		t.Fatal("PDF preview headers are incorrect")
	}
	request("DELETE", "/knowledge/"+root.ID, "", "11", 200)
	request("GET", "/knowledge/"+file.ID+"/file", "", "11", 404)
	request("PUT", "/knowledge/"+doc.ID, `{"content":"deleted"}`, "11", 404)
	if request("GET", "/knowledge?teamId=team-a", "", "11", 200).Body.String() == "[]" {
		t.Fatal("personal deletion removed team content")
	}
}
