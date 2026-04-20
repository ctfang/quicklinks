package navihub

import (
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	jwtCookieName = "navihub_token"
	ginKeyUserID  = "authUserId"
)

var errJWTSecretMissing = errors.New("JWT_SECRET is not configured")

func jwtSecret() string {
	return strings.TrimSpace(os.Getenv("JWT_SECRET"))
}

func jwtAccessTTL() time.Duration {
	sec := 86400
	if s := strings.TrimSpace(os.Getenv("JWT_ACCESS_TTL_SECONDS")); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 && v < 365*86400 {
			sec = v
		}
	}
	return time.Duration(sec) * time.Second
}

func jwtCookieSecure() bool {
	s := strings.TrimSpace(os.Getenv("JWT_COOKIE_SECURE"))
	return s == "1" || strings.EqualFold(s, "true")
}

type navClaims struct {
	Sub string `json:"sub"`
	jwt.RegisteredClaims
}

func issueAccessToken(userID int64) (string, error) {
	secret := jwtSecret()
	if secret == "" {
		return "", errJWTSecretMissing
	}
	now := time.Now()
	claims := navClaims{
		Sub: strconv.FormatInt(userID, 10),
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(jwtAccessTTL())),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims)
	return t.SignedString([]byte(secret))
}

func setAuthCookie(c *gin.Context, token string) {
	maxAge := int(jwtAccessTTL().Seconds())
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     jwtCookieName,
		Value:    token,
		Path:     "/api",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   jwtCookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func clearAuthCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     jwtCookieName,
		Value:    "",
		Path:     "/api",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   jwtCookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func extractBearerOrCookie(c *gin.Context) string {
	auth := c.GetHeader("Authorization")
	low := strings.ToLower(auth)
	if strings.HasPrefix(low, "bearer ") {
		return strings.TrimSpace(auth[len("Bearer "):])
	}
	tok, err := c.Cookie(jwtCookieName)
	if err == nil && tok != "" {
		return tok
	}
	return ""
}

// applyJWTToContext 解析 Cookie 或 Bearer JWT，将 authUserId 写入 Gin Context（无效则为 0）。
func applyJWTToContext(c *gin.Context) {
	c.Set(ginKeyUserID, int64(0))
	raw := extractBearerOrCookie(c)
	if raw == "" {
		return
	}
	secret := jwtSecret()
	if secret == "" {
		return
	}
	var claims navClaims
	_, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		return
	}
	uid, err := strconv.ParseInt(claims.Sub, 10, 64)
	if err != nil || uid <= 0 {
		return
	}
	c.Set(ginKeyUserID, uid)
}

func authUserID(c *gin.Context) (int64, bool) {
	v, exists := c.Get(ginKeyUserID)
	if !exists {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok && id > 0
}

func requireAuthUserID(c *gin.Context) (int64, bool) {
	id, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录或令牌无效"})
		return 0, false
	}
	return id, true
}
