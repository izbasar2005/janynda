package model

import "time"

type Referral struct {
	ID uint `gorm:"primaryKey" json:"id"`

	PatientID    uint  `gorm:"not null;index" json:"patient_id"`
	FromDoctorID uint  `gorm:"not null;index" json:"from_doctor_id"`
	ToDoctorID   *uint `gorm:"index" json:"to_doctor_id,omitempty"`
	ToSpecialty  string `gorm:"type:varchar(120)" json:"to_specialty"`

	AppointmentID        *uint `gorm:"index" json:"appointment_id,omitempty"`
	CreatedAppointmentID *uint `gorm:"index" json:"created_appointment_id,omitempty"`

	Diagnosis string `gorm:"type:text" json:"diagnosis"`
	Notes     string `gorm:"type:text" json:"notes"`

	Status    string    `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	CreatedAt time.Time `json:"created_at"`

	Patient      *User        `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	FromDoctor   *User        `gorm:"foreignKey:FromDoctorID" json:"from_doctor,omitempty"`
	ToDoctor     *User        `gorm:"foreignKey:ToDoctorID" json:"to_doctor,omitempty"`
	Appointment  *Appointment `gorm:"foreignKey:AppointmentID" json:"appointment,omitempty"`
	BookedAppointment *Appointment `gorm:"foreignKey:CreatedAppointmentID" json:"booked_appointment,omitempty"`
}

const (
	ReferralPending   = "pending"
	ReferralBooked    = "booked"
	ReferralCompleted = "completed"
	ReferralCanceled  = "canceled"
)
