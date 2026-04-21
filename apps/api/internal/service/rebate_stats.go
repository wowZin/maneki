package service

import (
	"context"
	"time"

	"github.com/maneki/api/internal/repository"
)

// RebateStatsService 返佣统计服务
type RebateStatsService struct {
	recordRepo *repository.RebateRecordRepository
}

// NewRebateStatsService 创建返佣统计服务
func NewRebateStatsService(recordRepo *repository.RebateRecordRepository) *RebateStatsService {
	return &RebateStatsService{recordRepo: recordRepo}
}

// GetDashboardStats 获取看板统计
func (s *RebateStatsService) GetDashboardStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	return s.recordRepo.GetStats(ctx, startDate, endDate)
}

// GetTrend 获取趋势数据
func (s *RebateStatsService) GetTrend(ctx context.Context, groupBy string, startDate, endDate time.Time, agentID, creatorID uint) ([]map[string]interface{}, error) {
	return s.recordRepo.GetTrend(ctx, groupBy, startDate, endDate, agentID, creatorID)
}

// GetCreatorRanking 获取创作者排名
func (s *RebateStatsService) GetCreatorRanking(ctx context.Context, startDate, endDate time.Time, page, pageSize int) ([]map[string]interface{}, int64, error) {
	return s.recordRepo.GetCreatorRanking(ctx, startDate, endDate, page, pageSize)
}

// GetAgentStats 获取Agent统计
func (s *RebateStatsService) GetAgentStats(ctx context.Context, startDate, endDate time.Time, creatorID uint, page, pageSize int) ([]map[string]interface{}, int64, error) {
	return s.recordRepo.GetAgentStats(ctx, startDate, endDate, creatorID, page, pageSize)
}
