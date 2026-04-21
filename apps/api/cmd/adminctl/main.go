package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	_ = godotenv.Load()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "create":
		createSuperAdmin()
	case "reset-password":
		resetSuperAdminPassword()
	default:
		fmt.Printf("Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: adminctl <command> [options]")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  create          Create a new super admin account")
	fmt.Println("  reset-password  Reset super admin password")
	fmt.Println("")
	fmt.Println("Options for create:")
	fmt.Println("  --name string     Admin account name (required)")
	fmt.Println("  --password string Admin password (required)")
	fmt.Println("")
	fmt.Println("Options for reset-password:")
	fmt.Println("  --name string     Admin account name (required)")
	fmt.Println("  --password string New password (required)")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  adminctl create --name superadmin --password YourStrongPassword")
	fmt.Println("  adminctl reset-password --name superadmin --password NewPassword")
}

func initDB() *gorm.DB {
	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	return db
}

func createSuperAdmin() {
	var name, password string
	fs := flag.NewFlagSet("create", flag.ExitOnError)
	fs.StringVar(&name, "name", "", "Admin account name")
	fs.StringVar(&password, "password", "", "Admin password")
	_ = fs.Parse(os.Args[2:])

	if name == "" || password == "" {
		fmt.Println("Error: --name and --password are required")
		fs.Usage()
		os.Exit(1)
	}

	db := initDB()
	adminRepo := repository.NewAdminRepository(db)

	ctx := db.Statement.Context
	if ctx == nil {
		ctx = db.Statement.Context
	}

	// 检查账户名称是否已存在
	exists, err := adminRepo.NameExists(nil, name)
	if err != nil {
		log.Fatalf("Failed to check admin existence: %v", err)
	}
	if exists {
		log.Fatalf("Admin account '%s' already exists", name)
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// 创建超级管理员
	admin := &model.Admin{
		Name:                name,
		PasswordHash:        string(hashedPassword),
		Role:                model.AdminRoleSuper,
		IsActive:            true,
		ForceChangePassword: false,
	}

	if err := adminRepo.Create(nil, admin); err != nil {
		log.Fatalf("Failed to create super admin: %v", err)
	}

	fmt.Printf("Super admin '%s' created successfully (ID: %d)\n", admin.Name, admin.ID)
}

func resetSuperAdminPassword() {
	var name, password string
	fs := flag.NewFlagSet("reset-password", flag.ExitOnError)
	fs.StringVar(&name, "name", "", "Admin account name")
	fs.StringVar(&password, "password", "", "New password")
	_ = fs.Parse(os.Args[2:])

	if name == "" || password == "" {
		fmt.Println("Error: --name and --password are required")
		fs.Usage()
		os.Exit(1)
	}

	db := initDB()
	adminRepo := repository.NewAdminRepository(db)

	// 查找管理员
	admin, err := adminRepo.GetByName(nil, name)
	if err != nil {
		log.Fatalf("Failed to find admin: %v", err)
	}
	if admin == nil {
		log.Fatalf("Admin account '%s' not found", name)
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// 更新密码
	admin.PasswordHash = string(hashedPassword)
	admin.ForceChangePassword = false
	if err := adminRepo.Update(nil, admin); err != nil {
		log.Fatalf("Failed to reset password: %v", err)
	}

	fmt.Printf("Password for admin '%s' has been reset successfully\n", admin.Name)
}
