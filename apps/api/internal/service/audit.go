package service

import (
	"context"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// AuditService 审计日志服务
type AuditService struct {
	auditRepo *repository.AuditLogRepository
}

// NewAuditService 创建审计日志服务
func NewAuditService(auditRepo *repository.AuditLogRepository) *AuditService {
	return &AuditService{auditRepo: auditRepo}
}

// AuditLogListResult 审计日志列表结果
type AuditLogListResult struct {
	List     []*model.AuditLog `json:"list"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
}

// ListAuditLogs 获取审计日志列表
func (s *AuditService) ListAuditLogs(ctx context.Context, startDate, endDate, adminName string, action model.AuditAction, page, pageSize int) (*AuditLogListResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := s.auditRepo.ListWithFilters(ctx, startDate, endDate, adminName, action, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to list audit logs: %w", err)
	}

	return &AuditLogListResult{
		List:     logs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// ExportAuditLogs 导出审计日志
func (s *AuditService) ExportAuditLogs(ctx context.Context, startDate, endDate, adminName string, action model.AuditAction) (string, error) {
	logs, err := s.auditRepo.Export(ctx, startDate, endDate, adminName, action, 10000)
	if err != nil {
		return "", fmt.Errorf("failed to export audit logs: %w", err)
	}

	var sb strings.Builder
	writer := csv.NewWriter(&sb)

	// 写入表头
	_ = writer.Write([]string{"ID", "AdminName", "Action", "TargetType", "TargetName", "Detail", "IPAddr", "CreatedAt"})

	// 写入数据
	for _, log := range logs {
		targetName := log.TargetName
		if targetName == "" {
			targetName = "-"
		}
		detail := log.Detail
		if detail == "" {
			detail = "-"
		}
		_ = writer.Write([]string{
			fmt.Sprintf("%d", log.ID),
			log.AdminName,
			string(log.Action),
			string(log.TargetType),
			targetName,
			detail,
			log.IPAddr,
			log.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	writer.Flush()
	return sb.String(), nil
}

// RecordAuditLog 记录审计日志
func (s *AuditService) RecordAuditLog(ctx context.Context, adminID uint64, adminName string, action model.AuditAction, targetType model.AuditTargetType, targetID *uint64, targetName string, detail string) error {
	log := &model.AuditLog{
		AdminID:    adminID,
		AdminName:  adminName,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		TargetName: targetName,
		Detail:     detail,
	}
	return s.auditRepo.Create(ctx, log)
}
