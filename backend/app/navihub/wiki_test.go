package navihub

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// A read-only test database exercises the real handlers without touching application data.
type wikiTestDriver struct{}
type wikiTestConn struct{ mode string }
type wikiTestRows struct {
	columns []string
	data    [][]driver.Value
}

func (wikiTestDriver) Open(mode string) (driver.Conn, error) { return &wikiTestConn{mode}, nil }
func (c *wikiTestConn) Prepare(string) (driver.Stmt, error) {
	return nil, fmt.Errorf("unexpected prepare")
}
func (c *wikiTestConn) Close() error              { return nil }
func (c *wikiTestConn) Begin() (driver.Tx, error) { return nil, fmt.Errorf("unexpected write") }
func (r *wikiTestRows) Columns() []string         { return r.columns }
func (r *wikiTestRows) Close() error              { return nil }
func (r *wikiTestRows) Next(values []driver.Value) error {
	if len(r.data) == 0 {
		return io.EOF
	}
	copy(values, r.data[0])
	r.data = r.data[1:]
	return nil
}
func (c *wikiTestConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	switch {
	case strings.HasPrefix(query, "SELECT teamId FROM wiki_nodes"):
		rows := &wikiTestRows{columns: []string{"teamId"}}
		if args[0].Value != "missing" {
			rows.data = [][]driver.Value{{"team-a"}}
		}
		return rows, nil
	case strings.HasPrefix(query, "SELECT 1 FROM team_members"):
		rows := &wikiTestRows{columns: []string{"member"}}
		if args[0].Value == "team-a" && args[1].Value == int64(11) {
			rows.data = [][]driver.Value{{int64(1)}}
		}
		return rows, nil
	case c.mode == "list" && strings.Contains(query, "LEFT(COALESCE(content,''), 128)"):
		if len(args) != 1 || args[0].Value != "team-a" {
			return nil, fmt.Errorf("missing team scope")
		}
		return &wikiTestRows{columns: []string{"id", "teamId", "parentId", "type", "title", "header", "updatedAt"}, data: [][]driver.Value{{"doc", "team-a", nil, "document", "Sheet", "quicklinks-document:v1\n{\"kind\":\"sheet\",\"sheets\":[]}", "2026-10-11"}}}, nil
	case c.mode == "detail" && strings.Contains(query, "WHERE id = ? AND teamId = ?"):
		if len(args) != 2 || args[0].Value != "doc" || args[1].Value != "team-a" {
			return nil, fmt.Errorf("missing node/team scope")
		}
		return &wikiTestRows{columns: []string{"id", "teamId", "parentId", "type", "title", "content", "updatedAt"}, data: [][]driver.Value{{"doc", "team-a", nil, "document", "Doc", strings.Repeat("正文", 100000), "2026-10-11"}}}, nil
	default:
		return nil, fmt.Errorf("unexpected query: %s", query)
	}
}
func init() { sql.Register("wiki-read-test", wikiTestDriver{}) }

func wikiRequest(t *testing.T, mode, path string, user int64) *httptest.ResponseRecorder {
	t.Helper()
	db, err := sql.Open("wiki-read-test", mode)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if user > 0 {
			c.Set(ginKeyUserID, user)
		}
	})
	router.GET("/wiki/team/:teamId", wikiList(db))
	router.GET("/wiki/:id", wikiGet(db))
	out := httptest.NewRecorder()
	router.ServeHTTP(out, httptest.NewRequest("GET", path, nil))
	return out
}

func TestWikiDirectoryOmitsContent(t *testing.T) {
	out := wikiRequest(t, "list", "/wiki/team/team-a", 11)
	if out.Code != 200 {
		t.Fatalf("status %d: %s", out.Code, out.Body.String())
	}
	var nodes []map[string]any
	if err := json.Unmarshal(out.Body.Bytes(), &nodes); err != nil {
		t.Fatal(err)
	}
	if len(nodes) != 1 || nodes[0]["documentKind"] != "sheet" {
		t.Fatalf("unexpected metadata: %v", nodes)
	}
	if _, exists := nodes[0]["content"]; exists {
		t.Fatal("directory includes document content")
	}
}
func TestWikiDetailReturnsOnlyRequestedDocument(t *testing.T) {
	out := wikiRequest(t, "detail", "/wiki/doc", 11)
	if out.Code != 200 {
		t.Fatalf("status %d: %s", out.Code, out.Body.String())
	}
	var node map[string]any
	if err := json.Unmarshal(out.Body.Bytes(), &node); err != nil {
		t.Fatal(err)
	}
	if node["id"] != "doc" || node["teamId"] != "team-a" || node["content"] != strings.Repeat("正文", 100000) {
		t.Fatal("document details are incomplete")
	}
}
func TestWikiReadPermissions(t *testing.T) {
	for _, tc := range []struct {
		path   string
		user   int64
		status int
	}{
		{"/wiki/doc", 0, 401}, {"/wiki/doc", 22, 403}, {"/wiki/missing", 11, 404},
		{"/wiki/team/team-a", 0, 401}, {"/wiki/team/team-a", 22, 403}, {"/wiki/team/team-b", 11, 403},
	} {
		t.Run(fmt.Sprintf("%s-%d", tc.path, tc.user), func(t *testing.T) {
			out := wikiRequest(t, "permissions", tc.path, tc.user)
			if out.Code != tc.status {
				t.Fatalf("status %d, want %d: %s", out.Code, tc.status, out.Body.String())
			}
			if strings.Contains(out.Body.String(), "正文") {
				t.Fatal("unauthorized content returned")
			}
		})
	}
}
