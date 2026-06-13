package handler

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"janymda/internal/middleware"
	"janymda/internal/sms"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler { return &UploadHandler{} }

func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		verifiedPhone := strings.TrimSpace(r.Header.Get("X-Verified-Phone"))
		if verifiedPhone == "" || !sms.IsPhoneVerified(verifiedPhone) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

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

	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	if cloudName != "" && apiKey != "" && apiSecret != "" {
		url, err := uploadToCloudinary(f, fh.Filename, cloudName, apiKey, apiSecret)
		if err != nil {
			fmt.Printf("[UPLOAD] Cloudinary error: %v\n", err)
			http.Error(w, "Upload failed", http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"url": url})
		return
	}

	// Fallback: local storage (for development)
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

	_ = json.NewEncoder(w).Encode(map[string]string{"url": "/uploads/" + name})
}

func uploadToCloudinary(file io.Reader, filename, cloudName, apiKey, apiSecret string) (string, error) {
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	folder := "janynda"

	params := map[string]string{
		"folder":    folder,
		"timestamp": timestamp,
	}
	signature := generateCloudinarySignature(params, apiSecret)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, file); err != nil {
		return "", err
	}

	writer.WriteField("api_key", apiKey)
	writer.WriteField("timestamp", timestamp)
	writer.WriteField("folder", folder)
	writer.WriteField("signature", signature)
	writer.Close()

	url := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", cloudName)
	resp, err := http.Post(url, writer.FormDataContentType(), &body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		SecureURL string `json:"secure_url"`
		Error     struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if result.Error.Message != "" {
		return "", fmt.Errorf("cloudinary: %s", result.Error.Message)
	}

	if result.SecureURL == "" {
		return "", fmt.Errorf("cloudinary: empty secure_url in response")
	}

	return result.SecureURL, nil
}

func generateCloudinarySignature(params map[string]string, apiSecret string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}

	toSign := strings.Join(parts, "&") + apiSecret
	hash := sha1.Sum([]byte(toSign))
	return hex.EncodeToString(hash[:])
}
