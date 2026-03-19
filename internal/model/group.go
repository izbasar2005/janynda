package model

import "time"

// Group — диагноз/тақырып бойынша қолдау тобы.
type Group struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"type:varchar(180);not null" json:"name"`
	Description   string    `gorm:"type:text" json:"description"`
	DiagnosisType string    `gorm:"type:varchar(120)" json:"diagnosis_type"`
	CreatedBy     uint      `gorm:"not null;index" json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}

// GroupMember — қолданушының топтағы рөлі.
type GroupMember struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	GroupID     uint      `gorm:"not null;index;uniqueIndex:idx_group_user" json:"group_id"`
	UserID      uint      `gorm:"not null;index;uniqueIndex:idx_group_user" json:"user_id"`
	RoleInGroup string    `gorm:"type:varchar(20);not null;default:'patient'" json:"role_in_group"` // patient|doctor|volunteer
	JoinedAt    time.Time `json:"joined_at"`
}

// GroupMessage — топтық чат хабарламасы.
type GroupMessage struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	GroupID    uint      `gorm:"not null;index" json:"group_id"`
	SenderID   uint      `gorm:"not null;index" json:"sender_id"`
	Body       string    `gorm:"type:text;not null" json:"body"`
	IsSystem   bool      `gorm:"default:false" json:"is_system"`
	CreatedAt  time.Time `json:"created_at"`
	SenderUser User      `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
}

// GroupChatRead — қолданушының топ чаттағы соңғы оқыған хабарламасы.
type GroupChatRead struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"not null;index;uniqueIndex:idx_group_chat_read" json:"user_id"`
	GroupID       uint      `gorm:"not null;index;uniqueIndex:idx_group_chat_read" json:"group_id"`
	LastMessageID uint      `gorm:"not null;default:0" json:"last_message_id"`
	UpdatedAt     time.Time `json:"updated_at"`
}

