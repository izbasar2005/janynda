package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateBucket struct {
	mu       sync.Mutex
	hits     map[string][]time.Time
	max      int
	window   time.Duration
}

func newRateBucket(max int, window time.Duration) *rateBucket {
	return &rateBucket{
		hits:   make(map[string][]time.Time),
		max:    max,
		window: window,
	}
}

func (b *rateBucket) allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-b.window)

	b.mu.Lock()
	defer b.mu.Unlock()

	prev := b.hits[key]
	kept := prev[:0]
	for _, t := range prev {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= b.max {
		b.hits[key] = kept
		return false
	}
	kept = append(kept, now)
	b.hits[key] = kept
	return true
}

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		return xrip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// RateLimit returns middleware that limits requests per client IP.
func RateLimit(max int, window time.Duration) func(http.Handler) http.Handler {
	bucket := newRateBucket(max, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !bucket.allow(clientIP(r)) {
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
