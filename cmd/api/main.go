package main

import (
	"fmt"
	"janymda/internal/model"
	"net/http"
	"os"
	"strings"

	"janymda/internal/scheduler"
	"janymda/internal/seed"
	"janymda/internal/server"
	"janymda/internal/storage"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := storage.NewGormFromEnv()
	if err != nil {
		panic(err)
	}

	if err := db.AutoMigrate(&model.User{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Doctor{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Doctor{}, &model.Appointment{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.Review{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.PlatformFeedback{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.Notification{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.Conversation{}, &model.Message{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.News{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.DiaryEntry{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.Group{}, &model.GroupMember{}, &model.GroupMessage{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.GroupChatRead{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.DirectConversation{}, &model.DirectMessage{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.DirectChatRead{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.PsychCase{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.Referral{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.ChatAiCheckpoint{}, &model.ChatAiAssessment{}); err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&model.PatientAiScore{}); err != nil {
		panic(err)
	}

	autoSeed := strings.ToLower(strings.TrimSpace(os.Getenv("AUTO_SEED")))
	shouldSeed := autoSeed == "1" || autoSeed == "true" || autoSeed == "yes" || autoSeed == "on"
	if !shouldSeed {
		// Always seed on first run (completely empty DB).
		var c int64
		if err := db.Model(&model.User{}).Count(&c).Error; err == nil && c == 0 {
			shouldSeed = true
		}
	}
	if shouldSeed {
		if _, err := seed.SeedIfEmpty(db); err != nil {
			panic(err)
		}
	}

	router := server.NewRouter(db)

	go scheduler.RunNotificationWorker(db)
	go scheduler.RunDiaryAiRetryWorker(db)
	go scheduler.RunChatAiWorker(db)

	fmt.Println("Server: http://localhost:" + port)
	http.ListenAndServe(":"+port, router)
}
