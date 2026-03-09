package handler

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
)

type AdminNewsHandler struct {
	db *gorm.DB
}

func NewAdminNewsHandler(db *gorm.DB) *AdminNewsHandler {
	return &AdminNewsHandler{db: db}
}

type NewsUpsertRequest struct {
	Title       string `json:"title"`
	Excerpt     string `json:"excerpt"`
	ContentHTML string `json:"content_html"`
	CoverURL    string `json:"cover_url"`
	Featured    bool   `json:"featured"`
	PublishedAt string `json:"published_at,omitempty"` // RFC3339, optional
}

// GET /api/v1/admin/news (admin or super_admin)
func (h *AdminNewsHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))
	if role != "admin" && role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var list []model.News
	if err := h.db.Order("published_at desc, id desc").Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

// POST /api/v1/admin/news (admin or super_admin)
func (h *AdminNewsHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))
	if role != "admin" && role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req NewsUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		http.Error(w, "title керек", http.StatusBadRequest)
		return
	}
	excerpt := strings.TrimSpace(req.Excerpt)
	content := strings.TrimSpace(req.ContentHTML)
	if content == "" {
		http.Error(w, "content_html керек", http.StatusBadRequest)
		return
	}
	cover := strings.TrimSpace(req.CoverURL)

	publishedAt := time.Now()
	if strings.TrimSpace(req.PublishedAt) != "" {
		if t, err := time.Parse(time.RFC3339, strings.TrimSpace(req.PublishedAt)); err == nil {
			publishedAt = t
		}
	}

	baseSlug := slugify(title)
	slug, err := ensureUniqueNewsSlug(h.db, baseSlug, 0)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	item := model.News{
		Title:       title,
		Slug:        slug,
		Excerpt:     excerpt,
		ContentHTML: content,
		CoverURL:    cover,
		Featured:    req.Featured,
		PublishedAt: publishedAt,
	}
	if err := h.db.Create(&item).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	if item.Featured {
		_ = h.db.Model(&model.News{}).Where("id <> ?", item.ID).Update("featured", false).Error
	}

	_ = json.NewEncoder(w).Encode(item)
}

// PUT /api/v1/admin/news/{id} (admin or super_admin)
func (h *AdminNewsHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))
	if role != "admin" && role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/news/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	var req NewsUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	var item model.News
	if err := h.db.First(&item, uint(id)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		http.Error(w, "title керек", http.StatusBadRequest)
		return
	}
	excerpt := strings.TrimSpace(req.Excerpt)
	content := strings.TrimSpace(req.ContentHTML)
	if content == "" {
		http.Error(w, "content_html керек", http.StatusBadRequest)
		return
	}
	cover := strings.TrimSpace(req.CoverURL)

	publishedAt := item.PublishedAt
	if strings.TrimSpace(req.PublishedAt) != "" {
		if t, err := time.Parse(time.RFC3339, strings.TrimSpace(req.PublishedAt)); err == nil {
			publishedAt = t
		}
	}

	// If title changed, regenerate slug to keep it aligned.
	if title != item.Title {
		baseSlug := slugify(title)
		slug, err := ensureUniqueNewsSlug(h.db, baseSlug, item.ID)
		if err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
		item.Slug = slug
	}

	item.Title = title
	item.Excerpt = excerpt
	item.ContentHTML = content
	item.CoverURL = cover
	item.Featured = req.Featured
	item.PublishedAt = publishedAt

	if err := h.db.Save(&item).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	if item.Featured {
		_ = h.db.Model(&model.News{}).Where("id <> ?", item.ID).Update("featured", false).Error
	}

	_ = json.NewEncoder(w).Encode(item)
}

// DELETE /api/v1/admin/news/{id} (admin or super_admin)
func (h *AdminNewsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodDelete {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))
	if role != "admin" && role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/news/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	if err := h.db.Delete(&model.News{}, uint(id)).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

var reNonSlug = regexp.MustCompile(`[^\p{L}\p{Nd}]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = reNonSlug.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "news"
	}
	// collapse multiple '-'
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return s
}

func ensureUniqueNewsSlug(db *gorm.DB, base string, excludeID uint) (string, error) {
	slug := base
	for i := 0; i < 1000; i++ {
		var count int64
		q := db.Model(&model.News{}).Where("slug = ?", slug)
		if excludeID > 0 {
			q = q.Where("id <> ?", excludeID)
		}
		if err := q.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return slug, nil
		}
		slug = base + "-" + strconv.Itoa(i+2)
	}
	return base + "-" + strconv.Itoa(int(time.Now().Unix())), nil
}

