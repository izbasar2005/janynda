package model

import "time"

type Doctor struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	UserID     uint   `gorm:"uniqueIndex;not null" json:"user_id"`
	Specialty  string `gorm:"not null" json:"specialty"`
	Experience int    `gorm:"not null" json:"experience"`
	Price      int    `gorm:"not null" json:"price"`

	PhotoURL    string `gorm:"not null;default:''" json:"photo_url"`
	Education   string `gorm:"not null;default:''" json:"education"`
	Languages   string `gorm:"not null;default:''" json:"languages"`
	IsTherapist bool   `gorm:"default:false" json:"is_therapist"`

	CreatedAt time.Time `json:"created_at"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
