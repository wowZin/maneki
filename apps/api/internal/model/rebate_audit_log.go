package model

import "time"

// RebateAuditConclusion 审核结论
type RebateAuditConclusion string

const (
	RebateAuditConclusionNormal    RebateAuditConclusion = "normal"
	RebateAuditConclusionArbitrage RebateAuditConclusion = "arbitrage"
)

// RebateAuditLog 返佣审核日志表
type RebateAuditLog struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time `json:"created_at"`
	RebateRecordID uint      `json:"rebate_record_id" gorm:"index;not null"`
	AdminID        uint      `json:"admin_id" gorm:"not null"`
	AdminName      string    `json:"admin_name" gorm:"size:64;not null"`
	Conclusion     RebateAuditConclusion `json:"conclusion" gorm:"size:16;not null"`
	Remark         string    `json:"remark" gorm:"type:text"`
}

func (RebateAuditLog) TableName() string {
	return "rebate_audit_logs"
}
