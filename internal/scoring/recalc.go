package scoring

import (
	"log"
	"math"
	"time"

	"gorm.io/gorm"

	"janymda/internal/model"
)

type scored struct {
	Score     int
	CreatedAt time.Time
}

// RecalcPatientScore recomputes the aggregated AI score for a patient
// using all diary and chat assessments from the last 30 days.
// Recent assessments are weighted more heavily.
func RecalcPatientScore(db *gorm.DB, patientID uint) {
	now := time.Now().UTC()
	since := now.AddDate(0, 0, -30)

	var diaryScores []scored
	db.Model(&model.DiaryEntry{}).
		Select("ai_score as score, created_at").
		Where("user_id = ? AND ai_status = 'ready' AND ai_score IS NOT NULL AND created_at >= ?", patientID, since).
		Order("created_at ASC").
		Scan(&diaryScores)

	var chatScores []scored
	db.Model(&model.ChatAiAssessment{}).
		Select("score, created_at").
		Where("patient_id = ? AND status = 'ready' AND created_at >= ?", patientID, since).
		Order("created_at ASC").
		Scan(&chatScores)

	all := make([]scored, 0, len(diaryScores)+len(chatScores))
	all = append(all, diaryScores...)
	all = append(all, chatScores...)

	if len(all) == 0 {
		return
	}

	sortByTime(all)

	// Weighted average: more recent scores get higher weight.
	// Weight = 1 + (30 - daysAgo) / 30, so oldest ~1.0, newest ~2.0.
	var weightedSum, totalWeight float64
	minScore, maxScore := 101, -1

	for _, s := range all {
		daysAgo := now.Sub(s.CreatedAt).Hours() / 24
		weight := 1.0 + (30.0-daysAgo)/30.0
		if weight < 0.5 {
			weight = 0.5
		}

		weightedSum += float64(s.Score) * weight
		totalWeight += weight

		if s.Score < minScore {
			minScore = s.Score
		}
		if s.Score > maxScore {
			maxScore = s.Score
		}
	}

	avgScore := int(math.Round(weightedSum / totalWeight))
	if avgScore < 0 {
		avgScore = 0
	}
	if avgScore > 100 {
		avgScore = 100
	}

	zone := "green"
	if avgScore < 60 {
		zone = "red"
	} else if avgScore < 80 {
		zone = "yellow"
	}

	trend := "stable"
	if len(all) >= 2 {
		mid := len(all) / 2
		firstHalfAvg := avgOf(all[:mid])
		secondHalfAvg := avgOf(all[mid:])
		diff := secondHalfAvg - firstHalfAvg
		if diff >= 5 {
			trend = "improving"
		} else if diff <= -5 {
			trend = "declining"
		}
	}

	var existing model.PatientAiScore
	if err := db.Where("patient_id = ?", patientID).First(&existing).Error; err != nil {
		rec := model.PatientAiScore{
			PatientID:  patientID,
			Score:      avgScore,
			Zone:       zone,
			DiaryCount: len(diaryScores),
			ChatCount:  len(chatScores),
			MinScore:   minScore,
			MaxScore:   maxScore,
			Trend:      trend,
			UpdatedAt:  now,
		}
		if err2 := db.Create(&rec).Error; err2 != nil {
			log.Printf("[scoring] create patient_ai_score patient=%d: %v", patientID, err2)
		}
		return
	}

	existing.Score = avgScore
	existing.Zone = zone
	existing.DiaryCount = len(diaryScores)
	existing.ChatCount = len(chatScores)
	existing.MinScore = minScore
	existing.MaxScore = maxScore
	existing.Trend = trend
	existing.UpdatedAt = now
	if err := db.Save(&existing).Error; err != nil {
		log.Printf("[scoring] update patient_ai_score patient=%d: %v", patientID, err)
	}
}

func avgOf(items []scored) float64 {
	if len(items) == 0 {
		return 0
	}
	sum := 0
	for _, s := range items {
		sum += s.Score
	}
	return float64(sum) / float64(len(items))
}

func sortByTime(items []scored) {
	for i := 1; i < len(items); i++ {
		key := items[i]
		j := i - 1
		for j >= 0 && items[j].CreatedAt.After(key.CreatedAt) {
			items[j+1] = items[j]
			j--
		}
		items[j+1] = key
	}
}
