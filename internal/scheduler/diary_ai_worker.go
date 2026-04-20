package scheduler

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/ai"
	"janymda/internal/model"
	"janymda/internal/scoring"
)

func truncateErr(msg string, maxLen int) string {
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return msg
	}
	if len(msg) > maxLen {
		return msg[:maxLen]
	}
	return msg
}

// RunDiaryAiRetryWorker retries Claude assessments for diary entries with ai_status="error"
// after ai_retry_at (default 24 hours from the last attempt).
func RunDiaryAiRetryWorker(db *gorm.DB) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	maxAttempts := 10
	if v := strings.TrimSpace(os.Getenv("AI_DIARY_MAX_RETRIES")); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 {
			maxAttempts = n
		}
	}

	// Use 24h delay unless overridden.
	retryDelay := 24 * time.Hour
	if v := strings.TrimSpace(os.Getenv("AI_DIARY_RETRY_DELAY_HOURS")); v != "" {
		// best-effort: hours -> duration
		// (keep it simple to avoid extra deps)
		// If parsing fails, fall back to default.
		if n, err := parseInt(v); err == nil && n > 0 {
			retryDelay = time.Duration(n) * time.Hour
		}
	}

	for range ticker.C {
		now := time.Now().UTC()

		// For existing rows that are already error but have no ai_retry_at, set it to now+24h.
		_ = db.Model(&model.DiaryEntry{}).
			Where("ai_status = ? AND ai_retry_at IS NULL", "error").
			Update("ai_retry_at", now.Add(retryDelay)).
			Error

		var entries []model.DiaryEntry
		if err := db.
			Where("ai_status = ? AND ai_retry_at <= ? AND text <> ''", "error", now).
			Order("created_at DESC").
			Limit(5).
			Find(&entries).Error; err != nil {
			log.Printf("[diary_ai_retry] list err: %v", err)
			continue
		}

		for _, e := range entries {
			// Respect max attempts.
			if e.AiAttempts >= maxAttempts {
				continue
			}

			assessedAt := now
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			assessment, err := ai.AssessDiaryText(ctx, e.Text)
			cancel()

			if err == nil {
				zone := assessment.Zone
				status := "ready"
				score := assessment.Score
				urgent := assessment.Urgent

				keySignalsJSON, _ := json.Marshal(assessment.KeySignals)
				keySignalsStr := string(keySignalsJSON)

				e.AiStatus = &status
				e.AiScore = &score
				e.AiZone = &zone
				e.AiKeySignals = &keySignalsStr
				e.AiReasoning = &assessment.Reasoning
				e.AiUrgent = &urgent
				e.AiAssessedAt = &assessedAt
				e.AiError = nil

				e.AiAttempts = e.AiAttempts + 1
				e.AiLastAttemptAt = &assessedAt
				e.AiRetryAt = nil

				if err2 := db.Save(&e).Error; err2 != nil {
					log.Printf("[diary_ai_retry] save success err: %v", err2)
				}
				if zone == "yellow" || zone == "red" {
					createPsychCaseFromRetry(db, e, score, zone)
				}
				scoring.RecalcPatientScore(db, e.UserID)
				continue
			}

			// Error -> schedule next retry.
			status := "error"
			msg := truncateErr(err.Error(), 500)
			retryAt := assessedAt.Add(retryDelay)

			e.AiStatus = &status
			e.AiError = &msg
			e.AiAttempts = e.AiAttempts + 1
			e.AiLastAttemptAt = &assessedAt
			e.AiAssessedAt = nil
			e.AiRetryAt = &retryAt

			if err2 := db.Save(&e).Error; err2 != nil {
				log.Printf("[diary_ai_retry] save error err: %v", err2)
			}
		}
	}
}

func parseInt(s string) (int, error) {
	// minimal int parser for env var
	var n int
	sign := 1
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, strconvErr("empty")
	}
	if s[0] == '-' {
		sign = -1
		s = s[1:]
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < '0' || c > '9' {
			return 0, strconvErr("not a number")
		}
		n = n*10 + int(c-'0')
	}
	return n * sign, nil
}

type strconvErr string

func (e strconvErr) Error() string { return string(e) }

func createPsychCaseFromRetry(db *gorm.DB, entry model.DiaryEntry, score int, zone string) {
	entryID := entry.ID
	pc := model.PsychCase{
		PatientID:    entry.UserID,
		DiaryEntryID: &entryID,
		SourceType:   "diary",
		Zone:         zone,
		Status:       "open",
		AiScore:      score,
		AiZone:       zone,
	}
	if zone == "yellow" {
		pc.AnonymousText = entry.Text
	}
	if err := db.Create(&pc).Error; err != nil {
		log.Printf("[diary_ai_retry] failed to create psych case for diary=%d: %v", entry.ID, err)
	}
}

