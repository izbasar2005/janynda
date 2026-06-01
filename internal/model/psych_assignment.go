package model

import (
	"time"

	"gorm.io/gorm"
)

// PsychAssignment — закрепление пациента за конкретным психологом.
// Распределение делает главный психолог (head_psychologist).
// Один пациент закреплён максимум за одним психологом (uniqueIndex по PatientID).
type PsychAssignment struct {
	ID             uint `gorm:"primaryKey" json:"id"`
	PatientID      uint `gorm:"uniqueIndex;not null" json:"patient_id"`
	PsychologistID uint `gorm:"index;not null" json:"psychologist_id"`
	AssignedBy     uint `gorm:"index" json:"assigned_by"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AssignedPsychologistID возвращает ID психолога, закреплённого за пациентом,
// либо nil, если пациент ещё не распределён.
func AssignedPsychologistID(db *gorm.DB, patientID uint) *uint {
	var a PsychAssignment
	if err := db.Select("psychologist_id").Where("patient_id = ?", patientID).First(&a).Error; err != nil {
		return nil
	}
	pid := a.PsychologistID
	return &pid
}

// AssignedPatientIDs возвращает список ID пациентов, закреплённых за психологом.
func AssignedPatientIDs(db *gorm.DB, psychologistID uint) []uint {
	var rows []PsychAssignment
	if err := db.Select("patient_id").Where("psychologist_id = ?", psychologistID).Find(&rows).Error; err != nil {
		return nil
	}
	ids := make([]uint, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.PatientID)
	}
	return ids
}
