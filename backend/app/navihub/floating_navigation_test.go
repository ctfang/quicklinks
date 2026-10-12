package navihub

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type floatingTestDriver struct{}
type floatingTestConn struct{ configs map[int64]string }

func (floatingTestDriver) Open(string) (driver.Conn, error) {
	return &floatingTestConn{configs: make(map[int64]string)}, nil
}
func (*floatingTestConn) Prepare(string) (driver.Stmt, error) {
	return nil, fmt.Errorf("unexpected prepare")
}
func (*floatingTestConn) Close() error              { return nil }
func (*floatingTestConn) Begin() (driver.Tx, error) { return nil, fmt.Errorf("unexpected transaction") }
func (c *floatingTestConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if query != "SELECT config FROM floating_navigation WHERE userId = ?" {
		return nil, fmt.Errorf("unexpected query")
	}
	rows := &wikiTestRows{columns: []string{"config"}}
	if config, ok := c.configs[args[0].Value.(int64)]; ok {
		rows.data = [][]driver.Value{{config}}
	}
	return rows, nil
}
func (c *floatingTestConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if !strings.HasPrefix(query, "INSERT INTO floating_navigation (userId, config)") {
		return nil, fmt.Errorf("unexpected write")
	}
	c.configs[args[0].Value.(int64)] = args[1].Value.(string)
	return driver.RowsAffected(1), nil
}
func init() { sql.Register("floating-test", floatingTestDriver{}) }

func TestFloatingNavigationAccountStorage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := sql.Open("floating-test", "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	request := func(method, body string, uid int64) *httptest.ResponseRecorder {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			if uid > 0 {
				c.Set(ginKeyUserID, uid)
			}
		})
		r.GET("/navigation/floating", floatingNavigationGet(db))
		r.PUT("/navigation/floating", floatingNavigationPut(db))
		req := httptest.NewRequest(method, "/navigation/floating", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		out := httptest.NewRecorder()
		r.ServeHTTP(out, req)
		return out
	}
	for _, method := range []string{"GET", "PUT"} {
		if out := request(method, "{}", 0); out.Code != 401 {
			t.Fatalf("guest %s: %d", method, out.Code)
		}
	}
	config := `{"leftEnabled":false,"left":[{"id":"a","title":"Example","url":"https://example.com/","icon":"Link"}],"userId":22}`
	if out := request("PUT", config, 11); out.Code != 200 {
		t.Fatalf("save: %d %s", out.Code, out.Body.String())
	}
	if out := request("GET", "", 11); out.Code != 200 || !strings.Contains(out.Body.String(), `"leftEnabled":false`) || !strings.Contains(out.Body.String(), "Example") {
		t.Fatalf("read: %s", out.Body.String())
	}
	if out := request("GET", "", 22); out.Code != 200 || out.Body.String() != "null" {
		t.Fatalf("account isolation: %s", out.Body.String())
	}
	for _, invalid := range []string{
		`{"leftEnabled":true,"left":[{"id":"a","title":"Bad","url":"javascript:alert(1)"}]}`,
		`{"leftEnabled":true,"left":[{"id":"a","title":"A","url":"https://example.com"},{"id":"a","title":"B","url":"https://example.com"}]}`,
		`{"leftEnabled":true}`,
	} {
		if out := request("PUT", invalid, 11); out.Code != 400 {
			t.Fatalf("invalid config accepted: %d", out.Code)
		}
	}
	if out := request("GET", "", 11); !strings.Contains(out.Body.String(), "Example") {
		t.Fatal("invalid save overwrote configuration")
	}
	if out := request("PUT", `{"leftEnabled":true,"left":[]}`, 11); out.Code != 200 {
		t.Fatalf("empty navigation: %d", out.Code)
	}
}
