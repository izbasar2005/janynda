package seed

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"janymda/internal/model"
)

type SeedResult struct {
	UsersCreated   int
	DoctorsCreated int
	NewsCreated    int
}

// Seed seeds minimal required data for local/dev usage.
// It is safe to call on every startup: it only adds missing rows (idempotent).
func SeedIfEmpty(db *gorm.DB) (SeedResult, error) {
	var res SeedResult

	// Allow disabling in production.
	if isTrue(os.Getenv("DISABLE_SEED")) {
		return res, nil
	}

	tx := db.Begin()
	if tx.Error != nil {
		return res, tx.Error
	}
	defer func() {
		// If caller ignores error and panic happens, rollback.
		if r := recover(); r != nil {
			_ = tx.Rollback().Error
			panic(r)
		}
	}()

	users, err := seedUsers(tx)
	if err != nil {
		_ = tx.Rollback().Error
		return res, err
	}
	res.UsersCreated = users

	doctors, err := seedDoctors(tx)
	if err != nil {
		_ = tx.Rollback().Error
		return res, err
	}
	res.DoctorsCreated = doctors

	news, err := seedNews(tx)
	if err != nil {
		_ = tx.Rollback().Error
		return res, err
	}
	res.NewsCreated = news

	if err := seedGroups(tx); err != nil {
		_ = tx.Rollback().Error
		return res, err
	}

	if err := tx.Commit().Error; err != nil {
		return res, err
	}
	return res, nil
}

type seedUser struct {
	FullName string
	Phone    string
	Password string
	Role     string
}

func seedUsers(db *gorm.DB) (int, error) {
	items := make([]seedUser, 0, 2+10+20+5+3)

	items = append(items,
		seedUser{FullName: "Super Admin", Phone: "+70000000001", Password: "superadmin123", Role: "super_admin"},
		seedUser{FullName: "Admin", Phone: "+70000000002", Password: "admin123", Role: "admin"},
	)

	// Deterministic phones so the seeder is idempotent.
	// doctors: +70000001001..+70000001010
	for i := 1; i <= 10; i++ {
		items = append(items, seedUser{
			FullName: fmt.Sprintf("Doctor %02d", i),
			Phone:    fmt.Sprintf("+700000010%02d", i),
			Password: "doctor123",
			Role:     "doctor",
		})
	}
	// volunteers: +70000002001..+70000002005
	for i := 1; i <= 5; i++ {
		items = append(items, seedUser{
			FullName: fmt.Sprintf("Volunteer %02d", i),
			Phone:    fmt.Sprintf("+700000020%02d", i),
			Password: "volunteer123",
			Role:     "volunteer",
		})
	}
	// patients: +70000003001..+70000003020
	for i := 1; i <= 20; i++ {
		items = append(items, seedUser{
			FullName: fmt.Sprintf("Patient %02d", i),
			Phone:    fmt.Sprintf("+700000030%02d", i),
			Password: "patient123",
			Role:     "patient",
		})
	}
	// psychologists: +70000004001..+70000004003
	for i := 1; i <= 3; i++ {
		items = append(items, seedUser{
			FullName: fmt.Sprintf("Psychologist %02d", i),
			Phone:    fmt.Sprintf("+700000040%02d", i),
			Password: "psych123",
			Role:     "psychologist",
		})
	}

	// therapist doctor
	items = append(items, seedUser{
		FullName: "Терапевт Айгерім",
		Phone:    "+70000005001",
		Password: "therapist123",
		Role:     "doctor",
	})

	created := 0
	for _, it := range items {
		it.Role = strings.ToLower(strings.TrimSpace(it.Role))
		if it.Phone == "" || it.Password == "" || it.FullName == "" || it.Role == "" {
			return created, fmt.Errorf("seed user invalid: %+v", it)
		}

		var exists model.User
		err := db.Where("phone = ?", it.Phone).First(&exists).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return created, err
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(it.Password), bcrypt.DefaultCost)
		if err != nil {
			return created, err
		}
		u := model.User{
			FullName: it.FullName,
			Phone:    it.Phone,
			Password: string(hash),
			Role:     it.Role,
		}
		if err := db.Create(&u).Error; err != nil {
			return created, err
		}
		created++
	}

	return created, nil
}

func seedDoctors(db *gorm.DB) (int, error) {
	var doctors []model.User
	if err := db.Where("role = ?", "doctor").Find(&doctors).Error; err != nil {
		return 0, err
	}

	created := 0
	for _, u := range doctors {
		var prof model.Doctor
		err := db.Where("user_id = ?", u.ID).First(&prof).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return created, err
		}

		item := model.Doctor{
			UserID:     u.ID,
			Specialty:  "Психолог",
			Experience: 5,
			Price:      0,
			PhotoURL:   "",
			Education:  "Demo education",
			Languages:  "Русский, Қазақша",
		}
		if err := db.Create(&item).Error; err != nil {
			return created, err
		}
		created++
	}

	// Ensure therapist doctor profile has is_therapist=true.
	var therapistUser model.User
	if err := db.Where("phone = ?", "+70000005001").First(&therapistUser).Error; err == nil {
		var prof model.Doctor
		if err2 := db.Where("user_id = ?", therapistUser.ID).First(&prof).Error; err2 == nil {
			if !prof.IsTherapist {
				db.Model(&prof).Updates(map[string]interface{}{
					"is_therapist": true,
					"specialty":    "Терапевт",
					"experience":   12,
					"education":    "ҚазҰМУ, Жалпы медицина",
					"languages":    "Қазақша, Русский",
				})
			}
		} else if errors.Is(err2, gorm.ErrRecordNotFound) {
			item := model.Doctor{
				UserID:      therapistUser.ID,
				Specialty:   "Терапевт",
				Experience:  12,
				Price:       0,
				Education:   "ҚазҰМУ, Жалпы медицина",
				Languages:   "Қазақша, Русский",
				IsTherapist: true,
			}
			if err3 := db.Create(&item).Error; err3 != nil {
				return created, err3
			}
			created++
		}
	}

	return created, nil
}

func seedNews(db *gorm.DB) (int, error) {
	now := time.Now()
	items := []model.News{
		{
			Title:       "Добро пожаловать",
			Slug:        "welcome",
			Excerpt:     "Проект запущен локально, база заполнена демо-данными.",
			ContentHTML: "<p>Добро пожаловать! Это демо-новость, созданная автоматически при первом запуске.</p>",
			CoverURL:    "",
			Featured:    true,
			PublishedAt: now,
		},
		{
			Title:       "Как записаться к врачу",
			Slug:        "how-to-appointment",
			Excerpt:     "Короткая инструкция по записи.",
			ContentHTML: "<p>Откройте раздел врачей, выберите специалиста и создайте запись.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-time.Hour),
		},
		{
			Title:       "Правила сообщества",
			Slug:        "community-rules",
			Excerpt:     "Уважение и безопасность — главное.",
			ContentHTML: "<p>Пожалуйста, общайтесь уважительно. Нарушения могут привести к блокировке.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-2 * time.Hour),
		},
		{
			Title:       "Что делать при тревоге",
			Slug:        "anxiety-tips",
			Excerpt:     "Простые техники для самопомощи.",
			ContentHTML: "<p>Попробуйте дыхание 4-7-8, заземление 5-4-3-2-1 и короткую прогулку.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-3 * time.Hour),
		},
		{
			Title:       "Сон и психическое здоровье",
			Slug:        "sleep-and-mental-health",
			Excerpt:     "Почему сон важен и как улучшить гигиену сна.",
			ContentHTML: "<p>Ложитесь и вставайте примерно в одно время, снизьте кофеин и экранное время вечером.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-4 * time.Hour),
		},
		{
			Title:       "Как подготовиться к консультации",
			Slug:        "prepare-for-consultation",
			Excerpt:     "Что написать врачу заранее, чтобы встреча была эффективнее.",
			ContentHTML: "<p>Сформулируйте запрос, симптомы, длительность и ожидания. Возьмите список лекарств/диагнозов.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-5 * time.Hour),
		},
		{
			Title:       "Панические атаки: краткая памятка",
			Slug:        "panic-attack-guide",
			Excerpt:     "Что происходит и как себе помочь.",
			ContentHTML: "<p>Паническая атака безопасна, хоть и неприятна. Дышите медленно, сосредоточьтесь на ощущениях тела.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-6 * time.Hour),
		},
		{
			Title:       "Как поддержать близкого",
			Slug:        "support-loved-one",
			Excerpt:     "Тёплая поддержка без давления и советов.",
			ContentHTML: "<p>Слушайте, уточняйте, что нужно человеку, избегайте обесценивания и спорных советов.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-7 * time.Hour),
		},
		{
			Title:       "О приложении и данных",
			Slug:        "about-data",
			Excerpt:     "Как мы относимся к приватности и безопасности.",
			ContentHTML: "<p>Мы стараемся хранить только необходимое и показывать вам прозрачные настройки.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-8 * time.Hour),
		},
		{
			Title:       "FAQ",
			Slug:        "faq",
			Excerpt:     "Частые вопросы о работе платформы.",
			ContentHTML: "<p>Здесь можно собрать ответы: запись к врачу, отмена, уведомления, новости и т.д.</p>",
			CoverURL:    "",
			Featured:    false,
			PublishedAt: now.Add(-9 * time.Hour),
		},
	}

	created := 0
	for i := range items {
		slug := strings.ToLower(strings.TrimSpace(items[i].Slug))
		if slug == "" {
			slug = fmt.Sprintf("news-%d", i+1)
		}
		items[i].Slug = slug

		var exists model.News
		err := db.Where("slug = ?", slug).First(&exists).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return created, err
		}

		if err := db.Create(&items[i]).Error; err != nil {
			return created, err
		}
		created++

		// keep invariant: only one featured item
		if items[i].Featured {
			_ = db.Model(&model.News{}).Where("id <> ?", items[i].ID).Update("featured", false).Error
		}
	}

	return created, nil
}

func seedGroups(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.Group{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	// Find users by role for membership.
	usersByRole := func(role string, limit int) []model.User {
		var uu []model.User
		db.Where("role = ?", role).Order("id asc").Limit(limit).Find(&uu)
		return uu
	}

	doctors := usersByRole("doctor", 10)
	patients := usersByRole("patient", 20)
	volunteers := usersByRole("volunteer", 5)

	if len(doctors) == 0 || len(patients) == 0 {
		return nil
	}

	type groupDef struct {
		Name          string
		Description   string
		DiagnosisType string
		DoctorIdx     int
		PatientStart  int
		PatientEnd    int
		VolunteerIdx  int
	}

	groups := []groupDef{
		{
			Name:          "Сүт безі обыры — қолдау тобы",
			Description:   "Сүт безі обыры диагнозы қойылған әйелдерге арналған қолдау тобы. Бірге күштіміз!",
			DiagnosisType: "breast_cancer",
			DoctorIdx:     0,
			PatientStart:  0,
			PatientEnd:    7,
			VolunteerIdx:  0,
		},
		{
			Name:          "Лимфома — бірге жеңеміз",
			Description:   "Лимфома емі алып жатқан пациенттерге арналған топ. Тәжірибе бөлісу, сұрақтар, қолдау.",
			DiagnosisType: "lymphoma",
			DoctorIdx:     1,
			PatientStart:  7,
			PatientEnd:    14,
			VolunteerIdx:  1,
		},
		{
			Name:          "Өкпе обыры — үміт тобы",
			Description:   "Өкпе обыры бар пациенттер мен олардың жақындары үшін қауіпсіз орта.",
			DiagnosisType: "lung_cancer",
			DoctorIdx:     2,
			PatientStart:  14,
			PatientEnd:    20,
			VolunteerIdx:  2,
		},
	}

	now := time.Now()

	for _, gd := range groups {
		if gd.DoctorIdx >= len(doctors) {
			continue
		}
		doc := doctors[gd.DoctorIdx]

		g := model.Group{
			Name:          gd.Name,
			Description:   gd.Description,
			DiagnosisType: gd.DiagnosisType,
			CreatedBy:     doc.ID,
			CreatedAt:     now,
		}
		if err := db.Create(&g).Error; err != nil {
			return err
		}

		// Add the doctor as a member.
		db.Create(&model.GroupMember{
			GroupID: g.ID, UserID: doc.ID, RoleInGroup: "doctor", JoinedAt: now,
		})

		// Add a second doctor if available.
		if gd.DoctorIdx+3 < len(doctors) {
			db.Create(&model.GroupMember{
				GroupID: g.ID, UserID: doctors[gd.DoctorIdx+3].ID, RoleInGroup: "doctor", JoinedAt: now,
			})
		}

		// Add volunteer.
		if gd.VolunteerIdx < len(volunteers) {
			db.Create(&model.GroupMember{
				GroupID: g.ID, UserID: volunteers[gd.VolunteerIdx].ID, RoleInGroup: "volunteer", JoinedAt: now,
			})
		}

		// Add patients.
		end := gd.PatientEnd
		if end > len(patients) {
			end = len(patients)
		}
		for i := gd.PatientStart; i < end; i++ {
			db.Create(&model.GroupMember{
				GroupID: g.ID, UserID: patients[i].ID, RoleInGroup: "patient", JoinedAt: now,
			})
		}

		// Welcome system message.
		db.Create(&model.GroupMessage{
			GroupID:   g.ID,
			SenderID:  doc.ID,
			Body:      fmt.Sprintf("🏥 «%s» тобына қош келдіңіздер! Бұл жерде сіз жалғыз емессіз. Бір-бірімізді қолдайық, тәжірибе бөлісейік. Дәрігерлерге сұрақ қоюға болады.", g.Name),
			IsSystem:  true,
			CreatedAt: now,
		})

		// Add therapist to every group.
		var therapistUser model.User
		if err := db.Where("phone = ?", "+70000005001").First(&therapistUser).Error; err == nil {
			var exists model.GroupMember
			if err2 := db.Where("group_id = ? AND user_id = ?", g.ID, therapistUser.ID).First(&exists).Error; err2 != nil {
				db.Create(&model.GroupMember{
					GroupID: g.ID, UserID: therapistUser.ID, RoleInGroup: "doctor", JoinedAt: now,
				})
			}
		}
	}

	return nil
}

func isTrue(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

