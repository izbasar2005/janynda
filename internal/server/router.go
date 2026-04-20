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
	"janymda/internal/realtime"
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

	// News (public)
	newsH := handler.NewNewsHandler(db)
	mux.HandleFunc("/api/v1/news", newsH.List)
	mux.HandleFunc("/api/v1/news/home", newsH.Home)
	mux.HandleFunc("/api/v1/news/", newsH.GetBySlug)

	// ---------------- PROTECTED (JWT) ----------------

	// Profile (JWT required)
	mux.Handle("/api/v1/profile", middleware.AuthJWT(http.HandlerFunc(handler.Profile)))

	// Me (JWT required)
	mh := handler.NewMeHandler(db)
	mux.HandleFunc("/api/v1/me", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			middleware.AuthJWT(http.HandlerFunc(mh.Me)).ServeHTTP(w, r)
			return
		}
		if r.Method == http.MethodPatch || r.Method == http.MethodPut {
			middleware.AuthJWT(http.HandlerFunc(mh.Update)).ServeHTTP(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	})
	mux.HandleFunc("/api/v1/me/password", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPatch || r.Method == http.MethodPost {
			middleware.AuthJWT(http.HandlerFunc(mh.ChangePassword)).ServeHTTP(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	})

	// Users (JWT required) — безопасный get by id
	uh := handler.NewUserDBHandler(db)
	mux.Handle("/api/v1/users/", middleware.AuthJWT(http.HandlerFunc(uh.GetByID)))

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

	// PATCH .../appointments/{id}/cancel | PATCH .../appointments/{id}
	mux.Handle("/api/v1/appointments/",
		middleware.AuthJWT(http.HandlerFunc(aph.HandleWithID)),
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

	// Diary (JWT) — жеке күнделік
	dhDiary := handler.NewDiaryHandler(db)
	mux.Handle("/api/v1/diary",
		middleware.AuthJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				dhDiary.ListMy(w, r)
				return
			}
			if r.Method == http.MethodPost {
				dhDiary.Create(w, r)
				return
			}
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		})),
	)
	mux.Handle("/api/v1/diary/summary",
		middleware.AuthJWT(http.HandlerFunc(dhDiary.Summary)),
	)

	// Groups / group chat (JWT)
	hub := realtime.NewHub()
	gh := handler.NewGroupHandler(db, hub)
	mux.Handle("/api/v1/groups", middleware.AuthJWT(http.HandlerFunc(gh.HandleRoot)))
	mux.Handle("/api/v1/groups/my", middleware.AuthJWT(http.HandlerFunc(gh.ListMy)))
	mux.Handle("/api/v1/groups/candidates", middleware.AuthJWT(http.HandlerFunc(gh.ListCandidates)))
	mux.Handle("/api/v1/groups/", middleware.AuthJWT(http.HandlerFunc(gh.HandleWithID)))

	// WebSocket realtime (JWT via query token or Authorization)
	wsH := handler.NewWSHandler(db, hub)
	mux.HandleFunc("/api/v1/ws", wsH.ServeWS)

	// Conversations / chat (JWT)
	convH := handler.NewConversationHandler(db, hub)
	mux.HandleFunc("/api/v1/conversations/by-appointment/", func(w http.ResponseWriter, r *http.Request) {
		middleware.AuthJWT(http.HandlerFunc(convH.GetByAppointment)).ServeHTTP(w, r)
	})
	mux.Handle("/api/v1/conversations/", middleware.AuthJWT(http.HandlerFunc(convH.HandleWithID)))

	// Direct chats between group participants (JWT)
	directH := handler.NewDirectChatHandler(db, hub)
	mux.Handle("/api/v1/direct-chats", middleware.AuthJWT(http.HandlerFunc(directH.HandleRoot)))
	mux.Handle("/api/v1/direct-chats/start", middleware.AuthJWT(http.HandlerFunc(directH.Start)))
	mux.Handle("/api/v1/direct-chats/", middleware.AuthJWT(http.HandlerFunc(directH.HandleWithID)))

	// Referrals (JWT)
	refH := handler.NewReferralHandler(db)
	mux.Handle("/api/v1/referrals",
		middleware.AuthJWT(http.HandlerFunc(refH.Create)),
	)
	mux.Handle("/api/v1/referrals/my",
		middleware.AuthJWT(http.HandlerFunc(refH.ListMy)),
	)
	mux.Handle("/api/v1/referrals/",
		middleware.AuthJWT(http.HandlerFunc(refH.GetByID)),
	)

	// Patient AI scores (psychologist, admin, super_admin)
	psh := handler.NewPatientScoreHandler(db)
	mux.Handle("/api/v1/psych/patients",
		middleware.AuthJWT(
			middleware.PsychologistOrAdmin(http.HandlerFunc(psh.ListPatients)),
		),
	)
	mux.Handle("/api/v1/patients/",
		middleware.AuthJWT(
			middleware.PsychologistOrAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if strings.HasSuffix(r.URL.Path, "/ai-score") {
					psh.GetPatientScore(w, r)
					return
				}
				http.NotFound(w, r)
			})),
		),
	)

	// Psychologist cases (psychologist, admin, super_admin)
	pch := handler.NewPsychCaseHandler(db)
	mux.Handle("/api/v1/psych/cases",
		middleware.AuthJWT(
			middleware.PsychologistOrAdmin(http.HandlerFunc(pch.List)),
		),
	)
	mux.Handle("/api/v1/psych/cases/", middleware.AuthJWT(
		middleware.PsychologistOrAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasSuffix(r.URL.Path, "/diary") {
				pch.CaseDiary(w, r)
				return
			}
			if strings.HasSuffix(r.URL.Path, "/assign") && r.Method == http.MethodPost {
				pch.Assign(w, r)
				return
			}
			if r.Method == http.MethodPatch {
				pch.Review(w, r)
				return
			}
			pch.GetByID(w, r)
		})),
	))

	// GET /api/v1/appointments/all (super_admin only — барлық жазылулар тек супер админге)
	mux.Handle("/api/v1/appointments/all",
		middleware.AuthJWT(
			middleware.SuperAdminOnly(http.HandlerFunc(aph.All)),
		),
	)

	// Admin Users (admin + super_admin; list/update logic by role in handler)
	auh := handler.NewAdminUsersHandler(db)
	mux.Handle("/api/v1/admin/users",
		middleware.AuthJWT(
			middleware.AdminOrSuperAdmin(http.HandlerFunc(auh.List)),
		),
	)
	mux.Handle("/api/v1/admin/users/",
		middleware.AuthJWT(
			middleware.AdminOrSuperAdmin(http.HandlerFunc(auh.UpdateRole)),
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

	// Admin News (admin + super_admin)
	anh := handler.NewAdminNewsHandler(db)
	mux.HandleFunc("/api/v1/admin/news", func(w http.ResponseWriter, r *http.Request) {
		h := middleware.AuthJWT(middleware.AdminOrSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				anh.List(w, r)
				return
			}
			if r.Method == http.MethodPost {
				anh.Create(w, r)
				return
			}
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		})))
		h.ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/v1/admin/news/", func(w http.ResponseWriter, r *http.Request) {
		h := middleware.AuthJWT(middleware.AdminOrSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPut {
				anh.Update(w, r)
				return
			}
			if r.Method == http.MethodDelete {
				anh.Delete(w, r)
				return
			}
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		})))
		h.ServeHTTP(w, r)
	})

	// Admin AI scores & psych cases (admin + super_admin)
	aiAdmH := handler.NewAdminAiHandler(db)
	mux.Handle("/api/v1/admin/ai-scores",
		middleware.AuthJWT(
			middleware.AdminOrSuperAdmin(http.HandlerFunc(aiAdmH.AllScores)),
		),
	)
	mux.Handle("/api/v1/admin/psych-cases",
		middleware.AuthJWT(
			middleware.AdminOrSuperAdmin(http.HandlerFunc(aiAdmH.AllCases)),
		),
	)

	// Admin Dashboard (super_admin only) — әр эндпоинт жеке тіркелген
	dashH := handler.NewAdminDashboardHandler(db)
	mux.Handle("/api/v1/admin/dashboard/stats",
		middleware.AuthJWT(
			middleware.SuperAdminOnly(http.HandlerFunc(dashH.Stats)),
		),
	)
	mux.Handle("/api/v1/admin/dashboard/low-reviews",
		middleware.AuthJWT(
			middleware.SuperAdminOnly(http.HandlerFunc(dashH.LowReviews)),
		),
	)
	mux.Handle("/api/v1/admin/dashboard/appointments-daily",
		middleware.AuthJWT(
			middleware.SuperAdminOnly(http.HandlerFunc(dashH.AppointmentsDaily)),
		),
	)
	mux.Handle("/api/v1/admin/dashboard/top-doctors",
		middleware.AuthJWT(
			middleware.SuperAdminOnly(http.HandlerFunc(dashH.TopDoctors)),
		),
	)
	mux.Handle("/api/v1/admin/dashboard/doctor-ratings",
		middleware.AuthJWT(
			middleware.SuperAdminOnly(http.HandlerFunc(dashH.DoctorRatings)),
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
	// avatar upload can happen before login (register) so keep it optional
	mux.Handle("/api/v1/upload", middleware.OptionalAuthJWT(http.HandlerFunc(uploadH.Upload)))

	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./static/uploads"))))

	// ---------------- GLOBAL MIDDLEWARE ----------------

	chain := middleware.Recover(middleware.Logger(mux))
	// WebSocket requires http.Hijacker; bypass middleware wrappers just in case.
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/v1/ws") {
			mux.ServeHTTP(w, r)
			return
		}
		chain.ServeHTTP(w, r)
	})
}
