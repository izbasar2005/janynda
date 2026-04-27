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

	// Create some diary entries so psychologists can see patient states.
	if err := seedDiaryEntries(tx); err != nil {
		_ = tx.Rollback().Error
		return res, err
	}

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

	// Seed direct chat demo dialogs for all patients.
	if err := seedDirectChats(tx); err != nil {
		_ = tx.Rollback().Error
		return res, err
	}

	if err := tx.Commit().Error; err != nil {
		return res, err
	}
	return res, nil
}

func seedDiaryEntries(db *gorm.DB) error {
	var patients []model.User
	if err := db.Where("role = ?", "patient").Order("id asc").Find(&patients).Error; err != nil {
		return err
	}
	if len(patients) == 0 {
		return nil
	}

	now := time.Now()
	texts := []string{
		"Бүгін көңіл-күй түсіп тұр. Ұйқы қашып, ой көп. Бірақ күнді бір кішкентай қадаммен бастағым келеді.",
		"Кеше жақын адамыммен сөйлескеннен кейін жеңілдеп қалдым. Әлі де мазасыздық бар, бірақ бақылауға келеді.",
		"Емге қатысты қорқыныш бар: белгісіздік қинайды. Дем алу жаттығулары көмектескендей.",
		"Бүгін шаршау қатты. Өзімді кінәламай, демалып алуға тырысып жүрмін.",
		"Тәбет төмен. Күнде бір жылы нәрсе ішу және қысқа серуен көмектеседі екен.",
		"Бірнеше күннен бері уайым азайды. Ұйқы сәл түзелді. Кішкентай үміт пайда болды.",
	}

	// Per-patient minimum entries so the diary is never empty.
	// Idempotent: only adds missing entries for each patient.
	const perPatientMin = 6
	for i, p := range patients {
		var existing int64
		if err := db.Model(&model.DiaryEntry{}).Where("user_id = ?", p.ID).Count(&existing).Error; err != nil {
			return err
		}
		if existing >= perPatientMin {
			continue
		}

		base := now.Add(-time.Duration(10+(i%3)) * 24 * time.Hour)
		for k := int(existing); k < perPatientMin; k++ {
			mood := 2 + ((i + k) % 4) // 2..5
			if k == 0 && i%5 == 0 {
				mood = 1 // some тяжелые записи
			}
			t := texts[(i+k)%len(texts)]
			e := model.DiaryEntry{
				UserID:    p.ID,
				Mood:      mood,
				Text:      t,
				CreatedAt: base.Add(time.Duration(k*30) * time.Hour),
			}
			if err := db.Create(&e).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func seedDirectChats(db *gorm.DB) error {
	var patients []model.User
	if err := db.Where("role = ?", "patient").Order("id asc").Find(&patients).Error; err != nil {
		return err
	}
	if len(patients) == 0 {
		return nil
	}
	var volunteers []model.User
	_ = db.Where("role = ?", "volunteer").Order("id asc").Find(&volunteers).Error
	var psych []model.User
	_ = db.Where("role = ?", "psychologist").Order("id asc").Find(&psych).Error

	now := time.Now()

	ensureConv := func(a, b uint, createdAt time.Time) (model.DirectConversation, error) {
		u1, u2 := a, b
		if u1 > u2 {
			u1, u2 = u2, u1
		}
		var conv model.DirectConversation
		if err := db.Where("user1_id = ? AND user2_id = ?", u1, u2).First(&conv).Error; err == nil {
			return conv, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return model.DirectConversation{}, err
		}
		conv = model.DirectConversation{User1ID: u1, User2ID: u2, CreatedAt: createdAt}
		if err := db.Create(&conv).Error; err != nil {
			return model.DirectConversation{}, err
		}
		return conv, nil
	}

	addMsg := func(convID uint, senderID uint, body string, at time.Time) error {
		body = strings.TrimSpace(body)
		if convID == 0 || senderID == 0 || body == "" {
			return nil
		}
		return db.Create(&model.DirectMessage{
			DirectConversationID: convID,
			SenderUserID:         senderID,
			Body:                 body,
			CreatedAt:            at,
		}).Error
	}

	ensureMinMsgs := func(convID uint, min int, seed func(startAt time.Time) []model.DirectMessage) error {
		if convID == 0 {
			return nil
		}
		var c int64
		if err := db.Model(&model.DirectMessage{}).Where("direct_conversation_id = ?", convID).Count(&c).Error; err != nil {
			return err
		}
		if int(c) >= min {
			return nil
		}
		// Start after last message time if exists, else "now - 24h"
		startAt := now.Add(-24 * time.Hour)
		var last model.DirectMessage
		if err := db.Where("direct_conversation_id = ?", convID).Order("created_at DESC, id DESC").First(&last).Error; err == nil {
			startAt = last.CreatedAt.Add(5 * time.Minute)
		}
		for _, m := range seed(startAt) {
			if err := addMsg(convID, m.SenderUserID, m.Body, m.CreatedAt); err != nil {
				return err
			}
		}
		return nil
	}

	// For every patient: ensure 1 direct chat with a volunteer and 1 with a psychologist,
	// and ensure each has enough messages so chat isn't empty.
	for i, p := range patients {
		createdAt := now.Add(-time.Duration(72+i) * time.Hour)

		if len(volunteers) > 0 {
			v := volunteers[i%len(volunteers)]
			conv, err := ensureConv(p.ID, v.ID, createdAt)
			if err != nil {
				return err
			}
			if err := ensureMinMsgs(conv.ID, 6, func(startAt time.Time) []model.DirectMessage {
				return []model.DirectMessage{
					{SenderUserID: p.ID, Body: "Сәлеметсіз бе. Соңғы күндері мазасыздық күшейіп кетті, сөйлескім келеді.", CreatedAt: startAt.Add(0 * time.Minute)},
					{SenderUserID: v.ID, Body: "Сәлем! Жазғаныңыз дұрыс. Қазір қауіпсіз жердесіз бе? Қысқаша не мазалап тұр?", CreatedAt: startAt.Add(4 * time.Minute)},
					{SenderUserID: p.ID, Body: "Иә, үйдемін. Ұйқы азайып, ой тоқтамайды. Кеудем қысылып кетеді.", CreatedAt: startAt.Add(10 * time.Minute)},
					{SenderUserID: v.ID, Body: "Түсіндім. Қазір бірге қысқа қадам жасайық: 1 стақан су + 1 минут баяу тыныс.", CreatedAt: startAt.Add(16 * time.Minute)},
					{SenderUserID: p.ID, Body: "Рақмет. Қазір аздап жеңілдегендей.", CreatedAt: startAt.Add(22 * time.Minute)},
					{SenderUserID: v.ID, Body: "Жақсы. Ертеңге бір ғана мақсат: ұйқы алдында экранды азайту немесе 10 минут серуен. Қайсысы оңай?", CreatedAt: startAt.Add(30 * time.Minute)},
				}
			}); err != nil {
				return err
			}
		}

		if len(psych) > 0 {
			s := psych[i%len(psych)]
			conv, err := ensureConv(p.ID, s.ID, createdAt.Add(-2*time.Hour))
			if err != nil {
				return err
			}
			score := 3 + (i % 6)
			if err := ensureMinMsgs(conv.ID, 6, func(startAt time.Time) []model.DirectMessage {
				return []model.DirectMessage{
					{SenderUserID: s.ID, Body: "Сәлем! Мен психологпын. Қысқаша: соңғы 1 аптада ең қиын болған 2 нәрсе қандай?", CreatedAt: startAt.Add(0 * time.Minute)},
					{SenderUserID: p.ID, Body: fmt.Sprintf("Сәлем. Бүгін өзімді шамамен %d/10 сезініп тұрмын. Ұйқы және уайым көп қинайды.", score), CreatedAt: startAt.Add(8 * time.Minute)},
					{SenderUserID: s.ID, Body: "Рақмет. Ұйқы (ұйықтап кету/ояну) және уайым (қандай ойлар) туралы 2-3 сөйлеммен жазыңыз.", CreatedAt: startAt.Add(18 * time.Minute)},
					{SenderUserID: p.ID, Body: "Көбіне түнде оянып кетемін. Ойлар «бәрі жаман болып кетеді» дегенге кетіп қалады.", CreatedAt: startAt.Add(30 * time.Minute)},
					{SenderUserID: s.ID, Body: "Түсіндім. Бүгін 1 кіші эксперимент: ұйқы алдында 10 минут тыныс/релаксация. Нәтижесін ертең жазыңыз.", CreatedAt: startAt.Add(42 * time.Minute)},
					{SenderUserID: p.ID, Body: "Жақсы, жасап көремін. Рақмет.", CreatedAt: startAt.Add(55 * time.Minute)},
				}
			}); err != nil {
				return err
			}
		}
	}

	return nil
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
	// Find users by role for membership.
	usersByRole := func(role string, limit int) []model.User {
		var uu []model.User
		db.Where("role = ?", role).Order("id asc").Limit(limit).Find(&uu)
		return uu
	}

	doctors := usersByRole("doctor", 10)
	patients := usersByRole("patient", 20)
	volunteers := usersByRole("volunteer", 5)
	psychologists := usersByRole("psychologist", 3)

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

	addMemberIfMissing := func(groupID uint, userID uint, roleInGroup string) {
		if groupID == 0 || userID == 0 {
			return
		}
		roleInGroup = strings.ToLower(strings.TrimSpace(roleInGroup))
		if roleInGroup == "" {
			roleInGroup = "patient"
		}
		var c int64
		_ = db.Model(&model.GroupMember{}).
			Where("group_id = ? AND user_id = ?", groupID, userID).
			Count(&c).Error
		if c > 0 {
			return
		}
		_ = db.Create(&model.GroupMember{
			GroupID:     groupID,
			UserID:      userID,
			RoleInGroup: roleInGroup,
			JoinedAt:    now,
		}).Error
	}

	seedDemoMessagesIfEmpty := func(groupID uint, docID uint, volunteerID uint, psychologistID uint, patientIDs []uint) {
		if groupID == 0 || docID == 0 {
			return
		}
		var msgCount int64
		_ = db.Model(&model.GroupMessage{}).Where("group_id = ?", groupID).Count(&msgCount).Error
		// We already created a single welcome message above; only seed if there's nothing more.
		if msgCount > 1 {
			return
		}

		type m struct {
			Sender uint
			Body   string
			System bool
			At     time.Time
		}

		pickPatient := func(idx int) uint {
			if len(patientIDs) == 0 {
				return 0
			}
			if idx < 0 {
				idx = -idx
			}
			return patientIDs[idx%len(patientIDs)]
		}

		// Spread messages across several days so the chat looks "alive".
		base := now.Add(-6 * 24 * time.Hour)
		msgs := []m{
			{Sender: docID, Body: "Сәлем! Апталық чек-ин: бүгін өзіңізді 0–10 шкаласында қалай сезінесіз? (0 — өте қиын, 10 — өте жақсы)", System: false, At: base.Add(2 * time.Hour)},
		}

		if psychologistID != 0 {
			msgs = append(msgs,
				m{Sender: psychologistID, Body: "Сәлем, бәріне! Мен психологпын. Егер қаласаңыз, бүгін эмоцияңызды 1 сөзбен сипаттап, 0–10 шкаласында мазасыздықты бағалап жазыңыз.", System: false, At: base.Add(2*time.Hour + 20*time.Minute)},
			)
		}

		// Make the chat feel active: each patient posts a short check-in.
		feelings := []string{
			"ұйқы",
			"тәбет",
			"мазасыздық",
			"шаршау",
			"көңіл-күй",
			"қорқыныш ойлар",
			"ауырсыну",
			"емге байланысты стресс",
		}
		checkinText := func(i int) string {
			r := 3 + (i * 2 % 6) // 3..8
			topic := feelings[i%len(feelings)]
			switch i % 6 {
			case 0:
				return fmt.Sprintf("Бүгін %d/10. %s жағынан қиындық бар, бірақ өзімді ұстап тұрмын.", r, topic)
			case 1:
				return fmt.Sprintf("Менде %d/10. %s мазалайды. Топтан қолдау керек.", r, topic)
			case 2:
				return fmt.Sprintf("%d/10. Бүгін кішкентай серуен көмектесті. %s әлі де бар.", r, topic)
			case 3:
				return fmt.Sprintf("Бүгін %d/10. %s кешке қарай күшейеді.", r, topic)
			case 4:
				return fmt.Sprintf("%d/10. Кеше жақсы ұйықтадым, бүгін %s жеңілірек.", r, topic)
			default:
				return fmt.Sprintf("%d/10. Бір-екі кеңес болса жақсы болар еді, %s жағынан.", r, topic)
			}
		}
		for i, pid := range patientIDs {
			if pid == 0 {
				continue
			}
			msgs = append(msgs, m{
				Sender: pid,
				Body:   checkinText(i),
				System: false,
				At:     base.Add(time.Duration(3+i) * time.Hour),
			})
			if i%7 == 0 && psychologistID != 0 {
				msgs = append(msgs, m{
					Sender: psychologistID,
					Body:   "Рақмет бөліскеніңізге. Қысқаша сұрақ: бұл сезім қашан күшейеді (таң/күн/кеш)? Бір нәрсе триггер бола ма?",
					System: false,
					At:     base.Add(time.Duration(3+i)*time.Hour + 12*time.Minute),
				})
			}
			// Add some short replies so it looks like people talk to each other.
			if i%4 == 0 && volunteerID != 0 {
				msgs = append(msgs, m{
					Sender: volunteerID,
					Body:   "Рақмет бөліскеніңізге. Бүгін өзіңізге 1 кіші қадам таңдасақ: су/тыныс алу/10 минут ауа. Қайсысы оңайырақ?",
					System: false,
					At:     base.Add(time.Duration(4+i) * time.Hour),
				})
			}
			if i%5 == 0 {
				msgs = append(msgs, m{
					Sender: docID,
					Body:   "Түсіндім. Ертеңге бір ғана мақсат қояйық: ұйқы/тамақ/қозғалыс ішінен 1 пункт. Қайсысын таңдайсыз?",
					System: false,
					At:     base.Add(time.Duration(5+i) * time.Hour),
				})
			}
			if i%6 == 0 {
				other := pickPatient(i + 2)
				if other != 0 && other != pid {
					msgs = append(msgs, m{
						Sender: other,
						Body:   "Мен де ұқсас жағдайдан өттім. Маған күнделік жазу және қысқа серуен көмектескен еді.",
						System: false,
						At:     base.Add(time.Duration(6+i) * time.Hour),
					})
				}
			}
		}

		// Add a gentle system reminder without crisis wording.
		msgs = append(msgs, m{
			Sender: docID,
			Body:   "Еске салу: бір-бірімізге жұмсақ сөйлейік, диагноз қоймайық, кеңес берерде «маған көмектескені…» форматында жазайық.",
			System: true,
			At:     base.Add(20 * time.Hour),
		})

		for _, it := range msgs {
			if it.Sender == 0 || strings.TrimSpace(it.Body) == "" {
				continue
			}
			_ = db.Create(&model.GroupMessage{
				GroupID:   groupID,
				SenderID:  it.Sender,
				Body:      it.Body,
				IsSystem:  it.System,
				CreatedAt: it.At,
			}).Error
		}
	}

	for _, gd := range groups {
		if gd.DoctorIdx >= len(doctors) {
			continue
		}
		doc := doctors[gd.DoctorIdx]

		// Ensure group exists (by name).
		var g model.Group
		err := db.Where("name = ?", gd.Name).First(&g).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			g = model.Group{
				Name:          gd.Name,
				Description:   gd.Description,
				DiagnosisType: gd.DiagnosisType,
				CreatedBy:     doc.ID,
				CreatedAt:     now,
			}
			if err := db.Create(&g).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		// Add the doctor as a member.
		addMemberIfMissing(g.ID, doc.ID, "doctor")

		// Add a second doctor if available.
		if gd.DoctorIdx+3 < len(doctors) {
			addMemberIfMissing(g.ID, doctors[gd.DoctorIdx+3].ID, "doctor")
		}

		// Add volunteer.
		if gd.VolunteerIdx < len(volunteers) {
			addMemberIfMissing(g.ID, volunteers[gd.VolunteerIdx].ID, "volunteer")
		}

		// Add ALL patients to this group (user request: everyone in group and chatting).
		patientIDs := make([]uint, 0, len(patients))
		for i := range patients {
			addMemberIfMissing(g.ID, patients[i].ID, "patient")
			patientIDs = append(patientIDs, patients[i].ID)
		}

		// Welcome system message.
		var welcomeCount int64
		_ = db.Model(&model.GroupMessage{}).
			Where("group_id = ? AND is_system = true", g.ID).
			Count(&welcomeCount).Error
		if welcomeCount == 0 {
			_ = db.Create(&model.GroupMessage{
				GroupID:   g.ID,
				SenderID:  doc.ID,
				Body:      fmt.Sprintf("🏥 «%s» тобына қош келдіңіздер! Бұл жерде сіз жалғыз емессіз. Бір-бірімізді қолдайық, тәжірибе бөлісейік. Дәрігерлерге сұрақ қоюға болады.", g.Name),
				IsSystem:  true,
				CreatedAt: now,
			}).Error
		}

		// Add therapist to every group.
		var therapistUser model.User
		if err := db.Where("phone = ?", "+70000005001").First(&therapistUser).Error; err == nil {
			addMemberIfMissing(g.ID, therapistUser.ID, "doctor")
		}

		// Add psychologists as members (so they can open group chats in UI).
		// We use role_in_group="doctor" because the API validator supports only patient|doctor|volunteer.
		for _, p := range psychologists {
			addMemberIfMissing(g.ID, p.ID, "doctor")
		}

		// Seed richer demo conversation in group chat.
		volID := uint(0)
		if gd.VolunteerIdx < len(volunteers) {
			volID = volunteers[gd.VolunteerIdx].ID
		}
		psychID := uint(0)
		if len(psychologists) > 0 {
			psychID = psychologists[gd.DoctorIdx%len(psychologists)].ID
		}
		seedDemoMessagesIfEmpty(g.ID, doc.ID, volID, psychID, patientIDs)
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

