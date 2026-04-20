package navihub

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func forbid(c *gin.Context, msg string) {
	c.JSON(http.StatusForbidden, gin.H{"error": msg})
}

func teamHasMember(db *sql.DB, teamID string, userID int64) bool {
	var x int
	err := db.QueryRow(`SELECT 1 FROM team_members WHERE teamId = ? AND userId = ? LIMIT 1`, teamID, userID).Scan(&x)
	return err == nil
}

func teamMemberIsManager(db *sql.DB, teamID string, userID int64) bool {
	var role string
	err := db.QueryRow(`SELECT role FROM team_members WHERE teamId = ? AND userId = ? LIMIT 1`, teamID, userID).Scan(&role)
	if err != nil {
		return false
	}
	return role == "owner" || role == "admin"
}

func teamOwnerID(db *sql.DB, teamID string) (int64, error) {
	var oid int64
	err := db.QueryRow(`SELECT ownerId FROM teams WHERE id = ?`, teamID).Scan(&oid)
	return oid, err
}

func projectTeamID(db *sql.DB, projectID string) (string, error) {
	var tid string
	err := db.QueryRow(`SELECT teamId FROM projects WHERE id = ?`, projectID).Scan(&tid)
	return tid, err
}

func wikiNodeTeamID(db *sql.DB, nodeID string) (string, error) {
	var tid string
	err := db.QueryRow(`SELECT teamId FROM wiki_nodes WHERE id = ?`, nodeID).Scan(&tid)
	return tid, err
}

func linkWritable(db *sql.DB, linkID string, jwtUID int64) (bool, error) {
	var u sql.NullInt64
	var teamID, projectID sql.NullString
	err := db.QueryRow(`SELECT userId, teamId, projectId FROM links WHERE id = ?`, linkID).Scan(&u, &teamID, &projectID)
	if err != nil {
		return false, err
	}
	if u.Valid {
		return u.Int64 == jwtUID, nil
	}
	if projectID.Valid && strings.TrimSpace(projectID.String) != "" {
		tid, err := projectTeamID(db, projectID.String)
		if err != nil {
			return false, err
		}
		return teamHasMember(db, tid, jwtUID), nil
	}
	if teamID.Valid && strings.TrimSpace(teamID.String) != "" {
		return teamHasMember(db, teamID.String, jwtUID), nil
	}
	return false, nil
}

func loadGroupScope(db *sql.DB, groupID string) (userID sql.NullInt64, teamID sql.NullString, projectID sql.NullString, err error) {
	err = db.QueryRow(`SELECT userId, teamId, projectId FROM `+"`groups`"+` WHERE id = ?`, groupID).Scan(&userID, &teamID, &projectID)
	return
}

func groupReadable(db *sql.DB, groupID string, jwtUID int64) (bool, error) {
	u, t, p, err := loadGroupScope(db, groupID)
	if err != nil {
		return false, err
	}
	if u.Valid {
		return u.Int64 == jwtUID, nil
	}
	if p.Valid && strings.TrimSpace(p.String) != "" {
		tid, err := projectTeamID(db, p.String)
		if err != nil {
			return false, err
		}
		return teamHasMember(db, tid, jwtUID), nil
	}
	if t.Valid && strings.TrimSpace(t.String) != "" {
		return teamHasMember(db, t.String, jwtUID), nil
	}
	return false, nil
}

func assertTeamMember(c *gin.Context, db *sql.DB, teamID string, jwtUID int64) bool {
	if !teamHasMember(db, teamID, jwtUID) {
		forbid(c, "无权访问该团队资源")
		return false
	}
	return true
}

func assertTeamManager(c *gin.Context, db *sql.DB, teamID string, jwtUID int64) bool {
	if !teamMemberIsManager(db, teamID, jwtUID) {
		forbid(c, "需要团队管理员权限")
		return false
	}
	return true
}

func assertTeamOwner(c *gin.Context, db *sql.DB, teamID string, jwtUID int64) bool {
	oid, err := teamOwnerID(db, teamID)
	if err != nil || oid != jwtUID {
		forbid(c, "仅团队创建者可执行此操作")
		return false
	}
	return true
}

// validateLinkUpdateMutation 校验 PATCH 中 userId / teamId / projectId / groupId 的变更是否被允许。
func validateLinkUpdateMutation(c *gin.Context, db *sql.DB, jwtUID int64, raw map[string]json.RawMessage) bool {
	if v, ok := raw["userId"]; ok {
		var z any
		if err := json.Unmarshal(v, &z); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
			return false
		}
		if z != nil {
			var target int64
			switch t := z.(type) {
			case float64:
				target = int64(t)
			case string:
				parsed, err := strconv.ParseInt(strings.TrimSpace(t), 10, 64)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
					return false
				}
				target = parsed
			default:
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
				return false
			}
			if target != jwtUID {
				forbid(c, "无权将链接归属到其他用户")
				return false
			}
		}
	}
	if v, ok := raw["teamId"]; ok {
		var x any
		if err := json.Unmarshal(v, &x); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid teamId"})
			return false
		}
		if x != nil {
			s, ok2 := x.(string)
			if !ok2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid teamId"})
				return false
			}
			s = strings.TrimSpace(s)
			if s != "" && !assertTeamMember(c, db, s, jwtUID) {
				return false
			}
		}
	}
	if v, ok := raw["projectId"]; ok {
		var x any
		if err := json.Unmarshal(v, &x); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid projectId"})
			return false
		}
		if x != nil {
			s, ok2 := x.(string)
			if !ok2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid projectId"})
				return false
			}
			s = strings.TrimSpace(s)
			if s != "" {
				tid, err := projectTeamID(db, s)
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{"error": "无效的项目"})
					return false
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return false
				}
				if !assertTeamMember(c, db, tid, jwtUID) {
					return false
				}
			}
		}
	}
	if v, ok := raw["groupId"]; ok {
		var x any
		if err := json.Unmarshal(v, &x); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid groupId"})
			return false
		}
		if x != nil {
			s, ok2 := x.(string)
			if !ok2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid groupId"})
				return false
			}
			s = strings.TrimSpace(s)
			if s != "" {
				okG, err := groupReadable(db, s, jwtUID)
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{"error": "无效的分组"})
					return false
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return false
				}
				if !okG {
					forbid(c, "无权使用该分组")
					return false
				}
			}
		}
	}
	return true
}
