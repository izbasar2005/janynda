package model

import "time"

type Review struct {
	ID uint `gorm:"primaryKey" json:"id"`

	PatientID    uint `gorm:"not null;uniqueIndex:idx_patient_doctor" json:"patient_id"`
	DoctorUserID uint `gorm:"not null;uniqueIndex:idx_patient_doctor" json:"doctor_user_id"`

	Rating int    `gorm:"not null" json:"rating"` // 1-5
	Text   string `gorm:"type:text" json:"text"`

	CreatedAt time.Time `json:"created_at"`

	Patient User `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Doctor  User `gorm:"foreignKey:DoctorUserID" json:"doctor,omitempty"`
}
