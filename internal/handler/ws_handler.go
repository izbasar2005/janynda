package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"gorm.io/gorm"

	"janymda/internal/auth"
	"janymda/internal/model"
	"janymda/internal/realtime"
)

type WSHandler struct {
	db  *gorm.DB
	hub *realtime.Hub
}

func NewWSHandler(db *gorm.DB, hub *realtime.Hub) *WSHandler {
	return &WSHandler{db: db, hub: hub}
}

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// dev-friendly; rely on JWT. In prod you can restrict origins.
		return true
	},
	Error: func(w http.ResponseWriter, r *http.Request, status int, reason error) {
		log.Printf("ws upgrade error status=%d err=%v ua=%q origin=%q conn=%q upgrade=%q", status, reason, r.UserAgent(), r.Header.Get("Origin"), r.Header.Get("Connection"), r.Header.Get("Upgrade"))
		http.Error(w, "WS upgrade failed", status)
	},
}

type wsIn struct {
	Type    string `json:"type"`    // subscribe|unsubscribe|ping
	Channel string `json:"channel"` // group|direct|conversation|user
	ID      uint   `json:"id"`
}

type wsOut struct {
	Type    string `json:"type"`    // message:new|message:read|chat:unread|pong|error
	Channel string `json:"channel"` // group|direct|conversation|user
	ID      uint   `json:"id"`
	Payload any    `json:"payload,omitempty"`
}

func (h *WSHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Browser WebSocket can't set Authorization headers reliably,
	// so we support query param token=... as primary auth.
	tokenStr := ""
	if q := strings.TrimSpace(r.URL.Query().Get("token")); q != "" {
		tokenStr = q
	} else if q := strings.TrimSpace(r.URL.Query().Get("access_token")); q != "" {
		tokenStr = q
	} else {
		ah := r.Header.Get("Authorization")
		if strings.HasPrefix(ah, "Bearer ") {
			tokenStr = strings.TrimSpace(strings.TrimPrefix(ah, "Bearer "))
		}
	}
	if tokenStr == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	claims, err := auth.ParseToken(tokenStr)
	if err != nil || claims == nil || claims.UserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &realtime.Client{
		UserID: claims.UserID,
		Role:   claims.Role,
		Send:   make(chan []byte, 64),
		Subs:   make(map[string]struct{}),
	}

	// Always allow a user-scoped room for personal events.
	if h.hub != nil {
		h.hub.Subscribe(realtime.RoomKey("user", claims.UserID), client)
	}

	// writer
	go func() {
		defer func() {
			_ = conn.Close()
		}()
		for msg := range client.Send {
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}()

	// reader loop
	conn.SetReadLimit(64 * 1024)
	for {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var in wsIn
		if err := json.Unmarshal(data, &in); err != nil {
			h.sendErr(client, "invalid_json")
			continue
		}
		switch strings.ToLower(strings.TrimSpace(in.Type)) {
		case "ping":
			h.send(client, wsOut{Type: "pong"})
		case "subscribe":
			h.handleSubscribe(client, in)
		case "unsubscribe":
			h.handleUnsubscribe(client, in)
		default:
			h.sendErr(client, "unknown_type")
		}
	}

	// cleanup
	if h.hub != nil {
		h.hub.UnsubscribeAll(client)
	}
	close(client.Send)
	_ = conn.Close()
}

func (h *WSHandler) send(c *realtime.Client, out wsOut) {
	if c == nil {
		return
	}
	b, _ := json.Marshal(out)
	select {
	case c.Send <- b:
	default:
	}
}

func (h *WSHandler) sendErr(c *realtime.Client, code string) {
	h.send(c, wsOut{Type: "error", Payload: map[string]any{"code": code}})
}

func (h *WSHandler) handleSubscribe(c *realtime.Client, in wsIn) {
	if h.hub == nil || c == nil {
		return
	}
	ch := strings.ToLower(strings.TrimSpace(in.Channel))
	if in.ID == 0 {
		h.sendErr(c, "missing_id")
		return
	}

	// authorize per channel
	ok := false
	switch ch {
	case "group":
		ok = h.isGroupMember(in.ID, c.UserID)
	case "direct":
		ok = h.isDirectParticipant(in.ID, c.UserID)
	case "conversation":
		ok = h.isConversationParticipant(in.ID, c.UserID)
	case "user":
		ok = in.ID == c.UserID
	default:
		h.sendErr(c, "unknown_channel")
		return
	}
	if !ok {
		h.sendErr(c, "forbidden")
		return
	}
	h.hub.Subscribe(realtime.RoomKey(ch, in.ID), c)
}

func (h *WSHandler) handleUnsubscribe(c *realtime.Client, in wsIn) {
	if h.hub == nil || c == nil {
		return
	}
	ch := strings.ToLower(strings.TrimSpace(in.Channel))
	if in.ID == 0 {
		return
	}
	h.hub.Unsubscribe(realtime.RoomKey(ch, in.ID), c)
}

func (h *WSHandler) isGroupMember(groupID uint, userID uint) bool {
	var cnt int64
	_ = h.db.Model(&model.GroupMember{}).Where("group_id = ? AND user_id = ?", groupID, userID).Count(&cnt).Error
	return cnt > 0
}

func (h *WSHandler) isDirectParticipant(convID uint, userID uint) bool {
	var dc model.DirectConversation
	if err := h.db.First(&dc, convID).Error; err != nil {
		return false
	}
	return dc.User1ID == userID || dc.User2ID == userID
}

func (h *WSHandler) isConversationParticipant(convID uint, userID uint) bool {
	var conv model.Conversation
	if err := h.db.First(&conv, convID).Error; err != nil {
		return false
	}
	return conv.PatientID == userID || conv.DoctorUserID == userID
}

