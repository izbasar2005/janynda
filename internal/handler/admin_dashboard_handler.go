package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
)

type AdminDashboardHandler struct {
	db *gorm.DB
}

func NewAdminDashboardHandler(db *gorm.DB) *AdminDashboardHandler {
	return &AdminDashboardHandler{db: db}
}

// StatsResponse — жалпы статистика (Top Cards)
type StatsResponse struct {
	Users        int64 `json:"users"`
	Doctors      int64 `json:"doctors"`
	Appointments int64 `json:"appointments"`
	Reviews      int64 `json:"reviews"`
}

// GET /api/v1/admin/dashboard/stats (super_admin only)
func (h *AdminDashboardHandler) Stats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var users, doctors, appointments, reviews int64

	if err := h.db.Model(&model.User{}).Count(&users).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if err := h.db.Model(&model.Doctor{}).Count(&doctors).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if err := h.db.Model(&model.Appointment{}).Count(&appointments).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if err := h.db.Model(&model.Review{}).Count(&reviews).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(StatsResponse{
		Users:        users,
		Doctors:      doctors,
		Appointments: appointments,
		Reviews:      reviews,
	})
}

// LowReviewItem — 1 жұлдыз пікір: клиент, комментарий, дәрігер
type LowReviewItem struct {
	ID        uint   `json:"id"`
	Rating    int    `json:"rating"`
	Text      string `json:"text"`
	CreatedAt string `json:"created_at"`

	PatientName string `json:"patient_name"`
	PatientPhone string `json:"patient_phone,omitempty"`

	DoctorName   string `json:"doctor_name"`
	DoctorSpecialty string `json:"doctor_specialty,omitempty"`
}

// GET /api/v1/admin/dashboard/low-reviews (super_admin only) — 1 жұлдыз пікірлер
func (h *AdminDashboardHandler) LowReviews(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var reviews []model.Review
	if err := h.db.Preload("Patient").Preload("Doctor").
		Where("rating = ?", 1).
		Order("created_at desc").
		Find(&reviews).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	doctorUserIDs := make([]uint, 0)
	for _, rev := range reviews {
		if rev.DoctorUserID != 0 {
			doctorUserIDs = append(doctorUserIDs, rev.DoctorUserID)
		}
	}
	specialtyByUserID := make(map[uint]string)
	if len(doctorUserIDs) > 0 {
		var doctors []model.Doctor
		if err := h.db.Where("user_id IN ?", doctorUserIDs).Find(&doctors).Error; err == nil {
			for _, d := range doctors {
				specialtyByUserID[d.UserID] = d.Specialty
			}
		}
	}

	list := make([]LowReviewItem, 0, len(reviews))
	for _, rev := range reviews {
		patientName := ""
		patientPhone := ""
		if rev.Patient.ID != 0 {
			patientName = rev.Patient.FullName
			patientPhone = rev.Patient.Phone
		}
		doctorName := ""
		if rev.Doctor.ID != 0 {
			doctorName = rev.Doctor.FullName
		}
		list = append(list, LowReviewItem{
			ID:            rev.ID,
			Rating:        rev.Rating,
			Text:          rev.Text,
			CreatedAt:     rev.CreatedAt.Format("2006-01-02 15:04"),
			PatientName:   patientName,
			PatientPhone:  patientPhone,
			DoctorName:    doctorName,
			DoctorSpecialty: specialtyByUserID[rev.DoctorUserID],
		})
	}

	_ = json.NewEncoder(w).Encode(list)
}

// DailyCount — күндік жазылу саны
type DailyCount struct {
	Date  string `json:"date"`  // "2006-01-02"
	Count int64  `json:"count"`
}

// GET /api/v1/admin/dashboard/appointments-daily?days=7 (super_admin only)
func (h *AdminDashboardHandler) AppointmentsDaily(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	days := 7
	if d := r.URL.Query().Get("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 && n <= 90 {
			days = n
		}
	}

	loc := time.UTC
	now := time.Now().In(loc)
	start := now.AddDate(0, 0, -days)
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, loc)

	type row struct {
		Day   string
		Count int64
	}
	var rows []row
	// Күндік топтау: created_at бойынша (жазылу қашан жасалған); UTC және бір формат
	err := h.db.Raw(
		`SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
		 FROM appointments WHERE created_at >= ?
		 GROUP BY (created_at AT TIME ZONE 'UTC')::date
		 ORDER BY day`,
		start,
	).Scan(&rows).Error
	if err != nil {
		// Егер AT TIME ZONE қолданылмаса (ескі PostgreSQL): created_at::date
		err = h.db.Raw(
			`SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
			 FROM appointments WHERE created_at >= ?
			 GROUP BY created_at::date
			 ORDER BY day`,
			start,
		).Scan(&rows).Error
	}
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	countByDate := make(map[string]int64)
	for _, r := range rows {
		countByDate[r.Day] = r.Count
	}

	result := make([]DailyCount, 0, days+1)
	for d := start; !d.After(now); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		result = append(result, DailyCount{
			Date:  key,
			Count: countByDate[key],
		})
	}

	_ = json.NewEncoder(w).Encode(result)
}

// TopDoctorItem — ең белсенді дәрігер
type TopDoctorItem struct {
	ID           uint   `json:"id"`
	DoctorName   string `json:"doctor_name"`
	Specialty    string `json:"specialty"`
	Appointments int64  `json:"appointments"`
	PhotoURL     string `json:"photo_url,omitempty"`
}

// GET /api/v1/admin/dashboard/top-doctors (super_admin only)
func (h *AdminDashboardHandler) TopDoctors(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	type row struct {
		DoctorUserID uint
		Count        int64
	}
	var rows []row
	if err := h.db.Model(&model.Appointment{}).
		Select("doctor_user_id, COUNT(*) AS count").
		Group("doctor_user_id").
		Order("count DESC").
		Scan(&rows).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	countByUser := make(map[uint]int64)
	for _, r := range rows {
		countByUser[r.DoctorUserID] = r.Count
	}
	userIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		userIDs = append(userIDs, r.DoctorUserID)
	}
	var doctors []model.Doctor
	if len(userIDs) > 0 {
		if err := h.db.Preload("User").Where("user_id IN ?", userIDs).Find(&doctors).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	}
	doctorByUser := make(map[uint]model.Doctor)
	for _, d := range doctors {
		doctorByUser[d.UserID] = d
	}
	list := make([]TopDoctorItem, 0, len(rows))
	for _, r := range rows {
		d := doctorByUser[r.DoctorUserID]
		list = append(list, TopDoctorItem{
			ID:           d.ID,
			DoctorName:   d.User.FullName,
			Specialty:    d.Specialty,
			Appointments: countByUser[r.DoctorUserID],
			PhotoURL:     d.PhotoURL,
		})
	}
	_ = json.NewEncoder(w).Encode(list)
}

// DoctorRatingItem — дәрігер рейтингі
type DoctorRatingItem struct {
	ID         uint    `json:"id"`
	DoctorName string  `json:"doctor_name"`
	Specialty  string  `json:"specialty"`
	Rating     float64 `json:"rating"`
	Reviews    int64   `json:"reviews"`
	PhotoURL   string  `json:"photo_url,omitempty"`
}

// GET /api/v1/admin/dashboard/doctor-ratings (super_admin only)
func (h *AdminDashboardHandler) DoctorRatings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	type row struct {
		DoctorUserID uint
		AvgRating    float64
		Count        int64
	}
	var rows []row
	if err := h.db.Model(&model.Review{}).
		Select("doctor_user_id, AVG(rating) AS avg_rating, COUNT(*) AS count").
		Group("doctor_user_id").
		Order("avg_rating DESC").
		Scan(&rows).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	userIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		userIDs = append(userIDs, r.DoctorUserID)
	}
	var doctors []model.Doctor
	if len(userIDs) > 0 {
		if err := h.db.Preload("User").Where("user_id IN ?", userIDs).Find(&doctors).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	}
	doctorByUser := make(map[uint]model.Doctor)
	for _, d := range doctors {
		doctorByUser[d.UserID] = d
	}
	list := make([]DoctorRatingItem, 0, len(rows))
	for _, r := range rows {
		d := doctorByUser[r.DoctorUserID]
		list = append(list, DoctorRatingItem{
			ID:         d.ID,
			DoctorName: d.User.FullName,
			Specialty:  d.Specialty,
			Rating:     r.AvgRating,
			Reviews:    r.Count,
			PhotoURL:   d.PhotoURL,
		})
	}
	_ = json.NewEncoder(w).Encode(list)
}
