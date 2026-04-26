package model

import (
	"time"

	"github.com/google/uuid"
)

// UserStockTracking 用户股票追踪表
type UserStockTracking struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;index:idx_user_track_date;not null"`
	StockCode string    `json:"stock_code" gorm:"size:20;index;not null"`
	TrackDate time.Time `json:"track_date" gorm:"type:date;index:idx_user_track_date;not null"`
	HitStatus *bool     `json:"hit_status,omitempty"`
	SignalID  *uint     `json:"signal_id,omitempty" gorm:"index"`
	CreatedAt time.Time `json:"created_at"`
}

func (UserStockTracking) TableName() string {
	return "user_stock_trackings"
}

// AgentPerformanceSnapshot Agent表现快照表
type AgentPerformanceSnapshot struct {
	ID                uint      `json:"id" gorm:"primaryKey"`
	AgentID           uint      `json:"agent_id" gorm:"index:idx_agent_period;not null"`
	PeriodType        string    `json:"period_type" gorm:"size:20;index:idx_agent_period;not null"`
	PeriodStart       time.Time `json:"period_start" gorm:"type:date;index:idx_agent_period;not null"`
	TotalPredictions  int       `json:"total_predictions" gorm:"not null;default:0"`
	HitCount          int       `json:"hit_count" gorm:"not null;default:0"`
	HitRate           float64   `json:"hit_rate" gorm:"type:decimal(5,4);not null;default:0"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (AgentPerformanceSnapshot) TableName() string {
	return "agent_performance_snapshots"
}

// HotStock 热门股票表
type HotStock struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	StockCode    string    `json:"stock_code" gorm:"size:20;index;not null"`
	HeatScore    float64   `json:"heat_score" gorm:"type:decimal(10,4);not null"`
	Rank         int       `json:"rank" gorm:"index;not null"`
	ChangePct    float64   `json:"change_pct" gorm:"type:decimal(6,2);not null"`
	Volume       float64   `json:"volume" gorm:"type:decimal(20,2);not null"`
	Price        float64   `json:"price" gorm:"type:decimal(10,4);not null;default:0"`
	CalculatedAt time.Time `json:"calculated_at" gorm:"not null"`
}

func (HotStock) TableName() string {
	return "hot_stocks"
}
