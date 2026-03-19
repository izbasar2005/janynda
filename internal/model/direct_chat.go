package model

import "time"

// DirectConversation — пайдаланушы-пайдаланушы жеке чат.
type DirectConversation struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	User1ID   uint      `gorm:"not null;index;uniqueIndex:idx_direct_pair" json:"user1_id"`
	User2ID   uint      `gorm:"not null;index;uniqueIndex:idx_direct_pair" json:"user2_id"`
	CreatedAt time.Time `json:"created_at"`
}

// DirectMessage — жеке чат хабарламасы.
type DirectMessage struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	DirectConversationID uint      `gorm:"not null;index" json:"direct_conversation_id"`
	SenderUserID         uint      `gorm:"not null;index" json:"sender_user_id"`
	Body                 string    `gorm:"type:text;not null" json:"body"`
	CreatedAt            time.Time `json:"created_at"`

	SenderUser User `gorm:"foreignKey:SenderUserID" json:"sender,omitempty"`
}

// DirectChatRead — қолданушының жеке чаттағы "соңғы оқыған" хабары.
type DirectChatRead struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	UserID               uint      `gorm:"not null;index;uniqueIndex:idx_direct_read" json:"user_id"`
	DirectConversationID uint      `gorm:"not null;index;uniqueIndex:idx_direct_read" json:"direct_conversation_id"`
	LastSeenMessageID    uint      `gorm:"not null;default:0" json:"last_seen_message_id"`
	UpdatedAt            time.Time `json:"updated_at"`
}
