package linkmeta

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const IconDirectory = "data/icons"
const IconURLPrefix = "/static/icons/"
const maxIconBody = 2 << 20

var iconFilename = regexp.MustCompile(`^[a-f0-9]{64}\.(png|jpg|gif|webp|ico)$`)

// Public requests validate each resolved address, including redirect destinations.
func publicClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, ip := range ips {
			if !ip.IP.IsGlobalUnicast() || ip.IP.IsPrivate() || ip.IP.IsLoopback() || ip.IP.IsLinkLocalUnicast() {
				return nil, fmt.Errorf("non-public website address")
			}
		}
		var dialer net.Dialer
		for _, ip := range ips {
			conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(ip.IP.String(), port))
			if err == nil {
				return conn, nil
			}
		}
		return nil, fmt.Errorf("website unavailable")
	}
	return &http.Client{Timeout: clientTimeout, Transport: transport}
}

// CacheIcon stores only recognized image bytes, with a content hash for immutable caching.
func CacheIcon(ctx context.Context, raw string) (string, error) {
	client := publicClient()
	defer client.CloseIdleConnections()
	return cacheIcon(ctx, client, raw, IconDirectory)
}

func cacheIcon(ctx context.Context, client *http.Client, raw, directory string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return "", errInvalidURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; NaviHub/1.0)")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("icon status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxIconBody+1))
	if err != nil || len(body) == 0 || len(body) > maxIconBody {
		return "", fmt.Errorf("invalid icon size")
	}
	ext := map[string]string{
		"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
		"image/webp": ".webp", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico",
	}[http.DetectContentType(body)]
	if ext == "" {
		return "", fmt.Errorf("unsupported icon format")
	}
	if err := os.MkdirAll(directory, 0755); err != nil {
		return "", err
	}
	name := fmt.Sprintf("%x%s", sha256.Sum256(body), ext)
	target := filepath.Join(directory, name)
	if _, err := os.Stat(target); err == nil {
		return IconURLPrefix + name, nil
	}
	file, err := os.CreateTemp(directory, ".icon-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(file.Name())
	_, writeErr := file.Write(body)
	closeErr := file.Close()
	if writeErr != nil {
		return "", writeErr
	}
	if closeErr != nil {
		return "", closeErr
	}
	if err := os.Rename(file.Name(), target); err != nil {
		if _, statErr := os.Stat(target); statErr != nil {
			return "", err
		}
	}
	return IconURLPrefix + name, nil
}

func AutoIcon(ctx context.Context, raw string) string {
	client := publicClient()
	defer client.CloseIdleConnections()
	return autoIcon(ctx, client, raw, IconDirectory)
}

func autoIcon(ctx context.Context, client *http.Client, raw, directory string) string {
	_, remote, _ := fetch(ctx, client, raw)
	if local, err := cacheIcon(ctx, client, remote, directory); err == nil {
		return local
	}
	if u, err := url.Parse(raw); err == nil && remote != defaultFavicon(u) {
		if local, err := cacheIcon(ctx, client, defaultFavicon(u), directory); err == nil {
			return local
		}
	}
	if u, err := url.Parse(remote); err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "" {
		return remote
	}
	return "Link"
}

func ServeIcon(w http.ResponseWriter, r *http.Request) {
	serveIcon(w, r, IconDirectory)
}

func serveIcon(w http.ResponseWriter, r *http.Request, directory string) {
	name := strings.TrimPrefix(r.URL.Path, IconURLPrefix)
	if !iconFilename.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, filepath.Join(directory, name))
}
