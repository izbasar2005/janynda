package model

import "time"

// ChatAiCheckpoint tracks the last processed message IDs per patient
// so the background worker knows where to resume scanning.
type ChatAiCheckpoint struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	PatientID        uint      `gorm:"not null;uniqueIndex" json:"patient_id"`
	LastGroupMsgID   uint      `gorm:"not null;default:0" json:"last_group_msg_id"`
	LastDirectMsgID  uint      `gorm:"not null;default:0" json:"last_direct_msg_id"`
	LastCheckedAt    time.Time `json:"last_checked_at"`
}

// ChatAiAssessment stores the AI analysis result for a batch of chat messages.
type ChatAiAssessment struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PatientID  uint      `gorm:"not null;index" json:"patient_id"`
	Score      int       `json:"score"`
	Zone       string    `gorm:"type:varchar(10);not null" json:"zone"`
	KeySignals *string   `gorm:"type:text" json:"key_signals,omitempty"`
	Reasoning  *string   `gorm:"type:text" json:"reasoning,omitempty"`
	Urgent     bool      `json:"urgent"`
	SourceType string    `gorm:"type:varchar(20);not null" json:"source_type"` // group | direct | mixed
	MsgCount   int       `json:"msg_count"`
	Status     string    `gorm:"type:varchar(16);not null;default:'ready'" json:"status"` // ready | error
	Error      *string   `gorm:"type:text" json:"error,omitempty"`
	Attempts   int       `gorm:"default:0" json:"attempts"`
	AssessedAt time.Time `json:"assessed_at"`
	CreatedAt  time.Time `json:"created_at"`
}
