package model

import "time"

// UserLevel 用户等级字典表
type UserLevel struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Code        string    `json:"code" gorm:"uniqueIndex;size:50"`
	Name        string    `json:"name" gorm:"size:50"`
	LevelValue  int       `json:"level_value" gorm:"uniqueIndex"`
	Color       string    `json:"color" gorm:"size:20;default:'default'"`
	SortOrder   int       `json:"sort_order" gorm:"default:0"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName 指定表名
func (UserLevel) TableName() string {
	return "user_levels"
}
