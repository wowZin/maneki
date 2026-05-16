package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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

	// 删除 min_visible_level >= 3 的脏数据
	result := db.Exec("DELETE FROM system_notifications WHERE min_visible_level >= 3")
	if result.Error != nil {
		log.Fatal("delete failed:", result.Error)
	}

	log.Printf("deleted %d dirty records", result.RowsAffected)
}
