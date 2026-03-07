package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/handler"
	"janymda/internal/middleware"
)

func NewRouter(db *gorm.DB) http.Handler {
	mux := http.NewServeMux()

	// ---------------- HEALTH ----------------

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("OK"))
	})

	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "janymda",
		})
	})

	// ---------------- PUBLIC API ----------------

	// Doctors (public list/detail)
	dh := handler.NewDoctorDBHandler(db)
	mux.HandleFunc("/api/v1/doctors", dh.List)
	mux.HandleFunc("/api/v1/doctors/", dh.GetByID)

	// Auth (public)
	ah := handler.NewAuthHandler(db)
	mux.HandleFunc("/api/v1/auth/register", ah.Register)
	mux.HandleFunc("/api/v1/auth/login", ah.Login)

	// ---------------- PROTECTED (JWT) ----------------

	// Profile (JWT required)
	mux.Handle("/api/v1/profile", middleware.AuthJWT(http.HandlerFunc(handler.Profile)))

	// Me (JWT required)
	mh := handler.NewMeHandler(db)
	mux.Handle("/api/v1/me", middleware.AuthJWT(http.HandlerFunc(mh.Me)))

	// Appointments (JWT required)
	aph := handler.NewAppointmentHandler(db)

	// Create
	mux.Handle("/api/v1/appointments",
		middleware.AuthJWT(http.HandlerFunc(aph.Create)),
	)

	// My
	mux.Handle("/api/v1/appointments/my",
		middleware.AuthJWT(http.HandlerFunc(aph.My)),
	)

	// Cancel (соңында / болуы керек)
	mux.Handle("/api/v1/appointments/",
		middleware.AuthJWT(http.HandlerFunc(aph.Cancel)),
	)

	// Reviews (JWT, patient: create)
	revH := handler.NewReviewHandler(db)
	mux.Handle("/api/v1/reviews",
		middleware.AuthJWT(http.HandlerFunc(revH.Create)),
	)
	mux.Handle("/api/v1/reviews/my",
		middleware.AuthJWT(http.HandlerFunc(revH.My)),
	)

	// Platform feedback (GET public with optional auth for is_mine, POST JWT, DELETE JWT author or admin)
	pfh := handler.NewPlatformFeedbackHandler(db)
	mux.HandleFunc("/api/v1/feedback", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			middleware.OptionalAuthJWT(http.HandlerFunc(pfh.List)).ServeHTTP(w, r)
			return
		}
		if r.Method == http.MethodPost {
			middleware.AuthJWT(http.HandlerFunc(pfh.Create)).ServeHTTP(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	})
	mux.Handle("/api/v1/feedback/", middleware.AuthJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		pfh.Delete(w, r)
	})))

	// Notifications (JWT)
	nh := handler.NewNotificationHandler(db)
	mux.HandleFunc("/api/v1/notifications", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			middleware.AuthJWT(http.HandlerFunc(nh.List)).ServeHTTP(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	})
	mux.Handle("/api/v1/notifications/", middleware.AuthJWT(http.HandlerFunc(nh.HandleWithID)))

	// Conversations / chat (JWT)
	convH := handler.NewConversationHandler(db)
	mux.HandleFunc("/api/v1/conversations/by-appointment/", func(w http.ResponseWriter, r *http.Request) {
		middleware.AuthJWT(http.HandlerFunc(convH.GetByAppointment)).ServeHTTP(w, r)
	})
	mux.Handle("/api/v1/conversations/", middleware.AuthJWT(http.HandlerFunc(convH.HandleWithID)))

	// GET /api/v1/appointments/all (admin only)
	mux.Handle("/api/v1/appointments/all",
		middleware.AuthJWT(
			middleware.AdminOnly(http.HandlerFunc(aph.All)),
		),
	)

	// Admin Users
	auh := handler.NewAdminUsersHandler(db)
	mux.Handle("/api/v1/admin/users",
		middleware.AuthJWT(
			middleware.AdminOnly(http.HandlerFunc(auh.List)),
		),
	)
	mux.Handle("/api/v1/admin/users/",
		middleware.AuthJWT(
			middleware.AdminOnly(http.HandlerFunc(auh.UpdateRole)),
		),
	)

	// Admin Doctors
	adh := handler.NewAdminDoctorsHandler(db)
	mux.Handle("/api/v1/admin/doctor-users",
		middleware.AuthJWT(
			middleware.AdminOnly(http.HandlerFunc(adh.ListDoctorUsers)),
		),
	)
	mux.Handle("/api/v1/admin/doctors",
		middleware.AuthJWT(
			middleware.AdminOnly(http.HandlerFunc(adh.CreateDoctorProfile)),
		),
	)
	mux.Handle("/api/v1/admin/doctors/",
		middleware.AuthJWT(
			middleware.AdminOnly(http.HandlerFunc(adh.UpdateDoctorProfile)),
		),
	)

	// ---------------- FRONTEND (React SPA) ----------------
	// React build: ./static/index.html және ./static/assets/*

	staticDir := "./static"
	fileServer := http.FileServer(http.Dir(staticDir))

	// Нақты статикалық файлдар (assets, favicon т.б.)
	mux.Handle("/assets/", fileServer)
	mux.Handle("/favicon.ico", fileServer)

	// SPA fallback: /login, /doctors, /profile сияқты route-тарда index.html беру
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Қауіпсіздік: /api/* бұған түспейді (бәрі жоғарыда тіркелген),
		// бірақ сақтық үшін:
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// URL -> файл жолы: "./static" + "/something"
		// Мысалы: /assets/index-xxx.js -> ./static/assets/index-xxx.js
		reqPath := filepath.Clean(r.URL.Path)
		fullPath := filepath.Join(staticDir, strings.TrimPrefix(reqPath, "/"))

		// Егер нақты файл бар болса, соны бер
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Әйтпесе React index.html бер (SPA routes)
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})

	uploadH := handler.NewUploadHandler()

	// мысалы:
	mux.Handle("/api/v1/upload", middleware.AuthJWT(http.HandlerFunc(uploadH.Upload)))

	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./static/uploads"))))

	// ---------------- GLOBAL MIDDLEWARE ----------------

	var h http.Handler = mux
	h = middleware.Logger(h)
	h = middleware.Recover(h)

	return h
}
