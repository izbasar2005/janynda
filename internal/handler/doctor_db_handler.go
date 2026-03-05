package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/model"
)

type DoctorDBHandler struct {
	db *gorm.DB
}

func NewDoctorDBHandler(db *gorm.DB) *DoctorDBHandler {
	return &DoctorDBHandler{db: db}
}

// -------- JSON Response --------
type DoctorResponse struct {
	ID         uint      `json:"id"`
	UserID     uint      `json:"user_id"`
	FullName   string    `json:"full_name"`
	Phone      string    `json:"phone"`
	Specialty  string    `json:"specialty"`
	Experience int       `json:"experience"`
	Price      int       `json:"price"`
	PhotoURL   string    `json:"photo_url"`
	Education  string    `json:"education"`
	Languages  string    `json:"languages"`
	CreatedAt  time.Time `json:"created_at"`
}

func toDoctorResponse(d model.Doctor) DoctorResponse {
	return DoctorResponse{
		ID:         d.ID,
		UserID:     d.UserID,
		FullName:   d.User.FullName,
		Phone:      d.User.Phone,
		Specialty:  d.Specialty,
		Experience: d.Experience,
		Price:      d.Price,
		PhotoURL:   d.PhotoURL,
		Education:  d.Education,
		Languages:  d.Languages,
		CreatedAt:  d.CreatedAt,
	}
}

// -------------------- GET /api/v1/doctors --------------------
func (h *DoctorDBHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var docs []model.Doctor
	if err := h.db.Preload("User").Order("id asc").Find(&docs).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	out := make([]DoctorResponse, 0, len(docs))
	for _, d := range docs {
		out = append(out, toDoctorResponse(d))
	}

	_ = json.NewEncoder(w).Encode(out)
}

// -------------------- GET /api/v1/doctors/{id} --------------------
// -------------------- GET /api/v1/doctors/{id}/slots?date=YYYY-MM-DD --------------------
func (h *DoctorDBHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// /api/v1/doctors/{id}/slots -> slots
	if strings.HasSuffix(r.URL.Path, "/slots") {
		h.Slots(w, r)
		return
	}

	// /api/v1/doctors/{id}
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/doctors/")
	idStr = strings.TrimSuffix(idStr, "/")

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	var doc model.Doctor
	if err := h.db.Preload("User").First(&doc, uint(id)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(toDoctorResponse(doc))
}

// -------------------- GET /api/v1/doctors/{id}/slots?date=YYYY-MM-DD --------------------
// {id} = doctors.id (Doctor профилі)
// appointments.doctor_user_id = doctors.user_id (UserID)
func (h *DoctorDBHandler) Slots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// /api/v1/doctors/{id}/slots
	p := strings.TrimPrefix(r.URL.Path, "/api/v1/doctors/")
	p = strings.TrimSuffix(p, "/slots")
	p = strings.TrimSuffix(p, "/")

	id, err := strconv.Atoi(p)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	// date=YYYY-MM-DD
	dateStr := strings.TrimSpace(r.URL.Query().Get("date"))
	if dateStr == "" {
		http.Error(w, "date is required", http.StatusBadRequest)
		return
	}

	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		http.Error(w, "invalid date", http.StatusBadRequest)
		return
	}

	// doctor табу
	var doc model.Doctor
	if err := h.db.First(&doc, uint(id)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "doctor not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// TODO: сенің нақты slots логикаң осы жерге келеді
	_ = json.NewEncoder(w).Encode(map[string]any{
		"doctor_id":      doc.ID,
		"doctor_user_id": doc.UserID,
		"date":           day.Format("2006-01-02"), // ✅ day қолданылды -> unused болмайды
		"slots":          []string{},
	})
}
