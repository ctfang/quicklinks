package mail



import (

	"crypto/tls"

	"errors"

	"fmt"

	"log"

	"net"

	"net/smtp"

	"os"

	"strconv"

	"strings"

	"sync"

	"time"



	"github.com/go-home-admin/home/bootstrap/services"

)



var (

	navMu sync.RWMutex

	nav   *services.Config

)



// BindNavihub 在框架 Boot 阶段注入 config/navihub.yaml 解析结果（已含 env("…") 替换）。

func BindNavihub(c *services.Config) {

	navMu.Lock()

	nav = c

	navMu.Unlock()

}



func trimCfg(s string) string {

	s = strings.TrimSpace(s)

	s = strings.TrimPrefix(s, "\ufeff")

	s = strings.Trim(s, `"'`)

	return strings.TrimSpace(s)

}



func fromNav(key string) string {

	navMu.RLock()

	n := nav

	navMu.RUnlock()

	if n == nil {

		return ""

	}

	return trimCfg(n.GetString(key))

}



func envOnly(key string) string {

	s := strings.TrimSpace(os.Getenv(key))

	s = strings.TrimPrefix(s, "\ufeff")

	s = strings.Trim(s, `"'`)

	return strings.TrimSpace(s)

}



func smtpHost() string {

	if v := fromNav("smtp_host"); v != "" {

		return v

	}

	if v := envOnly("SMTP_HOST"); v != "" {

		return v

	}

	return "smtp.qq.com"

}



func smtpPort() string {

	if v := fromNav("smtp_port"); v != "" {

		return v

	}

	if v := envOnly("SMTP_PORT"); v != "" {

		return v

	}

	return "587"

}



func smtpUser() string {

	if v := fromNav("smtp_user"); v != "" {

		return v

	}

	return envOnly("SMTP_USER")

}



func smtpPassword() string {

	if v := fromNav("smtp_password"); v != "" {

		return v

	}

	return envOnly("SMTP_PASSWORD")

}



func smtpFrom() string {

	if v := fromNav("smtp_from"); v != "" {

		return v

	}

	if v := envOnly("SMTP_FROM"); v != "" {

		return v

	}

	return smtpUser()

}



func ConfigSummary() string {

	host := smtpHost()

	port := smtpPort()

	user := smtpUser()

	passSet := smtpPassword() != ""

	return fmt.Sprintf("host=%s port=%s user=%q password_set=%v", host, port, user, passSet)

}



func ConfigDiagnostic() string {

	return fmt.Sprintf("len_raw(SMTP_USER)=%d len_raw(SMTP_PASSWORD)=%d configured=%v | %s",

		len(envOnly("SMTP_USER")), len(envOnly("SMTP_PASSWORD")), Configured(), ConfigSummary())

}



func LogStartupSMTP() {

	log.Printf("[mail] startup SMTP: %s", ConfigDiagnostic())

	if !Configured() {

		log.Printf("[mail] WARNING: POST /api/auth/forgot-password will return 503，直到 smtp_user / smtp_password 在环境变量或 navihub 配置中为非空（见 config/navihub.yaml）")

	}

}



func LogForgotPassword503() {

	s := "[mail] forgot-password -> 503: SMTP not configured. " + ConfigDiagnostic()

	log.Print(s)

	fmt.Fprintf(os.Stderr, "%s\n", s)

}



func LogSendFailure(to string, err error) {

	log.Printf("[mail] password reset send FAILED to=%q %s", to, ConfigSummary())

	for e := err; e != nil; e = errors.Unwrap(e) {

		log.Printf("[mail]   reason: %v", e)

	}

}



func Configured() bool {

	return smtpUser() != "" && smtpPassword() != ""

}



func SendPasswordReset(toEmail, resetURL string) error {

	if !Configured() {

		return fmt.Errorf("SMTP_USER and SMTP_PASSWORD must be set")

	}

	host := smtpHost()

	port := smtpPort()

	user := smtpUser()

	pass := smtpPassword()

	from := smtpFrom()

	addr := net.JoinHostPort(host, port)

	subject := "NaviHub Password Reset"

	body := fmt.Sprintf("请点击以下链接重置密码（1 小时内有效）：\n\n%s\n\n如非本人操作请忽略此邮件。", resetURL)

	msg := []byte(fmt.Sprintf(

		"From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",

		from, toEmail, subject, body))



	timeout := smtpDialTimeout()



	if port == "465" {

		return sendSMTPImplicitTLS(host, addr, user, pass, from, toEmail, msg, timeout)

	}

	return sendSMTPStartTLS(host, addr, user, pass, from, toEmail, msg, timeout)

}

// SendPasswordResetCode 发送 6 位数字验证码邮件（用于无链接的重置流程）。
func SendPasswordResetCode(toEmail, code string) error {

	if !Configured() {

		return fmt.Errorf("SMTP_USER and SMTP_PASSWORD must be set")

	}

	host := smtpHost()

	port := smtpPort()

	user := smtpUser()

	pass := smtpPassword()

	from := smtpFrom()

	addr := net.JoinHostPort(host, port)

	subject := "NaviHub 密码重置验证码"

	body := fmt.Sprintf("您的验证码为：%s\n\n验证码 15 分钟内有效，请勿告知他人。如非本人操作请忽略此邮件。", code)

	msg := []byte(fmt.Sprintf(

		"From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",

		from, toEmail, subject, body))

	timeout := smtpDialTimeout()

	if port == "465" {

		return sendSMTPImplicitTLS(host, addr, user, pass, from, toEmail, msg, timeout)

	}

	return sendSMTPStartTLS(host, addr, user, pass, from, toEmail, msg, timeout)

}

func smtpDialTimeout() time.Duration {

	if v := fromNav("smtp_timeout_seconds"); v != "" {

		if n, err := strconv.Atoi(v); err == nil && n > 0 {

			return time.Duration(n) * time.Second

		}

	}

	if v := envOnly("SMTP_TIMEOUT_SECONDS"); v != "" {

		if n, err := strconv.Atoi(v); err == nil && n > 0 {

			return time.Duration(n) * time.Second

		}

	}

	return 30 * time.Second

}



func sendSMTPStartTLS(host, addr, user, pass, from, to string, msg []byte, dialTimeout time.Duration) error {

	d := net.Dialer{Timeout: dialTimeout}

	conn, err := d.Dial("tcp", addr)

	if err != nil {

		return fmt.Errorf("smtp dial %s: %w", addr, err)

	}



	client, err := smtp.NewClient(conn, host)

	if err != nil {

		_ = conn.Close()

		return fmt.Errorf("smtp client: %w", err)

	}

	defer func() { _ = client.Close() }()



	tlsCfg := &tls.Config{

		ServerName:         host,

		MinVersion:         tls.VersionTLS12,

		InsecureSkipVerify: false,

	}

	if err := client.StartTLS(tlsCfg); err != nil {

		return fmt.Errorf("smtp STARTTLS: %w", err)

	}



	auth := smtp.PlainAuth("", user, pass, host)

	if ok, _ := client.Extension("AUTH"); ok {

		if err := client.Auth(auth); err != nil {

			return fmt.Errorf("smtp AUTH: %w", err)

		}

	} else {

		return fmt.Errorf("smtp: server does not advertise AUTH")

	}



	if err := client.Mail(from); err != nil {

		return fmt.Errorf("smtp MAIL FROM: %w", err)

	}

	if err := client.Rcpt(to); err != nil {

		return fmt.Errorf("smtp RCPT TO: %w", err)

	}

	wc, err := client.Data()

	if err != nil {

		return fmt.Errorf("smtp DATA: %w", err)

	}

	if _, err := wc.Write(msg); err != nil {

		return err

	}

	if err := wc.Close(); err != nil {

		return err

	}

	return client.Quit()

}



func sendSMTPImplicitTLS(host, addr, user, pass, from, to string, msg []byte, dialTimeout time.Duration) error {

	tlsCfg := &tls.Config{

		ServerName:         host,

		MinVersion:         tls.VersionTLS12,

		InsecureSkipVerify: false,

	}

	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: dialTimeout}, "tcp", addr, tlsCfg)

	if err != nil {

		return fmt.Errorf("SMTP TLS dial %s: %w", addr, err)

	}



	client, err := smtp.NewClient(conn, host)

	if err != nil {

		_ = conn.Close()

		return err

	}

	defer func() { _ = client.Close() }()



	auth := smtp.PlainAuth("", user, pass, host)

	if ok, _ := client.Extension("AUTH"); ok {

		if err := client.Auth(auth); err != nil {

			return fmt.Errorf("smtp AUTH: %w", err)

		}

	} else {

		return fmt.Errorf("smtp: server does not advertise AUTH")

	}

	if err := client.Mail(from); err != nil {

		return fmt.Errorf("smtp MAIL: %w", err)

	}

	if err := client.Rcpt(to); err != nil {

		return fmt.Errorf("smtp RCPT: %w", err)

	}

	wc, err := client.Data()

	if err != nil {

		return err

	}

	if _, err := wc.Write(msg); err != nil {

		return err

	}

	if err := wc.Close(); err != nil {

		return err

	}

	return client.Quit()

}


