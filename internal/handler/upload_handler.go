package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler { return &UploadHandler{} }

// POST /api/v1/upload
// form-data: file=<image>
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// 10MB лимит
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "Invalid multipart form", http.StatusBadRequest)
		return
	}

	f, fh, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file not found", http.StatusBadRequest)
		return
	}
	defer f.Close()

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		http.Error(w, "Only jpg/jpeg/png/webp allowed", http.StatusBadRequest)
		return
	}

	// ./static/uploads папкасы
	dir := "./static/uploads"
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, "Cannot create upload dir", http.StatusInternalServerError)
		return
	}

	name := fmt.Sprintf("doc_%d%s", time.Now().UnixNano(), ext)
	dstPath := filepath.Join(dir, name)

	dst, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, "Cannot save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, f); err != nil {
		http.Error(w, "Cannot write file", http.StatusInternalServerError)
		return
	}

	// Браузерге ашылатын URL
	url := "/uploads/" + name

	_ = json.NewEncoder(w).Encode(map[string]string{
		"url": url,
	})
}
