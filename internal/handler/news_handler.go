package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/model"
)

type NewsHandler struct {
	db *gorm.DB
}

func NewNewsHandler(db *gorm.DB) *NewsHandler {
	return &NewsHandler{db: db}
}

// GET /api/v1/news?limit=12&offset=0
func (h *NewsHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 12
	offset := 0
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("offset")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	var list []model.News
	if err := h.db.Order("published_at desc, id desc").Limit(limit).Offset(offset).Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(list)
}

// GET /api/v1/news/{slug}
func (h *NewsHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	slug := strings.TrimPrefix(r.URL.Path, "/api/v1/news/")
	slug = strings.Trim(slug, "/")
	if slug == "" {
		http.Error(w, "Invalid slug", http.StatusBadRequest)
		return
	}

	var item model.News
	if err := h.db.Where("slug = ?", slug).First(&item).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(item)
}

type NewsHomeResponse struct {
	Featured *model.News `json:"featured"`
	Items    []model.News `json:"items"`
}

// GET /api/v1/news/home
// Returns 1 featured (latest) + 3 latest non-featured (or excluding featured).
func (h *NewsHandler) Home(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var featured model.News
	var featuredPtr *model.News
	if err := h.db.Where("featured = ?", true).Order("published_at desc, id desc").First(&featured).Error; err == nil {
		featuredPtr = &featured
	}

	q := h.db.Order("published_at desc, id desc").Limit(3)
	if featuredPtr != nil {
		q = q.Where("id <> ?", featuredPtr.ID)
	} else {
		q = h.db.Order("published_at desc, id desc").Limit(4)
	}

	var items []model.News
	if err := q.Find(&items).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// if no featured, use first as featured and rest as items(3)
	if featuredPtr == nil && len(items) > 0 {
		featured = items[0]
		featuredPtr = &featured
		if len(items) > 1 {
			items = items[1:]
			if len(items) > 3 {
				items = items[:3]
			}
		} else {
			items = []model.News{}
		}
	}

	_ = json.NewEncoder(w).Encode(NewsHomeResponse{
		Featured: featuredPtr,
		Items:    items,
	})
}

