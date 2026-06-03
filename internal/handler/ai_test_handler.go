package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"janymda/internal/ai"
)

type AITestHandler struct{}

func NewAITestHandler() *AITestHandler { return &AITestHandler{} }

// POST /api/v1/ai/test
// body: { "text": "..." }
// Requires AuthJWT (any logged-in user).
func (h *AITestHandler) Test(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, http.StatusBadRequest)
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		http.Error(w, `{"error":"text is required"}`, http.StatusBadRequest)
		return
	}
	if len(req.Text) > 4000 {
		http.Error(w, `{"error":"text too long"}`, http.StatusBadRequest)
		return
	}

	assessment, err := ai.AssessDiaryText(r.Context(), req.Text)
	if err != nil {
		// Return error details to make debugging env/model issues easy in dev.
		msg := err.Error()
		if len(msg) > 800 {
			msg = msg[:800]
		}
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":   "AI request failed",
			"details": msg,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":         true,
		"assessment": assessment,
	})
}

