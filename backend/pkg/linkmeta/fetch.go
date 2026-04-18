package linkmeta

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/html"
)

const (
	maxHTMLBody   = 2 << 20
	clientTimeout = 12 * time.Second
)

var errInvalidURL = errors.New("invalid URL")

func Fetch(ctx context.Context, raw string) (title, icon string, err error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "http" && u.Scheme != "https" || u.Host == "" {
		return "", "", errInvalidURL
	}
	base := u.String()

	client := &http.Client{Timeout: clientTimeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; NaviHub/1.0; +https://github.com/ctfang/navihub)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return hostnameTitle(u), defaultFavicon(u), nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return hostnameTitle(u), defaultFavicon(u), nil
	}

	ct := resp.Header.Get("Content-Type")
	if !strings.Contains(strings.ToLower(ct), "html") && resp.ContentLength > 0 && ct != "" {
		return hostnameTitle(u), defaultFavicon(u), nil
	}

	body := io.LimitReader(resp.Body, maxHTMLBody)
	doc, err := html.Parse(body)
	if err != nil {
		return hostnameTitle(u), defaultFavicon(u), nil
	}

	t, iconHref := parseHead(doc)
	if strings.TrimSpace(t) == "" {
		t = hostnameTitle(u)
	}
	iconAbs := resolveIcon(u, iconHref)
	if iconAbs == "" {
		iconAbs = defaultFavicon(u)
	}
	return strings.TrimSpace(t), iconAbs, nil
}

func hostnameTitle(u *url.URL) string {
	h := u.Hostname()
	if h == "" {
		return "Link"
	}
	return h
}

func defaultFavicon(u *url.URL) string {
	return u.Scheme + "://" + u.Host + "/favicon.ico"
}

func findHead(n *html.Node) *html.Node {
	if n.Type == html.ElementNode && n.Data == "head" {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if h := findHead(c); h != nil {
			return h
		}
	}
	return nil
}

func parseHead(doc *html.Node) (title string, iconHref string) {
	head := findHead(doc)
	if head == nil {
		return "", ""
	}
	var plainTitle, ogTitle string
	for n := head.FirstChild; n != nil; n = n.NextSibling {
		if n.Type != html.ElementNode {
			continue
		}
		switch n.Data {
		case "title":
			t := strings.TrimSpace(collectText(n))
			if t != "" {
				plainTitle = t
			}
		case "meta":
			if strings.EqualFold(attr(n, "property"), "og:title") {
				c := strings.TrimSpace(attr(n, "content"))
				if c != "" {
					ogTitle = c
				}
			}
		case "link":
			rel := strings.ToLower(strings.TrimSpace(attr(n, "rel")))
			if rel == "icon" || rel == "shortcut icon" || rel == "apple-touch-icon" {
				href := strings.TrimSpace(attr(n, "href"))
				if href != "" && iconHref == "" {
					iconHref = href
				}
			}
		}
	}
	if ogTitle != "" {
		title = ogTitle
	} else {
		title = plainTitle
	}
	return title, iconHref
}

func collectText(n *html.Node) string {
	var b strings.Builder
	var f func(*html.Node)
	f = func(node *html.Node) {
		if node.Type == html.TextNode {
			b.WriteString(node.Data)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(n)
	return b.String()
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if strings.EqualFold(a.Key, key) {
			return a.Val
		}
	}
	return ""
}

func resolveIcon(page *url.URL, href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if strings.HasPrefix(href, "data:") {
		return href
	}
	u, err := url.Parse(href)
	if err != nil {
		return ""
	}
	if u.IsAbs() {
		return u.String()
	}
	ref := page.ResolveReference(u)
	return ref.String()
}
