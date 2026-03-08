package model

import "time"

type Appointment struct {
	ID uint `gorm:"primaryKey" json:"id"`

	PatientID uint `gorm:"not null;index" json:"patient_id"` // users.id

	// Бір дәрігерге бір уақытта бір ғана запись болсын:
	DoctorUserID uint      `gorm:"not null;index" json:"doctor_user_id"`
	StartAt      time.Time `gorm:"not null;index" json:"start_at"`

	Note      string    `gorm:"type:text" json:"note"`
	Status    string    `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	CreatedAt time.Time `json:"created_at"`

	Patient User `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Doctor  User `gorm:"foreignKey:DoctorUserID" json:"doctor,omitempty"`
}

func (Appointment) TableName() string { return "appointments" }

const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusCanceled = "canceled"
	StatusDone     = "done"
)
