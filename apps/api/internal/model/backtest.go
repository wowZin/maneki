package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// BacktestJob 回测任务表
type BacktestJob struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`

	UserID   uuid.UUID `json:"user_id" gorm:"type:uuid;index;not null"`
	AgentID  uint      `json:"agent_id" gorm:"index"`
	AgentType string   `json:"agent_type" gorm:"size:30;index"`
	Status   string    `json:"status" gorm:"size:20;default:'pending'"` // pending/running/completed/failed
	Params   JSON      `json:"params" gorm:"type:jsonb"`
	Progress int       `json:"progress" gorm:"default:0"`
	ErrorMsg string    `json:"error_msg,omitempty" gorm:"type:text"`

	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// TableName 指定表名
func (BacktestJob) TableName() string {
	return "backtest_jobs"
}

// BacktestParams 回测参数
 type BacktestParams struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

// BacktestResult 回测结果汇总表
type BacktestResult struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`

	JobID           uint    `json:"job_id" gorm:"unique;not null"`
	AgentID         uint    `json:"agent_id" gorm:"index"`
	TotalDays       int     `json:"total_days" gorm:"not null;default:0"`
	TotalSignals    int     `json:"total_signals" gorm:"not null;default:0"`
	TotalHit        int     `json:"total_hit" gorm:"not null;default:0"`
	TotalMiss       int     `json:"total_miss" gorm:"not null;default:0"`
	OverallHitRate  float64 `json:"overall_hit_rate" gorm:"type:decimal(5,4);default:0"`
}

// TableName 指定表名
func (BacktestResult) TableName() string {
	return "backtest_results"
}

// BacktestDayResult 回测按天结果表
type BacktestDayResult struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`

	ResultID     uint      `json:"result_id" gorm:"index;not null"`
	Date         time.Time `json:"date" gorm:"type:date;not null"`
	TotalSignals int       `json:"total_signals" gorm:"not null;default:0"`
	HitCount     int       `json:"hit_count" gorm:"not null;default:0"`
	MissCount    int       `json:"miss_count" gorm:"not null;default:0"`
	HitRate      float64         `json:"hit_rate" gorm:"type:decimal(5,4);default:0"`
	Details      json.RawMessage `json:"details" gorm:"type:jsonb"`
}

// TableName 指定表名
func (BacktestDayResult) TableName() string {
	return "backtest_day_results"
}

// BacktestDetailItem 回测详情单项（存储在 BacktestDayResult.Details JSON 中）
type BacktestDetailItem struct {
	StockCode string  `json:"stock_code"`
	StockName string  `json:"stock_name"`
	Decision  string  `json:"decision"`
	Score     float64 `json:"score,omitempty"`
	Reasoning string  `json:"reasoning,omitempty"`
	ActualHit bool    `json:"actual_hit"`
}
