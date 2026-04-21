package model

import (
	"time"
)

// HotMoney 游资名录数据模型
type HotMoney struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	Name          string    `json:"name" gorm:"size:100;index;uniqueIndex:idx_hot_money_name"` // 游资名称
	Description   string    `json:"description" gorm:"type:text"`                               // 游资描述
	Organizations string    `json:"organizations" gorm:"type:text"`                             // 关联机构 JSON
	Source        string    `json:"source" gorm:"size:50;index"`                                // 数据来源
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (HotMoney) TableName() string {
	return "hot_money"
}

// ToResponse 转换为响应格式
func (h *HotMoney) ToResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":            h.ID,
		"name":          h.Name,
		"description":   h.Description,
		"organizations": h.Organizations,
		"source":        h.Source,
	}
}
