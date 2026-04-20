package model

import "time"

// PsychCase — кейс для психолога, создаётся автоматически при yellow/red зоне AI.
type PsychCase struct {
	ID uint `gorm:"primaryKey" json:"id"`

	PatientID      uint  `gorm:"not null;index" json:"patient_id"`
	PsychologistID *uint `gorm:"index" json:"psychologist_id,omitempty"`
	DiaryEntryID   *uint `gorm:"index" json:"diary_entry_id,omitempty"`

	// chat — FK to ChatAiAssessment when the case originates from chat messages.
	ChatAssessmentID *uint `gorm:"index" json:"chat_assessment_id,omitempty"`

	// diary | chat — where the case was triggered from.
	SourceType string `gorm:"type:varchar(20);not null;default:'diary'" json:"source_type"`

	// yellow | red — зона при создании кейса.
	Zone string `gorm:"type:varchar(10);not null" json:"zone"`

	// open | in_review | resolved | escalated
	Status string `gorm:"type:varchar(20);not null;default:'open'" json:"status"`

	AiScore int    `json:"ai_score"`
	AiZone  string `gorm:"type:varchar(10)" json:"ai_zone"`

	// Анонимный текст — для yellow зоны (психолог не видит кто это).
	AnonymousText string `gorm:"type:text" json:"anonymous_text,omitempty"`

	// Оценка и заметки психолога.
	PsychScore *int   `json:"psych_score,omitempty"`
	PsychNote  string `gorm:"type:text" json:"psych_note,omitempty"`

	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`

	Patient         *User              `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	DiaryEntry      *DiaryEntry        `gorm:"foreignKey:DiaryEntryID" json:"diary_entry,omitempty"`
	ChatAssessment  *ChatAiAssessment  `gorm:"foreignKey:ChatAssessmentID" json:"chat_assessment,omitempty"`
}
