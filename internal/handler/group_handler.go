package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
)

type GroupHandler struct {
	db *gorm.DB
}

func NewGroupHandler(db *gorm.DB) *GroupHandler {
	return &GroupHandler{db: db}
}

func canManageGroups(role string) bool {
	r := strings.ToLower(strings.TrimSpace(role))
	return r == "doctor" || r == "admin" || r == "super_admin"
}

func canManageGroupByRole(role string, callerID uint, g model.Group) bool {
	r := strings.ToLower(strings.TrimSpace(role))
	if r == "admin" || r == "super_admin" {
		return true
	}
	if r == "doctor" {
		return g.CreatedBy == callerID
	}
	return false
}

// /api/v1/groups (GET, POST)
func (h *GroupHandler) HandleRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.List(w, r)
		return
	}
	if r.Method == http.MethodPost {
		h.Create(w, r)
		return
	}
	http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
}

// GET /api/v1/groups - manage roles көре алады
func (h *GroupHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if userID == 0 || !canManageGroups(role) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var groups []model.Group
	if strings.EqualFold(role, "doctor") {
		// Doctor: өзі құрған немесе өзі member (doctor role)
		if err := h.db.Raw(`
			SELECT DISTINCT g.*
			FROM groups g
			LEFT JOIN group_members gm ON gm.group_id = g.id
			WHERE g.created_by = ? OR gm.user_id = ?
			ORDER BY g.created_at DESC
		`, userID, userID).Scan(&groups).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	} else {
		// Admin/Super: бәрін көреді
		if err := h.db.Order("created_at DESC").Find(&groups).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	}

	_ = json.NewEncoder(w).Encode(groups)
}

// GET /api/v1/groups/my - кез келген кірген user үшін
func (h *GroupHandler) ListMy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	type row struct {
		model.Group
		LastMessageID uint   `json:"last_message_id"`
		LastMessage   string `json:"last_message"`
		UnreadCount   int64  `json:"unread_count"`
	}
	var groups []row
	if err := h.db.Raw(`
		SELECT
			g.*,
			COALESCE((
				SELECT id FROM group_messages
				WHERE group_id = g.id
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			), 0) AS last_message_id,
			COALESCE((
				SELECT body FROM group_messages
				WHERE group_id = g.id
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			), '') AS last_message
		FROM groups g
		INNER JOIN group_members gm ON gm.group_id = g.id
		WHERE gm.user_id = ?
		ORDER BY g.created_at DESC
	`, userID).Scan(&groups).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	for i := range groups {
		var lastSeen uint
		_ = h.db.Model(&model.GroupChatRead{}).
			Select("last_message_id").
			Where("user_id = ? AND group_id = ?", userID, groups[i].ID).
			Scan(&lastSeen).Error
		var c int64
		_ = h.db.Model(&model.GroupMessage{}).
			Where("group_id = ? AND id > ? AND sender_id <> ?", groups[i].ID, lastSeen, userID).
			Count(&c).Error
		groups[i].UnreadCount = c
	}
	_ = json.NewEncoder(w).Encode(groups)
}

// GET /api/v1/groups/candidates?role=patient
// doctor/admin/super_admin үшін топқа қоса алатын қолданушылар тізімі.
func (h *GroupHandler) ListCandidates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))
	if userID == 0 || !canManageGroups(role) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	targetRole := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("role")))
	if targetRole == "" {
		targetRole = "patient"
	}

	var users []model.User
	if role == "doctor" && targetRole == "patient" {
		// doctor тек өз appointment пациенттерін көреді
		if err := h.db.Raw(`
			SELECT DISTINCT u.*
			FROM users u
			INNER JOIN appointments a ON a.patient_id = u.id
			WHERE a.doctor_user_id = ? AND u.role = 'patient'
			ORDER BY u.full_name ASC
		`, userID).Scan(&users).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	} else {
		allowed := map[string]bool{
			"patient":   true,
			"doctor":    true,
			"volunteer": true,
			"admin":     true,
		}
		if !allowed[targetRole] {
			http.Error(w, "role қате", http.StatusBadRequest)
			return
		}
		if err := h.db.Where("role = ?", targetRole).Order("full_name ASC").Find(&users).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	}

	for i := range users {
		users[i].Password = ""
	}
	_ = json.NewEncoder(w).Encode(users)
}

// POST /api/v1/groups
func (h *GroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if userID == 0 || !canManageGroups(role) {
		http.Error(w, "Тек doctor/admin/super_admin топ құра алады", http.StatusForbidden)
		return
	}

	var req struct {
		Name          string `json:"name"`
		Description   string `json:"description"`
		DiagnosisType string `json:"diagnosis_type"`
		PhotoURL      string `json:"photo_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name қажет", http.StatusBadRequest)
		return
	}
	if len(req.Name) > 180 {
		http.Error(w, "name тым ұзын", http.StatusBadRequest)
		return
	}

	g := model.Group{
		Name:          req.Name,
		Description:   strings.TrimSpace(req.Description),
		DiagnosisType: strings.TrimSpace(req.DiagnosisType),
		PhotoURL:      strings.TrimSpace(req.PhotoURL),
		CreatedBy:     userID,
	}
	if err := h.db.Create(&g).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// creator-ды member қылып қосамыз
	_ = h.db.Create(&model.GroupMember{
		GroupID:     g.ID,
		UserID:      userID,
		RoleInGroup: strings.ToLower(strings.TrimSpace(role)),
	}).Error

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(g)
}

// /api/v1/groups/:id (PUT)
// /api/v1/groups/:id/members (GET, POST, DELETE)
// /api/v1/groups/:id/messages (GET, POST)
func (h *GroupHandler) HandleWithID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/groups/")
	path = strings.Trim(path, "/")
	parts := strings.Split(path, "/")
	groupID, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil || groupID == 0 {
		http.Error(w, "Invalid group id", http.StatusBadRequest)
		return
	}
	if len(parts) == 1 {
		if r.Method == http.MethodPut {
			h.Update(w, r, uint(groupID))
			return
		}
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if len(parts) < 2 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	resource := parts[1]

	switch resource {
	case "members":
		if r.Method == http.MethodGet {
			h.ListMembers(w, r, uint(groupID))
			return
		}
		if r.Method == http.MethodPost {
			h.AddMember(w, r, uint(groupID))
			return
		}
		// /api/v1/groups/:id/members/:userId (DELETE)
		if r.Method == http.MethodDelete && len(parts) >= 3 {
			targetUserID, err2 := strconv.ParseUint(parts[2], 10, 32)
			if err2 != nil || targetUserID == 0 {
				http.Error(w, "Invalid user id", http.StatusBadRequest)
				return
			}
			h.RemoveMember(w, r, uint(groupID), uint(targetUserID))
			return
		}
	case "messages":
		if r.Method == http.MethodGet {
			h.ListMessages(w, r, uint(groupID))
			return
		}
		if r.Method == http.MethodPost {
			h.SendMessage(w, r, uint(groupID))
			return
		}
	}
	http.Error(w, "Not found", http.StatusNotFound)
}

func (h *GroupHandler) Update(w http.ResponseWriter, r *http.Request, groupID uint) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if userID == 0 || !canManageGroups(role) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var g model.Group
	if err := h.db.First(&g, groupID).Error; err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}
	if !canManageGroupByRole(role, userID, g) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Name          string `json:"name"`
		Description   string `json:"description"`
		DiagnosisType string `json:"diagnosis_type"`
		PhotoURL      string `json:"photo_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		http.Error(w, "name қажет", http.StatusBadRequest)
		return
	}
	if len(name) > 180 {
		http.Error(w, "name тым ұзын", http.StatusBadRequest)
		return
	}

	g.Name = name
	g.Description = strings.TrimSpace(req.Description)
	g.DiagnosisType = strings.TrimSpace(req.DiagnosisType)
	if strings.TrimSpace(req.PhotoURL) != "" {
		g.PhotoURL = strings.TrimSpace(req.PhotoURL)
	}
	if err := h.db.Save(&g).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(g)
}

func (h *GroupHandler) ListMembers(w http.ResponseWriter, r *http.Request, groupID uint) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !h.isGroupMember(groupID, userID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	type row struct {
		UserID      uint   `json:"user_id"`
		FullName    string `json:"full_name"`
		Role        string `json:"role"`
		RoleInGroup string `json:"role_in_group"`
	}
	var rows []row
	if err := h.db.Raw(`
		SELECT gm.user_id, u.full_name, u.role, gm.role_in_group
		FROM group_members gm
		INNER JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = ?
		ORDER BY gm.joined_at ASC, gm.id ASC
	`, groupID).Scan(&rows).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(rows)
}

func (h *GroupHandler) AddMember(w http.ResponseWriter, r *http.Request, groupID uint) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if userID == 0 || !canManageGroups(role) {
		http.Error(w, "Тек doctor/admin/super_admin member қоса алады", http.StatusForbidden)
		return
	}

	var g model.Group
	if err := h.db.First(&g, groupID).Error; err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Doctor тек өзі құрған топқа қоса алады; admin/super кез келген топқа.
	if !canManageGroupByRole(role, userID, g) {
		http.Error(w, "Бұл топқа member қосуға рұқсат жоқ", http.StatusForbidden)
		return
	}

	var req struct {
		UserID      uint   `json:"user_id"`
		RoleInGroup string `json:"role_in_group"` // patient|doctor|volunteer
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	if req.UserID == 0 {
		http.Error(w, "user_id қажет", http.StatusBadRequest)
		return
	}
	req.RoleInGroup = strings.ToLower(strings.TrimSpace(req.RoleInGroup))
	if req.RoleInGroup == "" {
		req.RoleInGroup = "patient"
	}
	switch req.RoleInGroup {
	case "patient", "doctor", "volunteer":
	default:
		http.Error(w, "role_in_group қате", http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.First(&u, req.UserID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Қатаң шектеу: doctor тек өзіне тіркелген пациенттерді ғана қоса алады.
	if strings.EqualFold(role, "doctor") {
		if req.RoleInGroup != "patient" || !strings.EqualFold(u.Role, "patient") {
			http.Error(w, "Doctor тек patient рөліндегі қолданушыны қоса алады", http.StatusForbidden)
			return
		}
		var c int64
		if err := h.db.Model(&model.Appointment{}).
			Where("doctor_user_id = ? AND patient_id = ?", userID, req.UserID).
			Count(&c).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
		if c == 0 {
			http.Error(w, "Бұл пациент дәрігерге тіркелмеген", http.StatusForbidden)
			return
		}
	}

	var existing model.GroupMember
	if err := h.db.Where("group_id = ? AND user_id = ?", groupID, req.UserID).First(&existing).Error; err == nil {
		// already member болса role update
		existing.RoleInGroup = req.RoleInGroup
		if err := h.db.Save(&existing).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(existing)
		return
	}

	member := model.GroupMember{
		GroupID:     groupID,
		UserID:      req.UserID,
		RoleInGroup: req.RoleInGroup,
	}
	if err := h.db.Create(&member).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(member)
}

// /api/v1/groups/:id/members/:userId (DELETE)
// топтан member-ді шығару (kick/remove)
func (h *GroupHandler) RemoveMember(w http.ResponseWriter, r *http.Request, groupID uint, targetUserID uint) {
	w.Header().Set("Content-Type", "application/json")
	callerID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if callerID == 0 || !canManageGroups(role) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if targetUserID == 0 {
		http.Error(w, "Invalid user id", http.StatusBadRequest)
		return
	}

	// who can manage by role over this specific group
	var g model.Group
	if err := h.db.First(&g, groupID).Error; err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}
	if !canManageGroupByRole(role, callerID, g) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if targetUserID == callerID {
		http.Error(w, "Өзіңізді шығара алмайсыз", http.StatusForbidden)
		return
	}
	if !h.isGroupMember(groupID, targetUserID) {
		http.Error(w, "Member not found", http.StatusNotFound)
		return
	}

	if err := h.db.Where("group_id = ? AND user_id = ?", groupID, targetUserID).Delete(&model.GroupMember{}).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok": true,
	})
}

func (h *GroupHandler) isGroupMember(groupID, userID uint) bool {
	var c int64
	_ = h.db.Model(&model.GroupMember{}).Where("group_id = ? AND user_id = ?", groupID, userID).Count(&c).Error
	return c > 0
}

func (h *GroupHandler) ListMessages(w http.ResponseWriter, r *http.Request, groupID uint) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !h.isGroupMember(groupID, userID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var list []model.GroupMessage
	if err := h.db.Preload("SenderUser").Where("group_id = ?", groupID).Order("created_at ASC").Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// mark as seen
	var lastSeenID uint
	var lastSeenAt time.Time
	if len(list) > 0 {
		lastID := list[len(list)-1].ID
		var read model.GroupChatRead
		if err := h.db.Where("user_id = ? AND group_id = ?", userID, groupID).First(&read).Error; err != nil {
			read = model.GroupChatRead{
				UserID:        userID,
				GroupID:       groupID,
				LastMessageID: lastID,
			}
			_ = h.db.Create(&read).Error
		} else if read.LastMessageID < lastID {
			read.LastMessageID = lastID
			_ = h.db.Save(&read).Error
		}
		lastSeenID = read.LastMessageID
		lastSeenAt = read.UpdatedAt
	}

		// Readers for each message:
	// If a user has last_message_id >= message.ID, then that user has read that message.
	// We also include updated_at as "read_at".
	var groupReads []model.GroupChatRead
	_ = h.db.Where("group_id = ?", groupID).Find(&groupReads).Error
	readUserIDs := make([]uint, 0, len(groupReads))
	seenUID := make(map[uint]struct{}, len(groupReads))
	for _, gr := range groupReads {
		if gr.UserID == 0 {
			continue
		}
		if _, ok := seenUID[gr.UserID]; ok {
			continue
		}
		seenUID[gr.UserID] = struct{}{}
		readUserIDs = append(readUserIDs, gr.UserID)
	}
	userNameByID := make(map[uint]string, len(readUserIDs))
	if len(readUserIDs) > 0 {
		var users []model.User
		if err := h.db.Where("id IN ?", readUserIDs).Find(&users).Error; err == nil {
			for _, u := range users {
				userNameByID[u.ID] = u.FullName
			}
		}
	}

	out := make([]map[string]any, 0, len(list))
	for _, m := range list {
		item := map[string]any{
			"id":           m.ID,
			"group_id":     m.GroupID,
			"sender_id":    m.SenderID,
			"sender_name":  m.SenderUser.FullName,
			"body":         m.Body,
			"is_system":    m.IsSystem,
			"created_at":   m.CreatedAt,
			"is_read":      false,
			"read_at":      nil,
		}
		if !lastSeenAt.IsZero() && m.ID <= lastSeenID {
			item["is_read"] = true
			item["read_at"] = lastSeenAt
		}

		// Who read this message (names + read time).
		readers := make([]map[string]any, 0)
		for _, gr := range groupReads {
			if gr.LastMessageID >= m.ID && gr.UserID != 0 {
				if full := userNameByID[gr.UserID]; full != "" {
					readers = append(readers, map[string]any{
						"user_id":    gr.UserID,
						"full_name":  full,
						"read_at":    gr.UpdatedAt,
						"read_by_me": gr.UserID == userID,
					})
				}
			}
		}
		if len(readers) > 0 {
			item["readers"] = readers
		} else {
			item["readers"] = []map[string]any{}
		}

		out = append(out, item)
	}
	_ = json.NewEncoder(w).Encode(out)
}

func (h *GroupHandler) SendMessage(w http.ResponseWriter, r *http.Request, groupID uint) {
	w.Header().Set("Content-Type", "application/json")
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !h.isGroupMember(groupID, userID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
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

	msg := model.GroupMessage{
		GroupID:  groupID,
		SenderID: userID,
		Body:     req.Body,
	}
	if err := h.db.Create(&msg).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(msg)
}

