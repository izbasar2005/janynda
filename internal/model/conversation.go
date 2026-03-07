package model

import "time"

// Conversation — дәрігер–пациент чаты, кездесуге байланысты.
type Conversation struct {
	ID            uint `gorm:"primaryKey" json:"id"`
	AppointmentID uint `gorm:"uniqueIndex:idx_conv_appointment;not null" json:"appointment_id"`
	DoctorUserID  uint `gorm:"not null;index" json:"doctor_user_id"`
	PatientID     uint `gorm:"not null;index" json:"patient_id"`
	CreatedAt     time.Time `json:"created_at"`

	Appointment Appointment `gorm:"foreignKey:AppointmentID" json:"appointment,omitempty"`
}

// Message — чат хабарламасы.
type Message struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ConversationID uint      `gorm:"not null;index" json:"conversation_id"`
	SenderUserID   uint      `gorm:"not null;index" json:"sender_user_id"`
	Body           string    `gorm:"type:text" json:"body"`
	VideoLink      string    `gorm:"type:varchar(500)" json:"video_link,omitempty"` // жүйе хабарламасы (видео сілтемесі)
	IsSystem       bool      `gorm:"default:false" json:"is_system"`
	CreatedAt      time.Time `json:"created_at"`

	Sender User `gorm:"foreignKey:SenderUserID" json:"sender,omitempty"`
}
