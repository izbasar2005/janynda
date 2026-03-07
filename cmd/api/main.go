package main

import (
	"fmt"
	"janymda/internal/model"
	"net/http"
	"os"

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

	router := server.NewRouter(db)

	fmt.Println("Server: http://localhost:" + port)
	http.ListenAndServe(":"+port, router)
}
