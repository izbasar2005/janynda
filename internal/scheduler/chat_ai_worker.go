package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/ai"
	"janymda/internal/model"
	"janymda/internal/scoring"
)

// RunChatAiWorker periodically scans for new patient messages in group and
// direct chats, batches them per patient, sends to Claude, and creates
// PsychCases when yellow/red zones are detected.
func RunChatAiWorker(db *gorm.DB) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		processChatMessages(db)
	}
}

func processChatMessages(db *gorm.DB) {
	var patients []model.User
	if err := db.Where("role = ?", "patient").Find(&patients).Error; err != nil {
		log.Printf("[chat_ai] failed to list patients: %v", err)
		return
	}

	for _, p := range patients {
		if err := processPatientMessages(db, p.ID); err != nil {
			log.Printf("[chat_ai] patient=%d err: %v", p.ID, err)
		}
	}
}

func processPatientMessages(db *gorm.DB, patientID uint) error {
	var checkpoint model.ChatAiCheckpoint
	if err := db.Where("patient_id = ?", patientID).First(&checkpoint).Error; err != nil {
		checkpoint = model.ChatAiCheckpoint{
			PatientID:       patientID,
			LastGroupMsgID:  0,
			LastDirectMsgID: 0,
		}
	}

	var groupMsgs []model.GroupMessage
	db.Where("sender_id = ? AND id > ? AND is_system = false", patientID, checkpoint.LastGroupMsgID).
		Order("id ASC").
		Limit(100).
		Find(&groupMsgs)

	var directMsgs []model.DirectMessage
	db.Where("sender_user_id = ? AND id > ?", patientID, checkpoint.LastDirectMsgID).
		Order("id ASC").
		Limit(100).
		Find(&directMsgs)

	if len(groupMsgs) == 0 && len(directMsgs) == 0 {
		return nil
	}

	var sb strings.Builder
	var maxGroupID, maxDirectID uint
	sourceType := "mixed"

	if len(groupMsgs) > 0 && len(directMsgs) == 0 {
		sourceType = "group"
	} else if len(groupMsgs) == 0 && len(directMsgs) > 0 {
		sourceType = "direct"
	}

	for _, m := range groupMsgs {
		body := strings.TrimSpace(m.Body)
		if body != "" {
			sb.WriteString(fmt.Sprintf("[%s] %s\n", m.CreatedAt.Format("2006-01-02 15:04"), body))
		}
		if m.ID > maxGroupID {
			maxGroupID = m.ID
		}
	}
	for _, m := range directMsgs {
		body := strings.TrimSpace(m.Body)
		if body != "" {
			sb.WriteString(fmt.Sprintf("[%s] %s\n", m.CreatedAt.Format("2006-01-02 15:04"), body))
		}
		if m.ID > maxDirectID {
			maxDirectID = m.ID
		}
	}

	batchText := strings.TrimSpace(sb.String())
	if batchText == "" {
		updateCheckpoint(db, &checkpoint, maxGroupID, maxDirectID)
		return nil
	}

	msgCount := len(groupMsgs) + len(directMsgs)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	assessment, err := ai.AssessChatText(ctx, batchText)
	cancel()

	now := time.Now().UTC()

	if err != nil {
		log.Printf("[chat_ai] patient=%d assessment error: %v", patientID, err)
		errMsg := err.Error()
		if len(errMsg) > 500 {
			errMsg = errMsg[:500]
		}
		ca := model.ChatAiAssessment{
			PatientID:  patientID,
			Score:      0,
			Zone:       "unknown",
			SourceType: sourceType,
			MsgCount:   msgCount,
			Status:     "error",
			Error:      &errMsg,
			Attempts:   1,
			AssessedAt: now,
		}
		db.Create(&ca)
		updateCheckpoint(db, &checkpoint, maxGroupID, maxDirectID)
		return fmt.Errorf("ai assessment: %w", err)
	}

	keySignalsJSON, _ := json.Marshal(assessment.KeySignals)
	keySignalsStr := string(keySignalsJSON)

	ca := model.ChatAiAssessment{
		PatientID:  patientID,
		Score:      assessment.Score,
		Zone:       assessment.Zone,
		KeySignals: &keySignalsStr,
		Reasoning:  &assessment.Reasoning,
		Urgent:     assessment.Urgent,
		SourceType: sourceType,
		MsgCount:   msgCount,
		Status:     "ready",
		Attempts:   1,
		AssessedAt: now,
	}
	if err := db.Create(&ca).Error; err != nil {
		return fmt.Errorf("save chat assessment: %w", err)
	}

	if assessment.Zone == "yellow" || assessment.Zone == "red" {
		createChatPsychCase(db, ca, batchText)
	}

	scoring.RecalcPatientScore(db, patientID)

	updateCheckpoint(db, &checkpoint, maxGroupID, maxDirectID)
	log.Printf("[chat_ai] patient=%d score=%d zone=%s msgs=%d", patientID, assessment.Score, assessment.Zone, msgCount)
	return nil
}

func updateCheckpoint(db *gorm.DB, cp *model.ChatAiCheckpoint, maxGroupID, maxDirectID uint) {
	if maxGroupID > cp.LastGroupMsgID {
		cp.LastGroupMsgID = maxGroupID
	}
	if maxDirectID > cp.LastDirectMsgID {
		cp.LastDirectMsgID = maxDirectID
	}
	cp.LastCheckedAt = time.Now().UTC()

	if cp.ID == 0 {
		db.Create(cp)
	} else {
		db.Save(cp)
	}
}

func createChatPsychCase(db *gorm.DB, ca model.ChatAiAssessment, batchText string) {
	pc := model.PsychCase{
		PatientID:        ca.PatientID,
		ChatAssessmentID: &ca.ID,
		SourceType:       "chat",
		Zone:             ca.Zone,
		Status:           "open",
		AiScore:          ca.Score,
		AiZone:           ca.Zone,
	}
	if ca.Zone == "yellow" {
		if len(batchText) > 4000 {
			batchText = batchText[:4000]
		}
		pc.AnonymousText = batchText
	}
	if err := db.Create(&pc).Error; err != nil {
		log.Printf("[chat_ai] failed to create psych case for patient=%d assessment=%d: %v", ca.PatientID, ca.ID, err)
	}
}
