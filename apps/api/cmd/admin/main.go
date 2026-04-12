package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/model"
)

func main() {
	_ = godotenv.Load()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cfg := config.Load()
	db, err := initDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	command := os.Args[1]
	switch command {
	case "create":
		createAdmin(db)
	case "reset-password":
		resetPassword(db)
	case "list":
		listAdmins(db)
	case "set-admin":
		setAdmin(db, true)
	case "unset-admin":
		setAdmin(db, false)
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Maneki Admin CLI - 管理员用户管理工具")
	fmt.Println()
	fmt.Println("用法:")
	fmt.Println("  go run cmd/admin/main.go <命令>")
	fmt.Println()
	fmt.Println("命令:")
	fmt.Println("  create          创建新的 admin 用户")
	fmt.Println("  reset-password  重置 admin 用户密码")
	fmt.Println("  list            列出所有 admin 用户")
	fmt.Println("  set-admin       将普通用户设置为 admin")
	fmt.Println("  unset-admin     取消用户的 admin 权限")
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  go run cmd/admin/main.go create")
	fmt.Println("  go run cmd/admin/main.go reset-password")
	fmt.Println("  go run cmd/admin/main.go list")
}

// initDB 初始化数据库连接
func initDB(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	return db, nil
}

// createAdmin 创建新的 admin 用户
func createAdmin(db *gorm.DB) {
	fmt.Println("=== 创建 Admin 用户 ===")
	fmt.Println()

	reader := bufio.NewReader(os.Stdin)

	// 输入用户名
	fmt.Print("用户名: ")
	username, _ := reader.ReadString('\n')
	username = strings.TrimSpace(username)

	if username == "" {
		log.Fatal("用户名不能为空")
	}

	// 检查用户名是否已存在
	var existingUser model.User
	result := db.Where("username = ?", username).First(&existingUser)
	if result.Error == nil {
		log.Fatalf("用户名 '%s' 已存在", username)
	}

	// 输入邮箱
	fmt.Print("邮箱: ")
	email, _ := reader.ReadString('\n')
	email = strings.TrimSpace(email)

	if email == "" {
		log.Fatal("邮箱不能为空")
	}

	// 检查邮箱是否已存在
	result = db.Where("email = ?", email).First(&existingUser)
	if result.Error == nil {
		log.Fatalf("邮箱 '%s' 已存在", email)
	}

	// 输入密码
	fmt.Print("密码: ")
	password, err := readPassword()
	if err != nil {
		log.Fatalf("读取密码失败: %v", err)
	}
	fmt.Println()

	if len(password) < 6 {
		log.Fatal("密码长度至少为6位")
	}

	// 确认密码
	fmt.Print("确认密码: ")
	confirmPassword, err := readPassword()
	if err != nil {
		log.Fatalf("读取密码失败: %v", err)
	}
	fmt.Println()

	if password != confirmPassword {
		log.Fatal("两次输入的密码不一致")
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("密码加密失败: %v", err)
	}

	// 创建用户（包含密码）
	user := model.User{
		Username:       username,
		Email:          email,
		HashedPassword: string(hashedPassword),
		IsActive:       true,
		IsSuperuser:    true,
	}

	result = db.Create(&user)
	if result.Error != nil {
		log.Fatalf("创建用户失败: %v", result.Error)
	}

	fmt.Println()
	fmt.Printf("✅ Admin 用户 '%s' 创建成功!\n", username)
	fmt.Printf("   邮箱: %s\n", email)
	fmt.Printf("   超级管理员: 是\n")
}

// resetPassword 重置 admin 用户密码
func resetPassword(db *gorm.DB) {
	fmt.Println("=== 重置 Admin 密码 ===")
	fmt.Println()

	reader := bufio.NewReader(os.Stdin)

	// 输入用户名
	fmt.Print("用户名或邮箱: ")
	identifier, _ := reader.ReadString('\n')
	identifier = strings.TrimSpace(identifier)

	if identifier == "" {
		log.Fatal("用户名或邮箱不能为空")
	}

	// 查找用户
	var user model.User
	result := db.Where("username = ? OR email = ?", identifier, identifier).First(&user)
	if result.Error != nil {
		log.Fatalf("用户 '%s' 不存在", identifier)
	}

	// 确认是否为 admin
	if !user.IsSuperuser {
		fmt.Printf("⚠️  用户 '%s' 不是 admin，确定要重置密码吗？ (y/N): ", user.Username)
		confirm, _ := reader.ReadString('\n')
		confirm = strings.TrimSpace(strings.ToLower(confirm))
		if confirm != "y" && confirm != "yes" {
			fmt.Println("操作已取消")
			return
		}
	}

	// 输入新密码
	fmt.Print("新密码: ")
	password, err := readPassword()
	if err != nil {
		log.Fatalf("读取密码失败: %v", err)
	}
	fmt.Println()

	if len(password) < 6 {
		log.Fatal("密码长度至少为6位")
	}

	// 确认密码
	fmt.Print("确认密码: ")
	confirmPassword, err := readPassword()
	if err != nil {
		log.Fatalf("读取密码失败: %v", err)
	}
	fmt.Println()

	if password != confirmPassword {
		log.Fatal("两次输入的密码不一致")
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("密码加密失败: %v", err)
	}

	// 更新密码
	result = db.Model(&user).Update("hashed_password", string(hashedPassword))
	if result.Error != nil {
		log.Fatalf("重置密码失败: %v", result.Error)
	}

	fmt.Println()
	fmt.Printf("✅ 用户 '%s' 的密码已重置成功!\n", user.Username)
}

// listAdmins 列出所有 admin 用户
func listAdmins(db *gorm.DB) {
	fmt.Println("=== Admin 用户列表 ===")
	fmt.Println()

	var users []model.User
	result := db.Where("is_superuser = ?", true).Find(&users)
	if result.Error != nil {
		log.Fatalf("查询失败: %v", result.Error)
	}

	if len(users) == 0 {
		fmt.Println("暂无 admin 用户")
		return
	}

	fmt.Printf("%-5s %-20s %-30s %-10s %-20s\n", "序号", "用户名", "邮箱", "状态", "创建时间")
	fmt.Println(strings.Repeat("-", 90))

	for i, user := range users {
		status := "启用"
		if !user.IsActive {
			status = "禁用"
		}
		fmt.Printf("%-5d %-20s %-30s %-10s %-20s\n",
			i+1,
			user.Username,
			user.Email,
			status,
			user.CreatedAt.Format("2006-01-02 15:04"),
		)
	}

	fmt.Println()
	fmt.Printf("总计: %d 个 admin 用户\n", len(users))
}

// setAdmin 设置/取消用户 admin 权限
func setAdmin(db *gorm.DB, isAdmin bool) {
	action := "设置"
	if !isAdmin {
		action = "取消"
	}

	fmt.Printf("=== %s Admin 权限 ===\n", action)
	fmt.Println()

	reader := bufio.NewReader(os.Stdin)

	// 输入用户名
	fmt.Print("用户名或邮箱: ")
	identifier, _ := reader.ReadString('\n')
	identifier = strings.TrimSpace(identifier)

	if identifier == "" {
		log.Fatal("用户名或邮箱不能为空")
	}

	// 查找用户
	var user model.User
	result := db.Where("username = ? OR email = ?", identifier, identifier).First(&user)
	if result.Error != nil {
		log.Fatalf("用户 '%s' 不存在", identifier)
	}

	// 确认操作
	if isAdmin {
		if user.IsSuperuser {
			fmt.Printf("用户 '%s' 已经是 admin\n", user.Username)
			return
		}
	} else {
		if !user.IsSuperuser {
			fmt.Printf("用户 '%s' 已经不是 admin\n", user.Username)
			return
		}
	}

	// 更新权限
	result = db.Model(&user).Update("is_superuser", isAdmin)
	if result.Error != nil {
		log.Fatalf("操作失败: %v", result.Error)
	}

	fmt.Println()
	if isAdmin {
		fmt.Printf("✅ 用户 '%s' 已被设置为 admin\n", user.Username)
	} else {
		fmt.Printf("✅ 用户 '%s' 的 admin 权限已取消\n", user.Username)
	}
}

// readPassword 安全读取密码（隐藏输入）
func readPassword() (string, error) {
	bytePassword, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		return "", err
	}
	return string(bytePassword), nil
}
