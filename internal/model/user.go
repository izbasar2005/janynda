package model

import "time"

type User struct {
	ID uint `gorm:"primaryKey" json:"id"`

	FullName string `gorm:"not null" json:"full_name"`
	Phone    string `gorm:"uniqueIndex;not null" json:"phone"`
	Password string `gorm:"not null" json:"-"`

	Role string `gorm:"type:varchar(20);not null;default:'patient'" json:"role"`

	AvatarURL string `gorm:"type:text" json:"avatar_url,omitempty"`

	// ✅ ЖАҢА ӨРІСТЕР (бәрі optional)
	IIN        string `gorm:"type:varchar(20)" json:"iin"`
	FirstName  string `gorm:"type:varchar(80)" json:"first_name"`
	LastName   string `gorm:"type:varchar(80)" json:"last_name"`
	Patronymic string `gorm:"type:varchar(80)" json:"patronymic"`
	Gender    string `gorm:"type:varchar(20)" json:"gender"`
	Diagnosis string `gorm:"type:text" json:"diagnosis,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}
