package model

import (
	"time"
)

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

	// ---- Gemini psychological assessment (set after create) ----
	// Stored as nullable so frontend can show "loading/error" state.
	AiStatus     *string       `gorm:"type:varchar(16)" json:"ai_status,omitempty"`
	AiScore      *int          `json:"ai_score,omitempty"`
	AiZone       *string       `gorm:"type:varchar(8)" json:"ai_zone,omitempty"`
	// JSON array (stored as text to avoid extra gorm json dependencies).
	AiKeySignals *string      `gorm:"type:text" json:"ai_key_signals,omitempty"`
	AiReasoning  *string       `json:"ai_reasoning,omitempty"`
	AiUrgent     *bool         `json:"ai_urgent,omitempty"`
	AiAssessedAt *time.Time    `json:"ai_assessed_at,omitempty"`

	// Optional: last error message if Gemini failed.
	AiError *string `json:"ai_error,omitempty"`

	// ---- Retry scheduling (AI) ----
	// How many times we already tried to assess this diary entry with AI.
	AiAttempts int `json:"ai_attempts,omitempty" gorm:"default:0"`

	// When we made the last AI attempt (success or failure).
	AiLastAttemptAt *time.Time `json:"ai_last_attempt_at,omitempty"`

	// When AI should be retried again after failure.
	AiRetryAt *time.Time `json:"ai_retry_at,omitempty"`
}

