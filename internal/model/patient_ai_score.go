package model

import "time"

// PatientAiScore stores the aggregated (overall) AI psychological score
// for a patient, computed from all diary and chat assessments.
type PatientAiScore struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PatientID uint      `gorm:"not null;uniqueIndex" json:"patient_id"`
	Score     int       `json:"score"`                                  // 0-100 weighted average
	Zone      string    `gorm:"type:varchar(10);not null" json:"zone"`  // green | yellow | red
	DiaryCount int      `json:"diary_count"`
	ChatCount  int      `json:"chat_count"`
	MinScore   int      `json:"min_score"`
	MaxScore   int      `json:"max_score"`
	Trend      string   `gorm:"type:varchar(12);not null;default:'stable'" json:"trend"` // improving | stable | declining
	UpdatedAt  time.Time `json:"updated_at"`
}
