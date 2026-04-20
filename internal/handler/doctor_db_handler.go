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
	// /api/v1/doctors/{id}/reviews -> reviews
	if strings.HasSuffix(r.URL.Path, "/reviews") {
		h.DoctorReviews(w, r)
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

	loc := time.FixedZone("+05", 5*3600)
	startOfDay := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
	now := time.Now().In(loc)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	if startOfDay.Before(todayStart) {
		http.Error(w, "Өткен күнге слот берілмейді", http.StatusBadRequest)
		return
	}

	// Жұмыс уақыты: 09:00–17:00, қадам: 10 минут
	start := time.Date(day.Year(), day.Month(), day.Day(), 9, 0, 0, 0, loc)
	end := time.Date(day.Year(), day.Month(), day.Day(), 17, 0, 0, 0, loc)

	// Егер бүгін болса — өткен уақыттарды слот ретінде бермейміз.
	if startOfDay.Equal(todayStart) {
		// next10 = now дөңгелету (келесі 10 минут)
		next10 := time.Date(day.Year(), day.Month(), day.Day(), now.Hour(), now.Minute(), 0, 0, loc)
		if mod := next10.Minute() % 10; mod != 0 {
			next10 = next10.Add(time.Duration(10-mod) * time.Minute)
		}
		// Егер секундтар бар болса, бір қадам алға (көрінетін слот "өтіп кетті" болып қалмасын)
		if now.Second() > 0 || now.Nanosecond() > 0 {
			if next10.Before(now) || next10.Equal(now) {
				next10 = next10.Add(10 * time.Minute)
			}
		}
		if next10.After(start) {
			start = next10
		}
	}

	var slots []string
	for t := start; !t.After(end); t = t.Add(10 * time.Minute) {
		slots = append(slots, t.Format("15:04"))
	}

	// Дәрігердің сол күнгі занят слоттарын алу (тек pending/approved — canceled слот бос, қайта жазылуға болады)
	var taken []time.Time
	err = h.db.Model(&model.Appointment{}).
		Where("doctor_user_id = ? AND start_at >= ? AND start_at < ? AND status IN ?",
			doc.UserID,
			startOfDay,
			startOfDay.Add(24*time.Hour),
			[]string{model.StatusPending, model.StatusApproved},
		).
		Pluck("start_at", &taken).Error
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	takenSet := make(map[string]bool)
	for _, t := range taken {
		takenSet[t.In(loc).Format("15:04")] = true
	}

	free := make([]string, 0, len(slots))
	for _, s := range slots {
		if !takenSet[s] {
			free = append(free, s)
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"doctor_id":      doc.ID,
		"doctor_user_id": doc.UserID,
		"date":           day.Format("2006-01-02"),
		"slots":          free,
	})
}

// -------------------- GET /api/v1/doctors/{id}/reviews --------------------
// Пікірлер ашық, орташа рейтинг + тізім (соңғылар бірінші)
func (h *DoctorDBHandler) DoctorReviews(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	p := strings.TrimPrefix(r.URL.Path, "/api/v1/doctors/")
	p = strings.TrimSuffix(p, "/reviews")
	p = strings.TrimSuffix(p, "/")
	id, err := strconv.Atoi(p)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}
	var doc model.Doctor
	if err := h.db.First(&doc, uint(id)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "doctor not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	var reviews []model.Review
	if err := h.db.Preload("Patient").Where("doctor_user_id = ?", doc.UserID).Order("created_at desc").Find(&reviews).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	var sum int
	list := make([]map[string]any, 0, len(reviews))
	for _, rev := range reviews {
		sum += rev.Rating
		list = append(list, map[string]any{
			"id":         rev.ID,
			"rating":     rev.Rating,
			"text":       rev.Text,
			"created_at": rev.CreatedAt,
			"patient": map[string]any{
				"full_name": rev.Patient.FullName,
			},
		})
	}
	avg := 0.0
	if len(reviews) > 0 {
		avg = float64(sum) / float64(len(reviews))
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"average_rating": avg,
		"total":          len(reviews),
		"reviews":        list,
	})
}
