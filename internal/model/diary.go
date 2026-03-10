package model

import "time"

// DiaryEntry — пациенттің жеке күнделігіне жазбасы.
// Тек UserID иесі көре алады (және қажет кезде психолог/админ).
type DiaryEntry struct {
	ID uint `gorm:"primaryKey" json:"id"`

	UserID uint `gorm:"not null;index" json:"user_id"`

	// Көңіл-күй шкаласы 1–5 (1 — өте ауыр, 5 — жақсы).
	Mood int `gorm:"not null" json:"mood"`

	// Қысқа еркін мәтін (опционал, бірақ ИИ үшін маңызды).
	Text string `gorm:"type:text" json:"text"`

	CreatedAt time.Time `json:"created_at"`
}

