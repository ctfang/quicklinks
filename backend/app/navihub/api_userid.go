package navihub

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func parseInt64Param(c *gin.Context, param string) (int64, bool) {
	s := strings.TrimSpace(c.Param(param))
	if s == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少路径参数"})
		return 0, false
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 id"})
		return 0, false
	}
	return v, true
}

func parseInt64Query(raw string) (int64, error) {
	return strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
}

// optionalUserIDFromJSON 接受 JSON 中的 userId 为数字、数字字符串或 null/省略，供写入 bigint 列。
func optionalUserIDFromJSON(raw json.RawMessage) (interface{}, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return nil, nil
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	switch t := v.(type) {
	case nil:
		return nil, nil
	case float64:
		return int64(t), nil
	case string:
		st := strings.TrimSpace(t)
		if st == "" {
			return nil, nil
		}
		return strconv.ParseInt(st, 10, 64)
	default:
		return nil, errors.New("invalid userId type")
	}
}
