package navihub

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

func authMe(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := requireAuthUserID(c)
		if !ok {
			return
		}
		var u userPublic
		err := db.QueryRow(`SELECT id, name, email, avatar FROM users WHERE id = ?`, uid).Scan(&u.ID, &u.Name, &u.Email, &u.Avatar)
		if err == sql.ErrNoRows {
			clearAuthCookie(c)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, u)
	}
}

func authLogout(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_ = db
		clearAuthCookie(c)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
