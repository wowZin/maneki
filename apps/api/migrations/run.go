package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/maneki/api/internal/model"
)

func main() {
	_ = godotenv.Load(".env")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"), os.Getenv("DB_PORT"), os.Getenv("DB_SSLMODE"),
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatal("connect db failed:", err)
	}

	// Auto migrate
	if err := db.AutoMigrate(&model.UserLevel{}); err != nil {
		log.Fatal("migrate failed:", err)
	}

	// Seed data
	levels := []model.UserLevel{
		{Code: "free", Name: "普通用户", LevelValue: 0, Color: "default", SortOrder: 0},
		{Code: "vip", Name: "VIP", LevelValue: 1, Color: "blue", SortOrder: 1},
		{Code: "svip", Name: "SVIP", LevelValue: 2, Color: "purple", SortOrder: 2},
	}

	for _, l := range levels {
		var existing model.UserLevel
		result := db.Where("code = ?", l.Code).First(&existing)
		if result.Error != nil {
			if err := db.Create(&l).Error; err != nil {
				log.Printf("create level %s failed: %v", l.Code, err)
			} else {
				log.Printf("created level: %s", l.Code)
			}
		} else {
			log.Printf("level already exists: %s", l.Code)
		}
	}

	log.Println("migration done")
}
