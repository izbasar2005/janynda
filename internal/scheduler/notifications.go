package scheduler

import (
	"log"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/model"
)

// RunNotificationWorker әр минутта жазылуларды тексеріп, 15 мин және 5 мин таңдау ескертуін жасайды.
func RunNotificationWorker(db *gorm.DB) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	loc := time.FixedZone("+05", 5*3600)
	for range ticker.C {
		now := time.Now().In(loc)
		// 15 мин ескерту: start_at 15±1 мин кейін
		window15Start := now.Add(14 * time.Minute)
		window15End := now.Add(16 * time.Minute)
		// 5 мин таңдау ескертуі: start_at 2–10 мин аралығында (пациент уақытында таңдай алуы үшін)
		window5Start := now.Add(2 * time.Minute)
		window5End := now.Add(10 * time.Minute)

		var appointments []model.Appointment
		if err := db.Where("status IN ?", []string{model.StatusPending, model.StatusApproved}).
			Where("start_at >= ? AND start_at <= ?", window5Start, window15End).
			Find(&appointments).Error; err != nil {
			log.Printf("[notifications] list err: %v", err)
			continue
		}

		for _, ap := range appointments {
			startAt := ap.StartAt.In(loc)
			// 15 мин аралығы
			if (startAt.After(window15Start) || startAt.Equal(window15Start)) && startAt.Before(window15End) {
				for _, uid := range []uint{ap.PatientID, ap.DoctorUserID} {
					var exists int64
					db.Model(&model.Notification{}).Where("user_id = ? AND appointment_id = ? AND type = ?", uid, ap.ID, model.NotificationType15Min).Count(&exists)
					if exists == 0 {
						n := model.Notification{UserID: uid, AppointmentID: ap.ID, Type: model.NotificationType15Min}
						if err := db.Create(&n).Error; err != nil {
							log.Printf("[notifications] create 15min err: %v", err)
						}
					}
				}
			}
			// 5 мин таңдау аралығы
			if (startAt.After(window5Start) || startAt.Equal(window5Start)) && startAt.Before(window5End) {
				for _, uid := range []uint{ap.PatientID, ap.DoctorUserID} {
					var exists int64
					db.Model(&model.Notification{}).Where("user_id = ? AND appointment_id = ? AND type = ?", uid, ap.ID, model.NotificationType5Min).Count(&exists)
					if exists == 0 {
						n := model.Notification{UserID: uid, AppointmentID: ap.ID, Type: model.NotificationType5Min}
						if err := db.Create(&n).Error; err != nil {
							log.Printf("[notifications] create 5min err: %v", err)
						}
					}
				}
			}
		}

		// Дәрігер: кездесу уақыты басталғаннан 1 сағат өтті, әлі done емес — бір рет ескерту
		// Тек соңғы 90 күн (тарихи «ұмытылған» жазбаларға жүздеген хабарлама жібермеу үшін)
		cutoff1h := now.Add(-1 * time.Hour)
		recentStart := now.Add(-90 * 24 * time.Hour)
		var overdue []model.Appointment
		if err := db.Where("status IN ?", []string{model.StatusApproved, model.StatusPending}).
			Where("start_at <= ? AND start_at >= ?", cutoff1h, recentStart).
			Find(&overdue).Error; err != nil {
			log.Printf("[notifications] overdue list err: %v", err)
			continue
		}
		for _, ap := range overdue {
			var exists int64
			if err := db.Model(&model.Notification{}).
				Where("user_id = ? AND appointment_id = ? AND type = ?", ap.DoctorUserID, ap.ID, model.NotificationTypeDoctorIncomplete1h).
				Count(&exists).Error; err != nil {
				log.Printf("[notifications] doctor 1h exists err: %v", err)
				continue
			}
			if exists > 0 {
				continue
			}
			var p model.User
			_ = db.First(&p, ap.PatientID).Error
			pname := strings.TrimSpace(p.FullName)
			if pname == "" {
				pname = "Пациент"
			}
			msg := "Толтырылмаған жазылымыңыз бар: " + pname + " — «Қабылдау аяқталды» күйін қойып, диагноз/жазбаны тексеріңіз."
			n := model.Notification{
				UserID:        ap.DoctorUserID,
				AppointmentID: ap.ID,
				Type:          model.NotificationTypeDoctorIncomplete1h,
				Message:       msg,
			}
			if err := db.Create(&n).Error; err != nil {
				log.Printf("[notifications] create doctor_incomplete_1h err: %v", err)
			}
		}
	}
}
