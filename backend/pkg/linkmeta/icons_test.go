package linkmeta

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type iconTransport func(*http.Request) (*http.Response, error)

func (f iconTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func iconClient(status int, body []byte) *http.Client {
	return &http.Client{Transport: iconTransport(func(r *http.Request) (*http.Response, error) {
		content, contentType := body, "image/png"
		code := status
		if r.URL.Path == "/site" {
			content = []byte(`<html><head><title>Example</title><link rel="icon" href="/logo.png"></head></html>`)
			contentType, code = "text/html", 200
		}
		return &http.Response{StatusCode: code, Header: http.Header{"Content-Type": {contentType}}, Body: io.NopCloser(bytes.NewReader(content)), Request: r}, nil
	})}
}

func TestAutoIconDownloadAndServe(t *testing.T) {
	var body bytes.Buffer
	if err := png.Encode(&body, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	client := iconClient(200, body.Bytes())
	if _, err := cacheIcon(context.Background(), client, "https://example.com/logo.png", directory); err != nil {
		t.Fatal(err)
	}
	local := autoIcon(context.Background(), client, "https://example.com/site", directory)
	if !strings.HasPrefix(local, IconURLPrefix) {
		t.Fatalf("expected local icon, got %q", local)
	}
	file, err := os.ReadFile(filepath.Join(directory, strings.TrimPrefix(local, IconURLPrefix)))
	if err != nil || !bytes.Equal(file, body.Bytes()) {
		t.Fatalf("downloaded bytes differ: %v", err)
	}
	if again := autoIcon(context.Background(), client, "https://example.com/site", directory); again != local {
		t.Fatal("identical images should reuse the same path")
	}
	files, _ := os.ReadDir(directory)
	if len(files) != 1 {
		t.Fatalf("duplicate files: %d", len(files))
	}
	out := httptest.NewRecorder()
	serveIcon(out, httptest.NewRequest("GET", local, nil), directory)
	if out.Code != 200 || !bytes.Equal(out.Body.Bytes(), body.Bytes()) || out.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("local icon not served correctly: %d", out.Code)
	}
	for _, path := range []string{IconURLPrefix + "missing.png", IconURLPrefix + "../secret", IconURLPrefix + strings.Repeat("a", 64) + ".png"} {
		out := httptest.NewRecorder()
		serveIcon(out, httptest.NewRequest("GET", path, nil), directory)
		if out.Code != 404 {
			t.Fatalf("invalid or missing image: %s: %d", path, out.Code)
		}
	}
}

func TestAutoIconKeepsRemoteWhenDownloadFails(t *testing.T) {
	for _, scenario := range []struct {
		name   string
		status int
		body   []byte
	}{
		{"not found", 404, nil},
		{"HTML instead of image", 200, []byte("<html>not an icon</html>")},
		{"oversized", 200, bytes.Repeat([]byte("x"), maxIconBody+1)},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			directory := t.TempDir()
			icon := autoIcon(context.Background(), iconClient(scenario.status, scenario.body), "https://example.com/site", directory)
			if icon != "https://example.com/logo.png" {
				t.Fatalf("remote icon not preserved: %q", icon)
			}
			files, _ := os.ReadDir(directory)
			if len(files) != 0 {
				t.Fatal("invalid download was saved")
			}
		})
	}
}

func TestIconDownloadRejectsInvalidScheme(t *testing.T) {
	if _, err := cacheIcon(context.Background(), iconClient(200, nil), "file:///secret", t.TempDir()); err == nil {
		t.Fatal("file URL accepted")
	}
}
