package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
	"net/url"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
	"janymda/internal/realtime"
)

type DirectChatHandler struct {
	db  *gorm.DB
	hub *realtime.Hub
}

func NewDirectChatHandler(db *gorm.DB, hub *realtime.Hub) *DirectChatHandler {
	return &DirectChatHandler{db: db, hub: hub}
}

// /api/v1/direct-chats (GET)
func (h *DirectChatHandler) HandleRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.List(w, r)
		return
	}
	http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
}

// GET /api/v1/direct-chats
func (h *DirectChatHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	me, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if me == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	type row struct {
		ID            uint   `json:"id"`
		PeerUserID    uint   `json:"peer_user_id"`
		PeerName      string `json:"peer_name"`
		LastMessageID uint   `json:"last_message_id"`
		LastSenderID  uint   `json:"last_sender_id"`
		LastMessage   string `json:"last_message"`
		LastAt        string `json:"last_at"`
		UnreadCount   int64  `json:"unread_count"`
	}
	var rows []row
	if err := h.db.Raw(`
		SELECT
			dc.id,
			CASE WHEN dc.user1_id = ? THEN dc.user2_id ELSE dc.user1_id END AS peer_user_id,
			u.full_name AS peer_name,
			COALESCE((
				SELECT id
				FROM direct_messages
				WHERE direct_conversation_id = dc.id
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			), 0) AS last_message_id,
			COALESCE((
				SELECT sender_user_id
				FROM direct_messages
				WHERE direct_conversation_id = dc.id
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			), 0) AS last_sender_id,
			COALESCE((
				SELECT body
				FROM direct_messages
				WHERE direct_conversation_id = dc.id
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			), '') AS last_message,
			COALESCE((
				SELECT created_at
				FROM direct_messages
				WHERE direct_conversation_id = dc.id
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			)::text, dc.created_at::text) AS last_at
		FROM direct_conversations dc
		INNER JOIN users u ON u.id = CASE WHEN dc.user1_id = ? THEN dc.user2_id ELSE dc.user1_id END
		WHERE dc.user1_id = ? OR dc.user2_id = ?
		ORDER BY COALESCE((
			SELECT created_at
			FROM direct_messages
			WHERE direct_conversation_id = dc.id
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		), dc.created_at) DESC
	`, me, me, me, me).Scan(&rows).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	// unread_count есептеу (соңғы оқылған message_id бойынша)
	for i := range rows {
		var lastSeen uint
		_ = h.db.Model(&model.DirectChatRead{}).
			Select("last_seen_message_id").
			Where("user_id = ? AND direct_conversation_id = ?", me, rows[i].ID).
			Scan(&lastSeen).Error
		var c int64
		_ = h.db.Model(&model.DirectMessage{}).
			Where("direct_conversation_id = ? AND id > ? AND sender_user_id <> ?", rows[i].ID, lastSeen, me).
			Count(&c).Error
		rows[i].UnreadCount = c
	}
	_ = json.NewEncoder(w).Encode(rows)
}

// POST /api/v1/direct-chats/start
func (h *DirectChatHandler) Start(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	me, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if me == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		PeerUserID uint `json:"peer_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	if req.PeerUserID == 0 || req.PeerUserID == me {
		http.Error(w, "peer_user_id қате", http.StatusBadRequest)
		return
	}

	// Екі қолданушы бір топта болғанда ғана жеке чат ашылады.
	var cnt int64
	if err := h.db.Raw(`
		SELECT COUNT(1)
		FROM group_members gm1
		INNER JOIN group_members gm2 ON gm2.group_id = gm1.group_id
		WHERE gm1.user_id = ? AND gm2.user_id = ?
	`, me, req.PeerUserID).Scan(&cnt).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if cnt == 0 {
		http.Error(w, "Бұл адаммен чат ашу үшін бір топта болуыңыз керек", http.StatusForbidden)
		return
	}

	u1, u2 := me, req.PeerUserID
	if u1 > u2 {
		u1, u2 = u2, u1
	}

	var conv model.DirectConversation
	if err := h.db.Where("user1_id = ? AND user2_id = ?", u1, u2).First(&conv).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
		conv = model.DirectConversation{User1ID: u1, User2ID: u2}
		if err := h.db.Create(&conv).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	}

	_ = json.NewEncoder(w).Encode(conv)
}

// /api/v1/direct-chats/:id/messages (GET, POST)
func (h *DirectChatHandler) HandleWithID(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/messages") {
		if r.Method == http.MethodGet {
			h.ListMessages(w, r)
			return
		}
		if r.Method == http.MethodPost {
			h.SendMessage(w, r)
			return
		}
	}
	if strings.HasSuffix(r.URL.Path, "/read") {
		if r.Method == http.MethodPost {
			h.MarkRead(w, r)
			return
		}
	}
	http.Error(w, "Not found", http.StatusNotFound)
}

func (h *DirectChatHandler) getConvAndCheck(r *http.Request) (model.DirectConversation, uint, int, string) {
	me, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if me == 0 {
		return model.DirectConversation{}, 0, http.StatusUnauthorized, "Unauthorized"
	}
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/direct-chats/")
	idStr = strings.TrimSuffix(idStr, "/messages")
	idStr = strings.Trim(idStr, "/")
	cid, _ := strconv.ParseUint(idStr, 10, 32)
	if cid == 0 {
		return model.DirectConversation{}, 0, http.StatusBadRequest, "Invalid id"
	}
	var conv model.DirectConversation
	if err := h.db.First(&conv, uint(cid)).Error; err != nil {
		return model.DirectConversation{}, 0, http.StatusNotFound, "Not found"
	}
	if conv.User1ID != me && conv.User2ID != me {
		return model.DirectConversation{}, 0, http.StatusForbidden, "Forbidden"
	}
	return conv, me, 0, ""
}

func (h *DirectChatHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	conv, me, code, msg := h.getConvAndCheck(r)
	if code != 0 {
		http.Error(w, msg, code)
		return
	}
	peerID := conv.User1ID
	if peerID == me {
		peerID = conv.User2ID
	}
	var list []model.DirectMessage
	if err := h.db.Preload("SenderUser").Where("direct_conversation_id = ?", conv.ID).Order("created_at ASC").Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// mark as seen (last message) for current user and provide read time
	var lastSeenID uint
	var lastSeenAt time.Time
	changedRead := false
	var changedLastID uint
	var changedAt time.Time
	if len(list) > 0 {
		lastID := list[len(list)-1].ID
		var read model.DirectChatRead
		if err := h.db.Where("user_id = ? AND direct_conversation_id = ?", me, conv.ID).First(&read).Error; err != nil {
			read = model.DirectChatRead{
				UserID:               me,
				DirectConversationID: conv.ID,
				LastSeenMessageID:    lastID,
			}
			if err2 := h.db.Create(&read).Error; err2 == nil {
				changedRead = true
				changedLastID = lastID
				changedAt = read.UpdatedAt
			}
		} else if read.LastSeenMessageID < lastID {
			changedRead = true
			read.LastSeenMessageID = lastID
			if err2 := h.db.Save(&read).Error; err2 == nil {
				changedLastID = lastID
				changedAt = read.UpdatedAt
			}
		}
		lastSeenID = read.LastSeenMessageID
		lastSeenAt = read.UpdatedAt
	}

	// broadcast read progress
	if changedRead && h.hub != nil && changedLastID > 0 {
		if changedAt.IsZero() {
			changedAt = time.Now()
		}
		h.hub.Broadcast(realtime.RoomKey("direct", conv.ID), map[string]any{
			"type":    "message:read",
			"channel": "direct",
			"id":      conv.ID,
			"payload": map[string]any{
				"reader_user_id":  me,
				"last_message_id": changedLastID,
				"read_at":         changedAt,
			},
		})
	}

	// peer read state (do NOT update; just read it)
	var peerLastSeenID uint
	var peerLastSeenAt time.Time
	{
		var pr model.DirectChatRead
		if err := h.db.Where("user_id = ? AND direct_conversation_id = ?", peerID, conv.ID).First(&pr).Error; err == nil {
			peerLastSeenID = pr.LastSeenMessageID
			peerLastSeenAt = pr.UpdatedAt
		}
	}

	out := make([]map[string]any, 0, len(list))
	for _, m := range list {
		item := map[string]any{
			"id":           m.ID,
			"sender_id":   m.SenderUserID,
			"sender_name": m.SenderUser.FullName,
			"body":         m.Body,
			"created_at":  m.CreatedAt,
			"is_read":      false,
			"read_at":      nil,
			// WhatsApp-like receipt: whether the other participant has read this message
			"is_read_by_peer": false,
			"read_at_by_peer": nil,
		}
		if !lastSeenAt.IsZero() && m.ID <= lastSeenID {
			item["is_read"] = true
			item["read_at"] = lastSeenAt
		}
		if !peerLastSeenAt.IsZero() && m.ID <= peerLastSeenID {
			item["is_read_by_peer"] = true
			item["read_at_by_peer"] = peerLastSeenAt
		}
		out = append(out, item)
	}
	_ = json.NewEncoder(w).Encode(out)
}

func (h *DirectChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	conv, me, code, msg := h.getConvAndCheck(r)
	if code != 0 {
		http.Error(w, msg, code)
		return
	}
	var req struct {
		Body string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		http.Error(w, "body бос болмауы керек", http.StatusBadRequest)
		return
	}
	if len(req.Body) > 2000 {
		http.Error(w, "Хабар тым ұзын", http.StatusBadRequest)
		return
	}
	msgModel := model.DirectMessage{
		DirectConversationID: conv.ID,
		SenderUserID:         me,
		Body:                 req.Body,
	}
	if err := h.db.Create(&msgModel).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// broadcast
	if h.hub != nil {
		senderName := ""
		var u model.User
		if err := h.db.First(&u, me).Error; err == nil {
			senderName = u.FullName
		}
		h.hub.Broadcast(realtime.RoomKey("direct", conv.ID), map[string]any{
			"type":    "message:new",
			"channel": "direct",
			"id":      conv.ID,
			"payload": map[string]any{
				"id":          msgModel.ID,
				"direct_id":   msgModel.DirectConversationID,
				"sender_id":   msgModel.SenderUserID,
				"sender_name": senderName,
				"body":        msgModel.Body,
				"created_at":  msgModel.CreatedAt,
			},
		})
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(msgModel)
}

// POST /api/v1/direct-chats/:id/read
// body: { "last_message_id": 123 } (optional; if missing -> latest)
func (h *DirectChatHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	// reuse parser by faking suffix trim
	// getConvAndCheck trims /messages; here we trim /read first
	tmp := *r
	tmp.URL = new(url.URL)
	*tmp.URL = *r.URL
	tmp.URL.Path = strings.TrimSuffix(r.URL.Path, "/read") + "/messages"

	conv, me, code, msg := h.getConvAndCheck(&tmp)
	if code != 0 {
		http.Error(w, msg, code)
		return
	}

	var req struct {
		LastMessageID uint `json:"last_message_id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	lastID := req.LastMessageID
	if lastID == 0 {
		_ = h.db.Model(&model.DirectMessage{}).
			Select("COALESCE(MAX(id),0)").
			Where("direct_conversation_id = ?", conv.ID).
			Scan(&lastID).Error
	}
	if lastID == 0 {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}

	var read model.DirectChatRead
	if err := h.db.Where("user_id = ? AND direct_conversation_id = ?", me, conv.ID).First(&read).Error; err != nil {
		read = model.DirectChatRead{
			UserID:               me,
			DirectConversationID: conv.ID,
			LastSeenMessageID:    lastID,
		}
		_ = h.db.Create(&read).Error
	} else if read.LastSeenMessageID < lastID {
		read.LastSeenMessageID = lastID
		_ = h.db.Save(&read).Error
	}

	if h.hub != nil {
		h.hub.Broadcast(realtime.RoomKey("direct", conv.ID), map[string]any{
			"type":    "message:read",
			"channel": "direct",
			"id":      conv.ID,
			"payload": map[string]any{
				"reader_user_id":  me,
				"last_message_id": lastID,
				"read_at":         read.UpdatedAt,
			},
		})
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
