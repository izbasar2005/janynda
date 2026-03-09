package model

import "time"

// News — жаңалық/мақала (HTML контент).
type News struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Title       string `gorm:"not null" json:"title"`
	Slug        string `gorm:"uniqueIndex;not null" json:"slug"`
	Excerpt     string `gorm:"type:text;not null;default:''" json:"excerpt"`
	ContentHTML string `gorm:"type:text;not null" json:"content_html"`
	CoverURL    string `gorm:"type:text;not null;default:''" json:"cover_url"`

	Featured bool      `gorm:"not null;default:false" json:"featured"`
	PublishedAt time.Time `gorm:"not null;index" json:"published_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

