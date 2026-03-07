package model

import "time"

// Notification — жазылу ескертуі (15 мин, 5 мин таңдау).
type Notification struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	UserID        uint       `gorm:"not null;index" json:"user_id"`
	AppointmentID uint       `gorm:"not null;index" json:"appointment_id"`
	Type          string     `gorm:"type:varchar(30);not null" json:"type"` // "15min_reminder", "5min_choice"
	Choice        string     `gorm:"type:varchar(20)" json:"choice"`        // "in_person", "chat", "video" — 5min таңдауы
	ReadAt        *time.Time `json:"read_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`

	User        User        `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Appointment Appointment `gorm:"foreignKey:AppointmentID" json:"appointment,omitempty"`
}

const (
	NotificationType15Min = "15min_reminder"
	NotificationType5Min  = "5min_choice"
	ChoiceInPerson        = "in_person"
	ChoiceChat            = "chat"
	ChoiceVideo           = "video"
)
